# Developer Onboarding

Start here if you're new to this codebase. Read `CLAUDE.md` next — it's the canonical set of product/architecture rules and non-goals this app is held to; this doc is just the "get it running" path.

## 1. Clone and install

```bash
npm install
cp .env.example .env.local
```

Fill in `.env.local` — see `docs/environment-variables.md` for what each variable does and where to get it. At minimum you need a Supabase project (free tier is fine) to run anything; Google OAuth and Gmail/Calendar features degrade gracefully without their env vars set (features just skip themselves, logged, never crash), so you can defer those.

## 2. Link Supabase and apply the schema

```bash
brew install supabase/tap/supabase   # if not already installed
supabase login
supabase link --project-ref <your-project-ref>
supabase db push                     # applies every file in supabase/migrations/
supabase gen types typescript --linked > types/supabase.ts
```

## 3. Run it

```bash
npm run dev
```

Sign up a business at `/signup`, walk through onboarding. `POST /api/intake` needs a real `intakeApiKey` (Settings → Website intake API, auto-generated on signup) to test the lead-intake flow — see `docs/api.md`.

## 4. Where things live

See `docs/architecture.md` for the directory map and layering rules, `docs/service-layer.md` for what each service file does, `docs/database-schema.md` for every table. The short version: pages in `/app` call services in `/services`, never touch Supabase/Gmail/Calendar directly.

## 5. How to test a change

This codebase has no automated test suite — verification is: typecheck + lint + build, then a direct `tsx` script exercising the changed service-layer function(s) against **real Supabase**, using a throwaway test business created and fully cleaned up within the same script (never leave test data behind). For anything involving a Server Action specifically (which can't be invoked directly from a plain script the way a service function can), run a real `next dev` server and hit the route/action through an actual HTTP request or the browser.

Never test against real customer data without explicit authorization — always spin up and tear down your own throwaway business.

## 6. Shipping a change

See `docs/deployment.md` for the full commit → migrate → push → deploy → verify workflow.

## 7. Things that will surprise you

- **AI Lead Intelligence has no AI in it.** The name is legacy UI copy from before this app removed its Gemini dependency — `services/automation/leadClassifier.ts` is a deterministic rule engine now. Don't reintroduce an LLM here.
- **The Google Calendar API must be separately enabled** on the Google Cloud project beyond just granting the OAuth scope — see `docs/google-integrations.md`.
- **Two exceptions to "sending is approval-gated"**: the automatic lead-acknowledgment email and (when the Settings toggle is on) automatic appointment booking. Both are narrow, deliberate, and documented in `CLAUDE.md` — don't generalize from them.
- **RLS is off.** Tenant isolation is 100% application-code discipline (`workspace_id`/`businessId` filtering on every query). Take this seriously when adding a new table or query.
- **Git pushes redirect** — this repo shows as moved to a new GitHub location; the redirect doesn't block pushes to the old remote URL.
