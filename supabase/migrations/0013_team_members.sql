-- ---------------------------------------------------------------------------
-- Team members (multi-user support)
-- ---------------------------------------------------------------------------
-- The `users` table has existed since the initial schema as Phase-6 auth prep
-- but was never wired into login — every business authenticated as a single
-- shared account against `workspaces.password_hash`. This adds what's needed
-- for a real invite-a-teammate flow (services/userService.ts): an invited row
-- starts with no password_hash and a signed invite_token; accepting the
-- invite (app/invite/[token]) sets password_hash and accepted_at and clears
-- the token. `role` already existed (default 'owner') — 'member' is the only
-- other value the app assigns, via invites.
alter table users add column if not exists password_hash text;
alter table users add column if not exists name text;
alter table users add column if not exists invite_token text;
alter table users add column if not exists invite_token_expires_at timestamptz;
alter table users add column if not exists accepted_at timestamptz;
create unique index if not exists users_invite_token_idx on users (invite_token) where invite_token is not null;
