"use server";

import { revalidatePath } from "next/cache";
import { updateBusiness, clearGoogleConnection } from "@/services/business";
import { getCurrentBusinessId } from "@/lib/session";
import { logAction } from "@/lib/logger";
import { SERVICE_TYPES, TIMEZONE_OPTIONS } from "@/config/constants";

export async function updateBusinessProfileAction(formData: FormData) {
  const businessId = await getCurrentBusinessId();

  const businessName = String(formData.get("businessName") ?? "").trim();
  const industry = String(formData.get("industry") ?? "").trim();

  if (!businessName) {
    throw new Error("Business name is required.");
  }
  if (!SERVICE_TYPES.includes(industry as (typeof SERVICE_TYPES)[number])) {
    throw new Error("Invalid industry selection.");
  }

  await updateBusiness(businessId, { businessName, industry });
  logAction("settings.profile-update", { businessId, businessName, industry });
  revalidatePath("/settings");
}

export async function updateCalendarIdAction(formData: FormData) {
  const businessId = await getCurrentBusinessId();
  const calendarId = String(formData.get("calendarId") ?? "").trim() || "primary";

  await updateBusiness(businessId, { calendarId });
  logAction("settings.calendar-id-update", { businessId, calendarId });
  revalidatePath("/settings");
}

export async function updateScheduleAction(formData: FormData) {
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
  logAction("settings.schedule-update", { businessId, timezone, workingHoursStart, workingHoursEnd });
  revalidatePath("/settings");
}

export async function updateEmailSignatureAction(formData: FormData) {
  const businessId = await getCurrentBusinessId();
  const emailSignature = String(formData.get("emailSignature") ?? "").trim();

  await updateBusiness(businessId, { emailSignature: emailSignature || null });
  logAction("settings.signature-update", { businessId });
  revalidatePath("/settings");
}

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
