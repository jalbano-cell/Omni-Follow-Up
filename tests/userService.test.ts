import { describe, it, expect } from "vitest";
import { isInviteAcceptable } from "@/services/userService";
import type { TeamMember } from "@/types";

function member(overrides: Partial<TeamMember> = {}): TeamMember {
  return {
    id: "user-1",
    workspaceId: "biz-1",
    email: "a@b.com",
    name: "A",
    role: "member",
    passwordHash: null,
    inviteToken: "inv_abc",
    inviteTokenExpiresAt: new Date(Date.now() + 60_000).toISOString(),
    acceptedAt: null,
    createdAt: new Date().toISOString(),
    sessionTokenVersion: 0,
    ...overrides,
  };
}

describe("isInviteAcceptable", () => {
  it("accepts a pending, unexpired invite", () => {
    expect(isInviteAcceptable(member())).toBe(true);
  });

  it("rejects null", () => {
    expect(isInviteAcceptable(null)).toBe(false);
  });

  it("rejects an already-accepted invite (can't replay the link)", () => {
    expect(isInviteAcceptable(member({ acceptedAt: new Date().toISOString() }))).toBe(false);
  });

  it("rejects an expired invite", () => {
    expect(isInviteAcceptable(member({ inviteTokenExpiresAt: new Date(Date.now() - 1000).toISOString() }))).toBe(false);
  });

  it("rejects a row with no invite token", () => {
    expect(isInviteAcceptable(member({ inviteToken: null }))).toBe(false);
  });
});
