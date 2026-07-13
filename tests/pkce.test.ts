import { describe, it, expect } from "vitest";
import { createHash } from "crypto";
import { generatePkcePair } from "@/lib/pkce";

describe("generatePkcePair", () => {
  it("produces a verifier within RFC 7636's 43-128 char range", () => {
    const { codeVerifier } = generatePkcePair();
    expect(codeVerifier.length).toBeGreaterThanOrEqual(43);
    expect(codeVerifier.length).toBeLessThanOrEqual(128);
  });

  it("produces a verifier and challenge using only the base64url alphabet (no +, /, or = padding)", () => {
    const { codeVerifier, codeChallenge } = generatePkcePair();
    expect(codeVerifier).toMatch(/^[A-Za-z0-9_-]+$/);
    expect(codeChallenge).toMatch(/^[A-Za-z0-9_-]+$/);
  });

  it("derives the challenge as base64url(SHA-256(verifier)), per the S256 method", () => {
    const { codeVerifier, codeChallenge } = generatePkcePair();
    const expected = createHash("sha256").update(codeVerifier).digest("base64url");
    expect(codeChallenge).toBe(expected);
  });

  it("generates a fresh, distinct pair on every call", () => {
    const a = generatePkcePair();
    const b = generatePkcePair();
    expect(a.codeVerifier).not.toBe(b.codeVerifier);
    expect(a.codeChallenge).not.toBe(b.codeChallenge);
  });
});
