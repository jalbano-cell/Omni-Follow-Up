export type LeadStatus = "New Inquiry" | "Converted" | "Archived";

/**
 * A business inquiry — today, always created via POST /api/intake (a website
 * contact form), but the shape is source-agnostic (see `leadSource`) so a
 * future phone/referral entry point can reuse it. The single source of truth
 * for every inbound lead in OmniFollowUp.
 */
export interface Lead {
  id: string;
  businessId: string;
  /** Human-readable unique ID (e.g. "LEAD-M3F2K1-A9C") shown in the UI, distinct from the Airtable record id. */
  leadId: string;
  name: string;
  email: string;
  phone: string;
  company: string;
  requestedService: string;
  message: string;
  status: LeadStatus;
  /** Always "Website" today — kept as a field rather than a literal for future intake sources (e.g. phone, referral). */
  leadSource: string;
  createdTime: string;
  /** Bumped on every activity log entry for this lead — lets list views sort/show recency without joining ActivityLog. */
  lastActivityAt: string;
  ipAddress: string | null;
  userAgent: string | null;
  /** Set once "Convert to Estimate" creates an Estimate from this lead. */
  convertedEstimateId: string | null;
  /** Free text — there's no team/user roster yet, so this isn't a linked-record field. Blank until explicitly assigned. */
  assignedTo: string;
  /** Free-form internal notes, newest entry first, each prefixed with a timestamp by services/leadService.ts. */
  internalNotes: string;
  // --- AI placeholders (STEP 9) — always null until a real model is wired up. Never fabricate values for these. ---
  aiSummary: string | null;
  priorityScore: number | null;
  suggestedNextAction: string | null;
  suggestedFollowUpTiming: string | null;
}

export type NewLeadInput = Pick<Lead, "name" | "email" | "message"> &
  Partial<Pick<Lead, "phone" | "company" | "requestedService" | "ipAddress" | "userAgent">>;

export type UpdateLeadInput = Partial<
  Pick<Lead, "status" | "convertedEstimateId" | "assignedTo" | "internalNotes" | "lastActivityAt">
>;
