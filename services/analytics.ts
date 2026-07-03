import { getDueFollowUps, getEstimates, getFollowUps } from "@/services/airtable";
import { ACTIONABLE_FOLLOWUP_STATUSES } from "@/config/constants";

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

export async function getDashboardStats(): Promise<DashboardStats> {
  const [estimates, followUps, atRiskEstimates] = await Promise.all([
    getEstimates(),
    getFollowUps(),
    getDueFollowUps(),
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
