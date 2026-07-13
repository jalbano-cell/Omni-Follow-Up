function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(
      `Missing required environment variable: ${name}. Check .env.local against .env.example.`
    );
  }
  return value;
}

export const env = {
  get defaultBusinessName() {
    return process.env.DEFAULT_BUSINESS_NAME ?? "Your Business";
  },
  /** Signs/verifies session JWTs — not a password itself. Rotating it logs out every business. */
  get authSecret() {
    return requireEnv("AUTH_SECRET");
  },
  /** One Google Cloud OAuth client shared by every tenant's consent flow (not a per-tenant credential). */
  get googleClientId() {
    return requireEnv("GOOGLE_CLIENT_ID");
  },
  get googleClientSecret() {
    return requireEnv("GOOGLE_CLIENT_SECRET");
  },
  /** Encrypts OAuth refresh tokens at rest before writing them to the database. */
  get tokenEncryptionKey() {
    return requireEnv("TOKEN_ENCRYPTION_KEY");
  },
  /** The database — see lib/supabase.ts. Required; every read/write in the app goes through it. */
  get supabaseUrl() {
    return requireEnv("NEXT_PUBLIC_SUPABASE_URL");
  },
  get supabaseAnonKey() {
    return requireEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY");
  },
  /** Server-only — bypasses Row Level Security. Never send this to the client. */
  get supabaseServiceRoleKey() {
    return requireEnv("SUPABASE_SERVICE_ROLE_KEY");
  },
  /**
   * Full Cloud Pub/Sub topic name (e.g. "projects/<project>/topics/gmail-replies")
   * that services/gmailWatch.ts registers Gmail push notifications against.
   * Optional, unlike the getters above — Gmail push (real-time reply sync) is an
   * enhancement on top of the daily cron/manual sync, not a hard dependency, so
   * services/gmailWatchSync.ts silently no-ops (logged) when this isn't set
   * rather than breaking Google account connection for anyone who hasn't set up
   * Pub/Sub yet.
   */
  get gmailPubsubTopic(): string | undefined {
    return process.env.GMAIL_PUBSUB_TOPIC || undefined;
  },
  /** Shared secret appended as a query param to the Pub/Sub push subscription's endpoint URL — verified (constant-time) by app/api/webhooks/gmail-push/route.ts, since Pub/Sub push has no per-request HMAC of its own. Optional, same reasoning as gmailPubsubTopic. */
  get gmailPushSecret(): string | undefined {
    return process.env.GMAIL_PUSH_SECRET || undefined;
  },
  /**
   * The `workspaces.id` of the agency's own workspace — the one workspace
   * whose owner session can reach /admin (lib/session.ts's requireAdmin).
   * Not a customer-facing concept: there's no admin-user table or role
   * system, just this single deployment-level value, same pattern as
   * CRON_SECRET/GMAIL_PUSH_SECRET. Optional so the app still runs (with
   * /admin unreachable by anyone) before this is configured.
   */
  get adminWorkspaceId(): string | undefined {
    return process.env.ADMIN_WORKSPACE_ID || undefined;
  },
  /**
   * Anthropic API key for the inbound-email lead classifier
   * (services/leadClassification.ts, Claude Haiku). Optional, unlike
   * authSecret/googleClientId/etc: a missing key must not break the daily
   * cron or Gmail lead capture, which don't depend on classification —
   * services/anthropic.ts logs and skips instead of throwing when this is unset.
   */
  get anthropicApiKey(): string | undefined {
    return process.env.ANTHROPIC_API_KEY || undefined;
  },
  /**
   * Microsoft identity platform (Entra) OAuth client for the second mailbox
   * provider (services/microsoftOAuth.ts) — mirrors googleClientId/Secret's
   * role, but optional: unlike Google, Microsoft isn't required for the app
   * to run. app/api/oauth/microsoft/start returns a clear error if these
   * aren't set rather than the app failing to boot.
   */
  get microsoftClientId(): string | undefined {
    return process.env.MICROSOFT_CLIENT_ID || undefined;
  },
  get microsoftClientSecret(): string | undefined {
    return process.env.MICROSOFT_CLIENT_SECRET || undefined;
  },
  /** Azure AD tenant to authorize against — "common" (the default) accepts both personal Microsoft accounts and work/school accounts through the same app registration; see config/microsoft.ts. */
  get microsoftTenant(): string {
    return process.env.MICROSOFT_TENANT || "common";
  },
  /**
   * Optional explicit override for the OAuth redirect_uri — if unset, the
   * Microsoft OAuth routes derive it from the incoming request's own host
   * (new URL("/api/oauth/microsoft/callback", request.url)), same as
   * Google's flow does. Set this if your Azure AD app registration needs an
   * exact, single registered redirect URI rather than accepting whichever
   * host the request came in on.
   */
  get microsoftRedirectUri(): string | undefined {
    return process.env.MICROSOFT_REDIRECT_URI || undefined;
  },
};
