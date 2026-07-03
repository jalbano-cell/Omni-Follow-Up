# FollowUpQuote

Estimate follow-up automation for local service businesses. Track sent estimates, get nudged on which ones need a follow-up, review AI-free drafted follow-up messages, and see at-risk revenue at a glance.

This is **not** a CRM, a website builder, or an email sender (yet) — see [CLAUDE.md](./CLAUDE.md) for scope and architecture rules, and [ui-ux-pro-max.md](./ui-ux-pro-max.md) for the design system this project follows.

## Stack

Next.js 15 (App Router) · TypeScript · Tailwind CSS v4 · shadcn/ui · Airtable (data store) · Vercel-ready

## Getting started

```bash
npm install
cp .env.example .env.local   # fill in your Airtable credentials
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). Without Airtable configured, every data page shows a friendly "not connected" state instead of crashing.

### Airtable setup

Create a base with two tables:

**Estimates**
`customerName`, `customerEmail`, `businessName`, `serviceType`, `estimateValue` (number), `dateSent` (date), `status` (single select: Sent, Follow-up 1, Follow-up 2, Booked, Lost), `nextFollowUpDate` (date), `lastContactDate` (date), `notes` (long text)

**FollowUps**
`estimateId` (text — Airtable record ID of the linked estimate), `message` (long text), `status` (single select: Pending, Sent, Approved, Rejected), `scheduledDate` (date)

Generate a Personal Access Token at [airtable.com/create/tokens](https://airtable.com/create/tokens) with `data.records:read` and `data.records:write` scopes on that base, then set:

```
AIRTABLE_API_KEY=pat...
AIRTABLE_BASE_ID=app...
```

## Scripts

- `npm run dev` — start the dev server
- `npm run build` — production build
- `npm run lint` — ESLint

## How the follow-up engine works

`services/followupEngine.ts` finds open estimates (`Sent`, `Follow-up 1`, `Follow-up 2`) whose `nextFollowUpDate` has arrived, drafts a message based on the follow-up stage, and writes a `Pending` record to FollowUps — it never sends anything, never duplicates a draft for an estimate that already has one Pending, and never touches the Estimate record itself. Approving a follow-up in the queue marks it `Approved` ("ready to send") — actual sending arrives with the Gmail API integration in a later phase.

**At-Risk Revenue** on the dashboard is the sum (and count) of open estimates that are currently overdue for a follow-up — i.e. exactly the set the engine would draft for right now. It's a live "what needs attention" number, not total open pipeline.

### Daily automation (Vercel Cron)

`vercel.json` schedules `GET /api/follow-ups/generate` once a day at **08:00 UTC** — Vercel Cron schedules are always UTC, so adjust the hour in `vercel.json` to land on 8am in your local timezone (e.g. 12:00 UTC for 8am Eastern during EDT). Cron only runs once a project is deployed to Vercel; it does nothing in local dev.

Each run — whether from cron or the "Check for due follow-ups" button in the queue UI — produces a `DailyRunLog` (estimates checked, follow-ups created, errors) that's always printed to the console (the durable record in Vercel's function logs) and, best-effort, written to `/logs/daily-run/<date>.json` for local inspection. That directory write is skipped silently in production, where Vercel's filesystem is read-only outside `/tmp`.

To restrict who can trigger the cron endpoint, set `CRON_SECRET` as a project environment variable — Vercel automatically sends it as a bearer token on its own cron requests.

Manual approve/edit/skip actions and estimate status changes are also logged to the console via `lib/logger.ts`'s `logAction`, giving a lightweight audit trail without adding new Airtable tables.
