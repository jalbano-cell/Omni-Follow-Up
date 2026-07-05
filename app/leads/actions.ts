"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import {
  archiveLead,
  assignLead,
  addInternalNote,
  dismissAiInsights,
  restoreAiInsights,
  updateAiInsights,
  regenerateAiInsights,
  createLeadFromSubmission,
  type UpdateAiInsightsInput,
} from "@/services/leadService";
import { getBusinessById } from "@/services/business";
import { parseCsv, csvRowsToLeads } from "@/lib/csv";
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

/** Manual Entry — a business owner logging a lead that reached them some other way (phone call, in person, etc). Reuses the same createLeadFromSubmission every other entry point goes through. */
export async function createLeadAction(formData: FormData) {
  const businessId = await getCurrentBusinessId();
  const business = await getBusinessById(businessId);
  if (!business) {
    throw new Error("Business not found.");
  }

  const name = String(formData.get("name") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim();
  const phone = String(formData.get("phone") ?? "").trim();
  const company = String(formData.get("company") ?? "").trim();
  const requestedService = String(formData.get("service") ?? "").trim();
  const message = String(formData.get("message") ?? "").trim();

  if (!name || !email || !message) {
    throw new Error("Name, email, and message are required.");
  }

  const lead = await createLeadFromSubmission(business, {
    name,
    email,
    phone,
    company,
    requestedService,
    message,
    leadSource: "Manual Entry",
  });

  logAction("lead.manual-create", { leadId: lead.id });
  revalidatePath("/leads");
  redirect(`/leads/${lead.id}`);
}

/** Bulk-imports leads from an uploaded CSV's raw text (parsed server-side — see lib/csv.ts). Each row reuses createLeadFromSubmission; a bad row is skipped rather than aborting the whole import. */
export async function importLeadsCsvAction(csvText: string): Promise<{ imported: number; skipped: number }> {
  const businessId = await getCurrentBusinessId();
  const business = await getBusinessById(businessId);
  if (!business) {
    throw new Error("Business not found.");
  }

  const candidates = csvRowsToLeads(parseCsv(csvText));

  let imported = 0;
  for (const candidate of candidates) {
    try {
      await createLeadFromSubmission(business, {
        name: candidate.name,
        email: candidate.email,
        phone: candidate.phone,
        company: candidate.company,
        requestedService: candidate.service,
        message: candidate.message || "(Imported via CSV — no message provided.)",
        leadSource: "CSV Import",
      });
      imported += 1;
    } catch (error) {
      logAction("lead.csv-import-row-failed", { error: error instanceof Error ? error.message : "unknown error" });
    }
  }

  logAction("lead.csv-import", { businessId, imported, total: candidates.length });
  revalidatePath("/leads");
  return { imported, skipped: candidates.length - imported };
}
