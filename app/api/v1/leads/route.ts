import { NextResponse } from "next/server";
import { resolveBusinessFromBearer, unauthorized, handleLeadIntakeRequest, API_CORS_HEADERS } from "@/lib/apiAuth";
import { getLeads } from "@/services/db";
import { LEAD_STATUSES } from "@/config/constants";
import type { LeadStatus } from "@/types";

/**
 * GET  /api/v1/leads         — list this business's leads (optionally filtered by status)
 * POST /api/v1/leads         — create a lead (identical to /api/v1/webhooks/leads)
 *
 * Bearer-token auth via the business's own intake API key — see lib/apiAuth.ts.
 */

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: API_CORS_HEADERS });
}

export async function GET(request: Request) {
  const business = await resolveBusinessFromBearer(request);
  if (!business) return unauthorized();

  const statusParam = new URL(request.url).searchParams.get("status");
  if (statusParam && !LEAD_STATUSES.includes(statusParam as LeadStatus)) {
    return NextResponse.json(
      { error: `Invalid status. Must be one of: ${LEAD_STATUSES.join(", ")}` },
      { status: 400, headers: API_CORS_HEADERS }
    );
  }

  const leads = await getLeads(business.id);
  const filtered = statusParam ? leads.filter((lead) => lead.status === statusParam) : leads;

  return NextResponse.json({ leads: filtered }, { status: 200, headers: API_CORS_HEADERS });
}

export async function POST(request: Request) {
  return handleLeadIntakeRequest(request, "Webhook");
}
