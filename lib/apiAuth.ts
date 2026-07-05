import { NextResponse } from "next/server";
import { getBusinessByIntakeApiKey } from "@/services/business";
import { processIntake } from "@/services/intakeService";
import { checkFeatureGate } from "@/services/subscriptionService";
import type { Business } from "@/types";
import type { LeadSource } from "@/config/constants";

/**
 * Shared infrastructure for every /api/v1/* route — all of them authenticate
 * the same way as POST /api/intake: a bearer token that's the business's own
 * intake API key (Settings > Website intake API). One key, one scope (full
 * access to that business's own data) — no per-route permissions yet.
 */

export const API_CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PATCH, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

export function getBearerToken(request: Request): string | null {
  const auth = request.headers.get("authorization");
  const match = auth?.match(/^Bearer\s+(.+)$/i);
  return match ? match[1].trim() : null;
}

function getClientIp(request: Request): string | null {
  const forwardedFor = request.headers.get("x-forwarded-for");
  if (forwardedFor) return forwardedFor.split(",")[0].trim();
  return request.headers.get("x-real-ip");
}

/** Resolves the calling business from the request's bearer token, or null if missing/invalid. */
export async function resolveBusinessFromBearer(request: Request): Promise<Business | null> {
  const token = getBearerToken(request);
  if (!token) return null;
  return getBusinessByIntakeApiKey(token);
}

export function unauthorized(): NextResponse {
  return NextResponse.json({ error: "Invalid or missing API key." }, { status: 401, headers: API_CORS_HEADERS });
}

/**
 * Gates the "read/manage your existing data" side of the public API — GET
 * /api/v1/leads, PATCH /api/v1/leads/:id, GET+POST /api/v1/estimates —
 * behind the Pro plan's `publicApi` feature. Returns a ready-to-return 403
 * NextResponse if this business's plan doesn't include it, or null if the
 * route should proceed. Deliberately NOT applied to POST /api/v1/leads or
 * /api/v1/webhooks/leads (identical handler, see handleLeadIntakeRequest) —
 * creating a lead is a basic inbound channel every plan gets, same tier as
 * POST /api/intake; gating creation there too would just push Free-plan
 * integrators onto the identical /api/v1/webhooks/leads route instead of
 * actually restricting anything.
 */
export async function requirePublicApiFeature(business: Business): Promise<NextResponse | null> {
  const allowed = await checkFeatureGate(business.id, "publicApi");
  if (allowed) return null;
  return NextResponse.json(
    { error: "The public API requires the Pro plan. Upgrade in Settings to enable it." },
    { status: 403, headers: API_CORS_HEADERS }
  );
}

/**
 * Shared adapter for every "create a Lead over HTTP" route — POST
 * /api/intake, /api/v1/webhooks/leads, and /api/v1/leads all funnel through
 * this, differing only in which leadSource gets recorded. Parses the
 * request, delegates to services/intakeService.ts's processIntake (the one
 * place validation/rate-limiting/spam-detection/lead-creation actually
 * happens), and maps the result to a Response.
 */
export async function handleLeadIntakeRequest(request: Request, source: LeadSource): Promise<NextResponse> {
  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ error: "Request body must be valid JSON." }, { status: 400, headers: API_CORS_HEADERS });
  }

  const outcome = await processIntake({
    apiKey: getBearerToken(request),
    payload,
    ip: getClientIp(request),
    userAgent: request.headers.get("user-agent"),
    source,
  });

  if (!outcome.ok) {
    const body: Record<string, unknown> = { error: outcome.error };
    if ("fields" in outcome && outcome.fields) body.fields = outcome.fields;
    return NextResponse.json(body, { status: outcome.status, headers: API_CORS_HEADERS });
  }

  return NextResponse.json(
    { success: true, leadId: outcome.leadId },
    { status: outcome.status, headers: API_CORS_HEADERS }
  );
}
