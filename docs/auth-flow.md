# Authentication & Authorization

Four independent auth mechanisms coexist in this app — none of them share infrastructure beyond `lib/auth.ts`'s `jose`-based JWT signing.

## 1. Business session (the app itself)

- **Login**: email + password, hashed with Node's built-in `scrypt` (`lib/password.ts`) against `workspaces.password_hash`. No third-party auth provider, no magic links.
- **Session token**: `lib/auth.ts`'s `createSessionToken`/`verifySessionToken` — an HS256 JWT (`{ businessId, email }`, 30-day expiry) stored in the `fq_session` cookie (`SESSION_COOKIE_NAME`).
- **Resolution**: `lib/session.ts`'s `getCurrentSession()`/`getCurrentBusinessId()`/`requireOnboardedBusiness()` independently re-verify the JWT from the cookie in every Server Component/Action — they do not trust anything middleware forwarded.
- **Middleware** (`middleware.ts`) is a coarse gate: verifies the session JWT exists and is valid, redirects to `/login` if not. It does not know about onboarding completeness (that's `requireOnboardedBusiness()`, which needs a DB read middleware can't cheaply do on the Edge runtime) and is not the source of `businessId` for any service call.

## 2. Google OAuth (Gmail + Calendar connection)

- One shared OAuth client (`GOOGLE_CLIENT_ID`/`GOOGLE_CLIENT_SECRET`) serves every tenant — `services/googleOAuth.ts` is the only file that talks to Google's token endpoint.
- The OAuth `state` param is a signed, stateless JWT (`lib/auth.ts`'s `createOAuthStateToken`/`verifyOAuthStateToken`, `{ businessId, returnTo }`, 10-minute expiry) — no server-side state store, the JWT itself carries and verifies what it was issued for.
- A business connects once, covering Gmail send/read + Calendar scopes together — see `docs/google-integrations.md`.

## 3. Public API / inbound webhooks (bearer key)

- `workspaces.intake_api_key` — a plaintext-stored (not hashed) per-business secret, generated on signup, rotatable from Settings.
- Every `/api/intake` and `/api/v1/*` request authenticates via `Authorization: Bearer <key>` → `services/business.ts`'s `getBusinessByIntakeApiKey` (`lib/apiAuth.ts`'s `resolveBusinessFromBearer` for the v1 routes). One key, full access to that business's own data — no scopes/permissions concept yet.

## 4. Customer portal share token (Phase 4)

- `lib/auth.ts`'s `createEstimateShareToken`/`verifyEstimateShareToken` — an HS256 JWT (`{ estimateId, businessId }`, 90-day expiry). Same `jose` mechanics as the OAuth state token, just longer-lived since a customer might open the link weeks later.
- No session, no login — the token in the URL (`/e/[token]`) *is* the credential. Every portal Server Action (`app/e/actions.ts`) re-verifies the token itself rather than trusting anything the page passed in.
- **No revocation mechanism exists for any token type in this app** — a signed link is valid until it expires, full stop. Regenerating a business's "Copy customer link" mints a new token but doesn't invalidate the old one early.

## Encryption at rest

`lib/crypto.ts` (AES-256-GCM, Node's built-in `crypto`) encrypts Google refresh tokens before they're written to `workspaces.google_refresh_token_enc` — the database has no field-level encryption of its own. `TOKEN_ENCRYPTION_KEY` is a single global secret; losing/rotating it without a re-encryption migration means every business must reconnect Google.
