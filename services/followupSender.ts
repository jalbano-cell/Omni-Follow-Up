import { sendEmail } from "@/services/gmail";
import { getEstimate, getFollowUp, updateEstimate, updateFollowUp } from "@/services/db";
import { getBusinessById, getEffectiveCadenceDays, clearGoogleConnection } from "@/services/business";
import { clearReminder } from "@/services/calendarReminders";
import { decrypt } from "@/lib/crypto";
import { addDays, todayIso } from "@/lib/date";
import { logAction } from "@/lib/logger";
import type { Estimate, EstimateStatus } from "@/types";

const MAX_ATTEMPTS = 2; // one send + one retry

export type SendFollowUpResult =
  | { ok: true }
  | { ok: false; error: string };

/** What the Estimate should become once this follow-up email actually sends, using the business's own cadence. */
function nextStage(
  current: EstimateStatus,
  cadence: ReturnType<typeof getEffectiveCadenceDays>
): { status: EstimateStatus; nextFollowUpDate: string | null } {
  const today = todayIso();
  if (current === "Sent") {
    return { status: "Follow-up 1", nextFollowUpDate: addDays(today, cadence["Follow-up 1"]) };
  }
  if (current === "Follow-up 1") {
    return { status: "Follow-up 2", nextFollowUpDate: addDays(today, cadence["Follow-up 2"]) };
  }
  // Follow-up 2 is the last automated stage — keep the status, stop scheduling further follow-ups.
  return { status: current, nextFollowUpDate: null };
}

function subjectFor(estimate: Estimate): string {
  return `Your ${estimate.serviceType} estimate from ${estimate.businessName || "us"}`;
}

function bodyWithSignature(message: string, emailSignature: string | null): string {
  return emailSignature ? `${message}\n\n${emailSignature}` : message;
}

/**
 * Sends an already-approved follow-up via Gmail and syncs the database. This is
 * the ONLY path that ever calls services/gmail.ts — it is invoked exclusively
 * from the Follow-up Queue UI's "Send Email" / "Retry Send" action, never
 * from the daily cron job, so nothing is ever emailed without a human first
 * clicking Approve and then explicitly confirming the send.
 */
export async function sendApprovedFollowUp(businessId: string, followUpId: string): Promise<SendFollowUpResult> {
  const followUp = await getFollowUp(businessId, followUpId);
  if (!followUp) {
    return { ok: false, error: "Follow-up not found." };
  }
  if (followUp.status !== "Approved" && followUp.status !== "Failed") {
    return { ok: false, error: `Follow-up must be Approved before sending (currently ${followUp.status}).` };
  }

  const estimate = await getEstimate(businessId, followUp.estimateId);
  if (!estimate) {
    return { ok: false, error: "Linked estimate not found." };
  }

  const business = await getBusinessById(businessId);
  if (!business) {
    return { ok: false, error: "Business not found." };
  }
  if (!business.googleRefreshTokenEnc || !business.googleConnectedEmail) {
    return { ok: false, error: "Gmail isn't connected for this business yet. Connect Gmail in Settings to enable sending." };
  }

  const refreshToken = decrypt(business.googleRefreshTokenEnc);
  const cadence = getEffectiveCadenceDays(business);

  let lastError = "Unknown error";
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    try {
      const result = await sendEmail({
        refreshToken,
        fromEmail: business.googleConnectedEmail,
        to: estimate.customerEmail,
        subject: subjectFor(estimate),
        body: bodyWithSignature(followUp.message, business.emailSignature),
        threadId: estimate.gmailThreadId,
        inReplyToMessageId: estimate.gmailLastMessageId,
      });

      const stage = nextStage(estimate.status, cadence);

      // Never lose the drafted message — only status/sentAt change on the FollowUps record.
      await updateFollowUp(businessId, followUpId, { status: "Sent", sentAt: new Date().toISOString() });
      await updateEstimate(businessId, estimate.id, {
        status: stage.status,
        lastContactDate: todayIso(),
        nextFollowUpDate: stage.nextFollowUpDate,
        gmailThreadId: result.threadId,
        gmailLastMessageId: result.rfc822MessageId ?? estimate.gmailLastMessageId,
      });
      await clearReminder(business, followUp);

      logAction("follow-up.send.success", {
        followUpId,
        estimateId: estimate.id,
        attempt,
        gmailMessageId: result.gmailMessageId,
      });
      return { ok: true };
    } catch (error) {
      lastError = error instanceof Error ? error.message : "Unknown error";

      if (lastError === "invalid_grant") {
        await clearGoogleConnection(businessId);
        logAction("follow-up.send.google-disconnected", { followUpId, estimateId: estimate.id });
        return {
          ok: false,
          error: "Google access was revoked. Reconnect Gmail in Settings and try sending again.",
        };
      }

      logAction("follow-up.send.attempt-failed", { followUpId, estimateId: estimate.id, attempt, error: lastError });
    }
  }

  await updateFollowUp(businessId, followUpId, { status: "Failed" });
  logAction("follow-up.send.failed", { followUpId, estimateId: estimate.id, error: lastError });
  return { ok: false, error: lastError };
}
