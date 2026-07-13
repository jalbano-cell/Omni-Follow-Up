export interface Reply {
  id: string;
  businessId: string;
  estimateId: string;
  /** Opaque provider message id — despite the name, a Graph message id for a Microsoft-connected business (see types/estimate.ts's gmailThreadId doc comment for why). */
  gmailMessageId: string;
  /** Opaque provider thread/conversation id — same dual-provider reuse as gmailMessageId above. */
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
