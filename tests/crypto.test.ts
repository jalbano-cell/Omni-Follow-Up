import { describe, it, expect } from "vitest";
import { encrypt, decrypt, generateApiKey } from "@/lib/crypto";

describe("token encryption", () => {
  it("round-trips a value through encrypt/decrypt", () => {
    const secret = "1//0abcRefreshTokenFromGoogle-xyz";
    expect(decrypt(encrypt(secret))).toBe(secret);
  });

  it("produces different ciphertext each time (random IV)", () => {
    expect(encrypt("same-plaintext")).not.toEqual(encrypt("same-plaintext"));
  });

  it("throws on a malformed packed value", () => {
    expect(() => decrypt("not-packed")).toThrow();
  });

  it("throws when the ciphertext is tampered with (auth tag mismatch)", () => {
    const packed = encrypt("sensitive");
    const [iv, tag, ct] = packed.split(":");
    const flipped = ct.slice(0, -1) + (ct.at(-1) === "0" ? "1" : "0");
    expect(() => decrypt(`${iv}:${tag}:${flipped}`)).toThrow();
  });
});

describe("generateApiKey", () => {
  it("uses the ofu_live_ prefix and is unique per call", () => {
    const a = generateApiKey();
    const b = generateApiKey();
    expect(a).toMatch(/^ofu_live_[0-9a-f]{48}$/);
    expect(a).not.toEqual(b);
  });
});
