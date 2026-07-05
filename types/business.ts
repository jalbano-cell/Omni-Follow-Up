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
}

export type NewBusinessInput = Pick<Business, "businessName" | "ownerName" | "ownerEmail" | "passwordHash">;

export type UpdateBusinessInput = Partial<Omit<Business, "id" | "createdAt">>;
