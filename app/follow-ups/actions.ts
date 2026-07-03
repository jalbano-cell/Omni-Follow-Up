"use server";

import { revalidatePath } from "next/cache";
import { updateFollowUp } from "@/services/airtable";
import { generateDueFollowUps } from "@/services/followupEngine";
import { logAction } from "@/lib/logger";

export async function approveFollowUpAction(id: string) {
  await updateFollowUp(id, { status: "Approved" });
  logAction("follow-up.approve", { followUpId: id });
  revalidatePath("/follow-ups");
  revalidatePath("/");
}

export async function skipFollowUpAction(id: string) {
  await updateFollowUp(id, { status: "Rejected" });
  logAction("follow-up.skip", { followUpId: id });
  revalidatePath("/follow-ups");
  revalidatePath("/");
}

export async function editFollowUpMessageAction(id: string, message: string) {
  await updateFollowUp(id, { message });
  logAction("follow-up.edit", { followUpId: id });
  revalidatePath("/follow-ups");
}

export async function generateFollowUpsAction() {
  const created = await generateDueFollowUps();
  logAction("follow-up.manual-generate", { created: created.length });
  revalidatePath("/follow-ups");
  revalidatePath("/");
  return created.length;
}
