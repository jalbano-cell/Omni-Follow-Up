import { getSupabase, insertRow, updateRow, selectById, selectWhere } from "@/lib/supabase";
import type { Database } from "@/types/supabase";
import {
  APP_TIMEZONE,
  CALENDAR_REMINDER_HOUR,
  DEFAULT_FOLLOW_UP_CADENCE_DAYS,
  DEFAULT_WORKING_HOURS_END,
} from "@/config/constants";
import { generateApiKey } from "@/lib/crypto";
import type { Business, NewBusinessInput, UpdateBusinessInput } from "@/types";

type WorkspaceRow = Database["public"]["Tables"]["workspaces"]["Row"];

function toBusiness(row: WorkspaceRow): Business {
  return {
    id: row.id,
    businessName: row.business_name,
    ownerName: row.owner_name,
    ownerEmail: row.owner_email,
    passwordHash: row.password_hash,
    followUpCadenceSentDays: row.follow_up_cadence_sent_days,
    followUpCadenceFollowUp1Days: row.follow_up_cadence_followup1_days,
    followUpCadenceFollowUp2Days: row.follow_up_cadence_followup2_days,
    onboardingStep: row.onboarding_step,
    onboardingCompletedAt: row.onboarding_completed_at,
    googleRefreshTokenEnc: row.google_refresh_token_enc,
    googleConnectedEmail: row.google_connected_email,
    googleScopes: row.google_scopes,
    googleConnectedAt: row.google_connected_at,
    calendarId: row.calendar_id,
    industry: row.industry,
    timezone: row.timezone,
    workingHoursStart: row.working_hours_start,
    workingHoursEnd: row.working_hours_end,
    emailSignature: row.email_signature,
    createdAt: row.created_at,
    intakeApiKey: row.intake_api_key,
    intakeApiKeyCreatedAt: row.intake_api_key_created_at,
    autoBookAppointments: row.auto_book_appointments,
    outboundWebhookUrl: row.outbound_webhook_url,
    notifyOnNewLead: row.notify_on_new_lead,
    notifyOnReply: row.notify_on_reply,
    monitorGmailInbox: row.monitor_gmail_inbox,
  };
}

export async function getBusinessById(id: string): Promise<Business | null> {
  const row = await selectById("workspaces", id);
  return row ? toBusiness(row) : null;
}

/** Case-insensitive email lookup — uses the raw client directly since this needs ilike, not the generic equality helpers. */
export async function getBusinessByEmail(email: string): Promise<Business | null> {
  const { data, error } = await getSupabase()
    .from("workspaces")
    .select()
    .ilike("owner_email", email)
    .limit(1)
    .maybeSingle();
  if (error) throw new Error(`Supabase select on "workspaces" failed: ${error.message}`);
  return data ? toBusiness(data as WorkspaceRow) : null;
}

export async function createBusiness(input: NewBusinessInput): Promise<Business> {
  const now = new Date().toISOString();
  const row = await insertRow("workspaces", {
    business_name: input.businessName,
    owner_name: input.ownerName,
    owner_email: input.ownerEmail,
    password_hash: input.passwordHash,
    // Every business gets a working POST /api/intake key from the moment it signs up —
    // no separate "enable website intake" step to remember.
    intake_api_key: generateApiKey(),
    intake_api_key_created_at: now,
  });
  return toBusiness(row);
}

export async function updateBusiness(id: string, input: UpdateBusinessInput): Promise<Business> {
  const fields: Database["public"]["Tables"]["workspaces"]["Update"] = {};
  if (input.businessName !== undefined) fields.business_name = input.businessName;
  if (input.ownerName !== undefined) fields.owner_name = input.ownerName;
  if (input.ownerEmail !== undefined) fields.owner_email = input.ownerEmail;
  if (input.passwordHash !== undefined) fields.password_hash = input.passwordHash;
  if (input.followUpCadenceSentDays !== undefined) fields.follow_up_cadence_sent_days = input.followUpCadenceSentDays;
  if (input.followUpCadenceFollowUp1Days !== undefined)
    fields.follow_up_cadence_followup1_days = input.followUpCadenceFollowUp1Days;
  if (input.followUpCadenceFollowUp2Days !== undefined)
    fields.follow_up_cadence_followup2_days = input.followUpCadenceFollowUp2Days;
  if (input.onboardingStep !== undefined) fields.onboarding_step = input.onboardingStep;
  if (input.onboardingCompletedAt !== undefined) fields.onboarding_completed_at = input.onboardingCompletedAt;
  if (input.googleRefreshTokenEnc !== undefined) fields.google_refresh_token_enc = input.googleRefreshTokenEnc;
  if (input.googleConnectedEmail !== undefined) fields.google_connected_email = input.googleConnectedEmail;
  if (input.googleScopes !== undefined) fields.google_scopes = input.googleScopes;
  if (input.googleConnectedAt !== undefined) fields.google_connected_at = input.googleConnectedAt;
  if (input.calendarId !== undefined) fields.calendar_id = input.calendarId;
  if (input.industry !== undefined) fields.industry = input.industry;
  if (input.timezone !== undefined) fields.timezone = input.timezone;
  if (input.workingHoursStart !== undefined) fields.working_hours_start = input.workingHoursStart;
  if (input.workingHoursEnd !== undefined) fields.working_hours_end = input.workingHoursEnd;
  if (input.emailSignature !== undefined) fields.email_signature = input.emailSignature;
  if (input.intakeApiKey !== undefined) fields.intake_api_key = input.intakeApiKey;
  if (input.intakeApiKeyCreatedAt !== undefined) fields.intake_api_key_created_at = input.intakeApiKeyCreatedAt;
  if (input.autoBookAppointments !== undefined) fields.auto_book_appointments = input.autoBookAppointments;
  if (input.outboundWebhookUrl !== undefined) fields.outbound_webhook_url = input.outboundWebhookUrl;
  if (input.notifyOnNewLead !== undefined) fields.notify_on_new_lead = input.notifyOnNewLead;
  if (input.notifyOnReply !== undefined) fields.notify_on_reply = input.notifyOnReply;
  if (input.monitorGmailInbox !== undefined) fields.monitor_gmail_inbox = input.monitorGmailInbox;

  const row = await updateRow("workspaces", id, fields);
  return toBusiness(row);
}

