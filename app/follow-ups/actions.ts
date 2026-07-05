"use server";

import { revalidatePath } from "next/cache";
import { getFollowUp, updateFollowUp } from "@/services/db";
import { getBusinessById } from "@/services/business";
import { clearReminder } from "@/services/calendarReminders";
import { generateDueFollowUps } from "@/services/followupEngine";
import { sendApprovedFollowUp, type SendFollowUpResult } from "@/services/followupSender";
import { logEstimateActivity } from "@/services/activityService";
import { getCurrentBusinessId } from "@/lib/session";
import { logAction } from "@/lib/logger";

export async function approveFollowUpAction(id: string) {
  const businessId = await getCurrentBusinessId();
  const followUp = await updateFollowUp(businessId, id, { status: "Approved" });
  logAction("follow-up.approve", { followUpId: id });
  await logEstimateActivity(businessId, followUp.estimateId, "estimate.followup_approved", "Follow-up approved.");
  revalidatePath("/follow-ups");
  revalidatePath("/");
}

export async function skipFollowUpAction(id: string) {
  const businessId = await getCurrentBusinessId();
  const followUp = await getFollowUp(businessId, id);
  await updateFollowUp(businessId, id, { status: "Rejected" });
  logAction("follow-up.skip", { followUpId: id });

  if (followUp?.calendarEventId) {
    const business = await getBusinessById(businessId);
    if (business) await clearReminder(business, followUp);
  }

  revalidatePath("/follow-ups");
  revalidatePath("/");
}

export async function editFollowUpMessageAction(id: string, message: string) {
  const businessId = await getCurrentBusinessId();
  await updateFollowUp(businessId, id, { message });
  logAction("follow-up.edit", { followUpId: id });
  revalidatePath("/follow-ups");
}

/**
 * The one and only path that sends an email — requires the follow-up to
 * already be Approved (or Failed, for a retry). Never called from the cron
 * job. See services/followupSender.ts for the retry + database sync logic.
 */
export async function sendFollowUpAction(id: string): Promise<SendFollowUpResult> {
  const businessId = await getCurrentBusinessId();
  const result = await sendApprovedFollowUp(businessId, id);
  revalidatePath("/follow-ups");
  revalidatePath("/");
  revalidatePath("/estimates");
  return result;
}

export async function generateFollowUpsAction() {
  const businessId = await getCurrentBusinessId();
  const created = await generateDueFollowUps(businessId);
  logAction("follow-up.manual-generate", { created: created.length });
  revalidatePath("/follow-ups");
  revalidatePath("/");
  return created.length;
}
