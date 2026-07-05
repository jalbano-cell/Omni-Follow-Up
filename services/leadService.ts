import { randomBytes } from "crypto";
import {
  createLead,
  getEstimate,
  getFollowUpsForEstimate,
  getLead,
  getLeads,
  getRepliesForEstimate,
  updateLead,
  createNotification,
} from "@/services/airtable";
import { logLeadActivity, getLeadTimeline } from "@/services/activityService";
import { analyzeLead, generateLeadAcknowledgment } from "@/services/aiInsightsService";
import { syncLeadCreationToSupabase } from "@/services/supabaseSync";
import { sendEmail } from "@/services/gmail";
import { decrypt } from "@/lib/crypto";
import { logAction } from "@/lib/logger";
import type { ActivityLogEntry, Business, Estimate, FollowUp, Lead, NewLeadInput, Reply } from "@/types";

/**
 * Domain logic for the Lead lifecycle — this is the one place "what happens
 * when a lead arrives / gets converted / archived / assigned / noted"
 * lives, so any future entry point (a manual add, a phone-in lead) can reuse
 * it instead of re-implementing activity logging + notifications inline.
 * services/intakeService.ts (HTTP validation/rate-limit/spam) is the only
 * caller of createLeadFromSubmission today.
 */

function generateLeadId(): string {
  const stamp = Date.now().toString(36).toUpperCase();
  const rand = randomBytes(3).toString("hex").toUpperCase();
  return `LEAD-${stamp}-${rand}`;
}

/** Best-effort notification to the business's own inbox — never blocks lead creation from succeeding. */
async function sendLeadNotificationEmail(business: Business, lead: Lead): Promise<void> {
  if (!business.googleRefreshTokenEnc || !business.googleConnectedEmail) {
    logAction("lead.notify-email-skipped", { businessId: business.id, leadId: lead.leadId, reason: "Gmail not connected" });
    return;
  }

  const lines = [
    `New website inquiry for ${business.businessName}`,
    "",
    `Lead ID: ${lead.leadId}`,
    `Name: ${lead.name}`,
    `Email: ${lead.email}`,
    lead.phone && `Phone: ${lead.phone}`,
    lead.company && `Company: ${lead.company}`,
    `Requested service: ${lead.requestedService || "Not specified"}`,
    "",
    "Message:",
    lead.message,
    "",
    `Submitted: ${new Date(lead.createdTime).toLocaleString("en-US", { timeZone: "America/Toronto" })}`,
  ].filter((line): line is string => Boolean(line));

  try {
    await sendEmail({
      refreshToken: decrypt(business.googleRefreshTokenEnc),
      fromEmail: business.googleConnectedEmail,
      to: business.ownerEmail,
      subject: "New Website Inquiry",
      body: lines.join("\n"),
    });
  } catch (error) {
    logAction("lead.notify-email-failed", {
      businessId: business.id,
      leadId: lead.leadId,
      error: error instanceof Error ? error.message : "unknown error",
    });
  }
}

/**
 * Automatic acknowledgment email sent to the CUSTOMER, with no human
 * approval — an explicit, narrow exception granted for this one email only
 * (see services/aiInsightsService.ts's generateLeadAcknowledgment for the
 * safety constraints on its content, and CLAUDE.md's "Sending is
 * approval-gated" section for why this doesn't contradict that rule).
 * Requires Gmail connected, same as the owner-notification email — skipped
 * and logged otherwise, never blocking lead creation.
 */
async function sendLeadAcknowledgmentEmail(business: Business, lead: Lead): Promise<void> {
  if (!business.googleRefreshTokenEnc || !business.googleConnectedEmail) {
    logAction("lead.acknowledgment-skipped", { businessId: business.id, leadId: lead.leadId, reason: "Gmail not connected" });
    return;
  }

  const content = await generateLeadAcknowledgment(lead, business.businessName);
  if (!content) {
    await logLeadActivity(
      business.id,
      lead.id,
      "lead.acknowledgment_failed",
      "Automatic acknowledgment email could not be generated."
    );
    return;
  }

  try {
    await sendEmail({
      refreshToken: decrypt(business.googleRefreshTokenEnc),
      fromEmail: business.googleConnectedEmail,
      to: lead.email,
      subject: content.subject,
      body: content.body,
    });
    await logLeadActivity(
      business.id,
      lead.id,
      "lead.acknowledgment_sent",
      `Automatic acknowledgment email sent to ${lead.email}.`
    );
  } catch (error) {
    logAction("lead.acknowledgment-send-failed", {
      businessId: business.id,
      leadId: lead.leadId,
      error: error instanceof Error ? error.message : "unknown error",
    });
    await logLeadActivity(
      business.id,
      lead.id,
      "lead.acknowledgment_failed",
      "Automatic acknowledgment email failed to send."
    );
  }
}

