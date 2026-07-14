import { randomBytes } from "crypto";
import { getSupabase, insertRow, updateRow, selectWhere, selectById, deleteRow } from "@/lib/supabase";
import { getBusinessByEmail, getBusinessById, updateBusiness } from "@/services/business";
import { MAX_TEAM_SEATS } from "@/config/constants";
import type { Database } from "@/types/supabase";
import type { Business, TeamMember } from "@/types";

/**
 * Team members (multi-user support) — a `TeamMember` is distinct from the
 * `Business` record, which owns its own single built-in owner login
 * (`workspaces.password_hash`, unchanged by any of this). A pending invite is
 * a row with `passwordHash`/`acceptedAt` both null; accepting it fills them
 * in. See CLAUDE.md's Team members section for the full auth-flow writeup.
 */

type UserRow = Database["public"]["Tables"]["users"]["Row"];

const INVITE_TOKEN_TTL_MS = 7 * 24 * 60 * 60 * 1000;

function toTeamMember(row: UserRow): TeamMember {
  return {
    id: row.id,
    workspaceId: row.workspace_id,
    email: row.email,
    name: row.name,
    role: row.role === "owner" ? "owner" : "member",
    passwordHash: row.password_hash,
    inviteToken: row.invite_token,
    inviteTokenExpiresAt: row.invite_token_expires_at,
    acceptedAt: row.accepted_at,
    createdAt: row.created_at,
    sessionTokenVersion: row.session_token_version ?? 0,
  };
}

export async function getTeamMembersForBusiness(businessId: string): Promise<TeamMember[]> {
  const rows = await selectWhere("users", { workspace_id: businessId }, { orderBy: "created_at", ascending: true });
  return rows.map(toTeamMember);
}

export async function getTeamMemberById(id: string): Promise<TeamMember | null> {
  const row = await selectById("users", id);
  return row ? toTeamMember(row) : null;
}

/** Case-insensitive, global (not scoped to one workspace) — a team member's email is how they log in, same as a business owner's. */
export async function getTeamMemberByEmail(email: string): Promise<TeamMember | null> {
  const { data, error } = await getSupabase()
    .from("users")
    .select()
    .ilike("email", email)
    .limit(1)
    .maybeSingle();
  if (error) throw new Error(`Supabase select on "users" failed: ${error.message}`);
  return data ? toTeamMember(data as UserRow) : null;
}

export async function getTeamMemberByInviteToken(token: string): Promise<TeamMember | null> {
  if (!token) return null;
  const rows = await selectWhere("users", { invite_token: token });
  return rows[0] ? toTeamMember(rows[0]) : null;
}

export class TeamMemberLimitExceededError extends Error {
  constructor(public readonly maxUsers: number) {
    super(`This workspace allows up to ${maxUsers} user${maxUsers === 1 ? "" : "s"}.`);
    this.name = "TeamMemberLimitExceededError";
  }
}

export class TeamMemberEmailInUseError extends Error {
  constructor() {
    super("That email is already associated with an Omni Follow Up account.");
    this.name = "TeamMemberEmailInUseError";
  }
}

/**
 * Creates a pending invite row with a signed token (services/business.ts's
 * generateApiKey precedent — a random opaque secret, not a JWT, since it's a
 * one-time-use link with its own DB-backed expiry/revocation rather than a
 * stateless claim). Throws TeamMemberLimitExceededError once the flat seat
 * cap (config/constants.ts's MAX_TEAM_SEATS — the owner plus every
 * invited-or-accepted row counts, so a still-pending invite already occupies
 * a seat) is already met — the same cap for every workspace, no plan tiers.
 * Counts pending invites too, not just accepted ones — otherwise a business
 * could send unlimited invites and blow past the cap the instant they're all
 * accepted at once.
 */
export async function inviteTeamMember(
  businessId: string,
  input: { email: string; name: string }
): Promise<TeamMember> {
  const business = await getBusinessById(businessId);
  if (!business) {
    throw new Error(`Business not found: ${businessId}`);
  }
  const existingMembers = await getTeamMembersForBusiness(businessId);
  const seatsUsed = 1 + existingMembers.length; // +1 for the workspace owner, who has no `users` row
  if (seatsUsed >= MAX_TEAM_SEATS) {
    throw new TeamMemberLimitExceededError(MAX_TEAM_SEATS);
  }

  // An email can only ever be one kind of account (owner or member) — reject
  // upfront rather than letting login's owner-takes-priority tiebreak (see
  // app/login/actions.ts) silently shadow a pending/accepted invite.
  const [existingBusiness, existingMember] = await Promise.all([
    getBusinessByEmail(input.email),
    getTeamMemberByEmail(input.email),
  ]);
  if (existingBusiness || existingMember) {
    throw new TeamMemberEmailInUseError();
  }

  const inviteToken = `inv_${randomBytes(24).toString("hex")}`;
  const row = await insertRow("users", {
    workspace_id: businessId,
    email: input.email,
    name: input.name,
    role: "member",
    invite_token: inviteToken,
    invite_token_expires_at: new Date(Date.now() + INVITE_TOKEN_TTL_MS).toISOString(),
  });
  return toTeamMember(row);
}

