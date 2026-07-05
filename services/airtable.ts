import Airtable, { type FieldSet, type Record as AirtableRecord } from "airtable";
import {
  AIRTABLE_TABLES,
  ESTIMATE_FIELDS,
  FOLLOWUP_FIELDS,
  REPLY_FIELDS,
  LEAD_FIELDS,
  ACTIVITY_LOG_FIELDS,
  NOTIFICATION_FIELDS,
} from "@/config/airtable";
import { OPEN_ESTIMATE_STATUSES } from "@/config/constants";
import { env } from "@/lib/env";
import { todayIso } from "@/lib/date";
import type {
  ActivityLogEntry,
  Estimate,
  EstimateStatus,
  FollowUp,
  FollowUpStatus,
  Lead,
  NewActivityLogEntryInput,
  NewEstimateInput,
  NewFollowUpInput,
  NewLeadInput,
  NewNotificationInput,
  NewReplyInput,
  Notification,
  Reply,
  UpdateEstimateInput,
  UpdateFollowUpInput,
  UpdateLeadInput,
} from "@/types";

function getBase() {
  return new Airtable({ apiKey: env.airtableApiKey }).base(env.airtableBaseId);
}

/** Escapes single quotes for safe interpolation into an Airtable filterByFormula string. */
function escapeFormulaValue(value: string): string {
  return value.replace(/'/g, "\\'");
}

function scopedToBusiness(businessId: string): string {
  return `{${ESTIMATE_FIELDS.businessId}} = '${escapeFormulaValue(businessId)}'`;
}

function toEstimate(record: AirtableRecord<FieldSet>): Estimate {
  return {
    id: record.id,
    businessId: (record.get(ESTIMATE_FIELDS.businessId) as string) ?? "",
    customerName: (record.get(ESTIMATE_FIELDS.customerName) as string) ?? "",
    customerEmail: (record.get(ESTIMATE_FIELDS.customerEmail) as string) ?? "",
    businessName: (record.get(ESTIMATE_FIELDS.businessName) as string) ?? "",
    serviceType: (record.get(ESTIMATE_FIELDS.serviceType) as string) ?? "",
    estimateValue: (record.get(ESTIMATE_FIELDS.estimateValue) as number) ?? 0,
    dateSent: (record.get(ESTIMATE_FIELDS.dateSent) as string) ?? "",
    status: ((record.get(ESTIMATE_FIELDS.status) as EstimateStatus) ?? "Sent"),
    nextFollowUpDate: (record.get(ESTIMATE_FIELDS.nextFollowUpDate) as string) ?? null,
    lastContactDate: (record.get(ESTIMATE_FIELDS.lastContactDate) as string) ?? null,
    notes: (record.get(ESTIMATE_FIELDS.notes) as string) ?? "",
    gmailThreadId: (record.get(ESTIMATE_FIELDS.gmailThreadId) as string) ?? null,
    gmailLastMessageId: (record.get(ESTIMATE_FIELDS.gmailLastMessageId) as string) ?? null,
  };
}

function toFollowUp(record: AirtableRecord<FieldSet>): FollowUp {
  return {
    id: record.id,
    businessId: (record.get(FOLLOWUP_FIELDS.businessId) as string) ?? "",
    estimateId: (record.get(FOLLOWUP_FIELDS.estimateId) as string) ?? "",
    message: (record.get(FOLLOWUP_FIELDS.message) as string) ?? "",
    status: ((record.get(FOLLOWUP_FIELDS.status) as FollowUpStatus) ?? "Pending"),
    scheduledDate: (record.get(FOLLOWUP_FIELDS.scheduledDate) as string) ?? "",
    sentAt: (record.get(FOLLOWUP_FIELDS.sentAt) as string) ?? null,
    calendarEventId: (record.get(FOLLOWUP_FIELDS.calendarEventId) as string) ?? null,
  };
}

function toLead(record: AirtableRecord<FieldSet>): Lead {
  return {
    id: record.id,
    businessId: (record.get(LEAD_FIELDS.businessId) as string) ?? "",
    leadId: (record.get(LEAD_FIELDS.leadId) as string) ?? "",
    name: (record.get(LEAD_FIELDS.name) as string) ?? "",
    email: (record.get(LEAD_FIELDS.email) as string) ?? "",
    phone: (record.get(LEAD_FIELDS.phone) as string) ?? "",
    company: (record.get(LEAD_FIELDS.company) as string) ?? "",
    requestedService: (record.get(LEAD_FIELDS.requestedService) as string) ?? "",
    message: (record.get(LEAD_FIELDS.message) as string) ?? "",
    status: ((record.get(LEAD_FIELDS.status) as Lead["status"]) ?? "New Inquiry"),
    leadSource: (record.get(LEAD_FIELDS.leadSource) as string) ?? "Website",
    createdTime: (record.get(LEAD_FIELDS.createdTime) as string) ?? "",
    lastActivityAt: (record.get(LEAD_FIELDS.lastActivityAt) as string) ?? "",
    ipAddress: (record.get(LEAD_FIELDS.ipAddress) as string) ?? null,
    userAgent: (record.get(LEAD_FIELDS.userAgent) as string) ?? null,
    convertedEstimateId: (record.get(LEAD_FIELDS.convertedEstimateId) as string) ?? null,
    assignedTo: (record.get(LEAD_FIELDS.assignedTo) as string) ?? "",
    internalNotes: (record.get(LEAD_FIELDS.internalNotes) as string) ?? "",
    aiSummary: (record.get(LEAD_FIELDS.aiSummary) as string) ?? null,
    priorityScore: (record.get(LEAD_FIELDS.priorityScore) as number) ?? null,
    suggestedNextAction: (record.get(LEAD_FIELDS.suggestedNextAction) as string) ?? null,
    suggestedFollowUpTiming: (record.get(LEAD_FIELDS.suggestedFollowUpTiming) as string) ?? null,
  };
}

function toActivityLogEntry(record: AirtableRecord<FieldSet>): ActivityLogEntry {
  return {
    id: record.id,
    businessId: (record.get(ACTIVITY_LOG_FIELDS.businessId) as string) ?? "",
    leadId: (record.get(ACTIVITY_LOG_FIELDS.leadId) as string) ?? "",
    type: (record.get(ACTIVITY_LOG_FIELDS.type) as string) ?? "",
    description: (record.get(ACTIVITY_LOG_FIELDS.description) as string) ?? "",
    createdAt: (record.get(ACTIVITY_LOG_FIELDS.createdAt) as string) ?? "",
  };
}

function toNotification(record: AirtableRecord<FieldSet>): Notification {
  return {
    id: record.id,
    businessId: (record.get(NOTIFICATION_FIELDS.businessId) as string) ?? "",
    leadId: (record.get(NOTIFICATION_FIELDS.leadId) as string) ?? "",
    type: (record.get(NOTIFICATION_FIELDS.type) as string) ?? "",
    message: (record.get(NOTIFICATION_FIELDS.message) as string) ?? "",
    isRead: (record.get(NOTIFICATION_FIELDS.isRead) as boolean) ?? false,
    createdAt: (record.get(NOTIFICATION_FIELDS.createdAt) as string) ?? "",
  };
}

function toReply(record: AirtableRecord<FieldSet>): Reply {
  return {
    id: record.id,
    businessId: (record.get(REPLY_FIELDS.businessId) as string) ?? "",
    estimateId: (record.get(REPLY_FIELDS.estimateId) as string) ?? "",
    gmailMessageId: (record.get(REPLY_FIELDS.gmailMessageId) as string) ?? "",
    gmailThreadId: (record.get(REPLY_FIELDS.gmailThreadId) as string) ?? "",
    fromEmail: (record.get(REPLY_FIELDS.fromEmail) as string) ?? "",
    subject: (record.get(REPLY_FIELDS.subject) as string) ?? "",
    snippet: (record.get(REPLY_FIELDS.snippet) as string) ?? "",
    bodyText: (record.get(REPLY_FIELDS.bodyText) as string) ?? "",
    receivedAt: (record.get(REPLY_FIELDS.receivedAt) as string) ?? "",
    isRead: (record.get(REPLY_FIELDS.isRead) as boolean) ?? false,
  };
}

export async function getEstimates(businessId: string): Promise<Estimate[]> {
  const records = await getBase()(AIRTABLE_TABLES.estimates)
    .select({
      filterByFormula: scopedToBusiness(businessId),
      sort: [{ field: ESTIMATE_FIELDS.dateSent, direction: "desc" }],
    })
    .all();
  return records.map(toEstimate);
}

/**
 * Direct-id lookup — filterByFormula alone doesn't apply here, so ownership
 * is verified explicitly against the fetched record. A guessed/leaked
 * Airtable record ID from another business must never resolve.
 */
export async function getEstimate(businessId: string, id: string): Promise<Estimate | null> {
  try {
    const record = await getBase()(AIRTABLE_TABLES.estimates).find(id);
    const estimate = toEstimate(record);
    return estimate.businessId === businessId ? estimate : null;
  } catch {
    return null;
  }
}

export async function createEstimate(businessId: string, input: NewEstimateInput): Promise<Estimate> {
  const record = await getBase()(AIRTABLE_TABLES.estimates).create({
    [ESTIMATE_FIELDS.businessId]: businessId,
    [ESTIMATE_FIELDS.customerName]: input.customerName,
    [ESTIMATE_FIELDS.customerEmail]: input.customerEmail,
    [ESTIMATE_FIELDS.businessName]: input.businessName ?? env.defaultBusinessName,
    [ESTIMATE_FIELDS.serviceType]: input.serviceType,
    [ESTIMATE_FIELDS.estimateValue]: input.estimateValue,
    [ESTIMATE_FIELDS.dateSent]: input.dateSent,
    [ESTIMATE_FIELDS.status]: input.status ?? "Sent",
    [ESTIMATE_FIELDS.nextFollowUpDate]: input.nextFollowUpDate ?? undefined,
    [ESTIMATE_FIELDS.lastContactDate]: input.lastContactDate ?? undefined,
    [ESTIMATE_FIELDS.notes]: input.notes ?? "",
  });
  return toEstimate(record);
}

export async function updateEstimate(
  businessId: string,
  id: string,
  input: UpdateEstimateInput
): Promise<Estimate> {
  const existing = await getEstimate(businessId, id);
  if (!existing) {
    throw new Error("Estimate not found for this business.");
  }

  const fields: FieldSet = {};
  if (input.customerName !== undefined) fields[ESTIMATE_FIELDS.customerName] = input.customerName;
  if (input.customerEmail !== undefined) fields[ESTIMATE_FIELDS.customerEmail] = input.customerEmail;
  if (input.businessName !== undefined) fields[ESTIMATE_FIELDS.businessName] = input.businessName;
  if (input.serviceType !== undefined) fields[ESTIMATE_FIELDS.serviceType] = input.serviceType;
  if (input.estimateValue !== undefined) fields[ESTIMATE_FIELDS.estimateValue] = input.estimateValue;
  if (input.dateSent !== undefined) fields[ESTIMATE_FIELDS.dateSent] = input.dateSent;
  if (input.status !== undefined) fields[ESTIMATE_FIELDS.status] = input.status;
  if (input.nextFollowUpDate !== undefined) fields[ESTIMATE_FIELDS.nextFollowUpDate] = input.nextFollowUpDate ?? undefined;
  if (input.lastContactDate !== undefined) fields[ESTIMATE_FIELDS.lastContactDate] = input.lastContactDate ?? undefined;
  if (input.notes !== undefined) fields[ESTIMATE_FIELDS.notes] = input.notes;
  if (input.gmailThreadId !== undefined) fields[ESTIMATE_FIELDS.gmailThreadId] = input.gmailThreadId ?? undefined;
  if (input.gmailLastMessageId !== undefined) fields[ESTIMATE_FIELDS.gmailLastMessageId] = input.gmailLastMessageId ?? undefined;

  const record = await getBase()(AIRTABLE_TABLES.estimates).update(id, fields);
  return toEstimate(record);
}

/** Open estimates whose nextFollowUpDate has arrived (or passed), scoped to one business. */
export async function getDueFollowUps(businessId: string): Promise<Estimate[]> {
  const estimates = await getEstimates(businessId);
  const today = todayIso();
  return estimates.filter(
    (estimate) =>
      OPEN_ESTIMATE_STATUSES.includes(estimate.status) &&
      !!estimate.nextFollowUpDate &&
      estimate.nextFollowUpDate <= today
  );
}

export async function getFollowUps(businessId: string): Promise<FollowUp[]> {
  const records = await getBase()(AIRTABLE_TABLES.followUps)
    .select({
      filterByFormula: `{${FOLLOWUP_FIELDS.businessId}} = '${escapeFormulaValue(businessId)}'`,
      sort: [{ field: FOLLOWUP_FIELDS.scheduledDate, direction: "desc" }],
    })
    .all();
  return records.map(toFollowUp);
}

export async function getFollowUpsForEstimate(businessId: string, estimateId: string): Promise<FollowUp[]> {
  const followUps = await getFollowUps(businessId);
  return followUps.filter((f) => f.estimateId === estimateId);
}

/** Direct-id lookup — ownership verified against the fetched record, same rationale as getEstimate. */
export async function getFollowUp(businessId: string, id: string): Promise<FollowUp | null> {
  try {
    const record = await getBase()(AIRTABLE_TABLES.followUps).find(id);
    const followUp = toFollowUp(record);
    return followUp.businessId === businessId ? followUp : null;
  } catch {
    return null;
  }
}

export async function createFollowUp(businessId: string, input: NewFollowUpInput): Promise<FollowUp> {
  const record = await getBase()(AIRTABLE_TABLES.followUps).create({
    [FOLLOWUP_FIELDS.businessId]: businessId,
    [FOLLOWUP_FIELDS.estimateId]: input.estimateId,
    [FOLLOWUP_FIELDS.message]: input.message,
    [FOLLOWUP_FIELDS.status]: input.status ?? "Pending",
    [FOLLOWUP_FIELDS.scheduledDate]: input.scheduledDate,
  });
  return toFollowUp(record);
}

export async function updateFollowUp(
  businessId: string,
  id: string,
  input: UpdateFollowUpInput
): Promise<FollowUp> {
  const existing = await getFollowUp(businessId, id);
  if (!existing) {
    throw new Error("Follow-up not found for this business.");
  }

  const fields: FieldSet = {};
  if (input.message !== undefined) fields[FOLLOWUP_FIELDS.message] = input.message;
  if (input.status !== undefined) fields[FOLLOWUP_FIELDS.status] = input.status;
  if (input.scheduledDate !== undefined) fields[FOLLOWUP_FIELDS.scheduledDate] = input.scheduledDate;
  if (input.sentAt !== undefined) fields[FOLLOWUP_FIELDS.sentAt] = input.sentAt ?? undefined;
  if (input.calendarEventId !== undefined)
    fields[FOLLOWUP_FIELDS.calendarEventId] = input.calendarEventId ?? "";

  // typecast lets Airtable add "Failed" as a select option the first time it's written,
  // since the choices list can only be extended this way (not via the schema/meta API).
  const record = await getBase()(AIRTABLE_TABLES.followUps).update(id, fields, { typecast: true });
  return toFollowUp(record);
}

export async function getReplies(businessId: string): Promise<Reply[]> {
  const records = await getBase()(AIRTABLE_TABLES.replies)
    .select({
      filterByFormula: `{${REPLY_FIELDS.businessId}} = '${escapeFormulaValue(businessId)}'`,
      sort: [{ field: REPLY_FIELDS.receivedAt, direction: "desc" }],
    })
    .all();
  return records.map(toReply);
}

export async function getRepliesForEstimate(businessId: string, estimateId: string): Promise<Reply[]> {
  const replies = await getReplies(businessId);
  return replies.filter((r) => r.estimateId === estimateId);
}

export async function createReply(businessId: string, input: NewReplyInput): Promise<Reply> {
  const record = await getBase()(AIRTABLE_TABLES.replies).create({
    [REPLY_FIELDS.businessId]: businessId,
    [REPLY_FIELDS.estimateId]: input.estimateId,
    [REPLY_FIELDS.gmailMessageId]: input.gmailMessageId,
    [REPLY_FIELDS.gmailThreadId]: input.gmailThreadId,
    [REPLY_FIELDS.fromEmail]: input.fromEmail,
    [REPLY_FIELDS.subject]: input.subject,
    [REPLY_FIELDS.snippet]: input.snippet,
    [REPLY_FIELDS.bodyText]: input.bodyText,
    [REPLY_FIELDS.receivedAt]: input.receivedAt,
    [REPLY_FIELDS.isRead]: false,
  });
  return toReply(record);
}

export async function markReplyRead(businessId: string, id: string): Promise<Reply> {
  const replies = await getReplies(businessId);
  if (!replies.some((r) => r.id === id)) {
    throw new Error("Reply not found for this business.");
  }
  const record = await getBase()(AIRTABLE_TABLES.replies).update(id, { [REPLY_FIELDS.isRead]: true });
  return toReply(record);
}

export async function getLeads(businessId: string): Promise<Lead[]> {
  const records = await getBase()(AIRTABLE_TABLES.leads)
    .select({
      filterByFormula: `{${LEAD_FIELDS.businessId}} = '${escapeFormulaValue(businessId)}'`,
      sort: [{ field: LEAD_FIELDS.createdTime, direction: "desc" }],
    })
    .all();
  return records.map(toLead);
}

/** Direct-id lookup — ownership verified against the fetched record, same rationale as getEstimate. */
export async function getLead(businessId: string, id: string): Promise<Lead | null> {
  try {
    const record = await getBase()(AIRTABLE_TABLES.leads).find(id);
    const lead = toLead(record);
    return lead.businessId === businessId ? lead : null;
  } catch {
    return null;
  }
}

/** Count of unreviewed leads — the live signal behind the dashboard's notification banner and sidebar badge. */
export async function getNewLeadCount(businessId: string): Promise<number> {
  const leads = await getLeads(businessId);
  return leads.filter((l) => l.status === "New Inquiry").length;
}

/**
 * Creates a Lead from a validated, sanitized submission. Always
 * "New Inquiry"/"Website" on creation — status only changes later via
 * updateLead (Convert to Estimate / Archive). AI placeholder fields are left
 * null — see services/leadService.ts's getAiInsightsPlaceholder.
 */
export async function createLead(businessId: string, leadId: string, input: NewLeadInput): Promise<Lead> {
  const now = new Date().toISOString();
  const record = await getBase()(AIRTABLE_TABLES.leads).create({
    [LEAD_FIELDS.businessId]: businessId,
    [LEAD_FIELDS.leadId]: leadId,
    [LEAD_FIELDS.name]: input.name,
    [LEAD_FIELDS.email]: input.email,
    [LEAD_FIELDS.phone]: input.phone ?? "",
    [LEAD_FIELDS.company]: input.company ?? "",
    [LEAD_FIELDS.requestedService]: input.requestedService ?? "",
    [LEAD_FIELDS.message]: input.message,
    [LEAD_FIELDS.status]: "New Inquiry",
    [LEAD_FIELDS.leadSource]: "Website",
    [LEAD_FIELDS.createdTime]: now,
    [LEAD_FIELDS.lastActivityAt]: now,
    [LEAD_FIELDS.ipAddress]: input.ipAddress ?? "",
    [LEAD_FIELDS.userAgent]: input.userAgent ?? "",
    [LEAD_FIELDS.assignedTo]: "",
    [LEAD_FIELDS.internalNotes]: "",
  });
  return toLead(record);
}

export async function updateLead(businessId: string, id: string, input: UpdateLeadInput): Promise<Lead> {
  const existing = await getLead(businessId, id);
  if (!existing) {
    throw new Error("Lead not found for this business.");
  }

  const fields: FieldSet = {};
  if (input.status !== undefined) fields[LEAD_FIELDS.status] = input.status;
  if (input.convertedEstimateId !== undefined)
    fields[LEAD_FIELDS.convertedEstimateId] = input.convertedEstimateId ?? undefined;
  if (input.assignedTo !== undefined) fields[LEAD_FIELDS.assignedTo] = input.assignedTo;
  if (input.internalNotes !== undefined) fields[LEAD_FIELDS.internalNotes] = input.internalNotes;
  if (input.lastActivityAt !== undefined) fields[LEAD_FIELDS.lastActivityAt] = input.lastActivityAt;

  const record = await getBase()(AIRTABLE_TABLES.leads).update(id, fields);
  return toLead(record);
}

export async function getActivityLog(businessId: string): Promise<ActivityLogEntry[]> {
  const records = await getBase()(AIRTABLE_TABLES.activityLog)
    .select({
      filterByFormula: `{${ACTIVITY_LOG_FIELDS.businessId}} = '${escapeFormulaValue(businessId)}'`,
      sort: [{ field: ACTIVITY_LOG_FIELDS.createdAt, direction: "desc" }],
    })
    .all();
  return records.map(toActivityLogEntry);
}

export async function getActivityForLead(businessId: string, leadId: string): Promise<ActivityLogEntry[]> {
  const entries = await getActivityLog(businessId);
  return entries.filter((e) => e.leadId === leadId);
}

export async function createActivityLogEntry(
  businessId: string,
  input: NewActivityLogEntryInput
): Promise<ActivityLogEntry> {
  const record = await getBase()(AIRTABLE_TABLES.activityLog).create({
    [ACTIVITY_LOG_FIELDS.businessId]: businessId,
    [ACTIVITY_LOG_FIELDS.leadId]: input.leadId,
    [ACTIVITY_LOG_FIELDS.type]: input.type,
    [ACTIVITY_LOG_FIELDS.description]: input.description,
    [ACTIVITY_LOG_FIELDS.createdAt]: new Date().toISOString(),
  });
  return toActivityLogEntry(record);
}

export async function getNotifications(businessId: string): Promise<Notification[]> {
  const records = await getBase()(AIRTABLE_TABLES.notifications)
    .select({
      filterByFormula: `{${NOTIFICATION_FIELDS.businessId}} = '${escapeFormulaValue(businessId)}'`,
      sort: [{ field: NOTIFICATION_FIELDS.createdAt, direction: "desc" }],
    })
    .all();
  return records.map(toNotification);
}

export async function getUnreadNotificationCount(businessId: string): Promise<number> {
  const notifications = await getNotifications(businessId);
  return notifications.filter((n) => !n.isRead).length;
}

export async function createNotification(businessId: string, input: NewNotificationInput): Promise<Notification> {
  const record = await getBase()(AIRTABLE_TABLES.notifications).create({
    [NOTIFICATION_FIELDS.businessId]: businessId,
    [NOTIFICATION_FIELDS.leadId]: input.leadId,
    [NOTIFICATION_FIELDS.type]: input.type,
    [NOTIFICATION_FIELDS.message]: input.message,
    [NOTIFICATION_FIELDS.isRead]: false,
    [NOTIFICATION_FIELDS.createdAt]: new Date().toISOString(),
  });
  return toNotification(record);
}

export async function markNotificationRead(businessId: string, id: string): Promise<Notification> {
  const notifications = await getNotifications(businessId);
  if (!notifications.some((n) => n.id === id)) {
    throw new Error("Notification not found for this business.");
  }
  const record = await getBase()(AIRTABLE_TABLES.notifications).update(id, {
    [NOTIFICATION_FIELDS.isRead]: true,
  });
  return toNotification(record);
}

/** Marks every unread notification read in one pass — used by the bell dropdown's "Mark all read". */
export async function markAllNotificationsRead(businessId: string): Promise<number> {
  const unread = (await getNotifications(businessId)).filter((n) => !n.isRead);
  await Promise.all(
    unread.map((n) =>
      getBase()(AIRTABLE_TABLES.notifications).update(n.id, { [NOTIFICATION_FIELDS.isRead]: true })
    )
  );
  return unread.length;
}
