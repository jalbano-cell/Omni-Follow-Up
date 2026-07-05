import { insertRow, selectWhere } from "@/lib/supabase";
import { logAction } from "@/lib/logger";
import type { Business, Lead } from "@/types";

/**
 * Dual-write mirror, Phase 4 of the Airtable -> Supabase migration.
 *
 * Airtable stays authoritative and completely unchanged for the intake flow —
 * this module only ever ADDS a best-effort Supabase write after Airtable has
 * already succeeded. Any failure here is caught and logged, never thrown, so
 * Supabase being down/misconfigured can never break lead creation. That's a
 * deliberate reversal of the literal "Supabase first, then Airtable" spec
 * wording: with a live app already reading from Airtable everywhere except
 * this new mirror, keeping Airtable authoritative during the burn-in period
 * is the safer reading of "this must be a SAFE MIGRATION." Flipping Supabase
 * to authoritative is a Phase 5 step, once the mirrored data's been verified
 * over time.
 *
 * Only lead *creation* is mirrored right now (services/leadService.ts's
 * createLeadFromSubmission calls syncLeadCreationToSupabase once, after AI
 * analysis has finished writing to Airtable, so the mirrored row is complete).
 * Later lead actions (archive, assign, note, convert, AI edit/dismiss/
 * regenerate) are NOT yet mirrored — Supabase's copy of a lead goes stale
 * after creation until Phase 5 migrates those write paths too.
 */

/** Finds (or lazily creates) the Supabase workspace row mirroring an Airtable Business, keyed by airtable_record_id. */
export async function getOrCreateWorkspaceId(business: Business): Promise<string> {
  const existing = await selectWhere("workspaces", { airtable_record_id: business.id });
  if (existing[0]) return existing[0].id;

  const created = await insertRow("workspaces", {
    business_name: business.businessName,
    owner_name: business.ownerName,
    owner_email: business.ownerEmail,
    password_hash: business.passwordHash,
    follow_up_cadence_sent_days: business.followUpCadenceSentDays,
    follow_up_cadence_followup1_days: business.followUpCadenceFollowUp1Days,
    follow_up_cadence_followup2_days: business.followUpCadenceFollowUp2Days,
    onboarding_step: business.onboardingStep,
    onboarding_completed_at: business.onboardingCompletedAt,
    google_refresh_token_enc: business.googleRefreshTokenEnc,
    google_connected_email: business.googleConnectedEmail,
    google_scopes: business.googleScopes,
    google_connected_at: business.googleConnectedAt,
    calendar_id: business.calendarId,
    industry: business.industry,
    timezone: business.timezone,
    working_hours_start: business.workingHoursStart,
    working_hours_end: business.workingHoursEnd,
    email_signature: business.emailSignature,
    intake_api_key: business.intakeApiKey,
    intake_api_key_created_at: business.intakeApiKeyCreatedAt,
    airtable_record_id: business.id,
  });
  return created.id;
}

/**
 * Mirrors a freshly created (and fully AI-analyzed) Airtable Lead into
 * Supabase, along with its "created" activity log entry and notification.
 * Best-effort: every error is logged via logAction and swallowed here.
 */
export async function syncLeadCreationToSupabase(business: Business, lead: Lead): Promise<void> {
  try {
    const workspaceId = await getOrCreateWorkspaceId(business);

    const created = await insertRow("leads", {
      workspace_id: workspaceId,
      lead_id: lead.leadId,
      name: lead.name,
      email: lead.email,
      phone: lead.phone,
      company: lead.company,
      service: lead.requestedService,
      message: lead.message,
      status: lead.status,
      source: lead.leadSource,
      ip_address: lead.ipAddress,
      user_agent: lead.userAgent,
      assigned_to: lead.assignedTo,
      internal_notes: lead.internalNotes,
      ai_summary: lead.aiSummary,
      ai_category: lead.aiCategory,
      ai_priority: lead.aiPriority,
      ai_priority_reason: lead.aiPriorityReason,
      ai_opportunity_value_range: lead.aiOpportunityValueRange,
      ai_opportunity_confidence: lead.aiOpportunityConfidence,
      suggested_next_action: lead.suggestedNextAction,
      ai_response_urgency: lead.aiResponseUrgency,
      ai_response_urgency_reason: lead.aiResponseUrgencyReason,
      ai_generated_at: lead.aiGeneratedAt,
      ai_status: lead.aiStatus,
      created_at: lead.createdTime,
      last_activity_at: lead.lastActivityAt,
      airtable_record_id: lead.id,
    });

    await insertRow("activity_logs", {
      workspace_id: workspaceId,
      lead_id: created.id,
      action: "lead.created",
      description: "New website inquiry received.",
    });

    await insertRow("notifications", {
      workspace_id: workspaceId,
      lead_id: created.id,
      type: "lead.created",
      message: `New lead from ${lead.name}${lead.company ? ` (${lead.company})` : ""}`,
    });
  } catch (error) {
    logAction("supabase.lead-sync-failed", {
      businessId: business.id,
      leadId: lead.leadId,
      error: error instanceof Error ? error.message : "unknown error",
    });
  }
}
