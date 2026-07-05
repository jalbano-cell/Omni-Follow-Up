"use server";

import { redirect } from "next/navigation";
import { markOnboardingStep } from "@/services/business";
import { getCurrentBusinessId } from "@/lib/session";
import { logAction } from "@/lib/logger";

export async function skipFirstEstimateAction() {
  const businessId = await getCurrentBusinessId();
  await markOnboardingStep(businessId, 4);
  logAction("onboarding.first-estimate-skipped", { businessId });
  redirect("/onboarding/review");
}
