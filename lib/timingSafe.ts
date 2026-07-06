import { timingSafeEqual } from "crypto";

/**
 * Constant-time string comparison for secrets (bearer tokens, cron secrets).
 * A plain `a === b` short-circuits on the first differing byte, leaking how
 * many leading characters were correct through response timing; this always
 * compares the full length. Returns false on any length mismatch (comparing a
 * padded buffer would itself leak the length), which is the safe default here
 * since our secrets are fixed-length.
 */
export function safeCompare(a: string | null | undefined, b: string | null | undefined): boolean {
  if (!a || !b) return false;
  const bufA = Buffer.from(a, "utf-8");
  const bufB = Buffer.from(b, "utf-8");
  if (bufA.length !== bufB.length) return false;
  return timingSafeEqual(bufA, bufB);
}
