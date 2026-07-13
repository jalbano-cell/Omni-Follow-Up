import { describe, it, expect } from "vitest";
import {
  createSessionToken,
  verifySessionToken,
  createEstimateShareToken,
  verifyEstimateShareToken,
  createOAuthStateToken,
  verifyOAuthStateToken,
} from "@/lib/auth";

describe("session tokens", () => {
  it("round-trips businessId/email/tokenVersion", async () => {
    const token = await createSessionToken({ businessId: "biz-1", email: "a@b.com", tokenVersion: 3 });
    const payload = await verifySessionToken(token);
    expect(payload).toEqual({ businessId: "biz-1", email: "a@b.com", tokenVersion: 3 });
  });

  it("defaults tokenVersion to 0 when omitted (backward compat)", async () => {
    const token = await createSessionToken({ businessId: "biz-1", email: "a@b.com" });
    const payload = await verifySessionToken(token);
    expect(payload?.tokenVersion).toBe(0);
  });

  it("returns null for a tampered token", async () => {
    const token = await createSessionToken({ businessId: "biz-1", email: "a@b.com", tokenVersion: 0 });
    const tampered = token.slice(0, -3) + (token.at(-1) === "a" ? "bbb" : "aaa");
    expect(await verifySessionToken(tampered)).toBeNull();
  });

  it("returns null for null/empty input", async () => {
    expect(await verifySessionToken(null)).toBeNull();
    expect(await verifySessionToken(undefined)).toBeNull();
    expect(await verifySessionToken("")).toBeNull();
  });

  it("round-trips a team-member session's userId/role (services/userService.ts)", async () => {
    const token = await createSessionToken({
      businessId: "biz-1",
      email: "member@b.com",
      tokenVersion: 1,
      userId: "user-1",
      role: "member",
    });
    const payload = await verifySessionToken(token);
    expect(payload).toEqual({
      businessId: "biz-1",
      email: "member@b.com",
      tokenVersion: 1,
      userId: "user-1",
      role: "member",
    });
  });

  it("an owner session (no userId) round-trips without one", async () => {
    const token = await createSessionToken({ businessId: "biz-1", email: "owner@b.com", tokenVersion: 0 });
    const payload = await verifySessionToken(token);
    expect(payload?.userId).toBeUndefined();
  });
});

describe("estimate share tokens", () => {
  it("round-trips and carries shareTokenVersion", async () => {
    const token = await createEstimateShareToken({ estimateId: "est-1", businessId: "biz-1", shareTokenVersion: 2 });
    expect(await verifyEstimateShareToken(token)).toEqual({
      estimateId: "est-1",
      businessId: "biz-1",
      shareTokenVersion: 2,
    });
  });

  it("defaults shareTokenVersion to 0 when omitted", async () => {
    const token = await createEstimateShareToken({ estimateId: "est-1", businessId: "biz-1" });
    expect((await verifyEstimateShareToken(token))?.shareTokenVersion).toBe(0);
  });

  it("a session token is not accepted as a share token", async () => {
    const session = await createSessionToken({ businessId: "biz-1", email: "a@b.com" });
    // Signed by us, but lacks estimateId — must be rejected by the shape check.
    expect(await verifyEstimateShareToken(session)).toBeNull();
  });
});

describe("oauth state tokens", () => {
  it("round-trips businessId/returnTo", async () => {
    const token = await createOAuthStateToken({ businessId: "biz-1", returnTo: "/settings" });
    expect(await verifyOAuthStateToken(token)).toEqual({ businessId: "biz-1", returnTo: "/settings" });
  });

  it("round-trips a PKCE codeVerifier (Microsoft's flow)", async () => {
    const token = await createOAuthStateToken({ businessId: "biz-1", returnTo: "/settings", codeVerifier: "verifier-abc123" });
    expect(await verifyOAuthStateToken(token)).toEqual({ businessId: "biz-1", returnTo: "/settings", codeVerifier: "verifier-abc123" });
  });
});
