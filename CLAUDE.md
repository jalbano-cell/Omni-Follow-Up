# CLAUDE.md — FollowUpQuote

## What this is

FollowUpQuote is an estimate follow-up automation tool for local service businesses (plumbers, HVAC, contractors, etc). It tracks sent estimates, flags which ones need a follow-up, drafts the follow-up message, and shows at-risk revenue on a dashboard.

**This is NOT a CRM, NOT a website builder, and NOT an email sender (yet).** Keep scope tight: estimates in, follow-ups suggested, revenue visibility. Resist adding generic CRM features (pipelines, contacts, deals, tasks) — if a feature doesn't directly serve "get this estimate followed up," it doesn't belong here.

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

- `/app` — routes and page composition only. No Airtable calls or business logic directly in page components — call into `/services`.
- `/components` — presentational + client-interactive UI, grouped by domain (`dashboard/`, `estimates/`, `follow-ups/`, `layout/`) plus `ui/` (shadcn primitives, don't hand-edit generated files beyond what's needed).
- `/services` — all external I/O and business logic (Airtable client, follow-up generation engine). Pages and API routes call services; services never import from `/app` or `/components`.
- `/types` — shared TypeScript types/interfaces (`Estimate`, `FollowUp`, status enums).
- `/config` — constants (status lists, follow-up cadence rules, Airtable table/field names).
- `/lib` — small framework-agnostic helpers (`cn`, formatting, date math). No shadcn re-generation beyond `lib/utils.ts`.

Keep TypeScript strict. No `any`. Handle Airtable/env errors at the service boundary with clear thrown errors — don't swallow them silently, and don't add defensive checks for cases that can't happen.

## Non-goals for now

- No email sending (Gmail API is a later phase — the follow-up queue only gets drafts to "ready to send", nothing dispatches).
- No multi-tenant auth/teams — single business per deployment for the MVP.
- No CRM-style contact management beyond what's on an Estimate record.
