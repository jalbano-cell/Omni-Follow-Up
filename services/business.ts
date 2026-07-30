import { randomBytes } from "crypto";
import { getSupabase, insertRow, updateRow, selectById, selectWhere } from "@/lib/supabase";
import type { Database } from "@/types/supabase";
import {
  APP_TIMEZONE,
  CALENDAR_REMINDER_HOUR,
  DEFAULT_FOLLOW_UP_CADENCE_DAYS,
  DEFAULT_WORKING_HOURS_END,
  DEFAULT_APPOINTMENT_REMINDER_HOURS_BEFORE,
  DEFAULT_EMAIL_ACCENT_COLOR,
} from "@/config/constants";
import { generateApiKey } from "@/lib/crypto";
import { hashPassword } from "@/lib/password";
import { upsertMailboxConnection, deleteMailboxConnection } from "@/services/mailboxConnections";
import { logAction } from "@/lib/logger";
import type { Business, NewBusinessInput, UpdateBusinessInput, WorkspaceStatus, WorkspaceProductMode } from "@/types";

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
    notifyOnNewLead: row.notify_on_new_lead,
    notifyOnReply: row.notify_on_reply,
    monitorGmailInbox: row.monitor_gmail_inbox,
    // `?? 0` so the app tolerates the column not existing yet (i.e. this code
    // deployed before migration 0011 ran) — without it, an absent value would
    // read as undefined and the revocation check in lib/session.ts would fail
    // every authenticated request into a login loop.
    sessionTokenVersion: row.session_token_version ?? 0,
    gmailWatchHistoryId: row.gmail_watch_history_id ?? null,
    gmailWatchExpiration: row.gmail_watch_expiration ?? null,
    status: row.status as WorkspaceStatus,
    productMode: (row.product_mode as WorkspaceProductMode) ?? "both",
    googleReviewUrl: row.google_review_url ?? null,
    mailingAddress: row.mailing_address ?? null,
    rebookIntervalDays: row.rebook_interval_days ?? null,
    rebookIntervalOverrides: (row.rebook_interval_overrides as Record<string, number | null>) ?? {},
    appointmentReminderHoursBefore: row.appointment_reminder_hours_before ?? null,
    emailAccentColor: row.email_accent_color ?? null,
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

/**
 * Agency-provisioned workspace (app/admin/actions.ts's provisionNewWorkspaceAction)
 * — same shape as createBusiness, but status is set explicitly ('active'
 * immediately, since the agency is provisioning this after an external
 * invoice) instead of relying on the schema default ('inactive') meant for
 * self-serve signups. There's no real password yet — the client hasn't
 * claimed the workspace — so password_hash gets an unguessable random value
 * nobody will ever type correctly (same "unusable placeholder" idea as
 * app/login/actions.ts's DUMMY_HASH_PROMISE), which
 * services/userService.ts's claimWorkspaceOwnership overwrites for real once
 * the client accepts their claim invite.
 */
