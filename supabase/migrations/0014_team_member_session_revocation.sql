-- A team member's session must be revocable independently of the workspace
-- owner's and every other member's — `workspaces.session_token_version`
-- alone would mean one member logging out (or a future per-member
-- password-change flow) bumps a single shared counter that also invalidates
-- the owner's and every other member's session. Same mechanism as
-- workspaces (see migration 0011), scoped per-row instead.
alter table users add column if not exists session_token_version int not null default 0;
