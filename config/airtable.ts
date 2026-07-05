export const AIRTABLE_TABLES = {
  businesses: "Businesses",
  estimates: "Estimates",
  followUps: "FollowUps",
  replies: "Replies",
  leads: "Leads",
  activityLog: "ActivityLog",
  notifications: "Notifications",
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
  /** Bearer-token secret for POST /api/intake — looks up which business a website submission belongs to. */
  intakeApiKey: "intakeApiKey",
  intakeApiKeyCreatedAt: "intakeApiKeyCreatedAt",
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

/** Airtable field names for the Leads table (every inbound business inquiry — today, exclusively via POST /api/intake). */
export const LEAD_FIELDS = {
  businessId: "businessId",
  leadId: "leadId",
  name: "name",
  email: "email",
  phone: "phone",
  company: "company",
  requestedService: "requestedService",
  message: "message",
  status: "status",
  leadSource: "leadSource",
  createdTime: "createdTime",
  lastActivityAt: "lastActivityAt",
  ipAddress: "ipAddress",
  userAgent: "userAgent",
  convertedEstimateId: "convertedEstimateId",
  /** Free-text — no team/user roster exists yet, so this isn't a linked-record field. Defaults to the business owner. */
  assignedTo: "assignedTo",
  internalNotes: "internalNotes",
  // AI Lead Intelligence fields — populated by services/aiInsightsService.ts immediately after a lead is
  // created. Null/empty until analysis completes (or forever, if aiStatus ends up "failed"): never fabricated.
  aiSummary: "aiSummary",
  aiCategory: "aiCategory",
  aiPriority: "aiPriority",
  aiPriorityReason: "aiPriorityReason",
  aiOpportunityValueRange: "aiOpportunityValueRange",
  aiOpportunityConfidence: "aiOpportunityConfidence",
  suggestedNextAction: "suggestedNextAction",
  aiResponseUrgency: "aiResponseUrgency",
  aiResponseUrgencyReason: "aiResponseUrgencyReason",
  aiGeneratedAt: "aiGeneratedAt",
  /** "pending" | "completed" | "failed" | "dismissed" — see services/aiInsightsService.ts's AiInsightsStatus. */
  aiStatus: "aiStatus",
} as const;

/** Airtable field names for the ActivityLog table — a durable per-business/per-lead event trail. */
export const ACTIVITY_LOG_FIELDS = {
  businessId: "businessId",
  leadId: "leadId",
  type: "type",
  description: "description",
  createdAt: "createdAt",
} as const;

/** Airtable field names for the Notifications table — in-app alerts for the business owner. */
export const NOTIFICATION_FIELDS = {
  businessId: "businessId",
  leadId: "leadId",
  type: "type",
  message: "message",
  isRead: "isRead",
  createdAt: "createdAt",
} as const;
