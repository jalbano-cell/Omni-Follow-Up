import { randomBytes } from "crypto";
import { createInquiry } from "@/services/airtable";
import { getBusinessByIntakeApiKey } from "@/services/business";
import { sendEmail } from "@/services/gmail";
import { decrypt } from "@/lib/crypto";
import { logAction, logIntakeAudit } from "@/lib/logger";
import type { Business } from "@/types";

/**
 * Business logic for POST /api/intake, kept out of the route handler so the
 * route is a thin HTTP adapter (parse request -> call this -> map result to
 * a status code). Every branch is audited via logIntakeAudit, independent of
 * whether the Airtable write itself succeeds, so a failed submission is
 * never silently lost.
 */

const MAX_LENGTHS = {
  name: 200,
  email: 254,
  phone: 40,
  company: 200,
  service: 200,
  message: 5000,
} as const;

export interface RawIntakePayload {
  name?: unknown;
  email?: unknown;
  phone?: unknown;
  company?: unknown;
  service?: unknown;
  message?: unknown;
  /** Honeypot — a hidden field real visitors never fill in; a non-empty value marks the submission as spam. */
  website?: unknown;
}

export interface IntakeRequest {
  apiKey: string | null;
  payload: unknown;
  ip: string | null;
  userAgent: string | null;
}

export type IntakeOutcome =
  | { ok: true; status: 201; id: string; inquiryId: string }
  | { ok: false; status: 400; error: string; fields?: string[] }
  | { ok: false; status: 401; error: string }
  | { ok: false; status: 429; error: string }
  | { ok: false; status: 502; error: string };

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Strips HTML tags and control characters, trims, and caps length. Keeps newlines (for `message`) unless told not to. */
function sanitizeText(value: unknown, maxLength: number, { multiline = false } = {}): string {
  if (typeof value !== "string") return "";
  let cleaned = value.replace(/<[^>]*>/g, "");
  cleaned = multiline ? cleaned.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, "") : cleaned.replace(/[\x00-\x1F\x7F]/g, " ");
  cleaned = cleaned.replace(/[ \t]+/g, " ").trim();
  return cleaned.slice(0, maxLength);
}

function generateInquiryId(): string {
  const stamp = Date.now().toString(36).toUpperCase();
  const rand = randomBytes(3).toString("hex").toUpperCase();
  return `INQ-${stamp}-${rand}`;
}

// In-memory sliding-window limiter, scoped per business+IP. Deliberately not
// backed by Airtable/Redis — it's a best-effort deterrent against a form
// being hammered, not a hard security boundary, and it resets on cold start /
// doesn't share state across concurrent serverless instances. Good enough
// for "protect against spam where practical"; revisit with a shared store
// (Upstash/Redis) if abuse ever gets past it.
const RATE_LIMIT_WINDOW_MS = 10 * 60 * 1000;
const RATE_LIMIT_MAX = 8;
const rateLimitHits = new Map<string, number[]>();

function isRateLimited(key: string): boolean {
  const now = Date.now();
  const hits = (rateLimitHits.get(key) ?? []).filter((t) => now - t < RATE_LIMIT_WINDOW_MS);
  hits.push(now);
  rateLimitHits.set(key, hits);
  return hits.length > RATE_LIMIT_MAX;
}

/** Best-effort notification to the business's own inbox — never blocks the submission from succeeding. */
async function sendIntakeNotificationEmail(
  business: Business,
  fields: { name: string; email: string; phone: string; company: string; service: string; message: string },
  submittedAt: string
): Promise<void> {
  if (!business.googleRefreshTokenEnc || !business.googleConnectedEmail) {
    logAction("intake.notify-skipped", { businessId: business.id, reason: "Gmail not connected" });
    return;
  }

  const lines = [
    `New website inquiry for ${business.businessName}`,
    "",
    `Name: ${fields.name}`,
    `Email: ${fields.email}`,
    fields.phone && `Phone: ${fields.phone}`,
    fields.company && `Company: ${fields.company}`,
    `Requested service: ${fields.service || "Not specified"}`,
    "",
    "Message:",
    fields.message,
    "",
    `Submitted: ${new Date(submittedAt).toLocaleString("en-US", { timeZone: "America/Toronto" })}`,
  ].filter((line): line is string => Boolean(line));

  try {
    await sendEmail({
      refreshToken: decrypt(business.googleRefreshTokenEnc),
      fromEmail: business.googleConnectedEmail,
      to: business.ownerEmail,
      subject: "New Website Inquiry",
      body: lines.join("\n"),
    });
  } catch (error) {
    logAction("intake.notify-failed", {
      businessId: business.id,
      error: error instanceof Error ? error.message : "unknown error",
    });
  }
}