export async function createBusinessForAgency(input: {
  businessName: string;
  ownerName: string;
  ownerEmail: string;
  productMode?: WorkspaceProductMode;
}): Promise<Business> {
  const now = new Date().toISOString();
  const placeholderPasswordHash = await hashPassword(randomBytes(32).toString("hex"));
  const row = await insertRow("workspaces", {
    business_name: input.businessName,
    owner_name: input.ownerName,
    owner_email: input.ownerEmail,
    password_hash: placeholderPasswordHash,
    intake_api_key: generateApiKey(),
    intake_api_key_created_at: now,
    status: "active",
    product_mode: input.productMode ?? "both",
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
  if (input.notifyOnNewLead !== undefined) fields.notify_on_new_lead = input.notifyOnNewLead;
  if (input.notifyOnReply !== undefined) fields.notify_on_reply = input.notifyOnReply;
  if (input.monitorGmailInbox !== undefined) fields.monitor_gmail_inbox = input.monitorGmailInbox;
  if (input.sessionTokenVersion !== undefined) fields.session_token_version = input.sessionTokenVersion;
  if (input.gmailWatchHistoryId !== undefined) fields.gmail_watch_history_id = input.gmailWatchHistoryId;
  if (input.gmailWatchExpiration !== undefined) fields.gmail_watch_expiration = input.gmailWatchExpiration;
  if (input.status !== undefined) fields.status = input.status;
  if (input.productMode !== undefined) fields.product_mode = input.productMode;
  if (input.googleReviewUrl !== undefined) fields.google_review_url = input.googleReviewUrl;
  if (input.mailingAddress !== undefined) fields.mailing_address = input.mailingAddress;
  if (input.rebookIntervalDays !== undefined) fields.rebook_interval_days = input.rebookIntervalDays;
  if (input.rebookIntervalOverrides !== undefined) fields.rebook_interval_overrides = input.rebookIntervalOverrides;
  if (input.appointmentReminderHoursBefore !== undefined) fields.appointment_reminder_hours_before = input.appointmentReminderHoursBefore;
  if (input.emailAccentColor !== undefined) fields.email_accent_color = input.emailAccentColor;

  const row = await updateRow("workspaces", id, fields);
  return toBusiness(row);
}

/**
 * Revokes every outstanding session for this business by advancing its
 * session_token_version — any JWT minted with the old version (lib/session.ts
 * compares them) stops validating on its next request. Called on logout and
 * should be called by any future password-reset flow.
 */
export async function bumpSessionTokenVersion(id: string): Promise<void> {
  const business = await getBusinessById(id);
  if (!business) return;
  await updateBusiness(id, { sessionTokenVersion: business.sessionTokenVersion + 1 });
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

/**
 * Persists a freshly-connected (or reconnected) Google account's tokens/scopes.
 * Gmail is the product's primary lead source now, so every connection also turns
 * on inbox monitoring — a business can still switch it back off in Settings.
 *
 * Also mirrors the connection into `mailbox_connections` (provider='google')
 * — the provider-agnostic store services/mailboxProvider.ts's interface is
 * built against — so it stays valid as a genuinely-generalized store going
 * forward. `workspaces.google_*` above remains authoritative: every existing
 * Gmail read/send/refresh call site still reads those columns directly and
 * is unaffected by (and unaware of) this mirror. Best-effort — a failure
 * here must never break the actual Google connection, which is why it's
 * wrapped separately from the updateBusiness call above.
 */
export async function saveGoogleConnection(
  id: string,
  input: { encryptedRefreshToken: string; connectedEmail: string; scopes: string }
): Promise<Business> {
  const business = await updateBusiness(id, {
    googleRefreshTokenEnc: input.encryptedRefreshToken,
    googleConnectedEmail: input.connectedEmail,
    googleScopes: input.scopes,
    googleConnectedAt: new Date().toISOString(),
    monitorGmailInbox: true,
  });

  try {
    await upsertMailboxConnection(id, "google", {
      refreshTokenEnc: input.encryptedRefreshToken,
      connectedEmail: input.connectedEmail,
      scopes: input.scopes,
    });
  } catch (error) {
    logAction("business.mailbox-connection-mirror-failed", {
      businessId: id,
      provider: "google",
      error: error instanceof Error ? error.message : "unknown error",
    });
  }

  return business;
}

/**
 * Clears a Google connection — used when a refresh token is revoked
 * (invalid_grant) and needs reconnecting. Also clears the mirrored
 * `mailbox_connections` row (see saveGoogleConnection's doc comment) —
 * same best-effort treatment, never allowed to block the actual disconnect.
 */
export async function clearGoogleConnection(id: string): Promise<Business> {
  const business = await updateBusiness(id, {
    googleRefreshTokenEnc: null,
    googleConnectedEmail: null,
    googleScopes: null,
    googleConnectedAt: null,
    // The old watch registration is tied to a token we no longer have — no point
    // calling Gmail's stop API with it, it'll expire on its own within 7 days.
    gmailWatchHistoryId: null,
    gmailWatchExpiration: null,
  });

  try {
    await deleteMailboxConnection(id, "google");
  } catch (error) {
    logAction("business.mailbox-connection-mirror-failed", {
      businessId: id,
      provider: "google",
      error: error instanceof Error ? error.message : "unknown error",
    });
  }

  return business;
}

/**
 * Resolves the business a Gmail push notification belongs to, by the Gmail
 * address it fires for (services/gmailWatchSync.ts). Case-insensitive since
 * Gmail addresses are case-insensitive; uses ilike like getBusinessByEmail.
 */
export async function getBusinessByGoogleEmail(email: string): Promise<Business | null> {
  const { data, error } = await getSupabase()
    .from("workspaces")
    .select()
    .ilike("google_connected_email", email)
    .limit(1)
    .maybeSingle();
  if (error) throw new Error(`Supabase select on "workspaces" failed: ${error.message}`);
  return data ? toBusiness(data as WorkspaceRow) : null;
}

/** Persists the historyId/expiration from a fresh services/gmailWatch.ts startWatch() call. */
export async function saveGmailWatch(id: string, input: { historyId: string; expiration: string }): Promise<Business> {
  return updateBusiness(id, {
    gmailWatchHistoryId: input.historyId,
    gmailWatchExpiration: input.expiration,
  });
}

export async function markOnboardingStep(id: string, step: number): Promise<Business> {
  return updateBusiness(id, { onboardingStep: step });
}

export async function completeOnboarding(id: string): Promise<Business> {
  return updateBusiness(id, { onboardingCompletedAt: new Date().toISOString() });
}

/**
 * Every workspace, regardless of status — used by /admin (which must see
 * inactive/suspended workspaces to manage them) and, after filtering through
 * hasActiveEntitlement, by the cron loop. NOT pre-filtered by status: the name
 * used to imply "active" and it never actually filtered, which let the cron
 * run automation for locked-out workspaces (see the entitlement filter at the
 * cron's single entry point in app/api/follow-ups/generate/route.ts).
 */
export async function getAllBusinesses(): Promise<Business[]> {
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

/**
 * Days after an appointment's completedAt before a rebook reminder sends for
 * a given service type, or null if disabled — checks the per-service
 * override map first (a present key with a null value explicitly disables
 * the reminder for that service even when a business default is set), then
 * falls back to the business-wide default (also null = disabled). See
 * services/appointmentLifecycle.ts's rebook-reminder job.
 */
export function getEffectiveRebookIntervalDays(
  business: Pick<Business, "rebookIntervalDays" | "rebookIntervalOverrides">,
  serviceType: string
): number | null {
  const key = serviceType.trim().toLowerCase();
  const overrides = business.rebookIntervalOverrides ?? {};
  if (Object.prototype.hasOwnProperty.call(overrides, key)) {
    return overrides[key];
  }
  return business.rebookIntervalDays ?? null;
}

/** Hours before an approved appointment's scheduledStart its pre-appointment reminder auto-sends — falls back to DEFAULT_APPOINTMENT_REMINDER_HOURS_BEFORE when unset. See services/appointmentLifecycle.ts's runAppointmentReminderJob. */
export function getEffectiveReminderHoursBefore(business: Pick<Business, "appointmentReminderHoursBefore">): number {
  return business.appointmentReminderHoursBefore ?? DEFAULT_APPOINTMENT_REMINDER_HOURS_BEFORE;
}

/** Hex accent color for this business's automated emails (services/emailTemplates/emailLayout.ts) — falls back to DEFAULT_EMAIL_ACCENT_COLOR when unset. */
export function getEffectiveEmailAccentColor(business: Pick<Business, "emailAccentColor">): string {
  return business.emailAccentColor ?? DEFAULT_EMAIL_ACCENT_COLOR;
}

/** Whether the owner-notification email fires for a new lead — on by default. */
export function getEffectiveNotifyOnNewLead(business: Pick<Business, "notifyOnNewLead">): boolean {
  return business.notifyOnNewLead ?? true;
}

/** Whether an in-app Notification fires when a customer reply arrives — on by default. */
export function getEffectiveNotifyOnReply(business: Pick<Business, "notifyOnReply">): boolean {
  return business.notifyOnReply ?? true;
}

/** Whether the daily cron scans this business's Gmail inbox for new customer inquiries (services/gmailLeadCapture.ts) — turned on automatically the moment Google is connected (services/business.ts's saveGoogleConnection); null only for a business that's never connected Google or has explicitly turned it back off. */
export function getEffectiveGmailLeadMonitoring(business: Pick<Business, "monitorGmailInbox">): boolean {
  return business.monitorGmailInbox ?? false;
}

/**
 * The one access gate for the whole app — agency-assigned (Settings, not
 * self-serve), not derived from a payment processor. `status !== 'active'` (a brand-new
 * signup defaults to 'inactive' until provisioned, or an agency can flip a
 * workspace to 'suspended') means a full lockout via
 * lib/session.ts's requireOnboardedBusiness, not just losing individual
 * features — there's no free/fallback tier to drop back to in this model.
 */
export function hasActiveEntitlement(business: Pick<Business, "status">): boolean {
  return business.status === "active";
}
