import { NextResponse } from "next/server";
import { handleLeadIntakeRequest, API_CORS_HEADERS } from "@/lib/apiAuth";

/**
 * Inbound lead webhook — a third-party system (a form builder, a phone
 * system, another CRM) POSTs a lead here directly. Identical pipeline to
 * POST /api/intake and /api/v1/leads (see lib/apiAuth.ts's
 * handleLeadIntakeRequest) — only the recorded leadSource differs.
 */

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: API_CORS_HEADERS });
}

export async function POST(request: Request) {
  return handleLeadIntakeRequest(request, "Webhook");
}
