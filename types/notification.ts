/** An in-app notification for the business owner (e.g. "New lead from Jordan Rivera"), surfaced via the header bell. */
export interface Notification {
  id: string;
  businessId: string;
  /** Airtable record id of the related Lead, when applicable (every notification today is lead-scoped). */
  leadId: string;
  type: string;
  message: string;
  isRead: boolean;
  createdAt: string;
}

export type NewNotificationInput = Pick<Notification, "leadId" | "type" | "message">;
