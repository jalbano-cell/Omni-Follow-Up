"use server";

import { revalidatePath } from "next/cache";
import { updateBusiness, clearGoogleConnection } from "@/services/business";
import { deleteMailboxConnection } from "@/services/mailboxConnections";
import { upsertEmailTemplate, resetEmailTemplate } from "@/services/emailTemplateService";
import { inviteTeamMember, removeTeamMember, TeamMemberLimitExceededError, TeamMemberEmailInUseError } from "@/services/userService";
import { requireOwner } from "@/lib/session";
import { logAction } from "@/lib/logger";
import { SERVICE_TYPES, TIMEZONE_OPTIONS } from "@/config/constants";
import type { EmailTemplateKey } from "@/types";

/** Every Settings action is owner-only (lib/session.ts's requireOwner) — Server Actions are directly callable independent of which page rendered the form, so the page-level redirect in app/settings/page.tsx isn't sufficient on its own. */
async function getCurrentBusinessId(): Promise<string> {
  const business = await requireOwner();
  return business.id;
}

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

export async function disconnectMicrosoftAction() {
  const businessId = await getCurrentBusinessId();
  await deleteMailboxConnection(businessId, "microsoft");
  logAction("settings.microsoft-disconnect", { businessId });
  revalidatePath("/settings");
}

export async function updateEmailTemplateAction(key: EmailTemplateKey, subject: string, body: string) {
  const businessId = await getCurrentBusinessId();
  const trimmedSubject = subject.trim();
  const trimmedBody = body.trim();
  if (!trimmedSubject || !trimmedBody) {
    throw new Error("Subject and body are required.");
  }

  await upsertEmailTemplate(businessId, key, { subject: trimmedSubject, body: trimmedBody });
  logAction("settings.email-template-update", { businessId, key });
  revalidatePath("/settings");
}

export async function resetEmailTemplateAction(key: EmailTemplateKey) {
  const businessId = await getCurrentBusinessId();
  await resetEmailTemplate(businessId, key);
  logAction("settings.email-template-reset", { businessId, key });
  revalidatePath("/settings");
}

/** Parses the "Service Type: days" textarea into services/business.ts's getEffectiveRebookIntervalDays override shape — a blank or "none"/"off" value explicitly disables the reminder for that service; an unparseable line is silently skipped rather than rejecting the whole save. */
function parseRebookOverrides(text: string): Record<string, number | null> {
  const overrides: Record<string, number | null> = {};
  for (const rawLine of text.split("\n")) {
    const line = rawLine.trim();
    if (!line) continue;
    const separatorIndex = line.indexOf(":");
    if (separatorIndex === -1) continue;

    const serviceType = line.slice(0, separatorIndex).trim().toLowerCase();
    const valueText = line.slice(separatorIndex + 1).trim().toLowerCase();
    if (!serviceType) continue;

    if (valueText === "" || valueText === "none" || valueText === "off") {
      overrides[serviceType] = null;
      continue;
    }
    const days = Number(valueText);
    if (!Number.isNaN(days) && days > 0) {
      overrides[serviceType] = days;
    }
  }
  return overrides;
}

/**
 * Retired the old "auto-book appointments instantly" toggle here (see
 * CLAUDE.md's Appointments section — every requested appointment now always
 * requires owner approval) in favor of the review/rebook lifecycle settings:
 * the CASL-required Google review link + mailing address, and the recurring
 * rebook reminder's business default and per-service overrides.
 */
export async function updateAppointmentLifecycleAction(formData: FormData) {
  const businessId = await getCurrentBusinessId();

  const googleReviewUrl = String(formData.get("googleReviewUrl") ?? "").trim();
  const mailingAddress = String(formData.get("mailingAddress") ?? "").trim();
  const rebookDaysRaw = String(formData.get("rebookIntervalDays") ?? "").trim();
  const overridesRaw = String(formData.get("rebookIntervalOverrides") ?? "");
  const reminderHoursRaw = String(formData.get("appointmentReminderHoursBefore") ?? "").trim();

  let rebookIntervalDays: number | null = null;
  if (rebookDaysRaw) {
    const parsed = Number(rebookDaysRaw);
    if (Number.isNaN(parsed) || parsed <= 0) {
      throw new Error("Rebook interval must be a positive number of days.");
    }
    rebookIntervalDays = parsed;
  }

  let appointmentReminderHoursBefore: number | null = null;
  if (reminderHoursRaw) {
    const parsed = Number(reminderHoursRaw);
    if (Number.isNaN(parsed) || parsed <= 0) {
      throw new Error("Reminder timing must be a positive number of hours.");
    }
    appointmentReminderHoursBefore = parsed;
  }

  await updateBusiness(businessId, {
    googleReviewUrl: googleReviewUrl || null,
    mailingAddress: mailingAddress || null,
    rebookIntervalDays,
    rebookIntervalOverrides: parseRebookOverrides(overridesRaw),
    appointmentReminderHoursBefore,
  });
  logAction("settings.appointment-lifecycle-update", { businessId, rebookIntervalDays, appointmentReminderHoursBefore });
  revalidatePath("/settings");
}

export async function updateNotificationPreferencesAction(formData: FormData) {
  const businessId = await getCurrentBusinessId();
  const notifyOnNewLead = formData.get("notifyOnNewLead") === "on";
  const notifyOnReply = formData.get("notifyOnReply") === "on";

  await updateBusiness(businessId, { notifyOnNewLead, notifyOnReply });
  logAction("settings.notification-preferences-update", { businessId, notifyOnNewLead, notifyOnReply });
  revalidatePath("/settings");
}

export async function updateGmailLeadMonitoringAction(formData: FormData) {
  const businessId = await getCurrentBusinessId();
  const monitorGmailInbox = formData.get("monitorGmailInbox") === "on";

  await updateBusiness(businessId, { monitorGmailInbox });
  logAction("settings.gmail-lead-monitoring-update", { businessId, monitorGmailInbox });
  revalidatePath("/settings");
}

export async function inviteTeamMemberAction(formData: FormData): Promise<{ error?: string }> {
  const businessId = await getCurrentBusinessId();
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const name = String(formData.get("name") ?? "").trim();

  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return { error: "Enter a valid email address." };
  }
  if (!name) {
    return { error: "Name is required." };
  }

  try {
    const member = await inviteTeamMember(businessId, { email, name });
    logAction("settings.team-invite", { businessId, memberId: member.id });
  } catch (error) {
    if (error instanceof TeamMemberLimitExceededError || error instanceof TeamMemberEmailInUseError) {
      return { error: error.message };
    }
    throw error;
  }

  revalidatePath("/settings");
  return {};
}

export async function removeTeamMemberAction(memberId: string) {
  const businessId = await getCurrentBusinessId();
  await removeTeamMember(businessId, memberId);
  logAction("settings.team-remove", { businessId, memberId });
  revalidatePath("/settings");
}
