# Environment Variables

Reference for every environment variable this app reads. `.env.example` is the source of truth for local dev setup (copy to `.env.local`); this doc is the same information organized for quick lookup.

| Variable | Required | Purpose |
|---|---|---|
| `DEFAULT_BUSINESS_NAME` | No | Fallback `businessName` on a new estimate if the business record can't be read. |
| `CRON_SECRET` | No | Protects `POST /api/follow-ups/generate` — see `docs/cron-jobs.md`. Vercel sends it automatically once set as a project env var. |
| `AUTH_SECRET` | Yes | Signs/verifies session JWTs (`lib/auth.ts`). Not a password — rotating it logs out every business at once. Generate with `openssl rand -hex 32`. |
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` | Yes (for Gmail/Calendar features) | One shared OAuth client for every tenant's Gmail+Calendar consent flow. See `docs/google-integrations.md`. |
| `TOKEN_ENCRYPTION_KEY` | Yes (for Gmail/Calendar features) | AES-256-GCM key encrypting Google refresh tokens at rest (`lib/crypto.ts`). Generate with `openssl rand -hex 32`. Rotating without a re-encryption migration forces every business to reconnect Google. |
| `NEXT_PUBLIC_SUPABASE_URL` | Yes | Supabase project URL. |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Yes | Supabase "publishable" key — safe client-side (nothing here currently uses it client-side, but it's not secret). |
| `SUPABASE_SERVICE_ROLE_KEY` | Yes | Supabase "secret" key — server-only, bypasses RLS. Never send to the client. |
| `STRIPE_SECRET_KEY` | Yes (for Pro-plan billing) | Authenticates every Stripe API call (`services/stripeService.ts`). A restricted key (`rk_...`) scoped to Checkout/Billing Portal/Subscriptions/Prices/Products is safer than the full secret key. Test-mode (`sk_test_...`/test `rk_...`) and live-mode keys are entirely separate Stripe universes — switching modes recreates the Pro Price automatically (see `ensureProStripePrice`). |
| `STRIPE_WEBHOOK_SECRET` | Yes (for Pro-plan billing) | Verifies `POST /api/webhooks/stripe` genuinely came from Stripe (HMAC signature). From the Dashboard's webhook endpoint settings (or `stripe listen` for local dev) — a different secret from the API key. |

## No longer used

`AIRTABLE_API_KEY`/`AIRTABLE_BASE_ID` (retired when the app fully migrated to Supabase) and `GEMINI_API_KEY` (retired when AI Lead Intelligence was replaced with a deterministic rule engine — see `CLAUDE.md`'s "No AI/LLM dependency" note) — if you see either referenced in old commit messages or docs, they're historical.

## Where these are read

All access goes through `lib/env.ts`'s `env` object (a `requireEnv`/direct-`process.env` wrapper) except the `NEXT_PUBLIC_*` Supabase vars (read directly via `process.env` in a couple of places, e.g. the Settings page's "Database connection" status check) and Vercel/Next's own built-ins.

## Vercel production

Set the same variables as Project Environment Variables in the Vercel dashboard (Production environment). `vercel env ls` / `vercel env add` / `vercel env rm` manage these from the CLI — see `docs/deployment.md`.
