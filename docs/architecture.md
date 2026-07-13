# Architecture

Omni Follow Up is a multi-tenant Next.js 15 (App Router) SaaS. One tenant = one row in `workspaces` = one business. Every table below `workspaces` carries a `workspace_id` column, and every service function that touches tenant data takes `businessId` as an explicit first parameter — there's no ambient/implicit "current tenant" context anywhere in the codebase. See `CLAUDE.md` for the full set of product/architecture rules this codebase is held to; this file is the map of where things live.

## The core workflow

```
Lead → Estimate → Follow-up Queue → Reply Tracking → Booked Job
```

A **Lead** is a raw inbound inquiry (from a website form, manual entry, CSV import, or webhook — see `docs/database-schema.md`'s `leads` table). A human converts it to an **Estimate**, which enters the follow-up cadence (Sent → Follow-up 1 → Follow-up 2), gets nudged by the **Follow-up Queue** (draft → approve → send, always human-gated), and any customer reply surfaces in the **Reply Inbox**. The estimate ends in `Booked` or `Lost`.

## Directory layout and layering rules

- **`/app`** — routes and page composition only. No database calls or business logic directly in page components — call into `/services`. Every protected page/action calls `requireOnboardedBusiness()` (or `getCurrentBusinessId()`/`getCurrentSession()`) from `lib/session.ts`.
- **`/components`** — presentational + client-interactive UI, grouped by domain (`dashboard/`, `estimates/`, `follow-ups/`, `replies/`, `leads/`, `analytics/`, `layout/`, `auth/`, `onboarding/`, `settings/`, `portal/`) plus `ui/` (shadcn/Base UI primitives).
- **`/services`** — all external I/O and business logic. Pages and API routes call services; services never import from `/app` or `/components`. See `docs/service-layer.md` for the full map.
- **`/types`** — shared TypeScript interfaces, one file per domain (`estimate.ts`, `lead.ts`, `business.ts`, `emailTemplate.ts`, `estimateAttachment.ts`, `teamMember.ts`, etc.), barrel-exported via `types/index.ts`. Composed read-model types that join multiple entities for one screen live next to the service function that builds them, not in `/types`.
- **`/config`** — shared constants/vocabulary (status lists, default cadence, lead sources, email template keys, Google OAuth scopes, `APP_TIMEZONE`).
- **`/lib`** — framework-agnostic-ish helpers: `auth.ts` (JWTs), `session.ts` (current-business resolution), `crypto.ts` (token encryption), `password.ts` (scrypt), `supabase.ts` (DB client + generic CRUD), `csv.ts` (CSV parsing), `apiAuth.ts` (public API auth helpers), `date.ts`, `logger.ts`, `utils.ts`.
- **`middleware.ts`** — coarse authenticate-or-redirect gate (session cookie check). Not the source of `businessId` for service calls, not onboarding-aware. See `docs/auth-flow.md`.

## Multi-tenancy model

RLS is off in Supabase — every access is server-side via the service-role key, with tenant isolation enforced entirely in application code. Direct-id lookups (`getEstimate`, `getLead`, `getFollowUp`, etc.) fetch by id and then verify the row's `workspace_id` matches the caller's `businessId`, since there's no `filterByFormula`-equivalent scoping on a by-id fetch.

## What this is not

Not a general CRM, not project management software, not accounting/invoicing software. See `CLAUDE.md`'s "Non-goals" section for the exact, deliberately-maintained boundary — new features should reinforce "recover more revenue via consistent follow-up," not expand into unrelated business-management territory.

## Where to look next

- `docs/database-schema.md` — every table
- `docs/service-layer.md` — every service file's job
- `docs/api-routes.md` / `docs/api.md` — internal and public HTTP surface
- `docs/auth-flow.md` — every auth mechanism in the app
- `docs/google-integrations.md` — Gmail/Calendar/OAuth
- `docs/cron-jobs.md` — the daily automation
- `docs/environment-variables.md` — full env var reference
- `docs/deployment.md` — how a change actually ships
- `docs/developer-onboarding.md` — start here if you're new
