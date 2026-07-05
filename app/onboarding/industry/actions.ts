"use server";

import { redirect } from "next/navigation";
import { updateBusiness, markOnboardingStep } from "@/services/business";
import { getCurrentBusinessId } from "@/lib/session";
import { logAction } from "@/lib/logger";
import { SERVICE_TYPES } from "@/config/constants";

export async function saveIndustryAction(formData: FormData) {
  const businessId = await getCurrentBusinessId();

  const industry = String(formData.get("industry") ?? "").trim();
  if (!SERVICE_TYPES.includes(industry as (typeof SERVICE_TYPES)[number])) {
    throw new Error("Invalid industry selection.");
  }

  await updateBusiness(businessId, { industry });
  await markOnboardingStep(businessId, 1);
  logAction("onboarding.industry-set", { businessId, industry });

  redirect("/onboarding/gmail");
}
