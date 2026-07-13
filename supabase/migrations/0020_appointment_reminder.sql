-- ---------------------------------------------------------------------------
-- Appointment reminder — owner-approved, pre-appointment nudge
-- ---------------------------------------------------------------------------
-- A "follow-up" for Appointments, distinct from the Estimate Follow-up Queue:
-- drafted automatically once an approved appointment enters its reminder
-- window, but requires the owner to approve it before it sends (see
-- services/appointmentService.ts's approveReminder/sendReminder and
-- services/appointmentLifecycle.ts's runAppointmentReminderDraftJob). An
-- Appointment only ever needs one reminder — a single nullable-until-it-
-- happens fact, same shape as google_calendar_event_id/review_request_sent_at
-- already on this table, not a separate multi-row queue like `followups`.
alter table appointments add column if not exists reminder_message text;
-- Null until drafted; then 'pending' | 'approved' | 'sent' | 'skipped' | 'failed'.
alter table appointments add column if not exists reminder_status text;
alter table appointments add column if not exists reminder_sent_at timestamptz;

-- Business override for how many hours before scheduled_start the reminder
-- drafts; null = use the app default (24h, see config/constants.ts's
-- DEFAULT_APPOINTMENT_REMINDER_HOURS_BEFORE).
alter table workspaces add column if not exists appointment_reminder_hours_before int;
