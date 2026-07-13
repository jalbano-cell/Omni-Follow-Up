import { getEstimate, getFollowUp, updateEstimate, updateFollowUp } from "@/services/db";
import { getBusinessById, getEffectiveCadenceDays, clearGoogleConnection } from "@/services/business";
import { getMailboxProvider, resolveActiveMailboxConnection } from "@/services/mailboxProvider";
import { deleteMailboxConnection } from "@/services/mailboxConnections";
import { clearReminder } from "@/services/calendarReminders";
import { getEmailTemplate, renderTemplate, templateKeyForEstimateStage } from "@/services/emailTemplateService";
import { logEstimateActivity } from "@/services/activityService";
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

/** Renders the business's (possibly customized) subject template for this estimate's current stage. */
async function subjectFor(estimate: Estimate): Promise<string> {
  const template = await getEmailTemplate(estimate.businessId, templateKeyForEstimateStage(estimate.status));
  return renderTemplate(template, { service: estimate.serviceType, business_name: estimate.businessName || "us" }).subject;
}

function bodyWithSignature(message: string, emailSignature: string | null): string {
  return emailSignature ? `${message}\n\n${emailSignature}` : message;
}

/**
 * Sends an already-approved follow-up through whichever mailbox provider
 * the business has connected (services/mailboxProvider.ts's
 * resolveActiveMailboxConnection — Google or Microsoft, resolved fresh on
 * every send rather than cached on the Estimate/FollowUp) and syncs the
 * database. This is the ONLY path that ever sends a follow-up — it is
 * invoked exclusively from the Follow-up Queue UI's "Send Email" / "Retry
 * Send" action, never from the daily cron job, so nothing is ever emailed
 * without a human first clicking Approve and then explicitly confirming
 * the send. Provider-agnostic: this function never imports
 * services/gmail.ts or services/microsoftGraphSend.ts directly, only
 * through the MailboxProvider interface.
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

  const connection = await resolveActiveMailboxConnection(business);
  if (!connection) {
    return { ok: false, error: "No mailbox is connected for this business yet. Connect Gmail or Microsoft in Settings to enable sending." };
  }
  const provider = getMailboxProvider(connection.provider);

  const refreshToken = decrypt(connection.refreshTokenEnc);
  const cadence = getEffectiveCadenceDays(business);

  const subject = await subjectFor(estimate);

  let lastError = "Unknown error";
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    try {
      const result = await provider.send({
        refreshToken,
        fromEmail: connection.connectedEmail,
        to: estimate.customerEmail,
        subject,
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
        // Reused across providers as opaque identifiers, not literally
        // Gmail-specific despite the column name — see estimate.gmailThreadId's
        // doc comment in types/estimate.ts.
        gmailThreadId: result.providerThreadId,
        gmailLastMessageId: result.rfc822MessageId ?? estimate.gmailLastMessageId,
      });
      await clearReminder(business, followUp);
      await logEstimateActivity(businessId, estimate.id, "estimate.followup_sent", `Follow-up email sent to ${estimate.customerEmail}.`);

      logAction("follow-up.send.success", {
        followUpId,
        estimateId: estimate.id,
        attempt,
        provider: connection.provider,
        providerMessageId: result.providerMessageId,
      });
      return { ok: true };
    } catch (error) {
      lastError = error instanceof Error ? error.message : "Unknown error";

      if (lastError === "invalid_grant") {
        if (connection.provider === "google") {
          await clearGoogleConnection(businessId);
        } else {
          await deleteMailboxConnection(businessId, connection.provider);
        }
        logAction("follow-up.send.mailbox-disconnected", { followUpId, estimateId: estimate.id, provider: connection.provider });
        return {
          ok: false,
          error: `${connection.provider === "google" ? "Google" : "Microsoft"} access was revoked. Reconnect in Settings and try sending again.`,
        };
      }

      logAction("follow-up.send.attempt-failed", { followUpId, estimateId: estimate.id, attempt, provider: connection.provider, error: lastError });
    }
  }

  await updateFollowUp(businessId, followUpId, { status: "Failed" });
  logAction("follow-up.send.failed", { followUpId, estimateId: estimate.id, provider: connection.provider, error: lastError });
  return { ok: false, error: lastError };
}
