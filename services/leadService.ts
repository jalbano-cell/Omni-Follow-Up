import { randomBytes } from "crypto";
import {
  createLead,
  getAppointmentsForLead,
  getEstimate,
  getFollowUpsForEstimate,
  getLead,
  getLeads,
  getRepliesForEstimate,
  updateLead,
  createNotification,
} from "@/services/db";
import { logLeadActivity, getLeadTimeline } from "@/services/activityService";
import { analyzeLead } from "@/services/automation/leadClassifier";
import { buildAcknowledgmentEmail, type AcknowledgmentBookingOutcome } from "@/services/emailBuilder";
import { renderEmailHtml } from "@/services/emailTemplates/emailLayout";
import { buildLeadNotificationEmail } from "@/services/emailTemplates/leadNotification";
import { createAppointmentFromLead } from "@/services/appointmentService";
import { getEffectiveNotifyOnNewLead } from "@/services/business";
import { findPossibleDuplicateLead } from "@/services/duplicateLeadDetection";
import { sendEmail } from "@/services/gmail";
import { decrypt } from "@/lib/crypto";
import { logAction } from "@/lib/logger";
import { AUTO_ACKNOWLEDGE_LEAD_SOURCES, type LeadSource } from "@/config/constants";
import type { ActivityLogEntry, Appointment, Business, Estimate, FollowUp, Lead, NewLeadInput, Reply } from "@/types";

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

