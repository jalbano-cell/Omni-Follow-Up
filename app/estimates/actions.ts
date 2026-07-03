"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createEstimate, updateEstimate } from "@/services/airtable";
import { addDays } from "@/lib/date";
import { FOLLOW_UP_CADENCE_DAYS } from "@/config/constants";
import { logAction } from "@/lib/logger";
import type { EstimateStatus } from "@/types";

export async function createEstimateAction(formData: FormData) {
  const customerName = String(formData.get("customerName") ?? "").trim();
  const customerEmail = String(formData.get("customerEmail") ?? "").trim();
  const serviceType = String(formData.get("serviceType") ?? "").trim();
  const estimateValue = Number(formData.get("estimateValue"));
  const dateSent = String(formData.get("dateSent") ?? "").trim();
  const notes = String(formData.get("notes") ?? "").trim();

  if (!customerName || !customerEmail || !serviceType || !dateSent || Number.isNaN(estimateValue)) {
    throw new Error("Missing required estimate fields.");
  }

  const estimate = await createEstimate({
    customerName,
    customerEmail,
    serviceType,
    estimateValue,
    dateSent,
    notes,
    nextFollowUpDate: addDays(dateSent, FOLLOW_UP_CADENCE_DAYS.Sent),
  });
  logAction("estimate.create", { estimateId: estimate.id, customerName, estimateValue });

  revalidatePath("/");
  revalidatePath("/estimates");
  redirect("/");
}

export async function updateEstimateStatusAction(id: string, status: EstimateStatus) {
  await updateEstimate(id, { status, lastContactDate: new Date().toISOString().slice(0, 10) });
  logAction("estimate.status-update", { estimateId: id, status });
  revalidatePath("/");
  revalidatePath("/estimates");
  revalidatePath(`/estimates/${id}`);
  revalidatePath("/follow-ups");
}
