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
  return new SignJWT({ ...payload, tokenVersion: payload.tokenVersion ?? 0 })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(SESSION_DURATION)
    .sign(getSecretKey());
}

/**
 * Verifies and decodes a session token, returning null if invalid, tampered,
 * or expired. This proves the token was signed by us and isn't expired, but
 * NOT that it hasn't been revoked — the tokenVersion carried here still has to
 * be checked against the business's current version (lib/session.ts) for that,
 * which needs a DB read this Edge-runtime-safe function deliberately avoids.
 */
export async function verifySessionToken(token: string | null | undefined): Promise<SessionPayload | null> {
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, getSecretKey());
    if (typeof payload.businessId !== "string" || typeof payload.email !== "string") return null;
    return {
      businessId: payload.businessId,
      email: payload.email,
      tokenVersion: typeof payload.tokenVersion === "number" ? payload.tokenVersion : 0,
    };
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

export interface EstimateSharePayload {
  estimateId: string;
  businessId: string;
  /** The estimate's share_token_version at issue time; the portal (app/e) rejects the link if the estimate's current version has moved past it. Optional for backward compatibility with links minted before revocation existed, treated as version 0. */
  shareTokenVersion?: number;
}

const ESTIMATE_SHARE_DURATION = "90d";

/**
 * Signed, stateless link a business shares with its customer (the "view my
 * estimate" portal, see app/e/[token]/page.tsx) — same jose mechanics as the
 * OAuth state token, just a different payload and a much longer expiry since
 * a customer might reasonably open the link weeks later. No revocation
 * mechanism exists for this or any other token in this file: a link is valid
 * until it expires, full stop — regenerating the estimate's link (a new
 * token) doesn't invalidate the old one early.
 */
export async function createEstimateShareToken(payload: EstimateSharePayload): Promise<string> {
  return new SignJWT({ ...payload, shareTokenVersion: payload.shareTokenVersion ?? 0 })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(ESTIMATE_SHARE_DURATION)
    .sign(getSecretKey());
}

export async function verifyEstimateShareToken(token: string | null | undefined): Promise<EstimateSharePayload | null> {
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, getSecretKey());
    if (typeof payload.estimateId !== "string" || typeof payload.businessId !== "string") return null;
    return {
      estimateId: payload.estimateId,
      businessId: payload.businessId,
      shareTokenVersion: typeof payload.shareTokenVersion === "number" ? payload.shareTokenVersion : 0,
    };
  } catch {
    return null;
  }
}