/**
 * Creates a Lead and everything that must happen alongside it: an
 * ActivityLog entry ("New website inquiry received."), an in-app
 * Notification, a best-effort email to the business's own connected Gmail,
 * an automatic AI Lead Intelligence analysis, an automatic (no-approval)
 * acknowledgment email to the customer, and (Airtable -> Supabase migration,
 * Phase 4) a best-effort mirror of the finished Lead into Supabase. The
 * Airtable write (createLead) is the one step the caller must treat as
 * authoritative — every step after it is a best-effort side effect that must
 * never turn a saved lead into a failed response.
 */
export async function createLeadFromSubmission(business: Business, input: NewLeadInput): Promise<Lead> {
  const leadId = generateLeadId();
  const lead = await createLead(business.id, leadId, input);

  await logLeadActivity(business.id, lead.id, "lead.created", "New website inquiry received.");

  try {
    await createNotification(business.id, {
      leadId: lead.id,
      type: "lead.created",
      message: `New lead from ${lead.name}${lead.company ? ` (${lead.company})` : ""}`,
    });
  } catch (error) {
    logAction("lead.notify-inapp-failed", {
      businessId: business.id,
      leadId: lead.leadId,
      error: error instanceof Error ? error.message : "unknown error",
    });
  }

  await sendLeadNotificationEmail(business, lead);
  await analyzeLead(business.id, lead);
  await sendLeadAcknowledgmentEmail(business, lead);

  const finalLead = (await getLead(business.id, lead.id)) ?? lead;
  await syncLeadCreationToSupabase(business, finalLead);

  return lead;
}

export async function archiveLead(businessId: string, id: string): Promise<Lead> {
  const lead = await updateLead(businessId, id, { status: "Archived" });
  await logLeadActivity(businessId, id, "lead.archived", "Lead archived.");
  return lead;
}

/** Reverts a Lead back to "New Inquiry" and clears its estimate link — called when its linked Estimate is deleted. */
export async function revertLeadConversion(businessId: string, id: string): Promise<Lead> {
  const lead = await updateLead(businessId, id, { status: "New Inquiry", convertedEstimateId: null });
  await logLeadActivity(businessId, id, "lead.conversion_reverted", "Linked estimate was deleted — reverted to New Inquiry.");
  return lead;
}

/** No team/user roster exists yet, so this is a free-text field, not an assignment to a real account. */
export async function assignLead(businessId: string, id: string, assignedTo: string): Promise<Lead> {
  const lead = await updateLead(businessId, id, { assignedTo });
  await logLeadActivity(businessId, id, "lead.assigned", `Assigned to ${assignedTo || "Unassigned"}.`);
  return lead;
}

/** Prepends a timestamped line rather than overwriting — internalNotes is a running log, not a single field. */
export async function addInternalNote(businessId: string, id: string, note: string): Promise<Lead> {
  const existing = await getLead(businessId, id);
  if (!existing) {
    throw new Error("Lead not found for this business.");
  }
  const stamp = new Date().toLocaleString("en-US", { timeZone: "America/Toronto" });
  const entry = `[${stamp}] ${note}`;
  const internalNotes = existing.internalNotes ? `${entry}\n\n${existing.internalNotes}` : entry;

  const lead = await updateLead(businessId, id, { internalNotes });
  await logLeadActivity(businessId, id, "lead.note_added", "Internal note added.");
  return lead;
}

/** Called from app/estimates/actions.ts once "Convert to Estimate" actually creates the Estimate. */
export async function markLeadConverted(businessId: string, id: string, estimateId: string): Promise<Lead> {
  const lead = await updateLead(businessId, id, { status: "Converted", convertedEstimateId: estimateId });
  await logLeadActivity(businessId, id, "lead.converted", "Lead converted to an estimate.");
  return lead;
}

export async function getNewLeadCount(businessId: string): Promise<number> {
  const leads = await getLeads(businessId);
  return leads.filter((l) => l.status === "New Inquiry").length;
}

