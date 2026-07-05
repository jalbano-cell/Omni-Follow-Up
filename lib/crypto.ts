import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from "crypto";
import { env } from "@/lib/env";

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 12;

/** Derives a fixed-length key from the raw env secret — accepts any length input safely. */
function getKey(): Buffer {
  return scryptSync(env.tokenEncryptionKey, "followupquote-token-encryption", 32);
}

/**
 * Encrypts a value for storage in the database (which has no field-level
 * encryption) — used for Google OAuth refresh tokens, which are long-lived
 * and high-value. Output packs iv:authTag:ciphertext, all hex, into one string.
 */
export function encrypt(plaintext: string): string {
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv(ALGORITHM, getKey(), iv);
  const ciphertext = Buffer.concat([cipher.update(plaintext, "utf-8"), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return `${iv.toString("hex")}:${authTag.toString("hex")}:${ciphertext.toString("hex")}`;
}

export function decrypt(packed: string): string {
  const [ivHex, authTagHex, ciphertextHex] = packed.split(":");
  if (!ivHex || !authTagHex || !ciphertextHex) {
    throw new Error("Malformed encrypted value.");
  }
  const decipher = createDecipheriv(ALGORITHM, getKey(), Buffer.from(ivHex, "hex"));
  decipher.setAuthTag(Buffer.from(authTagHex, "hex"));
  const plaintext = Buffer.concat([decipher.update(Buffer.from(ciphertextHex, "hex")), decipher.final()]);
  return plaintext.toString("utf-8");
}

/** Generates a bearer-token secret (e.g. a business's POST /api/intake key) — random, not derived from anything reversible. */
export function generateApiKey(): string {
  return `ofu_live_${randomBytes(24).toString("hex")}`;
}
