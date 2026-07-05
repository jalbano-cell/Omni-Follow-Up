export type LeadStatus = "New Inquiry" | "Converted" | "Archived";

/** Lifecycle of a Lead's AI analysis — see services/aiInsightsService.ts. */
export type AiInsightsStatus = "pending" | "completed" | "failed" | "dismissed";

/**
 * A business inquiry — today, always created via POST /api/intake (a website
 * contact form), but the shape is source-agnostic (see `leadSource`) so a
 * future phone/referral entry point can reuse it. The single source of truth
 * for every inbound lead in OmniFollowUp.
 */
export interface Lead {
  id: string;
  businessId: string;
  /** Human-readable unique ID (e.g. "LEAD-M3F2K1-A9C") shown in the UI, distinct from the database record id. */
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
  // --- AI Lead Intelligence — null until services/aiInsightsService.ts's analyzeLead populates them (or
  // forever, if analysis fails). The business owner can edit or dismiss these; never fabricate a value here. ---
  aiSummary: string | null;
  /** e.g. "Website", "SEO", "Automation", "AI Agent", "Restaurant", "General Inquiry" — free text, not a closed enum. */
  aiCategory: string | null;
  aiPriority: "High" | "Medium" | "Low" | null;
  aiPriorityReason: string | null;
  /** A rough range only, e.g. "$2,000–$4,000" — never a single precise figure. */
  aiOpportunityValueRange: string | null;
  /** Explains how confident the range estimate is and why. */
  aiOpportunityConfidence: string | null;
  suggestedNextAction: string | null;
  aiResponseUrgency: "Today" | "24 hours" | "3 days" | "1 week" | null;
  aiResponseUrgencyReason: string | null;
  /** When analysis last completed — null while pending, unset if it has never run. */
  aiGeneratedAt: string | null;
  aiStatus: AiInsightsStatus;
}

export type NewLeadInput = Pick<Lead, "name" | "email" | "message"> &
  Partial<Pick<Lead, "phone" | "company" | "requestedService" | "ipAddress" | "userAgent">>;

export type UpdateLeadInput = Partial<
  Pick<
    Lead,
    | "status"
    | "convertedEstimateId"
    | "assignedTo"
    | "internalNotes"
    | "lastActivityAt"
    | "aiSummary"
    | "aiCategory"
    | "aiPriority"
    | "aiPriorityReason"
    | "aiOpportunityValueRange"
    | "aiOpportunityConfidence"
    | "suggestedNextAction"
    | "aiResponseUrgency"
    | "aiResponseUrgencyReason"
    | "aiGeneratedAt"
    | "aiStatus"
  >
>;
