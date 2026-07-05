# OmniFollowUp

Multi-tenant estimate follow-up automation SaaS for local service businesses. Each business signs up, connects its own Gmail account, tracks its own sent estimates, gets nudged on which ones need a follow-up, reviews AI-free drafted follow-up messages, and sees at-risk revenue at a glance.

This is **not** a CRM or a website builder — see [CLAUDE.md](./CLAUDE.md) for scope and architecture rules, and [ui-ux-pro-max.md](./ui-ux-pro-max.md) for the design system this project follows.

**Status:** the full phased migration is complete — multi-tenant foundation, onboarding/self-serve Gmail connection, Calendar reminders, the reply inbox, and the analytics dashboard are all live (see `/Users/john/.claude/plans/eager-riding-volcano.md`). A new business signs up, connects its own Google account (Gmail send/read + Calendar scopes, granted together in one consent), sets its follow-up cadence, and lands on its dashboard — all in one guided flow. Every drafted follow-up gets a short Calendar reminder nudging the owner to review it, cleared automatically once sent or skipped. Customer replies on a follow-up thread show up in the Reply Inbox and on the estimate's own page. Analytics shows a revenue trend, pipeline funnel, and reply engagement rate. No feature ever auto-sends: nothing goes out until a human clicks Approve *and then* Send Email in the queue.

## Stack

Next.js 15 (App Router) · TypeScript · Tailwind CSS v4 · shadcn/ui · Recharts (revenue trend) · Airtable (data store) · Gmail API (outbound email + reply reading) · Google Calendar API (reminders) · Google OAuth (self-serve per-tenant connection) · Vercel-ready

## Getting started

