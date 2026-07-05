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
  /** Server-only — authenticates every Stripe API call (services/stripeService.ts). Test-mode (sk_test_...) and live-mode (sk_live_...) keys create separate, non-overlapping Products/Prices/Customers. */
  get stripeSecretKey() {
    return requireEnv("STRIPE_SECRET_KEY");
  },
  /** Verifies that a POST to /api/webhooks/stripe genuinely came from Stripe (HMAC signature check) — from the Stripe Dashboard's webhook endpoint settings, not the same value as the secret key. */
  get stripeWebhookSecret() {
    return requireEnv("STRIPE_WEBHOOK_SECRET");
  },
};
