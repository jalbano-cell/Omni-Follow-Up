import type { EstimateStatus, FollowUpStatus } from "@/types";

/** Single deployment-wide timezone — used for the cron's local-hour check and Calendar reminder times. */
export const APP_TIMEZONE = "America/Toronto";

/** Local hour (in APP_TIMEZONE) a follow-up's Calendar reminder is scheduled at. */
export const CALENDAR_REMINDER_HOUR = 9;
export const CALENDAR_REMINDER_DURATION_MINUTES = 15;

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
