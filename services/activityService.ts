import { createActivityLogEntry, getActivityForLead, getActivityLog, getEstimate, updateLead } from "@/services/db";
import type { ActivityLogEntry } from "@/types";

/**
 * Domain layer over the durable ActivityLog table — this is what gives a
 * Lead its Timeline (services/leadService.ts's getLeadDetail) and feeds the
 * dashboard's "Recent activity" (services/analytics.ts). Kept separate from
 * services/db.ts's raw CRUD because logging an activity always also
 * bumps the parent Lead's lastActivityAt — a two-write invariant that
 * belongs in one place, not repeated at every call site.
 */

export async function logLeadActivity(
  businessId: string,
  leadId: string,
  type: string,
  description: string
): Promise<ActivityLogEntry> {
  const now = new Date().toISOString();
  const [entry] = await Promise.all([
    createActivityLogEntry(businessId, { leadId, type, description }),
    updateLead(businessId, leadId, { lastActivityAt: now }),
  ]);
  return entry;
}

/**
 * Logs an estimate-lifecycle event (follow-up approved/sent, reply received,
 * booked/lost) onto the Timeline of whichever Lead this estimate was
 * converted from — a no-op if it wasn't converted from a Lead (leadId null),
 * since there's nowhere to log it.
 */
export async function logEstimateActivity(
  businessId: string,
  estimateId: string,
  type: string,
  description: string
): Promise<void> {
  const estimate = await getEstimate(businessId, estimateId);
  if (!estimate?.leadId) return;
  await logLeadActivity(businessId, estimate.leadId, type, description);
}

/** Full timeline for one lead's detail page, newest first. */
export async function getLeadTimeline(businessId: string, leadId: string): Promise<ActivityLogEntry[]> {
  return getActivityForLead(businessId, leadId);
}

/** Most recent activity across every lead for this business — merged into the dashboard's live activity feed. */
export async function getRecentActivityLog(businessId: string, limit = 8): Promise<ActivityLogEntry[]> {
  const entries = await getActivityLog(businessId);
  return entries.slice(0, limit);
}
