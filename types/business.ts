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
  onboardingCompletedAt: string | null;
  createdAt: string;
}

export type NewBusinessInput = Pick<Business, "businessName" | "ownerName" | "ownerEmail" | "passwordHash">;

export type UpdateBusinessInput = Partial<Omit<Business, "id" | "createdAt">>;
