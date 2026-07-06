export type EstimateStatus =
  | "Sent"
  | "Follow-up 1"
  | "Follow-up 2"
  | "Booked"
  | "Lost";

export interface Estimate {
  id: string;
  businessId: string;
  /** Human-readable unique ID (e.g. "EST-M3F2K1-A9C") shown in the UI and available as the {{estimate_number}} merge variable — distinct from the database record id. */
  estimateNumber: string;
  /** The Lead this estimate was converted from, if any — lets estimate-lifecycle events (follow-up sent, booked, etc.) also log to that Lead's Timeline. Null for estimates created without a linked lead. */
  leadId: string | null;
  customerName: string;
  customerEmail: string;
  businessName: string;
  serviceType: string;
  estimateValue: number;
  dateSent: string;
  status: EstimateStatus;
  nextFollowUpDate: string | null;
  lastContactDate: string | null;
  notes: string;
  /** Gmail thread ID for the conversation with this customer, set after the first send. */
  gmailThreadId: string | null;
  /** RFC 822 Message-ID header of the most recently sent email, used for In-Reply-To threading. */
  gmailLastMessageId: string | null;
  /** Monotonic counter embedded in this estimate's customer share link (lib/auth.ts); bumping it invalidates a previously shared link. Defaults to 0. */
  shareTokenVersion: number;
}

export type NewEstimateInput = Pick<
  Estimate,
  "customerName" | "customerEmail" | "serviceType" | "estimateValue" | "dateSent"
> &
  Partial<Pick<Estimate, "businessName" | "status" | "nextFollowUpDate" | "lastContactDate" | "notes" | "leadId">>;

export type UpdateEstimateInput = Partial<Omit<Estimate, "id" | "businessId" | "estimateNumber">>;
