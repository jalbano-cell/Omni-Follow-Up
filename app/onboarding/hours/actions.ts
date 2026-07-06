"use server";

import { redirect } from "next/navigation";
import { updateBusiness, markOnboardingStep } from "@/services/business";
import { getCurrentBusinessId } from "@/lib/session";
import { logAction } from "@/lib/logger";
import { TIMEZONE_OPTIONS } from "@/config/constants";

export async function saveHoursAction(formData: FormData) {
  const businessId = await getCurrentBusinessId();

  const timezone = String(formData.get("timezone") ?? "").trim();
  const workingHoursStart = Number(formData.get("workingHoursStart"));
  const workingHoursEnd = Number(formData.get("workingHoursEnd"));

  if (!TIMEZONE_OPTIONS.some((tz) => tz.value === timezone)) {
    throw new Error("Invalid timezone selection.");
  }
  if (
    [workingHoursStart, workingHoursEnd].some((h) => Number.isNaN(h) || h < 0 || h > 23) ||
    workingHoursStart >= workingHoursEnd
  ) {
    throw new Error("Working hours must be valid hours with start before end.");
  }

  await updateBusiness(businessId, { timezone, workingHoursStart, workingHoursEnd });
  await markOnboardingStep(businessId, 3);
  logAction("onboarding.hours-set", { businessId, timezone, workingHoursStart, workingHoursEnd });

  redirect("/onboarding/review");
}
