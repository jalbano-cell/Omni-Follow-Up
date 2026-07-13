export const MICROSOFT_GRAPH_API = "https://graph.microsoft.com/v1.0";

/**
 * Microsoft identity platform (v2.0/Entra) endpoints are tenant-scoped in
 * the URL path itself (unlike Google's fixed URLs) — env.microsoftTenant
 * defaults to "common" so both personal Microsoft accounts and work/school
 * (Azure AD) accounts can consent through the same app registration.
 */
export function microsoftAuthUrl(tenant: string): string {
  return `https://login.microsoftonline.com/${tenant}/oauth2/v2.0/authorize`;
}

export function microsoftTokenUrl(tenant: string): string {
  return `https://login.microsoftonline.com/${tenant}/oauth2/v2.0/token`;
}

/**
 * offline_access is required to get a refresh token back at all — without
 * it Microsoft only issues a short-lived access token, and this app's whole
 * refresh-before-every-call pattern (mirrors services/googleOAuth.ts's
 * refreshAccessToken) depends on having one. Mail.Send/Mail.ReadWrite are
 * fully-qualified Graph resource scopes (the v2.0 endpoint also accepts the
 * short form and resolves it against graph.microsoft.com, but the qualified
 * form is unambiguous across tenant configurations).
 */
export const MICROSOFT_OAUTH_SCOPES = [
  "openid",
  "email",
  "offline_access",
  "https://graph.microsoft.com/Mail.Send",
  "https://graph.microsoft.com/Mail.ReadWrite",
] as const;
