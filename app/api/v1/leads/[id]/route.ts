import { NextResponse } from "next/server";
import { resolveBusinessFromBearer, unauthorized, API_CORS_HEADERS } from "@/lib/apiAuth";
import { getLead, updateLead } from "@/services/db";
import { LEAD_STATUSES } from "@/config/constants";
import type { LeadStatus } from "@/types";

/** PATCH /api/v1/leads/:id — update status, assignedTo, or internalNotes. AI-analysis fields aren't externally settable. */

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: API_CORS_HEADERS });
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const business = await resolveBusinessFromBearer(request);
  if (!business) return unauthorized();

  const { id } = await params;
  const existing = await getLead(business.id, id);
  if (!existing) {
    return NextResponse.json({ error: "Lead not found." }, { status: 404, headers: API_CORS_HEADERS });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Request body must be valid JSON." }, { status: 400, headers: API_CORS_HEADERS });
  }
  const patch = (body ?? {}) as Record<string, unknown>;

  if (patch.status !== undefined && !LEAD_STATUSES.includes(patch.status as LeadStatus)) {
    return NextResponse.json(
      { error: `Invalid status. Must be one of: ${LEAD_STATUSES.join(", ")}` },
      { status: 400, headers: API_CORS_HEADERS }
    );
  }

  const lead = await updateLead(business.id, id, {
    status: patch.status !== undefined ? (patch.status as LeadStatus) : undefined,
    assignedTo: typeof patch.assignedTo === "string" ? patch.assignedTo : undefined,
    internalNotes: typeof patch.internalNotes === "string" ? patch.internalNotes : undefined,
  });

  return NextResponse.json({ lead }, { status: 200, headers: API_CORS_HEADERS });
}
