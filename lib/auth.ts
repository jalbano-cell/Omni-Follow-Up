import { SignJWT } from "jose/jwt/sign";
import { jwtVerify } from "jose/jwt/verify";
import { env } from "@/lib/env";
import type { SessionPayload } from "@/types";

export const SESSION_COOKIE_NAME = "fq_session";

const SESSION_DURATION = "30d";

function getSecretKey(): Uint8Array {
  return new TextEncoder().encode(env.authSecret);
}

/**
 * Signs a tamper-evident session token carrying the business's identity.
 * Uses `jose` (Web Crypto under the hood) so it runs identically in the
 * Edge runtime (middleware.ts) and in Node (Server Actions) — hand-rolling
 * this would mean reimplementing HMAC signing and expiry checking.
 */
export async function createSessionToken(payload: SessionPayload): Promise<string> {
  return new SignJWT({ ...payload })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(SESSION_DURATION)
    .sign(getSecretKey());
}

/** Verifies and decodes a session token, returning null if invalid, tampered, or expired. */
export async function verifySessionToken(token: string | null | undefined): Promise<SessionPayload | null> {
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, getSecretKey());
    if (typeof payload.businessId !== "string" || typeof payload.email !== "string") return null;
    return { businessId: payload.businessId, email: payload.email };
  } catch {
    return null;
  }
}

export interface OAuthStatePayload {
  businessId: string;
  /** Where to send the business back to once the Google OAuth callback completes. */
  returnTo: string;
}

/**
 * Signed, stateless CSRF token for the Google OAuth redirect round-trip —
 * no server-side state store needed, since the JWT itself carries and
 * verifies the businessId/returnTo it was issued for. Short-lived since the
 * whole redirect-to-Google-and-back only takes a couple of minutes.
 */
export async function createOAuthStateToken(payload: OAuthStatePayload): Promise<string> {
  return new SignJWT({ ...payload })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("10m")
    .sign(getSecretKey());
}

export async function verifyOAuthStateToken(token: string | null | undefined): Promise<OAuthStatePayload | null> {
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, getSecretKey());
    if (typeof payload.businessId !== "string" || typeof payload.returnTo !== "string") return null;
    return { businessId: payload.businessId, returnTo: payload.returnTo };
  } catch {
    return null;
  }
}