/**
 * Creates the one-time claim link for a brand-new agency-provisioned
 * workspace (app/admin/actions.ts's provisionNewWorkspaceAction) — reuses
 * the exact same invite-token/expiry mechanics and the exact same
 * app/invite/[token] accept page as inviteTeamMember above, but with
 * role: "owner" instead of "member". This `users` row is transient: it only
 * ever exists to carry the claim token from creation to acceptance —
 * claimWorkspaceOwnership (below) deletes it the moment it's used, so it
 * never becomes a permanent second "owner shape" alongside
 * workspaces.password_hash. No seat-cap check here (unlike inviteTeamMember)
 * since this is the workspace's own inaugural owner, not an additional seat
 * on top of one; the email-collision guard still applies, since the agency
 * could still typo an email that's already tied to a different account.
 */
export async function createOwnerClaim(
  workspaceId: string,
  input: { email: string; name: string }
): Promise<TeamMember> {
  const [existingBusiness, existingMember] = await Promise.all([
    getBusinessByEmail(input.email),
    getTeamMemberByEmail(input.email),
  ]);
  if (existingBusiness || existingMember) {
    throw new TeamMemberEmailInUseError();
  }

  const inviteToken = `inv_${randomBytes(24).toString("hex")}`;
  const row = await insertRow("users", {
    workspace_id: workspaceId,
    email: input.email,
    name: input.name,
    role: "owner",
    invite_token: inviteToken,
    invite_token_expires_at: new Date(Date.now() + INVITE_TOKEN_TTL_MS).toISOString(),
  });
  return toTeamMember(row);
}

/**
 * Promotes an accepted owner-claim (see createOwnerClaim) onto the workspace
 * itself — sets the real password_hash on `workspaces` (overwriting the
 * unguessable placeholder from services/business.ts's createBusinessForAgency)
 * — then deletes the transient `users` row. After this, the workspace is
 * indistinguishable from one created through normal self-serve signup: the
 * owner always authenticates via workspaces.password_hash, never a `users`
 * row, exactly like every other workspace in this app.
 */
export async function claimWorkspaceOwnership(member: TeamMember, passwordHash: string): Promise<Business> {
  const business = await updateBusiness(member.workspaceId, { passwordHash });
  await deleteRow("users", member.id, { workspace_id: member.workspaceId } as Partial<UserRow>);
  return business;
}

/** Whether an invite token is still valid to accept — unknown, already-accepted, or expired tokens all fail this. */
export function isInviteAcceptable(member: TeamMember | null): member is TeamMember & { inviteTokenExpiresAt: string } {
  if (!member || member.acceptedAt || !member.inviteToken || !member.inviteTokenExpiresAt) return false;
  return new Date(member.inviteTokenExpiresAt).getTime() > Date.now();
}

/** Sets the member's password and marks the invite accepted, clearing the one-time token so it can't be replayed. */
export async function acceptInvite(id: string, passwordHash: string): Promise<TeamMember> {
  const row = await updateRow("users", id, {
    password_hash: passwordHash,
    accepted_at: new Date().toISOString(),
    invite_token: null,
    invite_token_expires_at: null,
  });
  return toTeamMember(row);
}

/** Owner-only action (gated by lib/session.ts's requireOwner at the call site) — tenant-scoped delete so one business can never remove another's member row. */
export async function removeTeamMember(businessId: string, id: string): Promise<void> {
  await deleteRow("users", id, { workspace_id: businessId } as Partial<UserRow>);
}

/** Revokes this one member's outstanding sessions without touching the owner's or any other member's (see migration 0014). */
export async function bumpMemberSessionTokenVersion(id: string): Promise<void> {
  const member = await getTeamMemberById(id);
  if (!member) return;
  await updateRow("users", id, { session_token_version: member.sessionTokenVersion + 1 });
}
