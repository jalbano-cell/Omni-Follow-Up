-- Phase 6 of the V1.0 roadmap: appointment booking becomes opt-in (default
-- off). When off, a requested appointment produces a reviewable
-- recommendation on the Lead instead of an automatic Calendar booking.
alter table workspaces add column if not exists auto_book_appointments boolean;

alter table leads add column if not exists pending_appointment_date_time text;
alter table leads add column if not exists pending_appointment_duration_minutes int;
