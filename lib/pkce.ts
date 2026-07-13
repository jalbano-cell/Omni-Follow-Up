import { randomBytes, createHash } from "crypto";

/**
 * PKCE (RFC 7636) pair generation for the Microsoft OAuth flow
 * (services/microsoftOAuth.ts) — Google's flow doesn't use this, it's a
 * confidential-client-secret exchange only. A fresh pair is generated per
 * connect attempt; the verifier travels through the redirect round-trip
 * inside the signed OAuth state token (lib/auth.ts's OAuthStatePayload),
 * since this app has no server-side OAuth session store to hold it in.
 */
export interface PkcePair {
  /** Sent to the token endpoint on exchange — 32 random bytes, base64url-encoded (43 chars, within RFC 7636's 43-128 range). */
  codeVerifier: string;
  /** Sent to the authorize endpoint — base64url(SHA-256(codeVerifier)), per the "S256" method. */
  codeChallenge: string;
}

export function generatePkcePair(): PkcePair {
  const codeVerifier = randomBytes(32).toString("base64url");
  const codeChallenge = createHash("sha256").update(codeVerifier).digest("base64url");
  return { codeVerifier, codeChallenge };
}
