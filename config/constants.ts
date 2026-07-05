import type { EmailTemplateKey, EstimateStatus, FollowUpStatus, LeadStatus } from "@/types";

/** Single deployment-wide timezone — used for the cron's local-hour check and Calendar reminder times. */
export const APP_TIMEZONE = "America/Toronto";

/** Local hour (in APP_TIMEZONE) a follow-up's Calendar reminder is scheduled at, when a business hasn't set its own working hours. */
export const CALENDAR_REMINDER_HOUR = 9;
export const CALENDAR_REMINDER_DURATION_MINUTES = 15;
/** Default end-of-workday hour, when a business hasn't set its own. */
export const DEFAULT_WORKING_HOURS_END = 17;

/** Curated timezone options for the Settings/onboarding picker — the North American markets this product targets. */
export const TIMEZONE_OPTIONS = [
  { value: "America/Toronto", label: "Eastern Time (Toronto)" },
  { value: "America/New_York", label: "Eastern Time (New York)" },
  { value: "America/Chicago", label: "Central Time" },
  { value: "America/Denver", label: "Mountain Time" },
  { value: "America/Los_Angeles", label: "Pacific Time" },
  { value: "America/Vancouver", label: "Pacific Time (Vancouver)" },
  { value: "America/Halifax", label: "Atlantic Time (Halifax)" },
] as const;

export const ESTIMATE_STATUSES: EstimateStatus[] = [
  "Sent",
  "Follow-up 1",
  "Follow-up 2",
  "Booked",
  "Lost",
];

/** Statuses still considered "open" — counted toward at-risk revenue. */
export const OPEN_ESTIMATE_STATUSES: EstimateStatus[] = [
  "Sent",
  "Follow-up 1",
  "Follow-up 2",
];

export const FOLLOW_UP_STATUSES: FollowUpStatus[] = [
  "Pending",
  "Approved",
  "Sent",
  "Rejected",
  "Failed",
];

/** Statuses still actionable from the Follow-up Queue (excludes terminal Sent/Rejected). */
export const ACTIONABLE_FOLLOWUP_STATUSES: FollowUpStatus[] = ["Pending", "Approved", "Failed"];

/** Display label per spec's "Draft / Approved / Sent / Failed" vocabulary — "Pending" reads as "Draft" in the UI. */
export const FOLLOWUP_STATUS_LABEL: Record<FollowUpStatus, string> = {
  Pending: "Draft",
  Approved: "Approved",
  Sent: "Sent",
  Rejected: "Skipped",
  Failed: "Failed",
};

export const FOLLOWUP_STATUS_BADGE_VARIANT: Record<
  FollowUpStatus,
  "default" | "secondary" | "success" | "warning" | "destructive"
> = {
  Pending: "secondary",
  Approved: "warning",
  Sent: "success",
  Rejected: "secondary",
  Failed: "destructive",
};

/** Days after the previous touch before each follow-up stage is due, when a business hasn't set its own cadence. */
export const DEFAULT_FOLLOW_UP_CADENCE_DAYS: Record<"Sent" | "Follow-up 1" | "Follow-up 2", number> = {
  Sent: 3,
  "Follow-up 1": 5,
  "Follow-up 2": 7,
};

export const SERVICE_TYPES = [
  "Plumbing",
  "HVAC",
  "Electrical",
  "Roofing",
  "Landscaping",
  "Painting",
  "General Contracting",
  "Other",
] as const;

export const STATUS_BADGE_VARIANT: Record<EstimateStatus, "default" | "secondary" | "success" | "warning" | "destructive"> = {
  Sent: "secondary",
  "Follow-up 1": "warning",
  "Follow-up 2": "warning",
  Booked: "success",
  Lost: "destructive",
};

/** Every way a Lead can enter the system — kept as a plain string on the Lead record (see types/lead.ts), not a closed DB enum. */
export const LEAD_SOURCES = ["Website Form", "Gmail", "Manual Entry", "CSV Import", "Webhook"] as const;
export type LeadSource = (typeof LEAD_SOURCES)[number];

/** What POST /api/intake records when a submission doesn't specify a source. */
export const DEFAULT_LEAD_SOURCE: LeadSource = "Website Form";

/** Sources where an automatic, real-time customer acknowledgment email makes sense — not for retroactive/batch entries (Manual Entry, CSV Import), where an automated email would be surprising. */
export const AUTO_ACKNOWLEDGE_LEAD_SOURCES: LeadSource[] = ["Website Form", "Webhook", "Gmail"];

export const LEAD_STATUSES: LeadStatus[] = ["New Inquiry", "Converted", "Archived"];

export const LEAD_STATUS_BADGE_VARIANT: Record<LeadStatus, "default" | "secondary" | "success" | "warning" | "destructive"> = {
  "New Inquiry": "warning",
  Converted: "success",
  Archived: "secondary",
};

/** The 4 customizable email templates (services/emailTemplateService.ts) — order matches the lifecycle they fire in. */
export const EMAIL_TEMPLATE_KEYS: EmailTemplateKey[] = ["acknowledgment", "followup_1", "followup_2", "final_followup"];

export const EMAIL_TEMPLATE_LABELS: Record<EmailTemplateKey, string> = {
  acknowledgment: "Acknowledgment Email",
  followup_1: "Follow-up #1",
  followup_2: "Follow-up #2",
  final_followup: "Final Follow-up",
};

/** Every merge variable a template MAY reference — not every template key has all of them populated at render time. */
export const EMAIL_TEMPLATE_MERGE_VARIABLES = [
  "customer_name",
  "company",
  "service",
  "estimate_number",
  "estimate_value",
  "days_since",
  "business_name",
] as const;
