-- Phase 8 of the V1.0 roadmap: subscription/plan scaffolding, no live billing.
-- Billing fields are placeholder columns only — nothing in the app calls
-- Billing's API yet. A workspace with no subscriptions row is implicitly on
-- the 'free' plan (see services/subscriptionService.ts's getEffectivePlan).
create table if not exists plans (
  id text primary key,
  name text not null,
  price_cents int not null default 0,
  max_leads_per_month int,
  max_users int not null default 1,
  features jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists subscriptions (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces (id) on delete cascade,
  plan_id text not null references plans (id),
  status text not null default 'active',
  billing_customer_id text,
  billing_subscription_id text,
  current_period_end timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index if not exists subscriptions_workspace_id_idx on subscriptions (workspace_id);

insert into plans (id, name, price_cents, max_leads_per_month, max_users, features)
values
  ('free', 'Free', 0, 50, 1, '{"emailTemplates": true, "customerPortal": true, "publicApi": false, "webhooks": false}'::jsonb),
  ('pro', 'Pro', 4900, null, 3, '{"emailTemplates": true, "customerPortal": true, "publicApi": true, "webhooks": true}'::jsonb)
on conflict (id) do nothing;
