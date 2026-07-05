-- OmniFollowUp — initial Supabase schema (Airtable -> Supabase migration, Phase 2)
--
-- This is a superset of the minimal 7-table spec: every field currently on
-- Airtable's Businesses/Leads/Estimates/FollowUps/Replies tables is preserved
-- here (renamed to snake_case, tenant column renamed businessId -> workspace_id
-- to match the new workspaces/users model), plus the ActivityLog and
-- Notifications tables, which aren't in the minimal spec but are live features
-- (Lead timeline, notification bell) that would otherwise be lost.
--
-- RLS is intentionally left disabled: every read/write happens server-side via
-- the service_role key with tenant isolation enforced in application code
-- (workspace_id filtering), exactly matching how Airtable access control works
-- today. Add RLS policies if/when Supabase Auth is fully enabled (Phase 6).
--
-- Every table carries an `airtable_record_id` column (nullable) so a row can be
-- traced back to its Airtable shadow copy during the dual-write phase. Drop
-- that column once Airtable is fully retired.

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------------
-- workspaces (one per tenant business — mirrors today's Airtable "Businesses")
-- ---------------------------------------------------------------------------
create table if not exists workspaces (
  id uuid primary key default gen_random_uuid(),
  business_name text not null,
  owner_name text not null,
  owner_email text not null,
  password_hash text not null,
  follow_up_cadence_sent_days int,
  follow_up_cadence_followup1_days int,
  follow_up_cadence_followup2_days int,
  onboarding_step int not null default 0,
  onboarding_completed_at timestamptz,
  google_refresh_token_enc text,
  google_connected_email text,
  google_scopes text,
  google_connected_at timestamptz,
  calendar_id text,
  industry text,
  timezone text,
  working_hours_start int,
  working_hours_end int,
  email_signature text,
  intake_api_key text,
  intake_api_key_created_at timestamptz,
  created_at timestamptz not null default now(),
  airtable_record_id text
);
create unique index if not exists workspaces_owner_email_idx on workspaces (lower(owner_email));
create unique index if not exists workspaces_intake_api_key_idx on workspaces (intake_api_key) where intake_api_key is not null;

-- ---------------------------------------------------------------------------
-- users (Phase 6 prep only — not wired into auth yet; app still authenticates
-- against workspaces.password_hash directly via lib/auth.ts's JWT session)
-- ---------------------------------------------------------------------------
create table if not exists users (
  id uuid primary key default gen_random_uuid(),
  email text not null,
  workspace_id uuid not null references workspaces (id) on delete cascade,
  role text not null default 'owner',
  created_at timestamptz not null default now()
);
create unique index if not exists users_email_idx on users (lower(email));
create index if not exists users_workspace_id_idx on users (workspace_id);

-- ---------------------------------------------------------------------------
-- leads (every inbound business inquiry — today, always via POST /api/intake)
-- ---------------------------------------------------------------------------
create table if not exists leads (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces (id) on delete cascade,
  lead_id text not null,
  name text not null,
  email text not null,
  phone text not null default '',
  company text not null default '',
  service text not null default '',
  message text not null,
  status text not null default 'New Inquiry',
  source text not null default 'Website',
  ip_address text,
  user_agent text,
  converted_estimate_id uuid,
  assigned_to text not null default '',
  internal_notes text not null default '',
  -- AI Lead Intelligence (services/aiInsightsService.ts) — null until analyzed, never fabricated.
  ai_summary text,
  ai_category text,
  ai_priority text,
  ai_priority_reason text,
  ai_opportunity_value_range text,
  ai_opportunity_confidence text,
  suggested_next_action text,
  ai_response_urgency text,
  ai_response_urgency_reason text,
  ai_generated_at timestamptz,
  ai_status text not null default 'pending',
  created_at timestamptz not null default now(),
  last_activity_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  airtable_record_id text
);
create unique index if not exists leads_lead_id_idx on leads (lead_id);
create index if not exists leads_workspace_id_idx on leads (workspace_id);
create index if not exists leads_workspace_status_idx on leads (workspace_id, status);

-- ---------------------------------------------------------------------------
-- estimates
-- ---------------------------------------------------------------------------
create table if not exists estimates (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces (id) on delete cascade,
  lead_id uuid references leads (id) on delete set null,
  customer_name text not null,
  customer_email text not null,
  business_name text not null default '',
  service_type text not null default '',
  value numeric not null default 0,
  status text not null default 'Sent',
  date_sent timestamptz not null default now(),
  next_followup_date date,
  last_contact_date date,
  notes text not null default '',
  gmail_thread_id text,
  gmail_last_message_id text,
  created_at timestamptz not null default now(),
  airtable_record_id text
);
create index if not exists estimates_workspace_id_idx on estimates (workspace_id);
create index if not exists estimates_lead_id_idx on estimates (lead_id);

alter table leads
  add constraint leads_converted_estimate_id_fkey
  foreign key (converted_estimate_id) references estimates (id) on delete set null;

-- ---------------------------------------------------------------------------
-- followups
-- ---------------------------------------------------------------------------
create table if not exists followups (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces (id) on delete cascade,
  estimate_id uuid not null references estimates (id) on delete cascade,
  message text not null,
  status text not null default 'Pending',
  scheduled_date date not null,
  sent_at timestamptz,
  calendar_event_id text,
  created_at timestamptz not null default now(),
  airtable_record_id text
);
create index if not exists followups_workspace_id_idx on followups (workspace_id);
create index if not exists followups_estimate_id_idx on followups (estimate_id);

-- ---------------------------------------------------------------------------
-- replies (incoming Gmail replies matched to an estimate's thread)
-- ---------------------------------------------------------------------------
create table if not exists replies (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces (id) on delete cascade,
  estimate_id uuid not null references estimates (id) on delete cascade,
  gmail_message_id text not null,
  gmail_thread_id text not null,
  from_email text not null,
  subject text not null default '',
  snippet text not null default '',
  body_text text not null default '',
  received_at timestamptz not null,
  is_read boolean not null default false,
  created_at timestamptz not null default now(),
  airtable_record_id text
);
create index if not exists replies_workspace_id_idx on replies (workspace_id);
create index if not exists replies_estimate_id_idx on replies (estimate_id);

-- ---------------------------------------------------------------------------
-- activity_logs (durable per-workspace/per-lead event trail — a Lead's Timeline)
-- ---------------------------------------------------------------------------
create table if not exists activity_logs (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces (id) on delete cascade,
  lead_id uuid references leads (id) on delete cascade,
  action text not null,
  description text not null default '',
  metadata jsonb,
  created_at timestamptz not null default now(),
  airtable_record_id text
);
create index if not exists activity_logs_workspace_id_idx on activity_logs (workspace_id);
create index if not exists activity_logs_lead_id_idx on activity_logs (lead_id);

-- ---------------------------------------------------------------------------
-- notifications (in-app alerts for the business owner — not in the original
-- 7-table spec, but a live feature (header bell) that must not be lost)
-- ---------------------------------------------------------------------------
create table if not exists notifications (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces (id) on delete cascade,
  lead_id uuid references leads (id) on delete cascade,
  type text not null,
  message text not null,
  is_read boolean not null default false,
  created_at timestamptz not null default now(),
  airtable_record_id text
);
create index if not exists notifications_workspace_id_idx on notifications (workspace_id);
create index if not exists notifications_workspace_unread_idx on notifications (workspace_id, is_read);
