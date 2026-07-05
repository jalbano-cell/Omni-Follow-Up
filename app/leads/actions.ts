"use server";

import { revalidatePath } from "next/cache";
import {
  archiveLead,
  assignLead,
  addInternalNote,
  dismissAiInsights,
  restoreAiInsights,
  updateAiInsights,
  regenerateAiInsights,
  type UpdateAiInsightsInput,
} from "@/services/leadService";
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

export async function dismissAiInsightsAction(id: string) {
  const businessId = await getCurrentBusinessId();
  await dismissAiInsights(businessId, id);
  logAction("lead.ai-dismiss", { leadId: id });
  revalidatePath(`/leads/${id}`);
}

export async function restoreAiInsightsAction(id: string) {
  const businessId = await getCurrentBusinessId();
  await restoreAiInsights(businessId, id);
  logAction("lead.ai-restore", { leadId: id });
  revalidatePath(`/leads/${id}`);
}

export async function updateAiInsightsAction(id: string, input: UpdateAiInsightsInput) {
  const businessId = await getCurrentBusinessId();
  await updateAiInsights(businessId, id, input);
  logAction("lead.ai-edit", { leadId: id });
  revalidatePath(`/leads/${id}`);
}

export async function regenerateAiInsightsAction(id: string) {
  const businessId = await getCurrentBusinessId();
  await regenerateAiInsights(businessId, id);
  logAction("lead.ai-regenerate", { leadId: id });
  revalidatePath(`/leads/${id}`);
}