export async function processIntake(request: IntakeRequest): Promise<IntakeOutcome> {
  const timestamp = new Date().toISOString();
  const { apiKey, ip, userAgent } = request;

  const business = apiKey ? await getBusinessByIntakeApiKey(apiKey) : null;
  if (!business) {
    await logIntakeAudit({ timestamp, businessId: null, ip, userAgent, source: "Website", result: "invalid_api_key" });
    return { ok: false, status: 401, error: "Invalid or missing API key." };
  }

  if (isRateLimited(`${business.id}:${ip ?? "unknown"}`)) {
    await logIntakeAudit({ timestamp, businessId: business.id, ip, userAgent, source: "Website", result: "rate_limited" });
    return { ok: false, status: 429, error: "Too many submissions. Please try again later." };
  }

  const raw = (request.payload ?? {}) as RawIntakePayload;

  // Honeypot: respond as if it succeeded (without creating anything) so a bot doesn't learn it was caught.
  if (typeof raw.website === "string" && raw.website.trim() !== "") {
    await logIntakeAudit({ timestamp, businessId: business.id, ip, userAgent, source: "Website", result: "spam_blocked" });
    return { ok: true, status: 201, id: "ignored", inquiryId: "ignored" };
  }

  const name = sanitizeText(raw.name, MAX_LENGTHS.name);
  const email = sanitizeText(raw.email, MAX_LENGTHS.email);
  const message = sanitizeText(raw.message, MAX_LENGTHS.message, { multiline: true });
  const phone = sanitizeText(raw.phone, MAX_LENGTHS.phone);
  const company = sanitizeText(raw.company, MAX_LENGTHS.company);
  const service = sanitizeText(raw.service, MAX_LENGTHS.service);

  const missingFields: string[] = [];
  if (!name) missingFields.push("name");
  if (!email || !EMAIL_RE.test(email)) missingFields.push("email");
  if (!message) missingFields.push("message");

  if (missingFields.length > 0) {
    await logIntakeAudit({
      timestamp,
      businessId: business.id,
      ip,
      userAgent,
      source: "Website",
      result: "validation_failed",
      detail: { missingFields },
    });
    return { ok: false, status: 400, error: "Missing or invalid required fields.", fields: missingFields };
  }

  const inquiryId = generateInquiryId();

  let createdId: string;
  try {
    const inquiry = await createInquiry(business.id, inquiryId, {
      name,
      email,
      phone,
      company,
      service,
      message,
      ipAddress: ip ?? undefined,
      userAgent: userAgent ?? undefined,
    });
    createdId = inquiry.id;
  } catch (error) {
    // The Airtable write is the one step that must not silently disappear on
    // failure — log the full sanitized payload (not just a summary) so the
    // submission is recoverable from Vercel's function logs even though it
    // never made it into the dashboard.
    await logIntakeAudit({
      timestamp,
      businessId: business.id,
      ip,
      userAgent,
      source: "Website",
      result: "airtable_failed",
      detail: {
        inquiryId,
        error: error instanceof Error ? error.message : "unknown error",
        payload: { name, email, phone, company, service, message },
      },
    });
    return { ok: false, status: 502, error: "Could not save your inquiry right now. Please try again shortly." };
  }

  logAction("intake.received", { businessId: business.id, inquiryId, email });
  await logIntakeAudit({ timestamp, businessId: business.id, ip, userAgent, source: "Website", result: "success", detail: { inquiryId } });

  // Best-effort — a failed notification email must never turn a saved inquiry into a failed response.
  await sendIntakeNotificationEmail(business, { name, email, phone, company, service, message }, timestamp);

  return { ok: true, status: 201, id: createdId, inquiryId };
}
