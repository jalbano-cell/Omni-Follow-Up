import { NextResponse } from "next/server";
import { processIntake } from "@/services/intakeService";

/**
 * Inbound lead webhook — a third-party system (a form builder, a phone
 * system, another CRM) POSTs a lead here directly. Same bearer-key auth,
 * validation, rate limiting, and Lead-creation pipeline as POST /api/intake
 * (see services/intakeService.ts) — the only difference is the recorded
 * leadSource ("Webhook" instead of "Website Form"), so this is a thin
 * wrapper, not a second implementation.
 */

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

function getClientIp(request: Request): string | null {
  const forwardedFor = request.headers.get("x-forwarded-for");
  if (forwardedFor) return forwardedFor.split(",")[0].trim();
  return request.headers.get("x-real-ip");
}

function getApiKey(request: Request): string | null {
  const auth = request.headers.get("authorization");
  const match = auth?.match(/^Bearer\s+(.+)$/i);
  return match ? match[1].trim() : null;
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS_HEADERS });
}

export async function POST(request: Request) {
  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ error: "Request body must be valid JSON." }, { status: 400, headers: CORS_HEADERS });
  }

  const outcome = await processIntake({
    apiKey: getApiKey(request),
    payload,
    ip: getClientIp(request),
    userAgent: request.headers.get("user-agent"),
    source: "Webhook",
  });

  if (!outcome.ok) {
    const body: Record<string, unknown> = { error: outcome.error };
    if ("fields" in outcome && outcome.fields) body.fields = outcome.fields;
    return NextResponse.json(body, { status: outcome.status, headers: CORS_HEADERS });
  }

  return NextResponse.json(
    { success: true, leadId: outcome.leadId },
    { status: outcome.status, headers: CORS_HEADERS }
  );
}