```bash
npm install
cp .env.example .env.local   # fill in your Airtable/auth/Google credentials
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) — you'll land on `/login` (or `/signup` to create the first account, which walks straight into the onboarding wizard). Without Airtable configured, every data page shows a friendly "not connected" state instead of crashing.

### Accounts

Each business has its own account: email + password, stored in the `Businesses` Airtable table (`passwordHash` via Node's `scrypt`, never the plaintext). Sign up at `/signup`, sign in at `/login` (password field has a show/hide toggle). Sessions are a signed JWT (`lib/auth.ts`, via `jose`) in an httpOnly cookie, verified both by `middleware.ts` (Edge runtime — redirects to `/login` if missing/invalid) and independently by `lib/session.ts` on every page/action that needs to know *which* business is asking. Set:

```
AUTH_SECRET=<openssl rand -hex 32>
```

`AUTH_SECRET` isn't a password — it's the key `lib/auth.ts` uses to sign/verify session tokens (and short-lived OAuth `state` tokens). Rotating it logs out every business at once. The sidebar's "Log out" clears the session cookie.

### Onboarding

A new signup is redirected straight into a short wizard before it can reach the dashboard (`requireOnboardedBusiness()` in `lib/session.ts` enforces this on every protected page):

1. **Business info** — collected at signup itself.
2. **Connect Gmail** (`/onboarding/gmail`) — one Google OAuth consent covering Gmail send/read and Calendar scopes together.
3. **Follow-up schedule** (`/onboarding/cadence`) — per-business cadence override (falls back to `DEFAULT_FOLLOW_UP_CADENCE_DAYS` if skipped/left default).
4. **Review** (`/onboarding/review`) — summary, then "Enter dashboard" marks `onboardingCompletedAt` and redirects to `/`.

Everything set during onboarding can be changed later in Settings.

### Airtable setup

Create a base with five tables:

**Businesses** (the tenant root — one record per signed-up business)
`businessName`, `ownerName`, `ownerEmail`, `passwordHash` (long text), `followUpCadenceSentDays`/`followUpCadenceFollowUp1Days`/`followUpCadenceFollowUp2Days` (number, optional per-business cadence override), `onboardingStep` (number), `onboardingCompletedAt` (date w/ time), `googleRefreshTokenEnc` (long text — AES-256-GCM encrypted, never plaintext), `googleConnectedEmail` (text), `googleScopes` (long text), `googleConnectedAt` (date w/ time), `calendarId` (text, optional — defaults to `"primary"` when blank), `createdAt` (date w/ time), `intakeApiKey` (text — bearer token for `POST /api/intake`, generated automatically on signup), `intakeApiKeyCreatedAt` (date w/ time)

**Estimates**
`businessId` (text — Airtable record ID of the owning business), `customerName`, `customerEmail`, `businessName`, `serviceType`, `estimateValue` (number), `dateSent` (date), `status` (single select: Sent, Follow-up 1, Follow-up 2, Booked, Lost), `nextFollowUpDate` (date), `lastContactDate` (date), `notes` (long text), `gmailThreadId` (text), `gmailLastMessageId` (text)

**FollowUps**
`businessId` (text), `estimateId` (text — Airtable record ID of the linked estimate), `message` (long text), `status` (single select: Pending, Approved, Sent, Rejected, Failed), `scheduledDate` (date), `sentAt` (date with time), `calendarEventId` (text — the reminder event's Google Calendar ID, cleared once sent/skipped)

**Replies**
`businessId` (text), `estimateId` (text), `gmailMessageId` (text), `gmailThreadId` (text), `fromEmail` (text), `subject` (text), `snippet` (long text), `bodyText` (long text), `receivedAt` (date w/ time), `isRead` (checkbox)

**Inquiries** (raw website contact-form submissions, captured via `POST /api/intake`)
`businessId` (text), `inquiryId` (text — human-readable unique ID, e.g. `INQ-M3F2K1-A9C`), `name`, `email`, `phone`, `company`, `service`, `message` (long text), `status` (single select: New Inquiry, Converted, Archived), `source` (text, always `"Website"` today), `submittedAt` (date w/ time), `ipAddress` (text), `userAgent` (long text), `convertedEstimateId` (text — set once "Convert to Estimate" creates an Estimate from this inquiry)

`businessId` on Estimates/FollowUps/Replies is a plain text field, not a linked-record field — matching the existing precedent that `estimateId` on FollowUps is already a plain string. Every tenant-scoped read/write in `services/airtable.ts` takes `businessId` as an explicit parameter and filters by it; direct-id lookups additionally verify the fetched record's `businessId` matches before returning it.

Generate a Personal Access Token at [airtable.com/create/tokens](https://airtable.com/create/tokens) with `data.records:read`, `data.records:write`, and `schema.bases:write` scopes on that base, then set:

```
AIRTABLE_API_KEY=pat...
AIRTABLE_BASE_ID=app...
```

This one Airtable base is shared deployment-level infrastructure across every tenant — not per-business configuration.

### Google connection (Gmail + Calendar)

One Google Cloud OAuth client serves every tenant's self-serve consent flow — each business gets its own refresh token, encrypted at rest, not a shared account:

1. In [Google Cloud Console](https://console.cloud.google.com/apis/credentials), create (or reuse) an OAuth 2.0 Client ID of type **Web application**.
2. Add Authorized redirect URIs: `http://localhost:3000/api/oauth/google/callback` for local dev and `https://<your-domain>/api/oauth/google/callback` for production.
3. On the OAuth consent screen, add scopes `gmail.send`, `gmail.readonly`, and `calendar.events`. `gmail.readonly` is a "sensitive" scope — until Google reviews the app, only accounts added as test users can complete the flow.
4. Set:
   ```
   GOOGLE_CLIENT_ID=...
   GOOGLE_CLIENT_SECRET=...
   TOKEN_ENCRYPTION_KEY=<openssl rand -hex 32>
   ```

A business clicks "Connect Google Account" (in onboarding or Settings) → `/api/oauth/google/start` builds a signed state token and redirects to Google's consent screen → `/api/oauth/google/callback` exchanges the code, reads the connected email via the Gmail profile endpoint, encrypts the refresh token (`lib/crypto.ts`, AES-256-GCM) and saves it on the `Businesses` record. `services/gmail.ts`, `services/googleOAuth.ts`, and `services/calendar.ts` are pure transport — no Airtable/orchestration knowledge; `services/followupSender.ts` decrypts the token, refreshes an access token per send (no caching, simplest correct thing for this volume), and clears the connection (prompting reconnect) if Google reports `invalid_grant` (the business revoked access).

### Calendar reminders (output-only)

`services/calendarReminders.ts` creates a 15-minute Calendar event (9am `APP_TIMEZONE` on the follow-up's `scheduledDate`, on the business's `calendarId` — "primary" unless overridden) the moment a follow-up is drafted, nudging the owner to go review it in the Follow-up Queue. It's deleted once the follow-up sends or is skipped. This is purely an internal reminder — it never reads the connected calendar's existing events/availability and never creates anything customer-facing. Every call is wrapped so a Calendar API failure is logged and swallowed, never blocking the drafting/sending/skipping action it's attached to.

### Reply inbox

