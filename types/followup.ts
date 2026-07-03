export type FollowUpStatus = "Pending" | "Sent" | "Approved" | "Rejected";

export interface FollowUp {
  id: string;
  estimateId: string;
  message: string;
  status: FollowUpStatus;
  scheduledDate: string;
}

export type NewFollowUpInput = Pick<FollowUp, "estimateId" | "message" | "scheduledDate"> &
  Partial<Pick<FollowUp, "status">>;

export type UpdateFollowUpInput = Partial<Omit<FollowUp, "id" | "estimateId">>;

/** A follow-up joined with its parent estimate, for queue UI rendering. */
export interface FollowUpQueueItem extends FollowUp {
  customerName: string;
  businessName: string;
  estimateValue: number;
  daysSinceSent: number;
}
