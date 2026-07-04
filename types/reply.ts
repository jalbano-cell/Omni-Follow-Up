export interface Reply {
  id: string;
  businessId: string;
  estimateId: string;
  gmailMessageId: string;
  gmailThreadId: string;
  fromEmail: string;
  subject: string;
  snippet: string;
  bodyText: string;
  receivedAt: string;
  isRead: boolean;
}

export type NewReplyInput = Pick<
  Reply,
  "estimateId" | "gmailMessageId" | "gmailThreadId" | "fromEmail" | "subject" | "snippet" | "bodyText" | "receivedAt"
>;

/** A reply joined with its parent estimate, for inbox UI rendering. */
export interface ReplyInboxItem extends Reply {
  customerName: string;
  businessName: string;
}
