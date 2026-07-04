import { getDueFollowUps, getEstimates, getFollowUps, getReplies } from "@/services/airtable";
import { ACTIONABLE_FOLLOWUP_STATUSES, ESTIMATE_STATUSES } from "@/config/constants";
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

export interface FollowUpFunnelItem {
  status: EstimateStatus;
  count: number;
  value: number;
}

/** Estimate counts/value per pipeline stage, in Sent -> Follow-up 1 -> Follow-up 2 -> Booked/Lost order. */
export async function getFollowUpFunnel(businessId: string): Promise<FollowUpFunnelItem[]> {
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

export interface RevenueTrendPoint {
  /** "2026-01" */
  month: string;
  bookedRevenue: number;
}

/**
 * Booked revenue per month for the last `months` months. Uses lastContactDate
 * as a proxy for "when it was booked" — there's no dedicated bookedAt field,
 * but marking an estimate Booked always updates lastContactDate (see
 * app/estimates/actions.ts's updateEstimateStatusAction).
 */
export async function getRevenueTrend(businessId: string, months = 6): Promise<RevenueTrendPoint[]> {
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

export interface ReplyMetrics {
  estimatesWithThread: number;
  estimatesWithReply: number;
  /** 0-100 */
  replyRate: number;
  avgDaysToFirstReply: number | null;
}

/**
 * Reply rate among estimates that have had at least one email sent (i.e.
 * have a gmailThreadId), plus the average days between sending and the
 * first customer reply. Inherits services/replyMatcher.ts's thread-based
 * matching limitations — a reply from a different address won't count.
 */
export async function getReplyMetrics(businessId: string): Promise<ReplyMetrics> {
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
