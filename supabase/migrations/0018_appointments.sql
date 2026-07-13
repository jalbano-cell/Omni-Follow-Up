-- ---------------------------------------------------------------------------
-- Appointments as a first-class entity + booking lifecycle
-- ---------------------------------------------------------------------------
-- Promotes "appointment" from ephemeral fields on a Lead
-- (pending_appointment_date_time/pending_appointment_duration_minutes, still
-- present below but no longer read/written by the app — see CLAUDE.md) into
-- its own durable table. An Appointment optionally belongs to a Lead and/or
-- an Estimate (both nullable, set-null on delete) but can exist standalone —
-- this is what lets a day-after review request or a weeks-later rebook
-- reminder fire off something more durable than a Calendar event the owner
-- can rename/move/delete out from under us. See services/appointmentService.ts
-- and services/appointmentLifecycle.ts.
create table if not exists appointments (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces (id) on delete cascade,
  lead_id uuid references leads (id) on delete set null,
  estimate_id uuid references estimates (id) on delete set null,
  customer_name text not null,
  customer_email text not null,
  customer_phone text not null default '',
  service_type text not null default '',
  -- requested -> approved -> completed, or terminal no_show/cancelled from
  -- either state. Plain text with app-layer validation (types/appointment.ts),
  -- same convention as every other status column in this schema.
  status text not null default 'requested',
  requested_at timestamptz not null default now(),
  scheduled_start timestamptz not null,
  scheduled_end timestamptz not null,
  approved_at timestamptz,
  completed_at timestamptz,
  -- Set on approval (services/appointmentService.ts's approveAppointment) —
  -- the owner's own Calendar event, never invites the customer as an
  -- attendee (Calendar is a display/scheduling layer only; the customer-
  -- facing artifact is the confirmation email). Null until approved.
  google_calendar_event_id text,
  -- Owner-supplied at approval time, not auto-derived from anything upstream.
  price numeric,
  location text,
  prep_instructions text,
  -- The lead message this was parsed from, if any — context for the owner
  -- reviewing a request, not shown to the customer.
  source_message text not null default '',
  -- Idempotency guards for the two auto-send lifecycle jobs
  -- (services/appointmentLifecycle.ts) — set on send attempt regardless of
  -- outcome, same best-effort/no-retry philosophy as the rest of this app's
  -- automated sends, so a job re-run never double-sends.
  review_request_sent_at timestamptz,
  rebook_reminder_sent_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists appointments_workspace_idx on appointments (workspace_id);
create index if not exists appointments_workspace_status_idx on appointments (workspace_id, status);
create index if not exists appointments_scheduled_end_idx on appointments (scheduled_end);
create index if not exists appointments_workspace_customer_email_idx on appointments (workspace_id, lower(customer_email));
create index if not exists appointments_lead_idx on appointments (lead_id) where lead_id is not null;

-- ---------------------------------------------------------------------------
-- Per-contact suppression (CASL unsubscribe) — checked before every
-- automated send in the appointment lifecycle (instant pending-ack, review
-- request, rebook reminder). Unsubscribing kills the whole downstream
-- sequence for that contact, not just one email — see services/suppression.ts.
-- ---------------------------------------------------------------------------
create table if not exists suppressed_contacts (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces (id) on delete cascade,
  email text not null,
  suppressed_at timestamptz not null default now(),
  reason text
);
create unique index if not exists suppressed_contacts_workspace_email_idx
  on suppressed_contacts (workspace_id, lower(email));

-- ---------------------------------------------------------------------------
-- Business-level appointment-lifecycle settings
-- ---------------------------------------------------------------------------
alter table workspaces add column if not exists google_review_url text;
-- CASL requires a valid mailing address in every commercial electronic
-- message — surfaced in services/emailTemplates/complianceFooter.ts, omitted
-- from the footer when unset (the business should fill this in before relying
-- on the auto-sends for real compliance).
alter table workspaces add column if not exists mailing_address text;
-- Business-wide default days after completion before a rebook reminder sends;
-- null = disabled. See services/business.ts's getEffectiveRebookIntervalDays.
alter table workspaces add column if not exists rebook_interval_days int;
-- Per-service-type overrides, keyed by lowercased service_type: { [serviceType]: number|null }.
-- A present key with a null value explicitly disables the reminder for that
-- service even when the business default is set; a missing key falls back to
-- rebook_interval_days.
alter table workspaces add column if not exists rebook_interval_overrides jsonb not null default '{}'::jsonb;
