"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { createEstimate, updateEstimate, deleteEstimate, getLeads, getEstimate, bumpEstimateShareTokenVersion } from "@/services/db";
import { markLeadConverted, revertLeadConversion } from "@/services/leadService";
import { logEstimateActivity } from "@/services/activityService";
import { getBusinessById, getEffectiveCadenceDays, markOnboardingStep } from "@/services/business";
import { uploadEstimateAttachment, deleteEstimateAttachment } from "@/services/estimateAttachmentService";
import { createEstimateShareToken } from "@/lib/auth";
import { addDays } from "@/lib/date";
import { requireEstimatesEnabled } from "@/lib/session";
import { logAction } from "@/lib/logger";
import type { EstimateStatus } from "@/types";

export async function createEstimateAction(formData: FormData) {
  const businessId = (await requireEstimatesEnabled()).id;

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
    leadId: fromLead || undefined,
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
  const businessId = (await requireEstimatesEnabled()).id;
  await updateEstimate(businessId, id, { status, lastContactDate: new Date().toISOString().slice(0, 10) });
  logAction("estimate.status-update", { estimateId: id, status });

  if (status === "Booked" || status === "Lost") {
    await logEstimateActivity(
      businessId,
      id,
      status === "Booked" ? "estimate.booked" : "estimate.lost",
      status === "Booked" ? "Estimate marked as booked." : "Estimate marked as lost."
    );
  }

  revalidatePath("/");
  revalidatePath("/estimates");
  revalidatePath(`/estimates/${id}`);
  revalidatePath("/follow-ups");
}

/**
 * Permanently deletes an Estimate along with its FollowUps/Replies (see
 * services/db.ts's deleteEstimate). If a Lead had been converted to
 * this estimate, it's reverted back to "New Inquiry" rather than left
 * pointing at a deleted record. No redirect here — this is invoked
 * programmatically from a confirmation dialog (not a <form action={...}>),
 * so the caller navigates client-side after this resolves.
 */
export async function deleteEstimateAction(id: string) {
  const businessId = (await requireEstimatesEnabled()).id;

  const leads = await getLeads(businessId);
  const linkedLead = leads.find((l) => l.convertedEstimateId === id);

  await deleteEstimate(businessId, id);
  logAction("estimate.delete", { estimateId: id });

  if (linkedLead) {
    await revertLeadConversion(businessId, linkedLead.id);
    revalidatePath("/leads");
    revalidatePath(`/leads/${linkedLead.id}`);
  }

  revalidatePath("/");
  revalidatePath("/estimates");
  revalidatePath("/follow-ups");
  revalidatePath("/replies");
}

async function buildShareUrl(estimateId: string, businessId: string, shareTokenVersion: number): Promise<string> {
  const token = await createEstimateShareToken({ estimateId, businessId, shareTokenVersion });
  const host = (await headers()).get("host") ?? "localhost:3000";
  const protocol = host.startsWith("localhost") || host.startsWith("127.0.0.1") ? "http" : "https";
  return `${protocol}://${host}/e/${token}`;
}

/** Mints a signed link to this estimate's customer portal (app/e/[token]/page.tsx), stamped with the estimate's current share-token version. */
export async function getEstimateShareUrlAction(estimateId: string): Promise<string> {
  const businessId = (await requireEstimatesEnabled()).id;
  const estimate = await getEstimate(businessId, estimateId);
  if (!estimate) {
    throw new Error("Estimate not found.");
  }
  return buildShareUrl(estimateId, businessId, estimate.shareTokenVersion);
}

/**
 * Revokes any link previously shared for this estimate (advances its
 * share-token version) and returns a fresh link at the new version — for a
 * "reset share link" control when a link was sent to the wrong person.
 */
export async function resetEstimateShareLinkAction(estimateId: string): Promise<string> {
  const businessId = (await requireEstimatesEnabled()).id;
  const estimate = await bumpEstimateShareTokenVersion(businessId, estimateId);
  logAction("estimate.share-link-reset", { estimateId });
  return buildShareUrl(estimateId, businessId, estimate.shareTokenVersion);
}

export async function uploadEstimateAttachmentAction(estimateId: string, formData: FormData) {
  const businessId = (await requireEstimatesEnabled()).id;
  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) {
    throw new Error("Choose a file first.");
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  await uploadEstimateAttachment(businessId, estimateId, {
    name: file.name,
    type: file.type,
    size: file.size,
    buffer,
  });
  logAction("estimate.attachment-upload", { estimateId, fileName: file.name });
  revalidatePath(`/estimates/${estimateId}`);
}

export async function deleteEstimateAttachmentAction(estimateId: string, attachmentId: string) {
  const businessId = (await requireEstimatesEnabled()).id;
  await deleteEstimateAttachment(businessId, attachmentId);
  logAction("estimate.attachment-delete", { estimateId, attachmentId });
  revalidatePath(`/estimates/${estimateId}`);
}
