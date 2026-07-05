"use server";

import { revalidatePath } from "next/cache";
import { archiveLead, assignLead, addInternalNote } from "@/services/leadService";
import { getCurrentBusinessId } from "@/lib/session";
import { logAction } from "@/lib/logger";

export async function archiveLeadAction(id: string) {
  const businessId = await getCurrentBusinessId();
  await archiveLead(businessId, id);
  logAction("lead.archive", { leadId: id });
  revalidatePath("/");
  revalidatePath("/leads");
  revalidatePath(`/leads/${id}`);
}

export async function assignLeadAction(id: string, assignedTo: string) {
  const businessId = await getCurrentBusinessId();
  await assignLead(businessId, id, assignedTo.trim());
  logAction("lead.assign", { leadId: id, assignedTo });
  revalidatePath("/leads");
  revalidatePath(`/leads/${id}`);
}

export async function addInternalNoteAction(id: string, note: string) {
  const businessId = await getCurrentBusinessId();
  const trimmed = note.trim();
  if (!trimmed) return;
  await addInternalNote(businessId, id, trimmed);
  logAction("lead.note-add", { leadId: id });
  revalidatePath(`/leads/${id}`);
}
