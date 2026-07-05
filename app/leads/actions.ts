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
  approveRecommendedAppointment,
  dismissRecommendedAppointment,
  mergeDuplicateLead,
  dismissDuplicateLead,
  type UpdateAiInsightsInput,
  type ApproveAppointmentResult,
  type MergeDuplicateResult,
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

export interface CsvImportSummary {
  imported: number;
  /** Rows missing a required field (name/email) — never attempted. Each entry e.g. "Row 4: Missing email". */
  skippedRows: string[];
  /** Rows that had valid data but failed during creation (rare — e.g. a transient database error). Each entry e.g. "Row 6: Business not found.". */
  errors: string[];
}

/** Bulk-imports leads from an uploaded CSV's raw text (parsed server-side — see lib/csv.ts). Each row reuses createLeadFromSubmission; a bad row is skipped (or its creation failure recorded) rather than aborting the whole import — possible duplicates aren't skipped here, they're flagged for review same as any other entry point (services/duplicateLeadDetection.ts). */
export async function importLeadsCsvAction(csvText: string): Promise<CsvImportSummary> {
  const businessId = await getCurrentBusinessId();
  const business = await getBusinessById(businessId);
  if (!business) {
    throw new Error("Business not found.");
  }

  const rows = csvRowsToLeads(parseCsv(csvText));

  let imported = 0;
  const skippedRows: string[] = [];
  const errors: string[] = [];

  for (const row of rows) {
    if (!row.data) {
      skippedRows.push(`Row ${row.rowNumber}: ${row.error}`);
      continue;
    }

    try {
      await createLeadFromSubmission(business, {
        name: row.data.name,
        email: row.data.email,
        phone: row.data.phone,
        company: row.data.company,
        requestedService: row.data.service,
        message: row.data.message || "(Imported via CSV — no message provided.)",
        leadSource: "CSV Import",
      });
      imported += 1;
    } catch (error) {
      const message = error instanceof Error ? error.message : "unknown error";
      errors.push(`Row ${row.rowNumber}: ${message}`);
      logAction("lead.csv-import-row-failed", { row: row.rowNumber, error: message });
    }
  }

  logAction("lead.csv-import", { businessId, imported, skipped: skippedRows.length, errors: errors.length, total: rows.length });
  revalidatePath("/leads");
  return { imported, skippedRows, errors };
}

export async function approveRecommendedAppointmentAction(id: string): Promise<ApproveAppointmentResult> {
  const businessId = await getCurrentBusinessId();
  const result = await approveRecommendedAppointment(businessId, id);
  logAction("lead.appointment-approve", { leadId: id, ok: result.ok });
  revalidatePath(`/leads/${id}`);
  return result;
}

export async function dismissRecommendedAppointmentAction(id: string) {
  const businessId = await getCurrentBusinessId();
  await dismissRecommendedAppointment(businessId, id);
  logAction("lead.appointment-dismiss", { leadId: id });
  revalidatePath(`/leads/${id}`);
}

export async function mergeDuplicateLeadAction(id: string): Promise<MergeDuplicateResult> {
  const businessId = await getCurrentBusinessId();
  const result = await mergeDuplicateLead(businessId, id);
  logAction("lead.duplicate-merge", { leadId: id, ok: result.ok });
  revalidatePath("/leads");
  revalidatePath(`/leads/${id}`);
  return result;
}

export async function dismissDuplicateLeadAction(id: string) {
  const businessId = await getCurrentBusinessId();
  await dismissDuplicateLead(businessId, id);
  logAction("lead.duplicate-dismiss", { leadId: id });
  revalidatePath(`/leads/${id}`);
}