/** Best-effort notification to the business's own inbox — never blocks lead creation from succeeding. Skipped entirely if the owner has turned it off (Settings > Notification Preferences). */
async function sendLeadNotificationEmail(business: Business, lead: Lead, appHost: string): Promise<void> {
  if (!getEffectiveNotifyOnNewLead(business)) {
    return;
  }
  if (!business.googleRefreshTokenEnc || !business.googleConnectedEmail) {
    logAction("lead.notify-email-skipped", { businessId: business.id, leadId: lead.leadId, reason: "Gmail not connected" });
    return;
  }

  const email = buildLeadNotificationEmail(business, lead, appHost);

  try {
    await sendEmail({
      refreshToken: decrypt(business.googleRefreshTokenEnc),
      fromEmail: business.googleConnectedEmail,
      to: business.ownerEmail,
      subject: email.subject,
      body: email.body,
      htmlBody: email.html,
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
 * (see services/emailBuilder.ts's buildAcknowledgmentEmail for the template
 * that keeps its content safe to auto-send, and CLAUDE.md's "Sending is
 * approval-gated" section for why this doesn't contradict that rule).
 * Requires Gmail connected, same as the owner-notification email — skipped
 * and logged otherwise, never blocking lead creation.
 *
 * First checks (via services/appointmentService.ts's createAppointmentFromLead)
 * whether the lead's message requested a specific date/time — if the slot is
 * free, that creates a durable, owner-approval-required Appointment and
 * sends its own instant pending-ack email (never a lock-implying "booked"
 * email — see CLAUDE.md's Appointments section for why the old
 * auto-book-instantly path was retired); if it conflicts, this function
 * falls back to offering open alternate times in the plain acknowledgment,
 * same as before.
 *
 * Only fires for real-time inbound sources (see AUTO_ACKNOWLEDGE_LEAD_SOURCES)
 * — a Manual Entry or CSV Import is typically a retroactive record of a lead
 * that already made contact some other way, where an automatic "we received
 * your message" email would be surprising or duplicate.
 */
async function sendLeadAcknowledgmentEmail(business: Business, lead: Lead, appHost: string): Promise<void> {
  if (!AUTO_ACKNOWLEDGE_LEAD_SOURCES.includes(lead.leadSource as LeadSource)) {
    return;
  }
  if (!business.googleRefreshTokenEnc || !business.googleConnectedEmail) {
    logAction("lead.acknowledgment-skipped", { businessId: business.id, leadId: lead.leadId, reason: "Gmail not connected" });
    return;
  }

  // Skipped entirely for a workspace the agency has restricted to
  // productMode "estimates_only" (see CLAUDE.md's Appointments section) — a
  // customer's message never gets parsed for a booking request there, it
  // just gets the plain acknowledgment below.
  const booking =
    business.productMode !== "estimates_only"
      ? await createAppointmentFromLead(business, lead, appHost)
      : ({ type: "none" } as const);

  // The "requested" case already sent its own instant pending-ack email
  // (services/appointmentService.ts) — nothing further to send here.
  if (booking.type === "requested") {
    return;
  }

  const bookingOutcome: AcknowledgmentBookingOutcome =
    booking.type === "alternates" ? { type: "alternates", alternateLabels: booking.labels } : { type: "none" };

  const content = await buildAcknowledgmentEmail(lead, business, bookingOutcome);

  try {
    await sendEmail({
      refreshToken: decrypt(business.googleRefreshTokenEnc),
      fromEmail: business.googleConnectedEmail,
      to: lead.email,
      subject: content.subject,
      body: content.body,
      htmlBody: renderEmailHtml(business.businessName, content.body),
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

export type MergeDuplicateResult = { ok: true } | { ok: false; error: string };

/**
 * Confirms a flagged possible-duplicate really is one. Never combines data
 * between the two records (no field copying, no re-parenting of Estimates)
 * — merging here just means archiving the newer, duplicate Lead so it stops
 * appearing as an open inquiry, while keeping a permanent trail on both
 * records pointing at each other. The earlier Lead (possibleDuplicateOfLeadId)
 * remains the single source of truth going forward.
 */
export async function mergeDuplicateLead(businessId: string, id: string): Promise<MergeDuplicateResult> {
  const lead = await getLead(businessId, id);
  if (!lead || !lead.possibleDuplicateOfLeadId) {
    return { ok: false, error: "No possible duplicate flagged for this lead." };
  }
  const original = await getLead(businessId, lead.possibleDuplicateOfLeadId);
  if (!original) {
    return { ok: false, error: "The original lead no longer exists." };
  }

  await updateLead(businessId, id, { status: "Archived" });
  await logLeadActivity(businessId, id, "lead.duplicate_merged", `Merged into ${original.leadId} (${original.name}) — archived as a duplicate.`);
  await logLeadActivity(businessId, original.id, "lead.duplicate_merged_into", `${lead.name} (${lead.leadId}) was merged into this lead as a duplicate.`);
  return { ok: true };
}

/** Clears a possible-duplicate flag without merging — the owner reviewed both and decided they're genuinely separate leads. */
export async function dismissDuplicateLead(businessId: string, id: string): Promise<Lead> {
  const lead = await updateLead(businessId, id, { possibleDuplicateOfLeadId: null });
  await logLeadActivity(businessId, id, "lead.duplicate_dismissed", "Possible-duplicate flag dismissed — confirmed not a duplicate.");
  return lead;
}

/**
 * Creates a Lead and everything that must happen alongside it: an
 * ActivityLog entry ("New website inquiry received."), an in-app
 * Notification, a best-effort email to the business's own connected Gmail,
 * an automatic AI Lead Intelligence analysis, and an automatic (no-approval)
 * acknowledgment email to the customer. The Supabase write (createLead) is
 * the one step the caller must treat as authoritative — every step after it
 * is a best-effort side effect that must never turn a saved lead into a
 * failed response.
 */
export async function createLeadFromSubmission(business: Business, input: NewLeadInput, appHost: string): Promise<Lead> {
  const leadId = generateLeadId();
  // Snapshot existing leads before this one is created — a duplicate check must never match the new lead against itself.
  const existingLeads = await getLeads(business.id);
  let lead = await createLead(business.id, leadId, input);

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

  const possibleDuplicate = findPossibleDuplicateLead(existingLeads, input, lead.createdTime);
  if (possibleDuplicate) {
    try {
      lead = await updateLead(business.id, lead.id, { possibleDuplicateOfLeadId: possibleDuplicate.id });
      await logLeadActivity(
        business.id,
        lead.id,
        "lead.possible_duplicate_flagged",
        `Possible duplicate of ${possibleDuplicate.leadId} (${possibleDuplicate.name}).`
      );
      await createNotification(business.id, {
        leadId: lead.id,
        type: "lead.possible_duplicate",
        message: `${lead.name} looks like a possible duplicate of an existing lead — review to merge or dismiss.`,
      });
    } catch (error) {
      logAction("lead.duplicate-flag-failed", {
        businessId: business.id,
        leadId: lead.leadId,
        error: error instanceof Error ? error.message : "unknown error",
      });
    }
  }

  await sendLeadNotificationEmail(business, lead, appHost);
  await analyzeLead(business.id, lead);
  await sendLeadAcknowledgmentEmail(business, lead, appHost);

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

/** Reads the AI Lead Intelligence fields straight off the Lead record — see services/automation/leadClassifier.ts for how they're populated. */
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
  /** The earlier Lead this one was flagged as a likely re-submission of (services/duplicateLeadDetection.ts) — null once dismissed/merged, or if never flagged. */
  possibleDuplicateOfLead: Lead | null;
  /** This lead's still-`requested` Appointment, if any (services/appointmentService.ts) — surfaced as the Lead Details page's approve/dismiss banner. Null once approved/cancelled, or if nothing was ever requested. */
  pendingAppointment: Appointment | null;
}

/** Everything the Lead Details page needs, joined in one call. */
export async function getLeadDetail(businessId: string, id: string): Promise<LeadDetail | null> {
  const lead = await getLead(businessId, id);
  if (!lead) return null;

  const [timeline, linkedEstimate, possibleDuplicateOfLead, leadAppointments] = await Promise.all([
    getLeadTimeline(businessId, id),
    lead.convertedEstimateId ? getEstimate(businessId, lead.convertedEstimateId) : Promise.resolve(null),
    lead.possibleDuplicateOfLeadId ? getLead(businessId, lead.possibleDuplicateOfLeadId) : Promise.resolve(null),
    getAppointmentsForLead(businessId, id),
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
    pendingAppointment: leadAppointments.find((a) => a.status === "requested") ?? null,
    possibleDuplicateOfLead,
  };
}
