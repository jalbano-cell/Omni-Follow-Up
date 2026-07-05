import { NextResponse } from "next/server";
import { resolveBusinessFromBearer, unauthorized, API_CORS_HEADERS } from "@/lib/apiAuth";
import { createEstimate, getEstimates } from "@/services/db";
import { getEffectiveCadenceDays } from "@/services/business";
import { addDays, todayIso } from "@/lib/date";

/**
 * GET  /api/v1/estimates — list this business's estimates
 * POST /api/v1/estimates — create one, same fields as the New Estimate form
 */

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: API_CORS_HEADERS });
}

export async function GET(request: Request) {
  const business = await resolveBusinessFromBearer(request);
  if (!business) return unauthorized();

  const estimates = await getEstimates(business.id);
  return NextResponse.json({ estimates }, { status: 200, headers: API_CORS_HEADERS });
}

export async function POST(request: Request) {
  const business = await resolveBusinessFromBearer(request);
  if (!business) return unauthorized();

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Request body must be valid JSON." }, { status: 400, headers: API_CORS_HEADERS });
  }
  const input = (body ?? {}) as Record<string, unknown>;

  const customerName = typeof input.customerName === "string" ? input.customerName.trim() : "";
  const customerEmail = typeof input.customerEmail === "string" ? input.customerEmail.trim() : "";
  const serviceType = typeof input.serviceType === "string" ? input.serviceType.trim() : "";
  const estimateValue = Number(input.estimateValue);
  const dateSent = typeof input.dateSent === "string" && input.dateSent.trim() ? input.dateSent.trim() : todayIso();
  const notes = typeof input.notes === "string" ? input.notes : "";

  const missingFields: string[] = [];
  if (!customerName) missingFields.push("customerName");
  if (!customerEmail) missingFields.push("customerEmail");
  if (!serviceType) missingFields.push("serviceType");
  if (Number.isNaN(estimateValue)) missingFields.push("estimateValue");

  if (missingFields.length > 0) {
    return NextResponse.json(
      { error: "Missing or invalid required fields.", fields: missingFields },
      { status: 400, headers: API_CORS_HEADERS }
    );
  }

  const cadence = getEffectiveCadenceDays(business);
  const estimate = await createEstimate(business.id, {
    customerName,
    customerEmail,
    serviceType,
    estimateValue,
    dateSent,
    notes,
    businessName: business.businessName,
    nextFollowUpDate: addDays(dateSent, cadence.Sent),
  });

  return NextResponse.json({ estimate }, { status: 201, headers: API_CORS_HEADERS });
}
