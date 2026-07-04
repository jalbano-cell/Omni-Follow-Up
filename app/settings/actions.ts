"use server";

import { revalidatePath } from "next/cache";
import { updateBusiness, clearGoogleConnection } from "@/services/business";
import { getCurrentBusinessId } from "@/lib/session";
import { logAction } from "@/lib/logger";

export async function updateCadenceAction(formData: FormData) {
  const businessId = await getCurrentBusinessId();

  const sentDays = Number(formData.get("sentDays"));
  const followUp1Days = Number(formData.get("followUp1Days"));
  const followUp2Days = Number(formData.get("followUp2Days"));

  if ([sentDays, followUp1Days, followUp2Days].some((d) => Number.isNaN(d) || d < 1)) {
    throw new Error("Cadence days must be positive numbers.");
  }

  await updateBusiness(businessId, {
    followUpCadenceSentDays: sentDays,
    followUpCadenceFollowUp1Days: followUp1Days,
    followUpCadenceFollowUp2Days: followUp2Days,
  });
  logAction("settings.cadence-update", { businessId, sentDays, followUp1Days, followUp2Days });
  revalidatePath("/settings");
}

export async function disconnectGoogleAction() {
  const businessId = await getCurrentBusinessId();
  await clearGoogleConnection(businessId);
  logAction("settings.google-disconnect", { businessId });
  revalidatePath("/settings");
}
