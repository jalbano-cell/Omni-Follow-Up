import { createFollowUp, getDueFollowUps, getEstimates, getFollowUps } from "@/services/airtable";
import { daysSince, formatCurrency, todayIso } from "@/lib/date";
import { writeDailyRunLog, type DailyRunLog } from "@/lib/logger";
import { ACTIONABLE_FOLLOWUP_STATUSES } from "@/config/constants";
import type { Estimate, FollowUp, FollowUpQueueItem } from "@/types";

/**
 * Drafts a follow-up message for an estimate based on how long it's been
 * sitting and which follow-up stage it's on. Kept as plain templates —
 * no AI call — so drafts are predictable and free to generate.
 */
export function draftFollowUpMessage(estimate: Estimate): string {
  const firstName = estimate.customerName.split(" ")[0] || estimate.customerName;
  const days = daysSince(estimate.dateSent);
  const value = formatCurrency(estimate.estimateValue);

  if (estimate.status === "Sent") {
    return `Hi ${firstName}, just checking in on the ${estimate.serviceType.toLowerCase()} estimate (${value}) we sent ${days} days ago. Happy to answer any questions or adjust the scope — want to get this booked in?`;
  }

  if (estimate.status === "Follow-up 1") {
    return `Hi ${firstName}, following up again on your ${estimate.serviceType.toLowerCase()} estimate. We can typically get started within the next week if you're ready to move forward. Let me know if you'd like to schedule it.`;
  }

  return `Hi ${firstName}, I don't want to keep bothering you, but wanted to check one last time if you're still interested in the ${estimate.serviceType.toLowerCase()} work (${value}). If timing isn't right, no worries — just let me know and I'll close this out.`;
}

/**
 * Finds every open estimate due for a follow-up (nextFollowUpDate <= today,
 * across the Sent / Follow-up 1 / Follow-up 2 stages) and drafts a message
 * for any that don't already have one queued. Never sends anything, never
 * mutates the Estimate record, and never duplicates a Pending draft.
 * Per-estimate failures are collected rather than aborting the whole run.
 */
async function generateFollowUpDrafts(): Promise<{
  estimatesChecked: number;
  created: FollowUp[];
  errors: string[];
}> {
  const [dueEstimates, existingFollowUps] = await Promise.all([getDueFollowUps(), getFollowUps()]);

  // Skip estimates that already have an unresolved follow-up (drafted, approved, or
  // awaiting retry) — the queue only ever holds one live item per estimate at a time.
  const estimateIdsWithActiveFollowUp = new Set(
    existingFollowUps
      .filter((f) => ACTIONABLE_FOLLOWUP_STATUSES.includes(f.status))
      .map((f) => f.estimateId)
  );
  const estimatesNeedingDraft = dueEstimates.filter((e) => !estimateIdsWithActiveFollowUp.has(e.id));

  const created: FollowUp[] = [];
  const errors: string[] = [];

  for (const estimate of estimatesNeedingDraft) {
    try {
      const followUp = await createFollowUp({
        estimateId: estimate.id,
        message: draftFollowUpMessage(estimate),
        status: "Pending",
        scheduledDate: todayIso(),
      });
      created.push(followUp);
    } catch (error) {
      errors.push(`estimate ${estimate.id}: ${error instanceof Error ? error.message : "unknown error"}`);
    }
  }

  return { estimatesChecked: dueEstimates.length, created, errors };
}

/** Manual trigger (e.g. the "Check for due follow-ups" button) — returns the drafts created. */
export async function generateDueFollowUps(): Promise<FollowUp[]> {
  const { created } = await generateFollowUpDrafts();
  return created;
}

/**
 * The daily automation entry point (called by the Vercel Cron job). Runs the
 * same detection + drafting logic as the manual trigger, but always produces
 * a DailyRunLog — checked/created/errors — logged to console and, best
 * effort, to /logs/daily-run/<date>.json.
 */
export async function runDailyFollowUpJob(): Promise<DailyRunLog> {
  const timestamp = new Date().toISOString();

  let result: { estimatesChecked: number; created: FollowUp[]; errors: string[] };
  try {
    result = await generateFollowUpDrafts();
  } catch (error) {
    const log: DailyRunLog = {
      timestamp,
      estimatesChecked: 0,
      followUpsCreated: 0,
      errors: [error instanceof Error ? error.message : "unknown error"],
    };
    await writeDailyRunLog(log);
    return log;
  }

  const log: DailyRunLog = {
    timestamp,
    estimatesChecked: result.estimatesChecked,
    followUpsCreated: result.created.length,
    errors: result.errors,
  };
  await writeDailyRunLog(log);
  return log;
}

/** Actionable follow-ups (Draft/Pending, Approved, Failed) joined with their parent estimate, for the queue UI. */
export async function getFollowUpQueue(): Promise<FollowUpQueueItem[]> {
  const [followUps, estimates] = await Promise.all([getFollowUps(), getEstimates()]);
  const estimateById = new Map(estimates.map((e) => [e.id, e]));

  return followUps
    .filter((f) => ACTIONABLE_FOLLOWUP_STATUSES.includes(f.status))
    .map((followUp) => {
      const estimate = estimateById.get(followUp.estimateId);
      return {
        ...followUp,
        customerName: estimate?.customerName ?? "Unknown customer",
        businessName: estimate?.businessName ?? "",
        estimateValue: estimate?.estimateValue ?? 0,
        daysSinceSent: estimate ? daysSince(estimate.dateSent) : 0,
      };
    })
    .sort((a, b) => b.daysSinceSent - a.daysSinceSent);
}
