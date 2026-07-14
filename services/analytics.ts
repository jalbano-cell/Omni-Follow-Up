import { unstable_cache } from "next/cache";
import { getDueFollowUps, getEstimates, getFollowUps, getLeads, getReplies } from "@/services/db";
import { getRecentActivityLog } from "@/services/activityService";
import { ACTIONABLE_FOLLOWUP_STATUSES, ESTIMATE_STATUSES, OPEN_ESTIMATE_STATUSES, LEAD_SOURCES } from "@/config/constants";
import { todayIso } from "@/lib/date";
import type { EstimateStatus, Reply } from "@/types";

export interface DashboardStats {
  totalEstimates: number;
  /** Count of follow-ups awaiting attention in the queue (Draft, Approved, or Failed). */
  pendingFollowUps: number;
  /** Sum of estimateValue across open estimates whose follow-up is overdue. */
  atRiskRevenue: number;
  /** Count of open estimates whose follow-up is overdue. */
  atRiskCount: number;
  bookedJobs: number;
  bookedRevenue: number;
}

export async function getDashboardStats(businessId: string): Promise<DashboardStats> {
  const [estimates, followUps, atRiskEstimates] = await Promise.all([
    getEstimates(businessId),
    getFollowUps(businessId),
    getDueFollowUps(businessId),
  ]);

  const bookedEstimates = estimates.filter((e) => e.status === "Booked");

  return {
    totalEstimates: estimates.length,
    pendingFollowUps: followUps.filter((f) => ACTIONABLE_FOLLOWUP_STATUSES.includes(f.status)).length,
    atRiskRevenue: atRiskEstimates.reduce((sum, e) => sum + e.estimateValue, 0),
    atRiskCount: atRiskEstimates.length,
    bookedJobs: bookedEstimates.length,
    bookedRevenue: bookedEstimates.reduce((sum, e) => sum + e.estimateValue, 0),
  };
}

/**
 * How long the four /analytics-page functions below (funnel, lead-source
 * breakdown, revenue trend, reply metrics) may serve a stale result before
 * recomputing — Next.js's Data Cache (`unstable_cache`), not a snapshot
 * table, per CLAUDE.md's "reach for a short-TTL cache before a new table"
 * guidance. The live dashboard's stats/queue/activity functions further down
 * this file deliberately stay uncached — those drive actionable items (what
 * needs a follow-up right now), where a minute of staleness is the wrong
 * tradeoff; the analytics page is a trend view where it isn't.
 */
const ANALYTICS_CACHE_SECONDS = 60;

export interface FollowUpFunnelItem {
  status: EstimateStatus;
  count: number;
  value: number;
}

async function computeFollowUpFunnel(businessId: string): Promise<FollowUpFunnelItem[]> {
  const estimates = await getEstimates(businessId);
  return ESTIMATE_STATUSES.map((status) => {
    const matching = estimates.filter((e) => e.status === status);
    return {
      status,
      count: matching.length,
      value: matching.reduce((sum, e) => sum + e.estimateValue, 0),
    };
  });
}

/** Estimate counts/value per pipeline stage, in Sent -> Follow-up 1 -> Follow-up 2 -> Booked/Lost order. */
export const getFollowUpFunnel = unstable_cache(computeFollowUpFunnel, ["analytics-follow-up-funnel"], {
  revalidate: ANALYTICS_CACHE_SECONDS,
});

export interface LeadSourceBreakdownItem {
  source: string;
  count: number;
}

async function computeLeadSourceBreakdown(businessId: string): Promise<LeadSourceBreakdownItem[]> {
  const leads = await getLeads(businessId);
  const known: readonly string[] = LEAD_SOURCES;

  const items: LeadSourceBreakdownItem[] = LEAD_SOURCES.map((source) => ({
    source,
    count: leads.filter((l) => l.leadSource === source).length,
  }));

  const otherCount = leads.filter((l) => !known.includes(l.leadSource)).length;
  if (otherCount > 0) {
    items.push({ source: "Other", count: otherCount });
  }

  return items;
}

