export type TeamMemberRole = "owner" | "member";

/**
 * An invited team member (services/userService.ts) — distinct from the
 * `Business` record, which is the workspace/tenant itself and its one
 * built-in owner login (`workspaces.password_hash`). A TeamMember with no
 * `passwordHash`/`acceptedAt` is a pending invite.
 */
export interface TeamMember {
  id: string;
  workspaceId: string;
  email: string;
  name: string | null;
  role: TeamMemberRole;
  passwordHash: string | null;
  inviteToken: string | null;
  inviteTokenExpiresAt: string | null;
  acceptedAt: string | null;
  createdAt: string;
  /** Own revocation counter, independent of the workspace's — see migration 0014. */
  sessionTokenVersion: number;
}

export type NewTeamMemberInput = Pick<TeamMember, "workspaceId" | "email" | "name"> & { role?: TeamMemberRole };