`services/gmailInbox.ts` (pure transport, read-only — deliberately a separate file from `services/gmail.ts`, which only sends) fetches a Gmail thread's full messages via `threads.get`. `services/replyMatcher.ts` (orchestration) matches messages to an estimate purely by `gmailThreadId` + the estimate's `customerEmail` — a message on the thread from any other address isn't treated as a reply. New messages become `Replies` records; nothing about the Estimate or FollowUp changes automatically. Surfaced in two places: the standalone `/replies` inbox (all replies across every estimate, unread first) and inline on each estimate's own detail page.

Sync runs once a day (piggybacked onto the same cron invocation as follow-up drafting — see below) plus on demand via the "Check for new replies" button on `/replies`. There's no real-time push; a 15-minute-or-faster sync would need its own Vercel Cron schedule, which risks exceeding Hobby-plan cron limits, so this stays request-driven for anything more immediate than once a day.

**Known limitation:** a customer reply from a different email address, or one deep in an old part of a long thread, won't be matched — this is a deliberate v1 simplicity tradeoff (loosening the match would risk pulling in messages that aren't actually replies to that estimate), not a bug.

### Website intake (`POST /api/intake`)

Turns OmniFollowUp into the intake point for every inbound website lead, not just estimates you've already sent. A business's own website contact form (or any external form builder) posts directly to this endpoint — no session cookie, since the caller isn't logged in — authenticated by the business's own `intakeApiKey` (Settings → **Website intake API**, generated automatically on signup, copy/reveal/regenerate from there):

```
POST https://<your-domain>/api/intake
Authorization: Bearer <intakeApiKey>
Content-Type: application/json

{ "name": "...", "email": "...", "phone": "...", "company": "...", "service": "...", "message": "..." }
```