/** Lead counts per source, in config/constants.ts's LEAD_SOURCES order — every listed source appears even at zero, plus one "Other" bucket for any legacy/unlisted value already stored on a Lead (leadSource is a free string, not a closed enum). */
export const getLeadSourceBreakdown = unstable_cache(computeLeadSourceBreakdown, ["analytics-lead-source-breakdown"], {
  revalidate: ANALYTICS_CACHE_SECONDS,
});

export interface RevenueTrendPoint {
  /** "2026-01" */
  month: string;
  bookedRevenue: number;
}

async function computeRevenueTrend(businessId: string, months = 6): Promise<RevenueTrendPoint[]> {
  const estimates = await getEstimates(businessId);
  const booked = estimates.filter((e) => e.status === "Booked" && e.lastContactDate);

  const now = new Date();
  const points: RevenueTrendPoint[] = [];
  for (let i = months - 1; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const monthKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    const bookedRevenue = booked
      .filter((e) => e.lastContactDate!.slice(0, 7) === monthKey)
      .reduce((sum, e) => sum + e.estimateValue, 0);
    points.push({ month: monthKey, bookedRevenue });
  }
  return points;
}

/**
 * Booked revenue per month for the last `months` months. Uses lastContactDate
 * as a proxy for "when it was booked" — there's no dedicated bookedAt field,
 * but marking an estimate Booked always updates lastContactDate (see
 * app/estimates/actions.ts's updateEstimateStatusAction).
 */
export const getRevenueTrend = unstable_cache(computeRevenueTrend, ["analytics-revenue-trend"], {
  revalidate: ANALYTICS_CACHE_SECONDS,
});

export interface UpcomingFollowUp {
  id: string;
  customerName: string;
  serviceType: string;
  estimateValue: number;
  nextFollowUpDate: string;
}

/**
 * Open estimates with a future nextFollowUpDate — i.e. not yet due, so they
 * never appear in getFollowUpQueue (which is due-items only). Gives the
 * dashboard a look-ahead view alongside the queue's look-behind one.
 */
export async function getUpcomingFollowUps(businessId: string): Promise<UpcomingFollowUp[]> {
  const estimates = await getEstimates(businessId);
  const today = todayIso();

  return estimates
    .filter(
      (e): e is typeof e & { nextFollowUpDate: string } =>
        OPEN_ESTIMATE_STATUSES.includes(e.status) && !!e.nextFollowUpDate && e.nextFollowUpDate > today
    )
    .sort((a, b) => a.nextFollowUpDate.localeCompare(b.nextFollowUpDate))
    .map((e) => ({
      id: e.id,
      customerName: e.customerName,
      serviceType: e.serviceType,
      estimateValue: e.estimateValue,
      nextFollowUpDate: e.nextFollowUpDate,
    }));
}

export interface ActivityItem {
  id: string;
  type: "estimate" | "followup" | "reply" | "lead";
  timestamp: string;
  customerName: string;
  description: string;
}

/**
 * Merges recent Estimate/FollowUp/Reply timestamps with the durable
 * ActivityLog (every lead created/converted/archived/assigned/noted event)
 * into one feed, newest first. Estimate/FollowUp/Reply stay computed live
 * (no snapshot table, per this file's usual approach) since there's no
 * separate log for them yet; lead-related entries now come from
 * services/activityService.ts's persisted log instead of being synthesized
 * from the Lead record directly, since that log is richer (more than just
 * "created").
 */
