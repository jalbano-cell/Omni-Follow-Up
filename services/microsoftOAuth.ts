import { env } from "@/lib/env";
import { microsoftAuthUrl, microsoftTokenUrl, MICROSOFT_GRAPH_API, MICROSOFT_OAUTH_SCOPES } from "@/config/microsoft";

/**
 * Dependency-free Microsoft identity platform (v2.0/Entra) OAuth client —
 * raw fetch, same precedent as services/googleOAuth.ts. Structured to
 * mirror that file 1:1 (same function shapes/names, same
 * "invalid_grant"-on-revoked-refresh-token contract) so
 * services/providers/microsoftMailboxProvider.ts is as thin an adapter as
 * services/providers/googleMailboxProvider.ts is. The one structural
 * difference: PKCE (buildAuthUrl takes a codeChallenge, exchangeCodeForTokens
 * takes a codeVerifier) — Google's confidential-client flow doesn't use it,
 * Microsoft's does here per the product requirement.
 */

function requireMicrosoftClientId(): string {
  if (!env.microsoftClientId) {
    throw new Error("MICROSOFT_CLIENT_ID isn't configured — Microsoft mailbox connections aren't available.");
  }
  return env.microsoftClientId;
}

function requireMicrosoftClientSecret(): string {
  if (!env.microsoftClientSecret) {
    throw new Error("MICROSOFT_CLIENT_SECRET isn't configured — Microsoft mailbox connections aren't available.");
  }
  return env.microsoftClientSecret;
}

export function buildAuthUrl(state: string, redirectUri: string, codeChallenge: string): string {
  const params = new URLSearchParams({
    client_id: requireMicrosoftClientId(),
    redirect_uri: redirectUri,
    response_type: "code",
    scope: MICROSOFT_OAUTH_SCOPES.join(" "),
    prompt: "consent",
    code_challenge: codeChallenge,
    code_challenge_method: "S256",
    state,
  });
  return `${microsoftAuthUrl(env.microsoftTenant)}?${params.toString()}`;
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
  /** Only present when offline_access was granted — always requested here, but Microsoft can still omit it in edge cases, same as Google. */
  refreshToken: string | null;
  scope: string;
}

export async function exchangeCodeForTokens(code: string, redirectUri: string, codeVerifier: string): Promise<ExchangedTokens> {
  const res = await fetch(microsoftTokenUrl(env.microsoftTenant), {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: requireMicrosoftClientId(),
      client_secret: requireMicrosoftClientSecret(),
      code,
      redirect_uri: redirectUri,
      grant_type: "authorization_code",
      code_verifier: codeVerifier,
    }),
  });
  if (!res.ok) {
    throw new Error(`Microsoft OAuth code exchange failed (${res.status}): ${await res.text()}`);
  }
  const data = (await res.json()) as TokenResponse;
  return { accessToken: data.access_token, refreshToken: data.refresh_token ?? null, scope: data.scope };
}

export async function refreshAccessToken(refreshToken: string): Promise<string> {
  const res = await fetch(microsoftTokenUrl(env.microsoftTenant), {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: requireMicrosoftClientId(),
      client_secret: requireMicrosoftClientSecret(),
      refresh_token: refreshToken,
      grant_type: "refresh_token",
    }),
  });
  if (!res.ok) {
    const body = await res.text();
    if (res.status === 400 && /invalid_grant/.test(body)) {
      throw new Error("invalid_grant");
    }
    throw new Error(`Microsoft access token refresh failed (${res.status}): ${body}`);
  }
  const data = (await res.json()) as TokenResponse;
  return data.access_token;
}

/** The connected Microsoft account's email — read via the Graph /me endpoint. Falls back to userPrincipalName since `mail` can be unset for some personal-account configurations. */
export async function getMicrosoftAccountEmail(accessToken: string): Promise<string> {
  const res = await fetch(`${MICROSOFT_GRAPH_API}/me?$select=mail,userPrincipalName`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) {
    throw new Error(`Failed to read Microsoft Graph profile (${res.status}): ${await res.text()}`);
  }
  const data = (await res.json()) as { mail?: string | null; userPrincipalName?: string };
  const email = data.mail || data.userPrincipalName;
  if (!email) {
    throw new Error("Microsoft Graph profile returned no usable email address.");
  }
  return email;
}