`name`, `email`, and `message` are required; `phone`, `company`, and `service` are optional. `services/intakeService.ts` (all business logic, kept out of the route handler) validates and sanitizes every field (HTML/control-character stripping, length caps, email format), applies a honeypot spam check (an optional hidden `website` field — a non-empty value is silently treated as spam, responding as if it succeeded so a bot doesn't learn it was caught) and a best-effort in-memory rate limit (8 requests / 10 minutes per business+IP — resets on cold start, not a hard security boundary), then:

1. Creates an `Inquiries` record (`status: "New Inquiry"`, a unique `inquiryId`, `source: "Website"`, `submittedAt`, and the requester's IP/User-Agent when available).
2. Sends a "New Website Inquiry" notification email to the business's own inbox via its already-connected Gmail account (`services/gmail.ts`) — skipped (logged, not thrown) if Google isn't connected yet. Nothing is ever emailed to the customer from this endpoint.
3. Logs every attempt — success or failure — via `logIntakeAudit` (console + best-effort `/logs/intake/*.jsonl`), independent of whether the Airtable write itself succeeded, so a submission is never silently lost even if it didn't reach the dashboard.

New inquiries show up immediately (live Airtable read, no cache) on the dashboard's **New Website Inquiries** card/banner and on the dedicated `/inquiries` page, where each one can be **Viewed** (full detail), **Converted to Estimate** (prefills the New Estimate form with the inquiry's name/email/service/message, then marks the inquiry `Converted` with `convertedEstimateId` set once the estimate is saved), or **Archived**. Converting is always an explicit human action — nothing here ever auto-creates an Estimate.

### Analytics (`/analytics`)

`services/analytics.ts` computes everything live from `Estimates`/`FollowUps`/`Replies` on every page load — no snapshot table, no pre-aggregation:

- **Revenue trend** — booked revenue by month (last 6 months), using `lastContactDate` as a proxy for "when it was booked" (there's no dedicated `bookedAt` field; marking an estimate Booked always updates `lastContactDate`). Rendered with `recharts`, the only charting dependency in the project.
- **Pipeline funnel** — estimate count/value per stage (Sent → Follow-up 1 → Follow-up 2 → Booked/Lost), plain CSS proportional bars (no chart library needed for this one).
- **Reply engagement** — reply rate (percentage of estimates with at least one sent email that got a reply) and average days to first reply, inheriting the reply inbox's thread-based matching limitations.

## Scripts

- `npm run dev` — start the dev server
- `npm run build` — production build
- `npm run lint` — ESLint

## How the follow-up engine works

`services/followupEngine.ts` finds, per business, open estimates (`Sent`, `Follow-up 1`, `Follow-up 2`) whose `nextFollowUpDate` has arrived, drafts a message based on the follow-up stage, and writes a `Pending` ("Draft" in the UI) record to FollowUps — it never sends anything, never duplicates a draft for an estimate that already has an unresolved one queued (Pending/Approved/Failed), and never touches the Estimate record itself. If the business has Google connected, it also creates a Calendar reminder for the new draft (see "Calendar reminders" below) — best-effort, never blocking the draft itself.

**At-Risk Revenue** on the dashboard is the sum (and count) of a business's open estimates that are currently overdue for a follow-up — i.e. exactly the set the engine would draft for right now. It's a live "what needs attention" number, not total open pipeline.

### Approval → send flow

The queue (`/follow-ups`) is the only path to sending an email — the daily cron never sends, only drafts. Per item, the flow is:

1. **Draft** (`Pending`) — Approve, Edit, or Skip.
2. **Approved** — Edit is still available; **Send Email** is the only new action. Skip is still available to bail out.
3. `services/followupSender.ts` (`sendApprovedFollowUp`) decrypts the business's Google refresh token, sends via `services/gmail.ts`, then syncs Airtable: FollowUps gets `status: "Sent"` + `sentAt`; the Estimate advances (`Sent` → `Follow-up 1` → `Follow-up 2`, cadence read from the business's own `followUpCadence*Days` fields, falling back to `DEFAULT_FOLLOW_UP_CADENCE_DAYS`) and records the Gmail `threadId`/RFC 822 `Message-Id` so the *next* follow-up replies in the same thread. Follow-up 2 is the last automated stage — after it sends, `nextFollowUpDate` is cleared.
4. If the Gmail send throws, it's retried once. If Google reports `invalid_grant` (access revoked), the connection is cleared immediately and the business is told to reconnect — no point retrying a dead token. Otherwise, if the retry also fails, the FollowUps record is marked **Failed** (the drafted `message` is never touched or lost) and the queue shows **Retry Send**. Every attempt is logged via `logAction`.
5. It can only run against a follow-up that's `Approved` or `Failed`, and only if the business has a connected Google account — so there's no code path that sends without a human approving first, or without the business having explicitly connected Gmail.

### Daily automation (Vercel Cron)

Vercel Cron schedules are always UTC, but the target is 8am **America/Toronto**, which shifts between EDT (UTC-4) and EST (UTC-5) across the year. Rather than needing a manual schedule edit twice a year, `vercel.json` fires the endpoint at both **12:00 and 13:00 UTC**, and the route itself (`app/api/follow-ups/generate/route.ts`) checks the actual current hour in `America/Toronto` and no-ops unless it's 8am there — so exactly one of the two invocations does anything on any given day, year-round. Cron only runs once a project is deployed to Vercel; it does nothing in local dev.

Each run loops over every business — one tenant's Airtable error is caught and logged without aborting the run for everyone else — and produces one `DailyRunLog` per business (estimates checked, follow-ups created, errors) that's always printed to the console (the durable record in Vercel's function logs) and, best-effort, written to `/logs/daily-run/<date>-<businessId>.json` for local inspection. That directory write is skipped silently in production, where Vercel's filesystem is read-only outside `/tmp`. The same invocation also runs `services/replyMatcher.ts`'s `runDailyReplySyncJob` for every business, so the response includes both `followUps` and `replySync` logs.

To restrict who can trigger the cron endpoint, set `CRON_SECRET` as a project environment variable — Vercel automatically sends it as a bearer token on its own cron requests.

Manual approve/edit/skip/send actions and estimate status changes are also logged to the console via `lib/logger.ts`'s `logAction`, giving a lightweight audit trail without adding new Airtable tables.

## Known limitations at this stage

- **Airtable's 5 req/sec-per-base rate limit is shared across every tenant** (one base for the whole SaaS), and its ~50,000-record cap is likewise shared. Fine for early usage; worth planning an eventual move to a per-tenant-isolated store (e.g. Postgres) if signup volume grows.
- **No email verification on signup.**
- **`gmail.readonly` requires Google's sensitive-scope app verification** before the consent screen works for real external users beyond manually-added test accounts — start that review process well before a public launch.
- **`TOKEN_ENCRYPTION_KEY` is a single global secret** — losing or rotating it without a re-encryption migration means every business must reconnect Google.
- **The intake rate limiter (`services/intakeService.ts`) is in-memory, per serverless instance** — a best-effort spam deterrent, not a hard limit; it resets on cold start and doesn't share state across concurrent instances. Move to a shared store (e.g. Upstash/Redis) if abuse becomes a real problem.
- **The intake notification email requires the business to have already connected Google** — if it hasn't, the inquiry still saves and appears on the dashboard, but no "New Website Inquiry" email goes out (silently skipped, logged).
