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
 * Creates a Lead and everything that must happen alongside it: an
 * ActivityLog entry ("New website inquiry received."), an in-app
 * Notification, and a best-effort email to the business's own connected
 * Gmail. The Airtable write (createLead) is the one step the caller must
 * treat as authoritative — activity/notification/email are all best-effort
 * side effects that must never turn a saved lead into a failed response.
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

  return lead;
}

export async function archiveLead(businessId: string, id: string): Promise<Lead> {
  const lead = await updateLead(businessId, id, { status: "Archived" });
  await logLeadActivity(businessId, id, "lead.archived", "Lead archived.");
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
  /** False until a real model is wired up — the UI must show this as "coming soon", never fabricate a value. */
  available: boolean;
  summary: string | null;
  priorityScore: number | null;
  suggestedNextAction: string | null;
  suggestedFollowUpTiming: string | null;
}

/**
 * STEP 9 placeholder — every Lead is already shaped to carry
 * aiSummary/priorityScore/suggestedNextAction/suggestedFollowUpTiming (see
 * config/airtable.ts's LEAD_FIELDS), so wiring up a real model later is a
 * matter of populating those columns, not a schema change. This function is
 * the single seam a future AI integration replaces — until then it must
 * only ever report "not available," never guess.
 */
export function getAiInsightsPlaceholder(lead: Lead): LeadAiInsights {
  return {
    available: false,
    summary: lead.aiSummary,
    priorityScore: lead.priorityScore,
    suggestedNextAction: lead.suggestedNextAction,
    suggestedFollowUpTiming: lead.suggestedFollowUpTiming,
  };
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
    aiInsights: getAiInsightsPlaceholder(lead),
  };
}
