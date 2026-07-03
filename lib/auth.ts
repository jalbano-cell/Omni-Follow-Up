import { env } from "@/lib/env";

export const SESSION_COOKIE_NAME = "fq_session";

/**
 * Single shared-password gate for this internal tool — no per-user accounts.
 * Uses Web Crypto (not Node's `crypto` module) so it works in both the
 * middleware's Edge runtime and regular Node route/action execution.
 */
async function sha256Hex(input: string): Promise<string> {
  const data = new TextEncoder().encode(input);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(hashBuffer))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/** The cookie value a logged-in session should hold — derived, never the raw password. */
export async function getExpectedSessionToken(): Promise<string> {
  return sha256Hex(`${env.appPassword}:${env.authSecret}`);
}

export async function isValidSessionToken(value: string | null | undefined): Promise<boolean> {
  if (!value) return false;
  return value === (await getExpectedSessionToken());
}
