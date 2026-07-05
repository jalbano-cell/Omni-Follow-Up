# API Routes

Every route under `/app/api/`. For the public, integration-facing routes (`/api/v1/*`, `/api/intake`) see `docs/api.md` for the full request/response contract — this file is the complete inventory, including the internal-only routes.

| Route | Auth | Purpose |
|---|---|---|
| `POST /api/intake` | Bearer (business's intake API key) | Website contact form → creates a Lead. Thin adapter over `lib/apiAuth.ts`'s `handleLeadIntakeRequest` → `services/intakeService.ts`. |
| `POST /api/v1/webhooks/leads` | Bearer (same intake API key) | Identical to `POST /api/v1/leads` — see `docs/api.md`. |
| `GET/POST /api/v1/leads` | Bearer | Public API: list leads (`GET`, gated behind the Pro plan's `publicApi` feature) / create a lead (`POST`, ungated — same as the webhook route above). |
| `PATCH /api/v1/leads/:id` | Bearer | Public API: update a lead's status/assignedTo/internalNotes. Gated behind `publicApi`. |
| `GET/POST /api/v1/estimates` | Bearer | Public API: list/create estimates. Gated behind `publicApi`. |
| `GET /api/oauth/google/start` | Session | Begins the Google OAuth consent redirect for the current business. |
| `GET /api/oauth/google/callback` | Signed OAuth state token (`lib/auth.ts`) | Exchanges the OAuth code, saves the encrypted refresh token. |
| `POST /api/follow-ups/generate` | Bearer (`CRON_SECRET`, optional) | The daily automation entry point — see `docs/cron-jobs.md`. |
| `POST /api/webhooks/billing` | Billing signature (`BILLING_WEBHOOK_SECRET`) | Keeps the `subscriptions` table in sync with Billing — `checkout.session.completed`, `customer.subscription.updated`/`.deleted`, `invoice.payment_failed`. See `services/billingService.ts`. |

## Middleware exemptions

`middleware.ts`'s `PUBLIC_PATHS` allowlist covers everything above except the OAuth routes (which are gated by their own session/state-token check inside the handler, not by middleware) — every route with its own non-cookie auth mechanism (bearer key, cron secret) must be in this list or it 302s to `/login` before the handler ever runs. The customer portal (`/e/[token]`) is also in this list — it authenticates via the signed share token, not a session, and needs no `/api` route at all (it's a page, not an API endpoint) but shares the same "no session cookie" requirement.

## Shared infrastructure

`lib/apiAuth.ts` is the common ground for every bearer-key-authenticated route: `resolveBusinessFromBearer`, `unauthorized()`, `API_CORS_HEADERS`, and `handleLeadIntakeRequest` (the shared lead-creation adapter used by 3 different routes so there's exactly one implementation of "parse this HTTP request into a Lead"). Every route also implements `OPTIONS` for CORS preflight.
