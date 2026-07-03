export const AIRTABLE_TABLES = {
  estimates: "Estimates",
  followUps: "FollowUps",
} as const;

/** Airtable field names for the Estimates table, kept in one place so schema drift is a one-line fix. */
export const ESTIMATE_FIELDS = {
  customerName: "customerName",
  customerEmail: "customerEmail",
  businessName: "businessName",
  serviceType: "serviceType",
  estimateValue: "estimateValue",
  dateSent: "dateSent",
  status: "status",
  nextFollowUpDate: "nextFollowUpDate",
  lastContactDate: "lastContactDate",
  notes: "notes",
  gmailThreadId: "gmailThreadId",
  gmailLastMessageId: "gmailLastMessageId",
} as const;

/** Airtable field names for the FollowUps table. */
export const FOLLOWUP_FIELDS = {
  estimateId: "estimateId",
  message: "message",
  status: "status",
  scheduledDate: "scheduledDate",
  sentAt: "sentAt",
} as const;
