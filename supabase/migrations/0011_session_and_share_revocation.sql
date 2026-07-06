-- ---------------------------------------------------------------------------
-- Token revocation support
-- ---------------------------------------------------------------------------
-- Session tokens (lib/auth.ts) are stateless signed JWTs with no server-side
-- record, so before this there was no way to invalidate one early — logout
-- only cleared the cookie in the current browser, and a password reset (or a
-- leaked token) couldn't kick existing sessions. Each session JWT now carries
-- the business's `session_token_version`; lib/session.ts rejects a token whose
-- version is behind the current one, and bumping the column (logout, and any
-- future password-change flow) revokes every outstanding session at once.
--
-- Estimate share links (app/e/[token]) get the same treatment per-estimate via
-- `share_token_version`, so a business can invalidate a previously shared
-- customer link ("reset link") without waiting out its 90-day expiry.
--
-- Both default to 0 so every JWT minted before this migration (which omits the
-- version, read as 0) stays valid — no forced logout / link breakage on deploy.

alter table workspaces
  add column if not exists session_token_version integer not null default 0;

alter table estimates
  add column if not exists share_token_version integer not null default 0;
