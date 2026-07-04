# FollowUpQuote

Multi-tenant estimate follow-up automation SaaS for local service businesses. Each business signs up, tracks its own sent estimates, gets nudged on which ones need a follow-up, reviews AI-free drafted follow-up messages, and sees at-risk revenue at a glance.

This is **not** a CRM or a website builder — see [CLAUDE.md](./CLAUDE.md) for scope and architecture rules, and [ui-ux-pro-max.md](./ui-ux-pro-max.md) for the design system this project follows.

**Status:** the multi-tenant foundation (real per-business accounts, isolated data) is live. Gmail sending is temporarily paused — a business can draft/approve/edit/skip follow-ups, but actually sending them is disabled until per-business self-serve Gmail connection ships in the next phase (see `/Users/john/.claude/plans/eager-riding-volcano.md`). No feature ever auto-sends: nothing goes out until a human clicks Approve *and then* Send Email in the queue.

## Stack

Next.js 15 (App Router) · TypeScript · Tailwind CSS v4 · shadcn/ui · Airtable (data store) · Gmail API (outbound email, currently paused) · Vercel-ready

## Getting started

```bash
npm install
cp .env.example .env.local   # fill in your Airtable/auth credentials
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) — you'll land on `/login` (or `/signup` to create the first account). Without Airtable configured, every data page shows a friendly "not connected" state instead of crashing.

### Accounts

Each business has its own account: email + password, stored in the `Businesses` Airtable table (`passwordHash` via Node's `scrypt`, never the plaintext). Sign up at `/signup`, sign in at `/login` (password field has a show/hide toggle). Sessions are a signed JWT (`lib/auth.ts`, via `jose`) in an httpOnly cookie, verified both by `middleware.ts` (Edge runtime — redirects to `/login` if missing/invalid) and independently by `lib/session.ts` on every page/action that needs to know *which* business is asking. Set:

```
AUTH_SECRET=<openssl rand -hex 32>
```

`AUTH_SECRET` isn't a password — it's the key `lib/auth.ts` uses to sign/verify session tokens. Rotating it logs out every business at once. The sidebar's "Log out" clears the session cookie.

### Airtable setup

Create a base with three tables:

**Businesses** (the tenant root — one record per signed-up business)
`businessName`, `ownerName`, `ownerEmail`, `passwordHash` (long text), `followUpCadenceSentDays`/`followUpCadenceFollowUp1Days`/`followUpCadenceFollowUp2Days` (number, optional per-business cadence override), `onboardingCompletedAt` (date w/ time), `createdAt` (date w/ time)

**Estimates**
`businessId` (text — Airtable record ID of the owning business), `customerName`, `customerEmail`, `businessName`, `serviceType`, `estimateValue` (number), `dateSent` (date), `status` (single select: Sent, Follow-up 1, Follow-up 2, Booked, Lost), `nextFollowUpDate` (date), `lastContactDate` (date), `notes` (long text), `gmailThreadId` (text), `gmailLastMessageId` (text)

**FollowUps**
`businessId` (text), `estimateId` (text — Airtable record ID of the linked estimate), `message` (long text), `status` (single select: Pending, Approved, Sent, Rejected, Failed), `scheduledDate` (date), `sentAt` (date with time)

`businessId` on Estimates/FollowUps is a plain text field, not a linked-record field — matching the existing precedent that `estimateId` on FollowUps is already a plain string. Every tenant-scoped read/write in `services/airtable.ts` takes `businessId` as an explicit parameter and filters by it; direct-id lookups additionally verify the fetched record's `businessId` matches before returning it.

Generate a Personal Access Token at [airtable.com/create/tokens](https://airtable.com/create/tokens) with `data.records:read`, `data.records:write`, and `schema.bases:write` scopes on that base, then set:

```
AIRTABLE_API_KEY=pat...
AIRTABLE_BASE_ID=app...
```

This one Airtable base is shared deployment-level infrastructure across every tenant — not per-business configuration.

### Gmail setup (currently paused)

Per-business self-serve Gmail connection (via Google OAuth, from Settings) is the next phase. Until it ships, `services/followupSender.ts` returns a clear "not connected" error instead of sending — the old single-shared-Gmail-account model was removed because it can't safely send on behalf of many different tenants.

## Scripts

- `npm run dev` — start the dev server
- `npm run build` — production build
- `npm run lint` — ESLint

## How the follow-up engine works

`services/followupEngine.ts` finds, per business, open estimates (`Sent`, `Follow-up 1`, `Follow-up 2`) whose `nextFollowUpDate` has arrived, drafts a message based on the follow-up stage, and writes a `Pending` ("Draft" in the UI) record to FollowUps — it never sends anything, never duplicates a draft for an estimate that already has an unresolved one queued (Pending/Approved/Failed), and never touches the Estimate record itself.

**At-Risk Revenue** on the dashboard is the sum (and count) of a business's open estimates that are currently overdue for a follow-up — i.e. exactly the set the engine would draft for right now. It's a live "what needs attention" number, not total open pipeline.

### Approval → send flow (sending currently paused)

The queue (`/follow-ups`) is the only path that would ever send an email — the daily cron never sends, only drafts. Per item, the flow is:

1. **Draft** (`Pending`) — Approve, Edit, or Skip.
2. **Approved** — Edit is still available. Skip is still available to bail out. There's no Send action in the UI right now (see "Status" above) — once a business connects Gmail, `services/followupSender.ts` will send via `services/gmail.ts`, sync Airtable (FollowUps `status: "Sent"` + `sentAt`; Estimate advances `Sent` → `Follow-up 1` → `Follow-up 2`, cadence read from the business's own `followUpCadence*Days` fields, falling back to `DEFAULT_FOLLOW_UP_CADENCE_DAYS`), and record the Gmail `threadId`/RFC 822 `Message-Id` for reply-threading.
3. It can only run against a follow-up that's `Approved` or `Failed`; calling it on anything else (e.g. a raw `Pending` draft) is rejected, so there's no code path that sends without a human approving first.

### Daily automation (Vercel Cron)

Vercel Cron schedules are always UTC, but the target is 8am **America/Toronto**, which shifts between EDT (UTC-4) and EST (UTC-5) across the year. Rather than needing a manual schedule edit twice a year, `vercel.json` fires the endpoint at both **12:00 and 13:00 UTC**, and the route itself (`app/api/follow-ups/generate/route.ts`) checks the actual current hour in `America/Toronto` and no-ops unless it's 8am there — so exactly one of the two invocations does anything on any given day, year-round. Cron only runs once a project is deployed to Vercel; it does nothing in local dev.

Each run loops over every business — one tenant's Airtable error is caught and logged without aborting the run for everyone else — and produces one `DailyRunLog` per business (estimates checked, follow-ups created, errors) that's always printed to the console (the durable record in Vercel's function logs) and, best-effort, written to `/logs/daily-run/<date>-<businessId>.json` for local inspection. That directory write is skipped silently in production, where Vercel's filesystem is read-only outside `/tmp`.

To restrict who can trigger the cron endpoint, set `CRON_SECRET` as a project environment variable — Vercel automatically sends it as a bearer token on its own cron requests.

Manual approve/edit/skip actions and estimate status changes are also logged to the console via `lib/logger.ts`'s `logAction`, giving a lightweight audit trail without adding new Airtable tables.

## Known limitations at this stage

- **Airtable's 5 req/sec-per-base rate limit is shared across every tenant** (one base for the whole SaaS), and its ~50,000-record cap is likewise shared. Fine for early usage; worth planning an eventual move to a per-tenant-isolated store (e.g. Postgres) if signup volume grows.
- **No email verification on signup** — acceptable until the app has its own outbound email capability (which arrives with the Gmail phase).
