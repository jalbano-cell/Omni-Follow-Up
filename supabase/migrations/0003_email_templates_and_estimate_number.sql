-- Phase 1 of the V1.0 roadmap: customer-customizable email templates.
--
-- email_templates holds one row per (workspace, template_key) override —
-- absence of a row means "use the built-in default" (see
-- services/emailTemplateService.ts's DEFAULT_TEMPLATES).
create table if not exists email_templates (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces (id) on delete cascade,
  template_key text not null,
  subject text not null,
  body text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index if not exists email_templates_workspace_key_idx on email_templates (workspace_id, template_key);

-- estimate_number: a human-readable identifier for an Estimate (Lead already
-- has the equivalent leadId) — needed as a {{estimate_number}} merge variable
-- in follow-up templates. Existing rows are backfilled from their own id
-- (already globally unique) since there's no better source of truth to
-- derive a sequential number from.
alter table estimates add column if not exists estimate_number text;
update estimates
set estimate_number = 'EST-' || upper(substr(replace(id::text, '-', ''), 1, 8))
where estimate_number is null;
alter table estimates alter column estimate_number set not null;
create unique index if not exists estimates_estimate_number_idx on estimates (estimate_number);
