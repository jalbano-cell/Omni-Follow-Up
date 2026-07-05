"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createEstimate, updateEstimate } from "@/services/airtable";
import { markLeadConverted } from "@/services/leadService";
import { getBusinessById, getEffectiveCadenceDays, markOnboardingStep } from "@/services/business";
import { addDays } from "@/lib/date";
import { getCurrentBusinessId } from "@/lib/session";
import { logAction } from "@/lib/logger";
import type { EstimateStatus } from "@/types";

export async function createEstimateAction(formData: FormData) {
  const businessId = await getCurrentBusinessId();

  const customerName = String(formData.get("customerName") ?? "").trim();
  const customerEmail = String(formData.get("customerEmail") ?? "").trim();
  const serviceType = String(formData.get("serviceType") ?? "").trim();
  const estimateValue = Number(formData.get("estimateValue"));
  const dateSent = String(formData.get("dateSent") ?? "").trim();
  const notes = String(formData.get("notes") ?? "").trim();
  const duringOnboarding = formData.get("onboarding") === "1";
  const fromLead = String(formData.get("fromLead") ?? "").trim();

  if (!customerName || !customerEmail || !serviceType || !dateSent || Number.isNaN(estimateValue)) {
    throw new Error("Missing required estimate fields.");
  }

  const business = await getBusinessById(businessId);
  const cadence = getEffectiveCadenceDays(
    business ?? { followUpCadenceSentDays: null, followUpCadenceFollowUp1Days: null, followUpCadenceFollowUp2Days: null }
  );

  const estimate = await createEstimate(businessId, {
    customerName,
    customerEmail,
    serviceType,
    estimateValue,
    dateSent,
    notes,
    nextFollowUpDate: addDays(dateSent, cadence.Sent),
  });
  logAction("estimate.create", { estimateId: estimate.id, customerName, estimateValue });

  if (fromLead) {
    await markLeadConverted(businessId, fromLead, estimate.id);
    logAction("lead.convert", { leadId: fromLead, estimateId: estimate.id });
    revalidatePath("/leads");
    revalidatePath(`/leads/${fromLead}`);
  }

  revalidatePath("/");
  revalidatePath("/estimates");

  if (duringOnboarding) {
    await markOnboardingStep(businessId, 4);
    redirect("/onboarding/review");
  }

  if (fromLead) {
    redirect(`/estimates/${estimate.id}`);
  }

  redirect("/");
}

export async function updateEstimateStatusAction(id: string, status: EstimateStatus) {
  const businessId = await getCurrentBusinessId();
  await updateEstimate(businessId, id, { status, lastContactDate: new Date().toISOString().slice(0, 10) });
  logAction("estimate.status-update", { estimateId: id, status });
  revalidatePath("/");
  revalidatePath("/estimates");
  revalidatePath(`/estimates/${id}`);
  revalidatePath("/follow-ups");
}
