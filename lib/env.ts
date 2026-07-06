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
  /** Server-only — authenticates every Billing API call (services/billingService.ts). Test-mode (sk_test_...) and live-mode (sk_live_...) keys create separate, non-overlapping Products/Prices/Customers. */
  get billingSecretKey() {
    return requireEnv("BILLING_SECRET_KEY");
  },
  /** Verifies that a POST to /api/webhooks/billing genuinely came from Billing (HMAC signature check) — from the Billing Dashboard's webhook endpoint settings, not the same value as the secret key. */
  get billingWebhookSecret() {
    return requireEnv("BILLING_WEBHOOK_SECRET");
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
};
