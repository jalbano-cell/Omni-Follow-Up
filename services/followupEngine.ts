import { createFollowUp, getDueFollowUps, getEstimates, getFollowUps } from "@/services/airtable";
import { daysSince, formatCurrency, todayIso } from "@/lib/date";
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
 * Finds every estimate due for a follow-up today (or overdue) and creates
 * a Pending FollowUps record with a suggested draft message.
 * Does not send anything and does not mutate the Estimate record.
 * Skips estimates that already have a Pending follow-up queued.
 */
export async function generateDueFollowUps(): Promise<FollowUp[]> {
  const [dueEstimates, existingFollowUps] = await Promise.all([getDueFollowUps(), getFollowUps()]);

  const estimateIdsWithPending = new Set(
    existingFollowUps.filter((f) => f.status === "Pending").map((f) => f.estimateId)
  );

  const estimatesNeedingDraft = dueEstimates.filter((e) => !estimateIdsWithPending.has(e.id));

  const created = await Promise.all(
    estimatesNeedingDraft.map((estimate) =>
      createFollowUp({
        estimateId: estimate.id,
        message: draftFollowUpMessage(estimate),
        status: "Pending",
        scheduledDate: todayIso(),
      })
    )
  );

  return created;
}

/** Pending follow-ups joined with their parent estimate, for the queue UI. */
export async function getFollowUpQueue(): Promise<FollowUpQueueItem[]> {
  const [followUps, estimates] = await Promise.all([getFollowUps(), getEstimates()]);
  const estimateById = new Map(estimates.map((e) => [e.id, e]));

  return followUps
    .filter((f) => f.status === "Pending")
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
