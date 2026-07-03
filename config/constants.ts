import type { EstimateStatus, FollowUpStatus } from "@/types";

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
  "Sent",
  "Approved",
  "Rejected",
];

/** Days after the previous touch before each follow-up stage is due. */
export const FOLLOW_UP_CADENCE_DAYS: Record<"Sent" | "Follow-up 1" | "Follow-up 2", number> = {
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
