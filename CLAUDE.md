# CLAUDE.md — FollowUpQuote

## What this is

FollowUpQuote is a multi-tenant estimate follow-up automation SaaS for local service businesses (plumbers, HVAC, contractors, etc). Each business signs up for its own account, tracks its own sent estimates, gets flagged which ones need a follow-up, drafts the follow-up message, queues it for human approval, and (once a business connects Gmail) sends it once approved — plus shows at-risk revenue on a dashboard.

**This is NOT a CRM and NOT a website builder.** Keep scope tight: estimates in, follow-ups suggested, revenue visibility, and approved sends out. Resist adding generic CRM features (pipelines, contacts, deals, tasks) — if a feature doesn't directly serve "get this estimate followed up," it doesn't belong here.

**Sending is approval-gated and always will be.** The daily cron (`services/followupEngine.ts`) only ever drafts — it must never call `services/gmail.ts`. The only path to an actual send is `services/followupSender.ts`, invoked exclusively from the Follow-up Queue UI's Send/Retry action on a follow-up that's already `Approved` or `Failed`. If you're tempted to auto-send from anywhere else (a new cron job, a webhook, a batch script), don't — that's the one hard line in this product.

**Multi-tenant migration is in progress, in phases.** Phase 0 (accounts, sessions, `businessId`-scoped data) is done. Gmail sending is temporarily paused — `services/followupSender.ts` returns a "not connected" error instead of sending, because the old single shared Gmail account can't safely send on behalf of many tenants. Per-tenant self-serve Gmail/Calendar connection, the onboarding wizard, a reply inbox, and an expanded analytics page are the next phases — see `/Users/john/.claude/plans/eager-riding-volcano.md` for the full phased plan. Don't build those features ad hoc outside that plan's shape without reason.

## Design system

Follow `ui-ux-pro-max.md` (in repo root) exactly — it is the canonical design reference (styles, palettes, font pairings, spacing scale, animation principles, component checklist). Do not override its philosophy.

Concrete choices made for this project (derived from that file, kept consistent across all screens):

- **Styles**: Dashboard (#34) + Card-First (#30) + Sidebar Navigation (#46) + Data-Dense (#23) for list/table screens, Minimalism (#3) as the base restraint.
- **Palette**: Neutral (Slate/Zinc) backgrounds, one primary accent — Indigo/Cobalt blue (`oklch(0.47 0.19 264)` light / `oklch(0.7 0.16 264)` dark), mapped to `--primary` in `app/globals.css`. Semantic status colors: `--success` (booked/won), `--warning` (at-risk/due), `--destructive` (lost). Never introduce more accent hues than this.
- **Font pairing**: #1 Geist / Geist Mono — already wired via `next/font/google` in `app/layout.tsx`.
- **Stack**: Next.js 15 (App Router) + TypeScript + Tailwind CSS v4 + shadcn/ui.
- **Spacing / type scale**: use the scale defined in `ui-ux-pro-max.md` (4/8/12/16/24/32/48/64/80/120/160, and the typography scale table). Don't invent new sizes.

Every screen must pass the Quality Bar and Component Checklist sections of `ui-ux-pro-max.md` before being considered done.

## Architecture rules

- `/app` — routes and page composition only. No Airtable calls or business logic directly in page components — call into `/services`. Every authenticated page/action resolves the current business via `getCurrentSession()`/`getCurrentBusinessId()` (`lib/session.ts`) and passes `businessId` explicitly into service calls — never assume a global "the business."
- `/components` — presentational + client-interactive UI, grouped by domain (`dashboard/`, `estimates/`, `follow-ups/`, `layout/`, `auth/`) plus `ui/` (shadcn primitives, don't hand-edit generated files beyond what's needed).
- `/services` — all external I/O and business logic (Airtable client, business/tenant CRUD, follow-up generation engine, Gmail client, the approval→send orchestrator). Pages and API routes call services; services never import from `/app` or `/components`. Every tenant-owned table's functions in `services/airtable.ts` take `businessId` as an explicit first parameter — this is deliberate (not solved with implicit/ambient context) so tenant scoping is visible and auditable at every call site. Direct-id lookups (`getEstimate`, `getFollowUp`) additionally verify the fetched record's `businessId` matches the caller's, since `filterByFormula` scoping doesn't apply to a direct `.find(id)`. Keep `services/gmail.ts` a pure transport (send one email, know nothing about Airtable/approval state) — orchestration (retry, Airtable sync, stage advancement) belongs in `services/followupSender.ts`, not in `gmail.ts`. Apply the same transport/orchestration split to any future Calendar or Gmail-inbox integration.
- `/types` — shared TypeScript types/interfaces (`Estimate`, `FollowUp`, `Business`, `SessionPayload`, status enums).
- `/config` — constants (status lists, default follow-up cadence, Airtable table/field names). `DEFAULT_FOLLOW_UP_CADENCE_DAYS` is a fallback — a business's own `followUpCadence*Days` fields (via `services/business.ts`'s `getEffectiveCadenceDays`) take precedence when set.
- `/lib` — small framework-agnostic-ish helpers (`cn`, formatting, date math). `lib/auth.ts` signs/verifies session JWTs via `jose` (Edge-runtime compatible, used identically in `middleware.ts` and Server Actions). `lib/session.ts` is how pages/actions resolve the current business — it independently re-verifies the JWT from the cookie rather than trusting middleware-forwarded headers. `lib/password.ts` hashes/verifies account passwords via Node's built-in `scrypt` (Server Actions run in Node, no Edge constraint there — unlike sessions). No shadcn re-generation beyond `lib/utils.ts`.
- `middleware.ts` (project root) — verifies the session JWT and redirects to `/login` if missing/invalid/expired. Excludes `/login`, `/signup`, and `/api/follow-ups/generate` only. It is a coarse authenticate-or-redirect gate — it is NOT the source of `businessId` for service calls (that's `lib/session.ts`, called fresh in each page/action).

Keep TypeScript strict. No `any`. Handle Airtable/env errors at the service boundary with clear thrown errors — don't swallow them silently, and don't add defensive checks for cases that can't happen.

## Non-goals for now

- No CRM-style contact management beyond what's on an Estimate record.
- No email *receiving*/reply detection yet — threading only makes outbound follow-ups land in the right Gmail thread; the app doesn't read replies or know if a customer responded. (This is a planned future phase, not a permanent non-goal — see the phased plan referenced above.)
- No Calendar integration yet (also a planned future phase).
- No two-way scheduling/availability — even once Calendar support lands, it's output-only (creating reminder events), never booking/availability logic.
