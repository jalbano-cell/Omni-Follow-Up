import { sendEmail } from "@/services/gmail";
import { getEstimate, getFollowUp, updateEstimate, updateFollowUp } from "@/services/airtable";
import { addDays, todayIso } from "@/lib/date";
import { FOLLOW_UP_CADENCE_DAYS } from "@/config/constants";
import { logAction } from "@/lib/logger";
import type { Estimate, EstimateStatus } from "@/types";

const MAX_ATTEMPTS = 2; // one send + one retry, per spec

export type SendFollowUpResult =
  | { ok: true }
  | { ok: false; error: string };

/** What the Estimate should become once this follow-up email actually sends. */
function nextStage(current: EstimateStatus): { status: EstimateStatus; nextFollowUpDate: string | null } {
  const today = todayIso();
  if (current === "Sent") {
    return { status: "Follow-up 1", nextFollowUpDate: addDays(today, FOLLOW_UP_CADENCE_DAYS["Follow-up 1"]) };
  }
  if (current === "Follow-up 1") {
    return { status: "Follow-up 2", nextFollowUpDate: addDays(today, FOLLOW_UP_CADENCE_DAYS["Follow-up 2"]) };
  }
  // Follow-up 2 is the last automated stage — keep the status, stop scheduling further follow-ups.
  return { status: current, nextFollowUpDate: null };
}

function subjectFor(estimate: Estimate): string {
  return `Your ${estimate.serviceType} estimate from ${estimate.businessName || "us"}`;
}

/**
 * Sends an already-approved follow-up via Gmail and syncs Airtable. This is
 * the ONLY path that ever calls services/gmail.ts — it is invoked exclusively
 * from the Follow-up Queue UI's "Send Email" / "Retry Send" action, never
 * from the daily cron job, so nothing is ever emailed without a human first
 * clicking Approve and then explicitly confirming the send.
 */
export async function sendApprovedFollowUp(followUpId: string): Promise<SendFollowUpResult> {
  const followUp = await getFollowUp(followUpId);
  if (!followUp) {
    return { ok: false, error: "Follow-up not found." };
  }
  if (followUp.status !== "Approved" && followUp.status !== "Failed") {
    return { ok: false, error: `Follow-up must be Approved before sending (currently ${followUp.status}).` };
  }

  const estimate = await getEstimate(followUp.estimateId);
  if (!estimate) {
    return { ok: false, error: "Linked estimate not found." };
  }

  let lastError = "Unknown error";
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    try {
      const result = await sendEmail({
        to: estimate.customerEmail,
        subject: subjectFor(estimate),
        body: followUp.message,
        threadId: estimate.gmailThreadId,
        inReplyToMessageId: estimate.gmailLastMessageId,
      });

      const stage = nextStage(estimate.status);

      // Never lose the drafted message — only status/sentAt change on the FollowUps record.
      await updateFollowUp(followUpId, { status: "Sent", sentAt: new Date().toISOString() });
      await updateEstimate(estimate.id, {
        status: stage.status,
        lastContactDate: todayIso(),
        nextFollowUpDate: stage.nextFollowUpDate,
        gmailThreadId: result.threadId,
        gmailLastMessageId: result.rfc822MessageId ?? estimate.gmailLastMessageId,
      });

      logAction("follow-up.send.success", {
        followUpId,
        estimateId: estimate.id,
        attempt,
        gmailMessageId: result.gmailMessageId,
      });
      return { ok: true };
    } catch (error) {
      lastError = error instanceof Error ? error.message : "Unknown error";
      logAction("follow-up.send.attempt-failed", { followUpId, estimateId: estimate.id, attempt, error: lastError });
    }
  }

  await updateFollowUp(followUpId, { status: "Failed" });
  logAction("follow-up.send.failed", { followUpId, estimateId: estimate.id, error: lastError });
  return { ok: false, error: lastError };
}
