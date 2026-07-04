import { env } from "@/lib/env";
import { GOOGLE_AUTH_URL, GOOGLE_TOKEN_URL, GOOGLE_OAUTH_SCOPES } from "@/config/google";

/** Dependency-free Google OAuth client — raw fetch, same precedent as services/gmail.ts. */

export function buildAuthUrl(state: string, redirectUri: string): string {
  const params = new URLSearchParams({
    client_id: env.googleClientId,
    redirect_uri: redirectUri,
    response_type: "code",
    scope: GOOGLE_OAUTH_SCOPES.join(" "),
    access_type: "offline",
    prompt: "consent",
    state,
  });
  return `${GOOGLE_AUTH_URL}?${params.toString()}`;
}

interface TokenResponse {
  access_token: string;
  refresh_token?: string;
  expires_in: number;
  scope: string;
  token_type: string;
}

export interface ExchangedTokens {
  accessToken: string;
  /** Only present on the first consent — Google omits it on subsequent grants for the same client/user. */
  refreshToken: string | null;
  scope: string;
}

export async function exchangeCodeForTokens(code: string, redirectUri: string): Promise<ExchangedTokens> {
  const res = await fetch(GOOGLE_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: env.googleClientId,
      client_secret: env.googleClientSecret,
      code,
      redirect_uri: redirectUri,
      grant_type: "authorization_code",
    }),
  });
  if (!res.ok) {
    throw new Error(`Google OAuth code exchange failed (${res.status}): ${await res.text()}`);
  }
  const data = (await res.json()) as TokenResponse;
  return { accessToken: data.access_token, refreshToken: data.refresh_token ?? null, scope: data.scope };
}

export async function refreshAccessToken(refreshToken: string): Promise<string> {
  const res = await fetch(GOOGLE_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: env.googleClientId,
      client_secret: env.googleClientSecret,
      refresh_token: refreshToken,
      grant_type: "refresh_token",
    }),
  });
  if (!res.ok) {
    const body = await res.text();
    if (res.status === 400 && /invalid_grant/.test(body)) {
      throw new Error("invalid_grant");
    }
    throw new Error(`Google access token refresh failed (${res.status}): ${body}`);
  }
  const data = (await res.json()) as TokenResponse;
  return data.access_token;
}

/** The connected Google account's email — read via the Gmail profile endpoint (gmail.send/readonly already grant it). */
export async function getGoogleAccountEmail(accessToken: string): Promise<string> {
  const res = await fetch("https://gmail.googleapis.com/gmail/v1/users/me/profile", {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) {
    throw new Error(`Failed to read Gmail profile (${res.status}): ${await res.text()}`);
  }
  const data = (await res.json()) as { emailAddress: string };
  return data.emailAddress;
}
