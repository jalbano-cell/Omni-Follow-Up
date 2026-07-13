export type AppointmentStatus = "requested" | "approved" | "completed" | "no_show" | "cancelled";

/** Null until services/appointmentLifecycle.ts's runAppointmentReminderDraftJob drafts one; then the approve/edit/skip/send lifecycle, mirroring (but separate from) the Estimate Follow-up Queue's FollowUpStatus. */
export type AppointmentReminderStatus = "pending" | "approved" | "sent" | "skipped" | "failed";

/**
 * A booked (or requested) service appointment — decoupled from Estimates on
 * purpose (see CLAUDE.md's Appointments section): it optionally links to the
 * Lead it was parsed from and/or the Estimate it may have been converted
 * from, but neither is required, and both are set-null on delete so a
 * deleted Lead/Estimate never takes an Appointment down with it. Customer
 * contact fields are denormalized here (not joined from Lead), same
 * precedent as Estimate's customerName/customerEmail, so an Appointment
 * stays fully readable even if its linked Lead is gone.
 */
export interface Appointment {
  id: string;
  businessId: string;
  leadId: string | null;
  estimateId: string | null;
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  serviceType: string;
  status: AppointmentStatus;
  requestedAt: string;
  scheduledStart: string;
  scheduledEnd: string;
  approvedAt: string | null;
  completedAt: string | null;
  /** Set on approval (services/appointmentService.ts) — the owner's own Calendar event; never invites the customer as an attendee. */
  googleCalendarEventId: string | null;
  /** Owner-supplied at approval time — never auto-derived. */
  price: number | null;
  location: string | null;
  prepInstructions: string | null;
  /** The lead message this was parsed from, if any — context for the owner, never shown to the customer. */
  sourceMessage: string;
  /** Idempotency guard for services/appointmentLifecycle.ts's review-request job — set on send attempt regardless of outcome. */
  reviewRequestSentAt: string | null;
  /** Idempotency guard for services/appointmentLifecycle.ts's rebook-reminder job — set on send attempt regardless of outcome. */
  rebookReminderSentAt: string | null;
  /** The pre-appointment reminder's drafted body — a genuinely different concern from reviewRequestSentAt/rebookReminderSentAt above (those are auto-sent; this one requires owner approval, like the Estimate Follow-up Queue). Null until services/appointmentLifecycle.ts's runAppointmentReminderDraftJob drafts one. */
  reminderMessage: string | null;
  reminderStatus: AppointmentReminderStatus | null;
  reminderSentAt: string | null;
  createdAt: string;
}

export type NewAppointmentInput = Pick<
  Appointment,
  "customerName" | "customerEmail" | "serviceType" | "scheduledStart" | "scheduledEnd"
> &
  Partial<Pick<Appointment, "leadId" | "estimateId" | "customerPhone" | "sourceMessage">>;

export type UpdateAppointmentInput = Partial<
  Pick<
    Appointment,
    | "status"
    | "approvedAt"
    | "completedAt"
    | "googleCalendarEventId"
    | "price"
    | "location"
    | "prepInstructions"
    | "scheduledStart"
    | "scheduledEnd"
    | "reviewRequestSentAt"
    | "rebookReminderSentAt"
    | "reminderMessage"
    | "reminderStatus"
    | "reminderSentAt"
  >
>;