export interface LeadAiInsights {
  status: Lead["aiStatus"];
  summary: string | null;
  category: string | null;
  priority: Lead["aiPriority"];
  priorityReason: string | null;
  opportunityValueRange: string | null;
  opportunityConfidence: string | null;
  suggestedNextAction: string | null;
  responseUrgency: Lead["aiResponseUrgency"];
  responseUrgencyReason: string | null;
  generatedAt: string | null;
}

/** Reads the AI Lead Intelligence fields straight off the Lead record — see services/aiInsightsService.ts for how they're populated. */
export function toAiInsights(lead: Lead): LeadAiInsights {
  return {
    status: lead.aiStatus,
    summary: lead.aiSummary,
    category: lead.aiCategory,
    priority: lead.aiPriority,
    priorityReason: lead.aiPriorityReason,
    opportunityValueRange: lead.aiOpportunityValueRange,
    opportunityConfidence: lead.aiOpportunityConfidence,
    suggestedNextAction: lead.suggestedNextAction,
    responseUrgency: lead.aiResponseUrgency,
    responseUrgencyReason: lead.aiResponseUrgencyReason,
    generatedAt: lead.aiGeneratedAt,
  };
}

/** Hides the AI recommendations without deleting them — the business owner can restore them later. */
export async function dismissAiInsights(businessId: string, id: string): Promise<Lead> {
  const lead = await updateLead(businessId, id, { aiStatus: "dismissed" });
  await logLeadActivity(businessId, id, "lead.ai_dismissed", "AI recommendations dismissed.");
  return lead;
}

export async function restoreAiInsights(businessId: string, id: string): Promise<Lead> {
  const lead = await updateLead(businessId, id, { aiStatus: "completed" });
  await logLeadActivity(businessId, id, "lead.ai_restored", "AI recommendations restored.");
  return lead;
}

export type UpdateAiInsightsInput = Partial<
  Pick<
    Lead,
    | "aiCategory"
    | "aiPriority"
    | "aiPriorityReason"
    | "aiOpportunityValueRange"
    | "aiOpportunityConfidence"
    | "suggestedNextAction"
    | "aiResponseUrgency"
    | "aiResponseUrgencyReason"
  >
>;

/** The business owner correcting one or more AI-generated fields by hand — logged as an edit, not a fresh analysis. */
export async function updateAiInsights(businessId: string, id: string, input: UpdateAiInsightsInput): Promise<Lead> {
  const lead = await updateLead(businessId, id, input);
  await logLeadActivity(businessId, id, "lead.ai_edited", "AI recommendations edited.");
  return lead;
}

/** Manually re-runs AI Lead Intelligence (e.g. after a prior "failed" run) — same analyzeLead the intake flow calls automatically. */
export async function regenerateAiInsights(businessId: string, id: string): Promise<Lead> {
  const lead = await getLead(businessId, id);
  if (!lead) {
    throw new Error("Lead not found for this business.");
  }
  await analyzeLead(businessId, lead);
  const updated = await getLead(businessId, id);
  if (!updated) {
    throw new Error("Lead not found for this business.");
  }
  return updated;
}

export interface LeadDetail {
  lead: Lead;
  timeline: ActivityLogEntry[];
  linkedEstimate: Estimate | null;
  /** Customer replies on the linked estimate's email thread, if converted — the closest thing to a "conversation" today. */
  conversation: Reply[];
  upcomingFollowUps: FollowUp[];
  aiInsights: LeadAiInsights;
}

/** Everything the Lead Details page needs, joined in one call. */
export async function getLeadDetail(businessId: string, id: string): Promise<LeadDetail | null> {
  const lead = await getLead(businessId, id);
  if (!lead) return null;

  const [timeline, linkedEstimate] = await Promise.all([
    getLeadTimeline(businessId, id),
    lead.convertedEstimateId ? getEstimate(businessId, lead.convertedEstimateId) : Promise.resolve(null),
  ]);

  const [conversation, upcomingFollowUps] = linkedEstimate
    ? await Promise.all([
        getRepliesForEstimate(businessId, linkedEstimate.id),
        getFollowUpsForEstimate(businessId, linkedEstimate.id),
      ])
    : [[], []];

  return {
    lead,
    timeline,
    linkedEstimate,
    conversation,
    upcomingFollowUps,
    aiInsights: toAiInsights(lead),
  };
}
