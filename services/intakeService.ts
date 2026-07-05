import { getBusinessByIntakeApiKey } from "@/services/business";
import { createLeadFromSubmission } from "@/services/leadService";
import { logIntakeAudit } from "@/lib/logger";

/**
 * HTTP-facing business logic for POST /api/intake, kept out of the route
 * handler so the route is a thin adapter (parse request -> call this -> map
 * result to a status code). This file owns validation/sanitization/rate
 * limiting/spam detection and the audit trail for the *request itself*;
 * everything about what a Lead's arrival should trigger (Airtable write,
 * activity log, in-app notification, owner email) lives in
 * services/leadService.ts's createLeadFromSubmission, so future non-HTTP
 * entry points can reuse it without going through this file.
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
  | { ok: true; status: 201; id: string; leadId: string }
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
    return { ok: true, status: 201, id: "ignored", leadId: "ignored" };
  }

  const name = sanitizeText(raw.name, MAX_LENGTHS.name);
  const email = sanitizeText(raw.email, MAX_LENGTHS.email);
  const message = sanitizeText(raw.message, MAX_LENGTHS.message, { multiline: true });
  const phone = sanitizeText(raw.phone, MAX_LENGTHS.phone);
  const company = sanitizeText(raw.company, MAX_LENGTHS.company);
  const requestedService = sanitizeText(raw.service, MAX_LENGTHS.service);

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

  let lead;
  try {
    lead = await createLeadFromSubmission(business, {
      name,
      email,
      phone,
      company,
      requestedService,
      message,
      ipAddress: ip ?? undefined,
      userAgent: userAgent ?? undefined,
    });
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
        error: error instanceof Error ? error.message : "unknown error",
        payload: { name, email, phone, company, requestedService, message },
      },
    });
    return { ok: false, status: 502, error: "Could not save your inquiry right now. Please try again shortly." };
  }

  await logIntakeAudit({
    timestamp,
    businessId: business.id,
    ip,
    userAgent,
    source: "Website",
    result: "success",
    detail: { leadId: lead.leadId },
  });

  return { ok: true, status: 201, id: lead.id, leadId: lead.leadId };
}
