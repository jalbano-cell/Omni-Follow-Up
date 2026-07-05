import { NextResponse } from "next/server";
import { handleLeadIntakeRequest, API_CORS_HEADERS } from "@/lib/apiAuth";
import { DEFAULT_LEAD_SOURCE } from "@/config/constants";

/**
 * Public endpoint — a business's own website contact form posts here
 * directly (cross-origin, no session cookie), authenticated by the bearer
 * API key from that business's Settings page. See lib/apiAuth.ts's
 * handleLeadIntakeRequest (shared with /api/v1/webhooks/leads and
 * /api/v1/leads) and services/intakeService.ts for the actual
 * validation/rate-limit/spam/database/notification logic.
 */

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: API_CORS_HEADERS });
}

export async function POST(request: Request) {
  return handleLeadIntakeRequest(request, DEFAULT_LEAD_SOURCE);
}
