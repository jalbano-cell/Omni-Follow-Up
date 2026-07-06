import { getBusinessByIntakeApiKey } from "@/services/business";
import { createLeadFromSubmission } from "@/services/leadService";
import { logIntakeAudit, maskEmail, maskPhone } from "@/lib/logger";
import { rateLimit } from "@/lib/rateLimit";
import { DEFAULT_LEAD_SOURCE, type LeadSource } from "@/config/constants";

/**
 * HTTP-facing business logic for POST /api/intake, kept out of the route
 * handler so the route is a thin adapter (parse request -> call this -> map
 * result to a status code). This file owns validation/sanitization/rate
 * limiting/spam detection and the audit trail for the *request itself*;
 * everything about what a Lead's arrival should trigger (the database write,
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
  /** Which entry point this came through — POST /api/intake (the default) or the inbound webhook. Recorded on the Lead and in the audit trail. */
  source?: LeadSource;
}

export type IntakeOutcome =
  | { ok: true; status: 201; id: string; leadId: string }
  | { ok: false; status: 400; error: string; fields?: string[] }
  | { ok: false; status: 401; error: string }
  | { ok: false; status: 402; error: string }
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

// Per business+IP spam deterrent, via the shared in-memory limiter
// (lib/rateLimit.ts) — see that file for the best-effort/serverless caveats.
const RATE_LIMIT_WINDOW_MS = 10 * 60 * 1000;
const RATE_LIMIT_MAX = 8;

async function isRateLimited(key: string): Promise<boolean> {
  return (await rateLimit(`intake:${key}`, { max: RATE_LIMIT_MAX, windowMs: RATE_LIMIT_WINDOW_MS })).limited;
}

export async function processIntake(request: IntakeRequest): Promise<IntakeOutcome> {
  const timestamp = new Date().toISOString();
  const { apiKey, ip, userAgent } = request;
  const source = request.source ?? DEFAULT_LEAD_SOURCE;

  const business = apiKey ? await getBusinessByIntakeApiKey(apiKey) : null;
  if (!business) {
    await logIntakeAudit({ timestamp, businessId: null, ip, userAgent, source, result: "invalid_api_key" });
    return { ok: false, status: 401, error: "Invalid or missing API key." };
  }

  if (await isRateLimited(`${business.id}:${ip ?? "unknown"}`)) {
    await logIntakeAudit({ timestamp, businessId: business.id, ip, userAgent, source, result: "rate_limited" });
    return { ok: false, status: 429, error: "Too many submissions. Please try again later." };
  }

  const raw = (request.payload ?? {}) as RawIntakePayload;

  // Honeypot: respond as if it succeeded (without creating anything) so a bot doesn't learn it was caught.
  if (typeof raw.website === "string" && raw.website.trim() !== "") {
    await logIntakeAudit({ timestamp, businessId: business.id, ip, userAgent, source, result: "spam_blocked" });
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
      source,
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
      leadSource: source,
      ipAddress: ip ?? undefined,
      userAgent: userAgent ?? undefined,
    });
  } catch (error) {
    // The database write is the one step that must not silently disappear on
    // failure — log the full sanitized payload (not just a summary) so the
    // submission is recoverable from Vercel's function logs even though it
    // never made it into the dashboard.
    await logIntakeAudit({
      timestamp,
      businessId: business.id,
      ip,
      userAgent,
      source,
      result: "db_failed",
      detail: {
        error: error instanceof Error ? error.message : "unknown error",
        // Recovery aid, but direct identifiers are masked so a failed
        // submission isn't a harvestable email/phone sitting in log retention.
        payload: { name, email: maskEmail(email), phone: maskPhone(phone), company, requestedService, message },
      },
    });
    return { ok: false, status: 502, error: "Could not save your inquiry right now. Please try again shortly." };
  }

  await logIntakeAudit({
    timestamp,
    businessId: business.id,
    ip,
    userAgent,
    source,
    result: "success",
    detail: { leadId: lead.leadId },
  });

  return { ok: true, status: 201, id: lead.id, leadId: lead.leadId };
}
