-- ---------------------------------------------------------------------------
-- Provider-agnostic mailbox connections (Microsoft Graph support, Step 1)
-- ---------------------------------------------------------------------------
-- Generalizes mailbox OAuth storage into one connection row per
-- (workspace, provider), so a second provider (Microsoft) can register
-- alongside Google without a provider-specific column set. This does NOT
-- replace `workspaces.google_*` (google_refresh_token_enc,
-- google_connected_email, google_scopes, google_connected_at) — every
-- existing Gmail code path (services/gmail.ts, gmailInbox.ts, googleOAuth.ts,
-- calendarReminders.ts, replyMatcher.ts, appointmentBooking.ts,
-- gmailWatchSync.ts, gmailLeadCapture.ts, followupSender.ts, the OAuth
-- routes, Settings/onboarding UI) keeps reading/writing those columns
-- exactly as before — zero refactor of the working Gmail flow. This table is
-- the live, canonical store for Microsoft going forward; for Google it's
-- kept in sync by an additive write in services/business.ts's
-- saveGoogleConnection/clearGoogleConnection (see that file), not a source
-- of truth anything currently reads from.
create table if not exists mailbox_connections (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces (id) on delete cascade,
  -- 'google' | 'microsoft' — plain text with app-layer validation
  -- (types/mailboxProvider.ts), same convention as every other status-like
  -- column in this schema (see CLAUDE.md's Database section).
  provider text not null,
  refresh_token_enc text not null,
  connected_email text not null,
  scopes text,
  connected_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- One connection per provider per business — upserted on reconnect, not duplicated.
create unique index if not exists mailbox_connections_workspace_provider_idx
  on mailbox_connections (workspace_id, provider);

-- One-time backfill: every workspace with a live Google connection today gets
-- a matching 'google' row here immediately, so this table is never empty or
-- "wrong" for an existing business the moment it's created. Going forward,
-- services/business.ts's saveGoogleConnection/clearGoogleConnection keep this
-- row in sync on every reconnect/disconnect.
insert into mailbox_connections (workspace_id, provider, refresh_token_enc, connected_email, scopes, connected_at)
select id, 'google', google_refresh_token_enc, google_connected_email, google_scopes, coalesce(google_connected_at, now())
from workspaces
where google_refresh_token_enc is not null and google_connected_email is not null
on conflict (workspace_id, provider) do nothing;
