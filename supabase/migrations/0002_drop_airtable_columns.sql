-- Airtable has been fully retired (see CLAUDE.md's "Database (Supabase)" section) —
-- the airtable_record_id traceability columns from the dual-write migration
-- phase are no longer needed.

alter table workspaces drop column if exists airtable_record_id;
alter table leads drop column if exists airtable_record_id;
alter table estimates drop column if exists airtable_record_id;
alter table followups drop column if exists airtable_record_id;
alter table replies drop column if exists airtable_record_id;
alter table activity_logs drop column if exists airtable_record_id;
alter table notifications drop column if exists airtable_record_id;
