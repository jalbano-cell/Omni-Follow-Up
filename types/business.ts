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
  createdAt: string;
}

export type NewBusinessInput = Pick<Business, "businessName" | "ownerName" | "ownerEmail" | "passwordHash">;

export type UpdateBusinessInput = Partial<Omit<Business, "id" | "createdAt">>;
