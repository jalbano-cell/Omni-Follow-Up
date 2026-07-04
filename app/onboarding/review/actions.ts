"use server";

import { redirect } from "next/navigation";
import { completeOnboarding } from "@/services/business";
import { getCurrentBusinessId } from "@/lib/session";
import { logAction } from "@/lib/logger";

export async function completeOnboardingAction() {
  const businessId = await getCurrentBusinessId();
  await completeOnboarding(businessId);
  logAction("onboarding.completed", { businessId });
  redirect("/");
}