/**
 * Looks up the tenant a POST /api/intake request belongs to by its bearer-token
 * API key — this is the only way that endpoint identifies a business, since a
 * public website form has no session cookie to carry a businessId.
 */
export async function getBusinessByIntakeApiKey(apiKey: string): Promise<Business | null> {
  if (!apiKey) return null;
  const rows = await selectWhere("workspaces", { intake_api_key: apiKey });
  return rows[0] ? toBusiness(rows[0]) : null;
}

/** Issues a fresh intake API key, invalidating the previous one — used by the Settings "Regenerate key" action. */
export async function rotateIntakeApiKey(id: string): Promise<Business> {
  return updateBusiness(id, { intakeApiKey: generateApiKey(), intakeApiKeyCreatedAt: new Date().toISOString() });
}

/** Persists a freshly-connected (or reconnected) Google account's tokens/scopes. */
export async function saveGoogleConnection(
  id: string,
  input: { encryptedRefreshToken: string; connectedEmail: string; scopes: string }
): Promise<Business> {
  return updateBusiness(id, {
    googleRefreshTokenEnc: input.encryptedRefreshToken,
    googleConnectedEmail: input.connectedEmail,
    googleScopes: input.scopes,
    googleConnectedAt: new Date().toISOString(),
  });
}

/** Clears a Google connection — used when a refresh token is revoked (invalid_grant) and needs reconnecting. */
export async function clearGoogleConnection(id: string): Promise<Business> {
  return updateBusiness(id, {
    googleRefreshTokenEnc: null,
    googleConnectedEmail: null,
    googleScopes: null,
    googleConnectedAt: null,
  });
}

export async function markOnboardingStep(id: string, step: number): Promise<Business> {
  return updateBusiness(id, { onboardingStep: step });
}

export async function completeOnboarding(id: string): Promise<Business> {
  return updateBusiness(id, { onboardingCompletedAt: new Date().toISOString() });
}

/** Every business, for the per-tenant cron loop (follow-up drafting). */
export async function getAllActiveBusinesses(): Promise<Business[]> {
  const { data, error } = await getSupabase().from("workspaces").select();
  if (error) throw new Error(`Supabase select on "workspaces" failed: ${error.message}`);
  return (data ?? []).map((row) => toBusiness(row as WorkspaceRow));
}

/** Resolves the effective follow-up cadence for a business, filling gaps with the global defaults. */
export function getEffectiveCadenceDays(
  business: Pick<Business, "followUpCadenceSentDays" | "followUpCadenceFollowUp1Days" | "followUpCadenceFollowUp2Days">
): Record<"Sent" | "Follow-up 1" | "Follow-up 2", number> {
  return {
    Sent: business.followUpCadenceSentDays ?? DEFAULT_FOLLOW_UP_CADENCE_DAYS.Sent,
    "Follow-up 1": business.followUpCadenceFollowUp1Days ?? DEFAULT_FOLLOW_UP_CADENCE_DAYS["Follow-up 1"],
    "Follow-up 2": business.followUpCadenceFollowUp2Days ?? DEFAULT_FOLLOW_UP_CADENCE_DAYS["Follow-up 2"],
  };
}

/** Which calendar Calendar reminders get created on — "primary" (the connected account's main calendar) unless overridden. */
export function getEffectiveCalendarId(business: Pick<Business, "calendarId">): string {
  return business.calendarId ?? "primary";
}

/** The business's own timezone for Calendar reminder times, falling back to the app-wide default when unset. */
export function getEffectiveTimezone(business: Pick<Business, "timezone">): string {
  return business.timezone ?? APP_TIMEZONE;
}

/** The business's own working-hours window (hour-of-day, 0-23), falling back to the app-wide defaults when unset. */
export function getEffectiveWorkingHours(
  business: Pick<Business, "workingHoursStart" | "workingHoursEnd">
): { start: number; end: number } {
  return {
    start: business.workingHoursStart ?? CALENDAR_REMINDER_HOUR,
    end: business.workingHoursEnd ?? DEFAULT_WORKING_HOURS_END,
  };
}

/** Whether a requested appointment books automatically (true) or only produces a reviewable recommendation (false, the default) — see services/appointmentBooking.ts. */
export function getEffectiveAutoBooking(business: Pick<Business, "autoBookAppointments">): boolean {
  return business.autoBookAppointments ?? false;
}

/** Whether the owner-notification email fires for a new lead — on by default. */
export function getEffectiveNotifyOnNewLead(business: Pick<Business, "notifyOnNewLead">): boolean {
  return business.notifyOnNewLead ?? true;
}

/** Whether an in-app Notification fires when a customer reply arrives — on by default. */
export function getEffectiveNotifyOnReply(business: Pick<Business, "notifyOnReply">): boolean {
  return business.notifyOnReply ?? true;
}

/** Whether the daily cron scans this business's Gmail inbox for new customer inquiries (services/gmailLeadCapture.ts) — off by default, since not every business wants inbound email auto-converted into Leads. */
export function getEffectiveGmailLeadMonitoring(business: Pick<Business, "monitorGmailInbox">): boolean {
  return business.monitorGmailInbox ?? false;
}
