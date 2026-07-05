export const AIRTABLE_TABLES = {
  businesses: "Businesses",
  estimates: "Estimates",
  followUps: "FollowUps",
  replies: "Replies",
} as const;

/** Airtable field names for the Businesses table (tenant root — one record per business). */
export const BUSINESS_FIELDS = {
  businessName: "businessName",
  ownerName: "ownerName",
  ownerEmail: "ownerEmail",
  passwordHash: "passwordHash",
  followUpCadenceSentDays: "followUpCadenceSentDays",
  followUpCadenceFollowUp1Days: "followUpCadenceFollowUp1Days",
  followUpCadenceFollowUp2Days: "followUpCadenceFollowUp2Days",
  onboardingStep: "onboardingStep",
  onboardingCompletedAt: "onboardingCompletedAt",
  googleRefreshTokenEnc: "googleRefreshTokenEnc",
  googleConnectedEmail: "googleConnectedEmail",
  googleScopes: "googleScopes",
  googleConnectedAt: "googleConnectedAt",
  calendarId: "calendarId",
  industry: "industry",
  timezone: "timezone",
  workingHoursStart: "workingHoursStart",
  workingHoursEnd: "workingHoursEnd",
  emailSignature: "emailSignature",
  createdAt: "createdAt",
} as const;

/** Airtable field names for the Estimates table, kept in one place so schema drift is a one-line fix. */
export const ESTIMATE_FIELDS = {
  businessId: "businessId",
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
  businessId: "businessId",
  estimateId: "estimateId",
  message: "message",
  status: "status",
  scheduledDate: "scheduledDate",
  sentAt: "sentAt",
  calendarEventId: "calendarEventId",
} as const;

/** Airtable field names for the Replies table. */
export const REPLY_FIELDS = {
  businessId: "businessId",
  estimateId: "estimateId",
  gmailMessageId: "gmailMessageId",
  gmailThreadId: "gmailThreadId",
  fromEmail: "fromEmail",
  subject: "subject",
  snippet: "snippet",
  bodyText: "bodyText",
  receivedAt: "receivedAt",
  isRead: "isRead",
} as const;
