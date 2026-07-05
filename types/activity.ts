/** One durable entry in a business's ActivityLog — the source of a lead's Timeline and the dashboard's activity feed. */
export interface ActivityLogEntry {
  id: string;
  businessId: string;
  /** Database record id of the related Lead, when this activity is lead-scoped (every entry today is). */
  leadId: string;
  /** Machine-readable event key, e.g. "lead.created", "lead.converted", "lead.archived", "lead.assigned", "lead.note_added". */
  type: string;
  /** Human-readable line shown in the Timeline/activity feed, e.g. "New website inquiry received." */
  description: string;
  createdAt: string;
}

export type NewActivityLogEntryInput = Pick<ActivityLogEntry, "leadId" | "type" | "description">;
