import { getDueFollowUps, getEstimates, getFollowUps } from "@/services/airtable";

export interface DashboardStats {
  totalEstimates: number;
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
    pendingFollowUps: followUps.filter((f) => f.status === "Pending").length,
    atRiskRevenue: atRiskEstimates.reduce((sum, e) => sum + e.estimateValue, 0),
    atRiskCount: atRiskEstimates.length,
    bookedJobs: bookedEstimates.length,
    bookedRevenue: bookedEstimates.reduce((sum, e) => sum + e.estimateValue, 0),
  };
}
