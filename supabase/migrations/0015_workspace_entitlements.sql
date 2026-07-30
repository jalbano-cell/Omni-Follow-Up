-- ---------------------------------------------------------------------------
-- Agency-provisioned entitlement
-- ---------------------------------------------------------------------------
-- Access is no longer driven by an external subscription the customer starts —
-- the agency invoices clients externally and provisions access directly by
-- setting these two columns. `plan` decides the seat cap (config/constants.ts's
-- PLAN_MAX_USERS); `status` is the actual gate — 'active' means full access
-- everywhere (lib/session.ts's requireOnboardedBusiness), anything else means
-- a full app lockout to /account-paused. Plain text columns with app-layer
-- validation (types/business.ts's WorkspacePlan/WorkspaceStatus unions), same
-- convention as every other status-like column in this schema (estimates.status,
-- leads.status, the outgoing subscriptions.status below) — no DB-level
-- enum/check constraint.
alter table workspaces add column if not exists plan text not null default 'grow';
alter table workspaces add column if not exists status text not null default 'inactive';

-- Backfill from the outgoing subscriptions/plans tables before dropping them,
-- so nobody currently using the app loses access on deploy. New signups from
-- here on get the column defaults above (grow/inactive) until provisioned.
update workspaces w
set status = 'active',
    plan = case
      when exists (
        select 1 from subscriptions s
        where s.workspace_id = w.id and s.plan_id = 'pro' and s.status in ('active', 'trialing')
      ) then 'transform'
      else 'grow'
    end;

-- External billing is fully removed as an access gatekeeper — dropping the
-- tables it owned. Historical customer/subscription IDs remain visible in the
-- billing provider's own dashboard if ever needed; they aren't preserved here.
drop table if exists subscriptions;
drop table if exists plans;
