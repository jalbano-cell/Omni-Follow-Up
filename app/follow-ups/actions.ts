"use server";

import { revalidatePath } from "next/cache";
import { updateFollowUp } from "@/services/airtable";
import { generateDueFollowUps } from "@/services/followupEngine";

export async function approveFollowUpAction(id: string) {
  await updateFollowUp(id, { status: "Approved" });
  revalidatePath("/follow-ups");
  revalidatePath("/");
}

export async function skipFollowUpAction(id: string) {
  await updateFollowUp(id, { status: "Rejected" });
  revalidatePath("/follow-ups");
  revalidatePath("/");
}

export async function editFollowUpMessageAction(id: string, message: string) {
  await updateFollowUp(id, { message });
  revalidatePath("/follow-ups");
}

export async function generateFollowUpsAction() {
  const created = await generateDueFollowUps();
  revalidatePath("/follow-ups");
  revalidatePath("/");
  return created.length;
}
