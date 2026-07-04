import { getBusinessById } from "@/services/business";
import { getEstimate, getFollowUp } from "@/services/airtable";
import { logAction } from "@/lib/logger";

export type SendFollowUpResult =
  | { ok: true }
  | { ok: false; error: string };

/**
 * Sends an already-approved follow-up via Gmail and syncs Airtable. This is
 * the ONLY path that ever calls services/gmail.ts — it is invoked exclusively
 * from the Follow-up Queue UI's "Send Email" / "Retry Send" action, never
 * from the daily cron job, so nothing is ever emailed without a human first
 * clicking Approve and then explicitly confirming the send.
 *
 * Phase 0 note: per-tenant Gmail connections don't exist yet (that's Phase 1
 * of the multi-tenant migration), so this currently short-circuits with a
 * clear "not connected" error rather than sending from a single shared Gmail
 * identity on every tenant's behalf — the follow-up stays Approved so it can
 * be retried once the business connects Gmail. The retry/stage-advancement
 * logic this replaced will come back in Phase 1 alongside real per-tenant
 * Gmail tokens.
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

  const error = "Gmail isn't connected for this business yet. Connect Gmail in Settings to enable sending.";
  logAction("follow-up.send.not-connected", { followUpId, estimateId: estimate.id });
  return { ok: false, error };
}
