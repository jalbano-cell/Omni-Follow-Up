import { OPEN_ESTIMATE_STATUSES } from "@/config/constants";
import { getEstimates, getFollowUps } from "@/services/airtable";

export interface DashboardStats {
  totalEstimates: number;
  pendingFollowUps: number;
  atRiskRevenue: number;
  bookedJobs: number;
  bookedRevenue: number;
}

export async function getDashboardStats(): Promise<DashboardStats> {
  const [estimates, followUps] = await Promise.all([getEstimates(), getFollowUps()]);

  const openEstimates = estimates.filter((e) => OPEN_ESTIMATE_STATUSES.includes(e.status));
  const bookedEstimates = estimates.filter((e) => e.status === "Booked");

  return {
    totalEstimates: estimates.length,
    pendingFollowUps: followUps.filter((f) => f.status === "Pending").length,
    atRiskRevenue: openEstimates.reduce((sum, e) => sum + e.estimateValue, 0),
    bookedJobs: bookedEstimates.length,
    bookedRevenue: bookedEstimates.reduce((sum, e) => sum + e.estimateValue, 0),
  };
}