export async function getRecentActivity(businessId: string, limit = 8): Promise<ActivityItem[]> {
  const [estimates, followUps, replies, leads, activityLog] = await Promise.all([
    getEstimates(businessId),
    getFollowUps(businessId),
    getReplies(businessId),
    getLeads(businessId),
    getRecentActivityLog(businessId, 50),
  ]);
  const estimateById = new Map(estimates.map((e) => [e.id, e]));
  const leadById = new Map(leads.map((l) => [l.id, l]));

  const items: ActivityItem[] = [];

  for (const estimate of estimates) {
    items.push({
      id: `estimate-${estimate.id}`,
      type: "estimate",
      timestamp: estimate.dateSent,
      customerName: estimate.customerName,
      description: "Estimate sent",
    });
  }
  for (const followUp of followUps) {
    if (!followUp.sentAt) continue;
    items.push({
      id: `followup-${followUp.id}`,
      type: "followup",
      timestamp: followUp.sentAt,
      customerName: estimateById.get(followUp.estimateId)?.customerName ?? "Unknown customer",
      description: "Follow-up sent",
    });
  }
  for (const reply of replies) {
    items.push({
      id: `reply-${reply.id}`,
      type: "reply",
      timestamp: reply.receivedAt,
      customerName: estimateById.get(reply.estimateId)?.customerName ?? "Unknown customer",
      description: "Customer replied",
    });
  }
  for (const entry of activityLog) {
    items.push({
      id: `activity-${entry.id}`,
      type: "lead",
      timestamp: entry.createdAt,
      customerName: leadById.get(entry.leadId)?.name ?? "Unknown lead",
      description: entry.description,
    });
  }

  const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  return items
    .filter((item) => item.timestamp >= cutoff)
    .sort((a, b) => b.timestamp.localeCompare(a.timestamp))
    .slice(0, limit);
}

export interface ReplyMetrics {
  estimatesWithThread: number;
  estimatesWithReply: number;
  /** 0-100 */
  replyRate: number;
  avgDaysToFirstReply: number | null;
}

async function computeReplyMetrics(businessId: string): Promise<ReplyMetrics> {
  const [estimates, replies] = await Promise.all([getEstimates(businessId), getReplies(businessId)]);
  const estimatesWithThread = estimates.filter((e) => !!e.gmailThreadId);

  const repliesByEstimate = new Map<string, Reply[]>();
  for (const reply of replies) {
    const list = repliesByEstimate.get(reply.estimateId) ?? [];
    list.push(reply);
    repliesByEstimate.set(reply.estimateId, list);
  }

  let daysSum = 0;
  let daysCount = 0;
  let estimatesWithReplyCount = 0;

  for (const estimate of estimatesWithThread) {
    const estimateReplies = repliesByEstimate.get(estimate.id);
    if (!estimateReplies || estimateReplies.length === 0) continue;
    estimatesWithReplyCount += 1;

    const firstReply = estimateReplies.reduce((earliest, r) => (r.receivedAt < earliest.receivedAt ? r : earliest));
    const days =
      (new Date(firstReply.receivedAt).getTime() - new Date(estimate.dateSent).getTime()) / (1000 * 60 * 60 * 24);
    if (days >= 0) {
      daysSum += days;
      daysCount += 1;
    }
  }

  return {
    estimatesWithThread: estimatesWithThread.length,
    estimatesWithReply: estimatesWithReplyCount,
    replyRate:
      estimatesWithThread.length > 0 ? Math.round((estimatesWithReplyCount / estimatesWithThread.length) * 100) : 0,
    avgDaysToFirstReply: daysCount > 0 ? Math.round((daysSum / daysCount) * 10) / 10 : null,
  };
}

/**
 * Reply rate among estimates that have had at least one email sent (i.e.
 * have a gmailThreadId), plus the average days between sending and the
 * first customer reply. Inherits services/replyMatcher.ts's thread-based
 * matching limitations — a reply from a different address won't count.
 */
export const getReplyMetrics = unstable_cache(computeReplyMetrics, ["analytics-reply-metrics"], {
  revalidate: ANALYTICS_CACHE_SECONDS,
});
