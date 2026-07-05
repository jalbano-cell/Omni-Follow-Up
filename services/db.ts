import { insertRow, updateRow, deleteRow, selectById, selectWhere } from "@/lib/supabase";
import { OPEN_ESTIMATE_STATUSES } from "@/config/constants";
import { env } from "@/lib/env";
import { todayIso } from "@/lib/date";
import type { Database } from "@/types/supabase";
import type {
  ActivityLogEntry,
  Estimate,
  FollowUp,
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

/**
 * The app's central data access layer — every Estimate/FollowUp/Reply/Lead/
 * ActivityLog/Notification read and write goes through here, against
 * Supabase (Postgres). Airtable has been fully retired (see CLAUDE.md's
 * "Supabase migration" section for the cutover history); this file replaces
 * the old services/airtable.ts one-for-one, same exported function names and
 * TypeScript shapes, so no call site elsewhere in the app had to change.
 */

type EstimateRow = Database["public"]["Tables"]["estimates"]["Row"];
type FollowUpRow = Database["public"]["Tables"]["followups"]["Row"];
type ReplyRow = Database["public"]["Tables"]["replies"]["Row"];
type LeadRow = Database["public"]["Tables"]["leads"]["Row"];
type ActivityLogRow = Database["public"]["Tables"]["activity_logs"]["Row"];
type NotificationRow = Database["public"]["Tables"]["notifications"]["Row"];

function toEstimate(row: EstimateRow): Estimate {
  return {
    id: row.id,
    businessId: row.workspace_id,
    customerName: row.customer_name,
    customerEmail: row.customer_email,
    businessName: row.business_name,
    serviceType: row.service_type,
    estimateValue: row.value,
    dateSent: row.date_sent,
    status: row.status as Estimate["status"],
    nextFollowUpDate: row.next_followup_date,
    lastContactDate: row.last_contact_date,
    notes: row.notes,
    gmailThreadId: row.gmail_thread_id,
    gmailLastMessageId: row.gmail_last_message_id,
  };
}

function toFollowUp(row: FollowUpRow): FollowUp {
  return {
    id: row.id,
    businessId: row.workspace_id,
    estimateId: row.estimate_id,
    message: row.message,
    status: row.status as FollowUp["status"],
    scheduledDate: row.scheduled_date,
    sentAt: row.sent_at,
    calendarEventId: row.calendar_event_id,
  };
}

function toReply(row: ReplyRow): Reply {
  return {
    id: row.id,
    businessId: row.workspace_id,
    estimateId: row.estimate_id,
    gmailMessageId: row.gmail_message_id,
    gmailThreadId: row.gmail_thread_id,
    fromEmail: row.from_email,
    subject: row.subject,
    snippet: row.snippet,
    bodyText: row.body_text,
    receivedAt: row.received_at,
    isRead: row.is_read,
  };
}

function toLead(row: LeadRow): Lead {
  return {
    id: row.id,
    businessId: row.workspace_id,
    leadId: row.lead_id,
    name: row.name,
    email: row.email,
    phone: row.phone,
    company: row.company,
    requestedService: row.service,
    message: row.message,
    status: row.status as Lead["status"],
    leadSource: row.source,
    createdTime: row.created_at,
    lastActivityAt: row.last_activity_at,
    ipAddress: row.ip_address,
    userAgent: row.user_agent,
    convertedEstimateId: row.converted_estimate_id,
    assignedTo: row.assigned_to,
    internalNotes: row.internal_notes,
    aiSummary: row.ai_summary,
    aiCategory: row.ai_category,
    aiPriority: row.ai_priority as Lead["aiPriority"],
    aiPriorityReason: row.ai_priority_reason,
    aiOpportunityValueRange: row.ai_opportunity_value_range,
    aiOpportunityConfidence: row.ai_opportunity_confidence,
    suggestedNextAction: row.suggested_next_action,
    aiResponseUrgency: row.ai_response_urgency as Lead["aiResponseUrgency"],
    aiResponseUrgencyReason: row.ai_response_urgency_reason,
    aiGeneratedAt: row.ai_generated_at,
    aiStatus: row.ai_status as Lead["aiStatus"],
  };
}

function toActivityLogEntry(row: ActivityLogRow): ActivityLogEntry {
  return {
    id: row.id,
    businessId: row.workspace_id,
    leadId: row.lead_id ?? "",
    type: row.action,
    description: row.description,
    createdAt: row.created_at,
  };
}

function toNotification(row: NotificationRow): Notification {
  return {
    id: row.id,
    businessId: row.workspace_id,
    leadId: row.lead_id ?? "",
    type: row.type,
    message: row.message,
    isRead: row.is_read,
    createdAt: row.created_at,
  };
}

// ---------------------------------------------------------------------------
// Estimates
// ---------------------------------------------------------------------------

export async function getEstimates(businessId: string): Promise<Estimate[]> {
  const rows = await selectWhere("estimates", { workspace_id: businessId }, { orderBy: "date_sent", ascending: false });
  return rows.map(toEstimate);
}

/** Direct-id lookup — ownership verified against the fetched row. A guessed/leaked id from another business must never resolve. */
export async function getEstimate(businessId: string, id: string): Promise<Estimate | null> {
  const row = await selectById("estimates", id);
  if (!row || row.workspace_id !== businessId) return null;
  return toEstimate(row);
}

export async function createEstimate(businessId: string, input: NewEstimateInput): Promise<Estimate> {
  const row = await insertRow("estimates", {
    workspace_id: businessId,
    customer_name: input.customerName,
    customer_email: input.customerEmail,
    business_name: input.businessName ?? env.defaultBusinessName,
    service_type: input.serviceType,
    value: input.estimateValue,
    date_sent: input.dateSent,
    status: input.status ?? "Sent",
    next_followup_date: input.nextFollowUpDate ?? null,
    last_contact_date: input.lastContactDate ?? null,
    notes: input.notes ?? "",
  });
  return toEstimate(row);
}

export async function updateEstimate(businessId: string, id: string, input: UpdateEstimateInput): Promise<Estimate> {
  const existing = await getEstimate(businessId, id);
  if (!existing) {
    throw new Error("Estimate not found for this business.");
  }

  const fields: Database["public"]["Tables"]["estimates"]["Update"] = {};
  if (input.customerName !== undefined) fields.customer_name = input.customerName;
  if (input.customerEmail !== undefined) fields.customer_email = input.customerEmail;
  if (input.businessName !== undefined) fields.business_name = input.businessName;
  if (input.serviceType !== undefined) fields.service_type = input.serviceType;
  if (input.estimateValue !== undefined) fields.value = input.estimateValue;
  if (input.dateSent !== undefined) fields.date_sent = input.dateSent;
  if (input.status !== undefined) fields.status = input.status;
  if (input.nextFollowUpDate !== undefined) fields.next_followup_date = input.nextFollowUpDate;
  if (input.lastContactDate !== undefined) fields.last_contact_date = input.lastContactDate;
  if (input.notes !== undefined) fields.notes = input.notes;
  if (input.gmailThreadId !== undefined) fields.gmail_thread_id = input.gmailThreadId;
  if (input.gmailLastMessageId !== undefined) fields.gmail_last_message_id = input.gmailLastMessageId;

  const row = await updateRow("estimates", id, fields);
  return toEstimate(row);
}

/**
 * Deletes an Estimate and everything that only makes sense in relation to it
 * — its FollowUps and Replies — so the Follow-up Queue and Reply Inbox never
 * show orphaned rows pointing at a deleted estimate. Ownership is verified
 * first; no-ops if the estimate doesn't exist or belongs to a different business.
 */
export async function deleteEstimate(businessId: string, id: string): Promise<void> {
  const estimate = await getEstimate(businessId, id);
  if (!estimate) return;

  const [followUps, replies] = await Promise.all([
    getFollowUpsForEstimate(businessId, id),
    getRepliesForEstimate(businessId, id),
  ]);

  await Promise.all([
    ...followUps.map((f) => deleteRow("followups", f.id)),
    ...replies.map((r) => deleteRow("replies", r.id)),
  ]);

  await deleteRow("estimates", id);
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

// ---------------------------------------------------------------------------
// FollowUps
// ---------------------------------------------------------------------------

export async function getFollowUps(businessId: string): Promise<FollowUp[]> {
  const rows = await selectWhere("followups", { workspace_id: businessId }, { orderBy: "scheduled_date", ascending: false });
  return rows.map(toFollowUp);
}

export async function getFollowUpsForEstimate(businessId: string, estimateId: string): Promise<FollowUp[]> {
  const rows = await selectWhere("followups", { workspace_id: businessId, estimate_id: estimateId });
  return rows.map(toFollowUp);
}

/** Direct-id lookup — ownership verified against the fetched row, same rationale as getEstimate. */
export async function getFollowUp(businessId: string, id: string): Promise<FollowUp | null> {
  const row = await selectById("followups", id);
  if (!row || row.workspace_id !== businessId) return null;
  return toFollowUp(row);
}

export async function createFollowUp(businessId: string, input: NewFollowUpInput): Promise<FollowUp> {
  const row = await insertRow("followups", {
    workspace_id: businessId,
    estimate_id: input.estimateId,
    message: input.message,
    status: input.status ?? "Pending",
    scheduled_date: input.scheduledDate,
  });
  return toFollowUp(row);
}

export async function updateFollowUp(businessId: string, id: string, input: UpdateFollowUpInput): Promise<FollowUp> {
  const existing = await getFollowUp(businessId, id);
  if (!existing) {
    throw new Error("Follow-up not found for this business.");
  }

  const fields: Database["public"]["Tables"]["followups"]["Update"] = {};
  if (input.message !== undefined) fields.message = input.message;
  if (input.status !== undefined) fields.status = input.status;
  if (input.scheduledDate !== undefined) fields.scheduled_date = input.scheduledDate;
  if (input.sentAt !== undefined) fields.sent_at = input.sentAt;
  if (input.calendarEventId !== undefined) fields.calendar_event_id = input.calendarEventId;

  const row = await updateRow("followups", id, fields);
  return toFollowUp(row);
}

// ---------------------------------------------------------------------------
// Replies
// ---------------------------------------------------------------------------

export async function getReplies(businessId: string): Promise<Reply[]> {
  const rows = await selectWhere("replies", { workspace_id: businessId }, { orderBy: "received_at", ascending: false });
  return rows.map(toReply);
}

export async function getRepliesForEstimate(businessId: string, estimateId: string): Promise<Reply[]> {
  const rows = await selectWhere("replies", { workspace_id: businessId, estimate_id: estimateId });
  return rows.map(toReply);
}

export async function createReply(businessId: string, input: NewReplyInput): Promise<Reply> {
  const row = await insertRow("replies", {
    workspace_id: businessId,
    estimate_id: input.estimateId,
    gmail_message_id: input.gmailMessageId,
    gmail_thread_id: input.gmailThreadId,
    from_email: input.fromEmail,
    subject: input.subject,
    snippet: input.snippet,
    body_text: input.bodyText,
    received_at: input.receivedAt,
    is_read: false,
  });
  return toReply(row);
}

export async function markReplyRead(businessId: string, id: string): Promise<Reply> {
  const row = await selectById("replies", id);
  if (!row || row.workspace_id !== businessId) {
    throw new Error("Reply not found for this business.");
  }
  const updated = await updateRow("replies", id, { is_read: true });
  return toReply(updated);
}

// ---------------------------------------------------------------------------
// Leads
// ---------------------------------------------------------------------------

export async function getLeads(businessId: string): Promise<Lead[]> {
  const rows = await selectWhere("leads", { workspace_id: businessId }, { orderBy: "created_at", ascending: false });
  return rows.map(toLead);
}

/** Direct-id lookup — ownership verified against the fetched row, same rationale as getEstimate. */
export async function getLead(businessId: string, id: string): Promise<Lead | null> {
  const row = await selectById("leads", id);
  if (!row || row.workspace_id !== businessId) return null;
  return toLead(row);
}

/** Count of unreviewed leads — the live signal behind the dashboard's notification banner and sidebar badge. */
export async function getNewLeadCount(businessId: string): Promise<number> {
  const leads = await getLeads(businessId);
  return leads.filter((l) => l.status === "New Inquiry").length;
}

/**
 * Creates a Lead from a validated, sanitized submission. Always
 * "New Inquiry"/"Website" on creation — status only changes later via
 * updateLead (Convert to Estimate / Archive). AI fields start empty with
 * aiStatus "pending" — services/leadService.ts's createLeadFromSubmission
 * runs the real analysis (services/automation/leadClassifier.ts) right after.
 */
export async function createLead(businessId: string, leadId: string, input: NewLeadInput): Promise<Lead> {
  const now = new Date().toISOString();
  const row = await insertRow("leads", {
    workspace_id: businessId,
    lead_id: leadId,
    name: input.name,
    email: input.email,
    phone: input.phone ?? "",
    company: input.company ?? "",
    service: input.requestedService ?? "",
    message: input.message,
    status: "New Inquiry",
    source: "Website",
    created_at: now,
    last_activity_at: now,
    ip_address: input.ipAddress ?? "",
    user_agent: input.userAgent ?? "",
    assigned_to: "",
    internal_notes: "",
    ai_status: "pending",
  });
  return toLead(row);
}

export async function updateLead(businessId: string, id: string, input: UpdateLeadInput): Promise<Lead> {
  const existing = await getLead(businessId, id);
  if (!existing) {
    throw new Error("Lead not found for this business.");
  }

  const fields: Database["public"]["Tables"]["leads"]["Update"] = {};
  if (input.status !== undefined) fields.status = input.status;
  if (input.convertedEstimateId !== undefined) fields.converted_estimate_id = input.convertedEstimateId;
  if (input.assignedTo !== undefined) fields.assigned_to = input.assignedTo;
  if (input.internalNotes !== undefined) fields.internal_notes = input.internalNotes;
  if (input.lastActivityAt !== undefined) fields.last_activity_at = input.lastActivityAt;
  if (input.aiSummary !== undefined) fields.ai_summary = input.aiSummary;
  if (input.aiCategory !== undefined) fields.ai_category = input.aiCategory;
  if (input.aiPriority !== undefined) fields.ai_priority = input.aiPriority;
  if (input.aiPriorityReason !== undefined) fields.ai_priority_reason = input.aiPriorityReason;
  if (input.aiOpportunityValueRange !== undefined) fields.ai_opportunity_value_range = input.aiOpportunityValueRange;
  if (input.aiOpportunityConfidence !== undefined) fields.ai_opportunity_confidence = input.aiOpportunityConfidence;
  if (input.suggestedNextAction !== undefined) fields.suggested_next_action = input.suggestedNextAction;
  if (input.aiResponseUrgency !== undefined) fields.ai_response_urgency = input.aiResponseUrgency;
  if (input.aiResponseUrgencyReason !== undefined) fields.ai_response_urgency_reason = input.aiResponseUrgencyReason;
  if (input.aiGeneratedAt !== undefined) fields.ai_generated_at = input.aiGeneratedAt;
  if (input.aiStatus !== undefined) fields.ai_status = input.aiStatus;

  const row = await updateRow("leads", id, fields);
  return toLead(row);
}

// ---------------------------------------------------------------------------
// ActivityLog
// ---------------------------------------------------------------------------

export async function getActivityLog(businessId: string): Promise<ActivityLogEntry[]> {
  const rows = await selectWhere("activity_logs", { workspace_id: businessId }, { orderBy: "created_at", ascending: false });
  return rows.map(toActivityLogEntry);
}

export async function getActivityForLead(businessId: string, leadId: string): Promise<ActivityLogEntry[]> {
  const rows = await selectWhere("activity_logs", { workspace_id: businessId, lead_id: leadId }, { orderBy: "created_at", ascending: false });
  return rows.map(toActivityLogEntry);
}

export async function createActivityLogEntry(businessId: string, input: NewActivityLogEntryInput): Promise<ActivityLogEntry> {
  const row = await insertRow("activity_logs", {
    workspace_id: businessId,
    lead_id: input.leadId,
    action: input.type,
    description: input.description,
  });
  return toActivityLogEntry(row);
}

// ---------------------------------------------------------------------------
// Notifications
// ---------------------------------------------------------------------------

export async function getNotifications(businessId: string): Promise<Notification[]> {
  const rows = await selectWhere("notifications", { workspace_id: businessId }, { orderBy: "created_at", ascending: false });
  return rows.map(toNotification);
}

export async function getUnreadNotificationCount(businessId: string): Promise<number> {
  const notifications = await getNotifications(businessId);
  return notifications.filter((n) => !n.isRead).length;
}

export async function createNotification(businessId: string, input: NewNotificationInput): Promise<Notification> {
  const row = await insertRow("notifications", {
    workspace_id: businessId,
    lead_id: input.leadId,
    type: input.type,
    message: input.message,
    is_read: false,
  });
  return toNotification(row);
}

/**
 * Idempotent by design — returns null instead of throwing when the id isn't
 * found (already deleted, already read via another tab, stale dropdown data).
 * "Mark as read" on a notification that's no longer there just isn't an
 * error a click in the header bell should ever be able to surface.
 */
export async function markNotificationRead(businessId: string, id: string): Promise<Notification | null> {
  const row = await selectById("notifications", id);
  if (!row || row.workspace_id !== businessId) return null;
  const updated = await updateRow("notifications", id, { is_read: true });
  return toNotification(updated);
}

/** Marks every unread notification read in one pass — used by the bell dropdown's "Mark all read". */
export async function markAllNotificationsRead(businessId: string): Promise<number> {
  const unread = (await getNotifications(businessId)).filter((n) => !n.isRead);
  await Promise.all(unread.map((n) => updateRow("notifications", n.id, { is_read: true })));
  return unread.length;
}
