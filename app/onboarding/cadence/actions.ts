"use server";

import { redirect } from "next/navigation";
import { updateBusiness, markOnboardingStep } from "@/services/business";
import { getCurrentBusinessId } from "@/lib/session";
import { logAction } from "@/lib/logger";

export async function saveCadenceAction(formData: FormData) {
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
  await markOnboardingStep(businessId, 3);
  logAction("onboarding.cadence-set", { businessId, sentDays, followUp1Days, followUp2Days });

  redirect("/onboarding/first-estimate");
}
