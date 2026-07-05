export interface Business {
  id: string;
  businessName: string;
  ownerName: string;
  ownerEmail: string;
  /** `scrypt` salt:hash hex string — never the plaintext password. */
  passwordHash: string;
  /** Per-business cadence override; falls back to DEFAULT_FOLLOW_UP_CADENCE_DAYS when null. */
  followUpCadenceSentDays: number | null;
  followUpCadenceFollowUp1Days: number | null;
  followUpCadenceFollowUp2Days: number | null;
  /** Furthest completed onboarding wizard step (0 = none), for resume support. */
  onboardingStep: number;
  onboardingCompletedAt: string | null;
  /** AES-256-GCM encrypted (lib/crypto.ts) — the only long-lived Google credential we store. */
  googleRefreshTokenEnc: string | null;
  googleConnectedEmail: string | null;
  /** Space-separated granted scopes, for future scope-upgrade detection. */
  googleScopes: string | null;
  googleConnectedAt: string | null;
  /** Which calendar Calendar reminders get created on — defaults to "primary" when blank. */
  calendarId: string | null;
  /** Primary service category — same vocabulary as an Estimate's serviceType (config/constants.ts SERVICE_TYPES). */
  industry: string | null;
  /** IANA timezone; falls back to APP_TIMEZONE when null. */
  timezone: string | null;
  /** Hour-of-day (0-23) the business's work day starts/ends; falls back to CALENDAR_REMINDER_HOUR/17 when null. */
  workingHoursStart: number | null;
  workingHoursEnd: number | null;
  /** Appended to the body of every outbound follow-up email when set. */
  emailSignature: string | null;
  createdAt: string;
  /** Bearer-token secret for POST /api/intake — a website's contact form authenticates with this to identify the tenant. */
  intakeApiKey: string | null;
  intakeApiKeyCreatedAt: string | null;
  /** Opt-in, defaults to false when null (see getEffectiveAutoBooking in services/business.ts) — off means a requested appointment becomes a reviewable recommendation on the Lead instead of an automatic Calendar booking. */
  autoBookAppointments: boolean | null;
  /** Outbound event dispatch target (services/webhookDispatcher.ts) — null means outbound webhooks are off. Separate concept from the inbound intake API key/webhook. */
  outboundWebhookUrl: string | null;
  /** Both default true when null — see getEffectiveNotifyOnNewLead/getEffectiveNotifyOnReply in services/business.ts. */
  notifyOnNewLead: boolean | null;
  notifyOnReply: boolean | null;
  /** Opt-in, defaults to false when null (see getEffectiveGmailLeadMonitoring in services/business.ts) — when on, the daily cron scans this business's Gmail inbox for new customer inquiries and creates a Lead (source "Gmail") for each one not already tied to a known Estimate thread. */
  monitorGmailInbox: boolean | null;
}

export type NewBusinessInput = Pick<Business, "businessName" | "ownerName" | "ownerEmail" | "passwordHash">;

export type UpdateBusinessInput = Partial<Omit<Business, "id" | "createdAt">>;
