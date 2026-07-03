# FollowUpQuote

Estimate follow-up automation for local service businesses. Track sent estimates, get nudged on which ones need a follow-up, review AI-free drafted follow-up messages, and see at-risk revenue at a glance.

This is **not** a CRM or a website builder — see [CLAUDE.md](./CLAUDE.md) for scope and architecture rules, and [ui-ux-pro-max.md](./ui-ux-pro-max.md) for the design system this project follows. Email sending is live, but strictly manual: nothing goes out until a human clicks Approve *and then* Send Email in the queue.

## Stack

Next.js 15 (App Router) · TypeScript · Tailwind CSS v4 · shadcn/ui · Airtable (data store) · Gmail API (outbound email) · Vercel-ready

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
`customerName`, `customerEmail`, `businessName`, `serviceType`, `estimateValue` (number), `dateSent` (date), `status` (single select: Sent, Follow-up 1, Follow-up 2, Booked, Lost), `nextFollowUpDate` (date), `lastContactDate` (date), `notes` (long text), `gmailThreadId` (text), `gmailLastMessageId` (text)

**FollowUps**
`estimateId` (text — Airtable record ID of the linked estimate), `message` (long text), `status` (single select: Pending, Approved, Sent, Rejected, Failed), `scheduledDate` (date), `sentAt` (date with time)

`gmailThreadId`/`gmailLastMessageId` and the `Failed` status choice were added after the initial build via the Metadata API and `typecast: true` writes — see "Gmail setup" below for why a select field's choices can't be patched directly.

Generate a Personal Access Token at [airtable.com/create/tokens](https://airtable.com/create/tokens) with `data.records:read` and `data.records:write` scopes on that base, then set:

```
AIRTABLE_API_KEY=pat...
AIRTABLE_BASE_ID=app...
```

### Gmail setup

Sends go out as `GMAIL_USER_EMAIL` via a Google Cloud OAuth client — no service account, no domain-wide delegation, just a regular Gmail account authorized once up front:

1. In [Google Cloud Console](https://console.cloud.google.com/apis/credentials), create an OAuth 2.0 Client ID (type "Desktop app" is simplest) and enable the Gmail API for that project.
2. Get a refresh token for `GMAIL_USER_EMAIL` with the `https://www.googleapis.com/auth/gmail.send` scope. The fastest way: [Google's OAuth 2.0 Playground](https://developers.google.com/oauthplayground) — under the gear icon, use your own Client ID/Secret, authorize the Gmail API v1 `gmail.send` scope signed in as `GMAIL_USER_EMAIL`, then exchange for a refresh token.
3. Set:
   ```
   GMAIL_CLIENT_ID=...
   GMAIL_CLIENT_SECRET=...
   GMAIL_REFRESH_TOKEN=...
   GMAIL_USER_EMAIL=you@yourbusiness.com
   ```

`services/gmail.ts` exchanges that refresh token for a short-lived access token on every send (no token caching — simplest correct thing for this volume) and is the only file that talks to Gmail. There's no interactive consent flow in the app itself; step 2 above is a one-time, out-of-band setup.

## Scripts

- `npm run dev` — start the dev server
- `npm run build` — production build
- `npm run lint` — ESLint

## How the follow-up engine works

`services/followupEngine.ts` finds open estimates (`Sent`, `Follow-up 1`, `Follow-up 2`) whose `nextFollowUpDate` has arrived, drafts a message based on the follow-up stage, and writes a `Pending` ("Draft" in the UI) record to FollowUps — it never sends anything, never duplicates a draft for an estimate that already has an unresolved one queued (Pending/Approved/Failed), and never touches the Estimate record itself.

**At-Risk Revenue** on the dashboard is the sum (and count) of open estimates that are currently overdue for a follow-up — i.e. exactly the set the engine would draft for right now. It's a live "what needs attention" number, not total open pipeline.

### Approval → send flow

The queue (`/follow-ups`) is the only path to sending an email — the daily cron never sends, only drafts. Per item, the flow is:

1. **Draft** (`Pending`) — Approve, Edit, or Skip.
2. **Approved** — Edit is still available; **Send Email** is the only new action, and is the explicit "final confirm" the spec calls for. Skip is still available to bail out.
3. `services/followupSender.ts` (`sendApprovedFollowUp`) sends via `services/gmail.ts`, then syncs Airtable: FollowUps gets `status: "Sent"` + `sentAt`; the Estimate advances (`Sent` → `Follow-up 1` → `Follow-up 2`, `lastContactDate` = today, `nextFollowUpDate` recalculated from `FOLLOW_UP_CADENCE_DAYS`) and records the Gmail `threadId`/RFC 822 `Message-Id` so the *next* follow-up for that estimate replies in the same thread instead of starting a new one. Follow-up 2 is the last automated stage — after it sends, `nextFollowUpDate` is cleared and no further drafts are generated automatically.
4. If the Gmail send throws, it's retried once. If the retry also fails, the FollowUps record is marked **Failed** (the drafted `message` is never touched or lost) and the queue shows **Retry Send**. Every attempt — success or failure — is logged via `logAction`.
5. It can only run against a follow-up that's `Approved` or `Failed`; calling it on anything else (e.g. a raw `Pending` draft) is rejected, so there's no code path that sends without a human approving first.

### Daily automation (Vercel Cron)

`vercel.json` schedules `GET /api/follow-ups/generate` once a day at **08:00 UTC** — Vercel Cron schedules are always UTC, so adjust the hour in `vercel.json` to land on 8am in your local timezone (e.g. 12:00 UTC for 8am Eastern during EDT). Cron only runs once a project is deployed to Vercel; it does nothing in local dev.

Each run — whether from cron or the "Check for due follow-ups" button in the queue UI — produces a `DailyRunLog` (estimates checked, follow-ups created, errors) that's always printed to the console (the durable record in Vercel's function logs) and, best-effort, written to `/logs/daily-run/<date>.json` for local inspection. That directory write is skipped silently in production, where Vercel's filesystem is read-only outside `/tmp`.

To restrict who can trigger the cron endpoint, set `CRON_SECRET` as a project environment variable — Vercel automatically sends it as a bearer token on its own cron requests.

Manual approve/edit/skip/send actions and estimate status changes are also logged to the console via `lib/logger.ts`'s `logAction`, giving a lightweight audit trail without adding new Airtable tables.
