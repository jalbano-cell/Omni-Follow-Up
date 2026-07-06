import { describe, it, expect } from "vitest";
import { hashPassword, verifyPassword } from "@/lib/password";

describe("password hashing", () => {
  it("verifies a correct password against its hash", async () => {
    const hash = await hashPassword("correct horse battery staple");
    expect(await verifyPassword("correct horse battery staple", hash)).toBe(true);
  });

  it("rejects an incorrect password", async () => {
    const hash = await hashPassword("correct horse battery staple");
    expect(await verifyPassword("wrong password", hash)).toBe(false);
  });

  it("produces a unique salt per hash (same password -> different hashes)", async () => {
    const a = await hashPassword("samePassword123");
    const b = await hashPassword("samePassword123");
    expect(a).not.toEqual(b);
    expect(await verifyPassword("samePassword123", a)).toBe(true);
    expect(await verifyPassword("samePassword123", b)).toBe(true);
  });

  it("returns false for a malformed stored hash instead of throwing", async () => {
    expect(await verifyPassword("whatever", "not-a-valid-hash")).toBe(false);
    expect(await verifyPassword("whatever", "")).toBe(false);
  });
});
