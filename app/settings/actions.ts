"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { updateBusiness, clearGoogleConnection, rotateIntakeApiKey, getBusinessById } from "@/services/business";
import { upsertEmailTemplate, resetEmailTemplate } from "@/services/emailTemplateService";
import { checkFeatureGate } from "@/services/subscriptionService";
import { createCheckoutSession, createBillingPortalSession } from "@/services/stripeService";
import { getCurrentBusinessId } from "@/lib/session";
import { logAction } from "@/lib/logger";
import { SERVICE_TYPES, TIMEZONE_OPTIONS } from "@/config/constants";
import type { EmailTemplateKey } from "@/types";

async function getSettingsBaseUrl(): Promise<string> {
  const host = (await headers()).get("host") ?? "localhost:3000";
  const protocol = host.startsWith("localhost") || host.startsWith("127.0.0.1") ? "http" : "https";
  return `${protocol}://${host}/settings`;
}

export async function upgradeToProAction() {
  const businessId = await getCurrentBusinessId();
  const business = await getBusinessById(businessId);
  if (!business) {
    throw new Error("Business not found.");
  }

  const baseUrl = await getSettingsBaseUrl();
  const checkoutUrl = await createCheckoutSession(business, {
    successUrl: `${baseUrl}?checkout=success`,
    cancelUrl: `${baseUrl}?checkout=cancelled`,
  });
  logAction("stripe.checkout-started", { businessId });
  redirect(checkoutUrl);
}

export async function manageBillingAction() {
  const businessId = await getCurrentBusinessId();
  const business = await getBusinessById(businessId);
  if (!business) {
    throw new Error("Business not found.");
  }

  const baseUrl = await getSettingsBaseUrl();
  const portalUrl = await createBillingPortalSession(business, { returnUrl: baseUrl });
  logAction("stripe.billing-portal-opened", { businessId });
  redirect(portalUrl);
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

/** Issues a fresh POST /api/intake key, invalidating the previous one — any website still using the old key starts getting 401s. */
export async function rotateIntakeApiKeyAction() {
  const businessId = await getCurrentBusinessId();
  await rotateIntakeApiKey(businessId);
  logAction("settings.intake-key-rotate", { businessId });
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

export async function updateAppointmentPreferencesAction(formData: FormData) {
  const businessId = await getCurrentBusinessId();
  const autoBookAppointments = formData.get("autoBookAppointments") === "on";

  await updateBusiness(businessId, { autoBookAppointments });
  logAction("settings.appointment-preferences-update", { businessId, autoBookAppointments });
  revalidatePath("/settings");
}

export async function updateWebhookUrlAction(formData: FormData) {
  const businessId = await getCurrentBusinessId();
  const url = String(formData.get("outboundWebhookUrl") ?? "").trim();

  if (url && !/^https?:\/\//i.test(url)) {
    throw new Error("Webhook URL must start with http:// or https://");
  }
  if (url && !(await checkFeatureGate(businessId, "webhooks"))) {
    throw new Error("Outbound webhooks require the Pro plan. Upgrade above to enable this.");
  }

  await updateBusiness(businessId, { outboundWebhookUrl: url || null });
  logAction("settings.webhook-url-update", { businessId, hasUrl: Boolean(url) });
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
