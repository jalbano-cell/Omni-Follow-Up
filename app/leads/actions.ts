"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import {
  archiveLead,
  addInternalNote,
  dismissAiInsights,
  restoreAiInsights,
  updateAiInsights,
  regenerateAiInsights,
  createLeadFromSubmission,
  mergeDuplicateLead,
  dismissDuplicateLead,
  type UpdateAiInsightsInput,
  type MergeDuplicateResult,
} from "@/services/leadService";
import { approveAppointment, dismissRequestedAppointment, type ApproveAppointmentResult } from "@/services/appointmentService";
import { getBusinessById } from "@/services/business";
import { parseCsv, csvRowsToLeads } from "@/lib/csv";
import { getCurrentBusinessId, requireAppointmentsEnabled } from "@/lib/session";
import { logAction } from "@/lib/logger";

/** Resolves the request's own host for building absolute links (unsubscribe, etc.) in outbound emails — see lib/url.ts. */
async function resolveAppHost(): Promise<string> {
  return (await headers()).get("host") ?? "localhost:3000";
}

export async function archiveLeadAction(id: string) {
  const businessId = await getCurrentBusinessId();
  await archiveLead(businessId, id);
  logAction("lead.archive", { leadId: id });
  revalidatePath("/");
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

  const lead = await createLeadFromSubmission(
    business,
    {
      name,
      email,
      phone,
      company,
      requestedService,
      message,
      leadSource: "Manual Entry",
    },
    await resolveAppHost()
  );

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
  const appHost = await resolveAppHost();

  let imported = 0;
  const skippedRows: string[] = [];
  const errors: string[] = [];

  for (const row of rows) {
    if (!row.data) {
      skippedRows.push(`Row ${row.rowNumber}: ${row.error}`);
      continue;
    }

    try {
      await createLeadFromSubmission(
        business,
        {
          name: row.data.name,
          email: row.data.email,
          phone: row.data.phone,
          company: row.data.company,
          requestedService: row.data.service,
          message: row.data.message || "(Imported via CSV — no message provided.)",
          leadSource: "CSV Import",
        },
        appHost
      );
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

/** Approves a Lead's linked requested Appointment (components/leads/pending-appointment-banner.tsx) — same underlying action as app/appointments/actions.ts's approveAppointmentAction, just also revalidating the Lead Details page. */
export async function approveLeadAppointmentAction(appointmentId: string, leadId: string): Promise<ApproveAppointmentResult> {
  const businessId = (await requireAppointmentsEnabled()).id;
  const appHost = await resolveAppHost();
  const result = await approveAppointment(businessId, appointmentId, {}, appHost);
  logAction("appointment.approve", { appointmentId, ok: result.ok });
  revalidatePath(`/leads/${leadId}`);
  revalidatePath("/appointments");
  return result;
}

export async function dismissLeadAppointmentAction(appointmentId: string, leadId: string) {
  const businessId = (await requireAppointmentsEnabled()).id;
  await dismissRequestedAppointment(businessId, appointmentId);
  logAction("appointment.dismiss", { appointmentId });
  revalidatePath(`/leads/${leadId}`);
  revalidatePath("/appointments");
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
