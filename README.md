# OmniFollowUp

Multi-tenant estimate follow-up automation SaaS for local service businesses. Each business signs up, connects its own Gmail account, tracks its own sent estimates, gets nudged on which ones need a follow-up, reviews AI-free drafted follow-up messages, and sees at-risk revenue at a glance.

This is **not** a CRM or a website builder — see [CLAUDE.md](./CLAUDE.md) for scope and architecture rules, and [ui-ux-pro-max.md](./ui-ux-pro-max.md) for the design system this project follows.

**Status:** the full phased migration is complete — multi-tenant foundation, onboarding/self-serve Gmail connection, Calendar reminders, the reply inbox, and the analytics dashboard are all live (see `/Users/john/.claude/plans/eager-riding-volcano.md`). A new business signs up, connects its own Google account (Gmail send/read + Calendar scopes, granted together in one consent), sets its follow-up cadence, and lands on its dashboard — all in one guided flow. Every drafted follow-up gets a short Calendar reminder nudging the owner to review it, cleared automatically once sent or skipped. Customer replies on a follow-up thread show up in the Reply Inbox and on the estimate's own page. Analytics shows a revenue trend, pipeline funnel, and reply engagement rate. On top of that, `POST /api/intake` makes OmniFollowUp the single source of truth for every inbound website inquiry (a **Lead**) — see "Lead intake" below. Every Follow-up Queue email is approval-gated: nothing goes out until a human clicks Approve *and then* Send Email. The one exception is a short automatic acknowledgment sent to a new lead immediately on submission — see "Automatic lead acknowledgment" below.

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

Create a base with seven tables:

**Businesses** (the tenant root — one record per signed-up business)
`businessName`, `ownerName`, `ownerEmail`, `passwordHash` (long text), `followUpCadenceSentDays`/`followUpCadenceFollowUp1Days`/`followUpCadenceFollowUp2Days` (number, optional per-business cadence override), `onboardingStep` (number), `onboardingCompletedAt` (date w/ time), `googleRefreshTokenEnc` (long text — AES-256-GCM encrypted, never plaintext), `googleConnectedEmail` (text), `googleScopes` (long text), `googleConnectedAt` (date w/ time), `calendarId` (text, optional — defaults to `"primary"` when blank), `createdAt` (date w/ time), `intakeApiKey` (text — bearer token for `POST /api/intake`, generated automatically on signup), `intakeApiKeyCreatedAt` (date w/ time)

**Estimates**
`businessId` (text — Airtable record ID of the owning business), `customerName`, `customerEmail`, `businessName`, `serviceType`, `estimateValue` (number), `dateSent` (date), `status` (single select: Sent, Follow-up 1, Follow-up 2, Booked, Lost), `nextFollowUpDate` (date), `lastContactDate` (date), `notes` (long text), `gmailThreadId` (text), `gmailLastMessageId` (text)

**FollowUps**
`businessId` (text), `estimateId` (text — Airtable record ID of the linked estimate), `message` (long text), `status` (single select: Pending, Approved, Sent, Rejected, Failed), `scheduledDate` (date), `sentAt` (date with time), `calendarEventId` (text — the reminder event's Google Calendar ID, cleared once sent/skipped)

**Replies**
`businessId` (text), `estimateId` (text), `gmailMessageId` (text), `gmailThreadId` (text), `fromEmail` (text), `subject` (text), `snippet` (long text), `bodyText` (long text), `receivedAt` (date w/ time), `isRead` (checkbox)

**Leads** (every inbound business inquiry — today, always captured via `POST /api/intake`)
`businessId` (text), `leadId` (text — human-readable unique ID, e.g. `LEAD-M3F2K1-A9C`), `name`, `email`, `phone`, `company`, `requestedService`, `message` (long text), `status` (single select: New Inquiry, Converted, Archived), `leadSource` (text, always `"Website"` today), `createdTime` (date w/ time), `lastActivityAt` (date w/ time — bumped on every ActivityLog entry for this lead), `ipAddress` (text), `userAgent` (long text), `convertedEstimateId` (text — set once "Convert to Estimate" creates an Estimate from this lead), `assignedTo` (text — free text, no team/user roster exists yet), `internalNotes` (long text — a single running log, newest entry first). AI Lead Intelligence fields (populated automatically by `services/aiInsightsService.ts`, see below): `aiSummary` (long text), `aiCategory` (text), `aiPriority` (text: High/Medium/Low), `aiPriorityReason` (long text), `aiOpportunityValueRange` (text — a rough range, never a precise figure), `aiOpportunityConfidence` (long text), `suggestedNextAction` (text), `aiResponseUrgency` (text: Today/24 hours/3 days/1 week), `aiResponseUrgencyReason` (long text), `aiGeneratedAt` (date w/ time), `aiStatus` (text: pending/completed/failed/dismissed). Two now-unused fields, `_deprecated_priorityScore` and `_deprecated_suggestedFollowUpTiming`, remain on the table (Airtable's Meta API doesn't support field deletion) but are no longer read or written anywhere.

**ActivityLog** (durable per-business/per-lead event trail — a Lead's Timeline and part of the dashboard's live activity feed)
`businessId` (text), `leadId` (text), `type` (text — e.g. `lead.created`, `lead.converted`, `lead.archived`, `lead.assigned`, `lead.note_added`), `description` (text — human-readable, e.g. "New website inquiry received."), `createdAt` (date w/ time)

**Notifications** (in-app alerts for the business owner, surfaced via the header bell)
`businessId` (text), `leadId` (text), `type` (text), `message` (text), `isRead` (checkbox), `createdAt` (date w/ time)

`businessId` on Estimates/FollowUps/Replies/Leads/ActivityLog/Notifications is a plain text field, not a linked-record field — matching the existing precedent that `estimateId` on FollowUps is already a plain string. Every tenant-scoped read/write in `services/airtable.ts` takes `businessId` as an explicit parameter and filters by it; direct-id lookups additionally verify the fetched record's `businessId` matches before returning it.

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
4. **Also enable the Google Calendar API itself** on the project, at `https://console.developers.google.com/apis/api/calendar-json.googleapis.com/overview?project=<your-project-number>` — granting the `calendar.events` *scope* above does not do this automatically. Skipping this step doesn't break anything visibly: Calendar reminders and appointment booking just silently no-op (caught, logged, swallowed) until it's enabled.
5. Set:
   ```
   GOOGLE_CLIENT_ID=...
   GOOGLE_CLIENT_SECRET=...
   TOKEN_ENCRYPTION_KEY=<openssl rand -hex 32>
   ```

A business clicks "Connect Google Account" (in onboarding or Settings) → `/api/oauth/google/start` builds a signed state token and redirects to Google's consent screen → `/api/oauth/google/callback` exchanges the code, reads the connected email via the Gmail profile endpoint, encrypts the refresh token (`lib/crypto.ts`, AES-256-GCM) and saves it on the `Businesses` record. `services/gmail.ts`, `services/googleOAuth.ts`, and `services/calendar.ts` are pure transport — no Airtable/orchestration knowledge; `services/followupSender.ts` decrypts the token, refreshes an access token per send (no caching, simplest correct thing for this volume), and clears the connection (prompting reconnect) if Google reports `invalid_grant` (the business revoked access).

### AI Lead Intelligence

Powers `services/aiInsightsService.ts` (see "AI Lead Intelligence" under Lead Details below). Get a key at [aistudio.google.com/apikey](https://aistudio.google.com/apikey) and set:
```
GEMINI_API_KEY=...
```
Optional in the sense that the app runs fine without it — leads just stay `aiStatus: "pending"`/"failed" and the Lead Details page shows "Not available" instead of AI insights.

### Supabase (migration in progress)

OmniFollowUp is migrating its backend data layer from Airtable to Supabase, table-by-table, dual-write first — see CLAUDE.md's "Supabase migration" section for the full status and architecture. Set:
```
NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_ANON_KEY=...      # "publishable" key
SUPABASE_SERVICE_ROLE_KEY=...         # "secret" key — server only, never expose client-side
```
Schema lives in `supabase/migrations/*.sql`. The Supabase CLI is linked (`supabase link --project-ref pqdlqlpesmoxklvalwgr`) — apply a new migration with `supabase db push`, and regenerate `types/supabase.ts` afterward with `supabase gen types typescript --linked > types/supabase.ts`. Right now only newly-created Leads are mirrored into Supabase (best-effort, after Airtable's write succeeds) — everything else (Estimates, FollowUps, Replies, Businesses, and every Lead action past creation) is still Airtable-only.

### Calendar reminders (output-only)

`services/calendarReminders.ts` creates a 15-minute Calendar event (9am `APP_TIMEZONE` on the follow-up's `scheduledDate`, on the business's `calendarId` — "primary" unless overridden) the moment a follow-up is drafted, nudging the owner to go review it in the Follow-up Queue. It's deleted once the follow-up sends or is skipped. This is purely an internal reminder — it never reads the connected calendar's existing events/availability and never creates anything customer-facing. Every call is wrapped so a Calendar API failure is logged and swallowed, never blocking the drafting/sending/skipping action it's attached to.

### Reply inbox

`services/gmailInbox.ts` (pure transport, read-only — deliberately a separate file from `services/gmail.ts`, which only sends) fetches a Gmail thread's full messages via `threads.get`. `services/replyMatcher.ts` (orchestration) matches messages to an estimate purely by `gmailThreadId` + the estimate's `customerEmail` — a message on the thread from any other address isn't treated as a reply. New messages become `Replies` records; nothing about the Estimate or FollowUp changes automatically. Surfaced in two places: the standalone `/replies` inbox (all replies across every estimate, unread first) and inline on each estimate's own detail page.

Sync runs once a day (piggybacked onto the same cron invocation as follow-up drafting — see below) plus on demand via the "Check for new replies" button on `/replies`. There's no real-time push; a 15-minute-or-faster sync would need its own Vercel Cron schedule, which risks exceeding Hobby-plan cron limits, so this stays request-driven for anything more immediate than once a day.

**Known limitation:** a customer reply from a different email address, or one deep in an old part of a long thread, won't be matched — this is a deliberate v1 simplicity tradeoff (loosening the match would risk pulling in messages that aren't actually replies to that estimate), not a bug.

### Lead intake (`POST /api/intake`)

OmniFollowUp is the single source of truth for every inbound business inquiry (a **Lead**) — a business's own website contact form (or any external form builder) posts directly to this endpoint — no session cookie, since the caller isn't logged in — authenticated by the business's own `intakeApiKey` (Settings → **Website intake API**, generated automatically on signup, copy/reveal/regenerate from there):

```
POST https://<your-domain>/api/intake
Authorization: Bearer <intakeApiKey>
Content-Type: application/json

{ "name": "...", "email": "...", "phone": "...", "company": "...", "service": "...", "message": "..." }
```

`name`, `email`, and `message` are required; `phone`, `company`, and `service` are optional. `services/intakeService.ts` owns only the HTTP-facing side (validation/sanitization — HTML/control-character stripping, length caps, email format; a honeypot spam check via an optional hidden `website` field, silently treated as spam without tipping off the bot; a best-effort in-memory rate limit, 8 requests/10 minutes per business+IP, resets on cold start; the request-level audit log) and delegates everything else to `services/leadService.ts`'s `createLeadFromSubmission`:

1. Creates a `Leads` record (`status: "New Inquiry"`, a unique `leadId`, `leadSource: "Website"`, `createdTime`, and the requester's IP/User-Agent when available).
2. Logs a `lead.created` entry to the durable `ActivityLog` ("New website inquiry received.") via `services/activityService.ts`, and creates an in-app `Notification` — both surfaced immediately via the header bell (unread badge + dropdown) on every page.
3. Sends a "New Website Inquiry" notification email (customer details, requested service, full message, submission timestamp, and the Lead ID) to the business's own inbox via its already-connected Gmail account (`services/gmail.ts`) — skipped (logged, not thrown) if Google isn't connected yet.
4. Runs AI Lead Intelligence (see below), then sends an automatic acknowledgment email to the *customer* — see "Automatic lead acknowledgment" below. This is the one email in the product that sends with no human approval.

Every attempt — success or failure — is logged via `logIntakeAudit` (console + best-effort `/logs/intake/*.jsonl`), independent of whether the Airtable write itself succeeded, so a submission is never silently lost even if it didn't reach the dashboard.

New leads show up immediately (live Airtable read, no cache) on the dashboard's **New Leads** card/banner and on `/leads`, where each one can be **Viewed** (full Lead Details page), **Assigned** (free-text, no team roster yet), **Converted to Estimate** (prefills the New Estimate form with the lead's name/email/service/message, then marks the lead `Converted` with `convertedEstimateId` set once the estimate is saved), or **Archived**. Converting is always an explicit human action — nothing here ever auto-creates an Estimate.

#### Automatic lead acknowledgment (no approval — see CLAUDE.md)

`services/leadService.ts`'s `sendLeadAcknowledgmentEmail` sends a short "we received your message" email straight to the customer, immediately, with zero human review — the one deliberate exception to this product's "nothing sends without approval" rule. It's kept safe by being tightly constrained rather than reviewed: `services/aiInsightsService.ts`'s `generateLeadAcknowledgment` prompts Gemini with hard rules — no prices, no invented facts, no named person committed to responding. Requires the business's Gmail connected (same requirement as the owner-notification email); skipped and logged otherwise. Every send/failure is also logged as a Lead ActivityLog entry (`lead.acknowledgment_sent` / `lead.acknowledgment_failed`), visible on the Lead's Timeline.

#### Automatic appointment booking (no approval — see CLAUDE.md)

If the lead's message requests a specific date **and** time (`services/aiInsightsService.ts`'s `parseRequestedAppointment` — vague requests like "sometime next week" don't count), `services/appointmentBooking.ts`'s `resolveAppointmentBooking` checks the business's real connected Calendar and, with no human approval:

- **If the slot is free**: books a real Calendar event immediately, with the customer added as an attendee (`notifyAttendees: true` — they get a native Google Calendar invite). The acknowledgment email confirms the specific date/time, since it's now a real booking, not a guess.
- **If the slot conflicts or falls outside business hours**: searches up to 5 days out (30-minute increments, business hours only) for up to 2 open alternates and offers those in the acknowledgment instead, asking the customer to reply with their preference — nobody auto-picks one, and a chosen alternate isn't auto-booked from the reply (the Reply Inbox surfaces it; a human books it, same as the reply inbox's normal "never auto-acts" rule).
- **If nothing is requested, or anything fails** (no Gmail/Calendar connection, Calendar API error, Gemini failure): falls back to the plain vague acknowledgment. Every outcome is logged to the Lead's ActivityLog (`lead.appointment_booked` / `lead.appointment_alternates_offered`).

Requires the **Google Calendar API enabled** on the connected Google Cloud project — this is separate from granting the `calendar.events` OAuth scope during Google connection, and is easy to miss (shows as a silent, logged-and-swallowed 403 otherwise). Check at `https://console.developers.google.com/apis/api/calendar-json.googleapis.com/overview?project=<your-project-number>`.

#### Lead Details page (`/leads/[id]`)

Contact info, the original message plus any customer replies on the linked estimate's thread ("Conversation"), estimate status (or a Convert prompt if not yet converted), upcoming follow-ups for the linked estimate, internal notes (a running log — add one via the textarea, newest first), a full activity Timeline (every `ActivityLog` entry for this lead), and an **AI Insights** card.

#### AI Lead Intelligence

`services/aiInsightsService.ts`'s `analyzeLead` runs automatically the moment a lead is created (called from `leadService.ts`'s `createLeadFromSubmission`, right after the notification email), calling Gemini (`gemini-2.5-flash`, structured JSON output) with the lead's name/company/requested service/message. It writes back:

- **Summary** — 2-3 sentences.
- **Category** — prefers Website/SEO/Automation/AI Agent/Restaurant/General Inquiry but isn't a strictly closed list.
- **Priority** — High/Medium/Low, with a one-sentence reason.
- **Estimated opportunity value** — a rough range only (e.g. "$2,000-$4,000"), plus a confidence explanation.
- **Suggested next action** — e.g. Schedule discovery call / Prepare proposal / Request more information / Refer elsewhere.
- **Response urgency** — Today/24 hours/3 days/1 week, with a one-sentence reason.

This is analysis and recommendation only — it never sends an email, never contacts the customer, and never changes the lead's status. It's best-effort: any failure (no `GEMINI_API_KEY` set, network error, malformed response) leaves the lead's AI fields untouched and sets `aiStatus: "failed"`, never a guessed value. On the Lead Details page the business owner can **Edit** any field, **Dismiss** the recommendations (hides them, doesn't delete — restorable anytime), or **Regenerate** (re-run analysis from scratch, e.g. after a failure). Every one of those actions is logged as its own ActivityLog entry.

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
- **The intake notification email requires the business to have already connected Google** — if it hasn't, the lead still saves and appears on the dashboard, but no "New Website Inquiry" email goes out (silently skipped, logged).
- **`assignedTo` on a Lead is free text, not a real assignment** — there's no team/user-member roster in this product yet (each business is a single login). Treat it as a label, not an access-control or notification-routing mechanism.
- **AI Lead Intelligence (`services/aiInsightsService.ts`) requires `GEMINI_API_KEY`** — without it, every lead's analysis fails gracefully (`aiStatus: "failed"`, no fabricated values) and the Lead Details page shows "Not available." One Gemini call per lead, run synchronously during intake — no batching, retry queue, or cost controls yet beyond the intake rate limiter.
- **The Supabase migration is mid-flight (dual-write, Lead creation only)** — Airtable is still authoritative and still the only thing any page reads from. A newly created Lead gets mirrored into Supabase best-effort; anything that happens to it afterward (archive/assign/note/convert/AI edit/dismiss/regenerate) does not yet sync, so Supabase's copy goes stale after creation. There's also no DB-level unique constraint on `workspaces.airtable_record_id` yet, so two truly concurrent first-ever intake requests for a brand-new business could theoretically create two workspace rows. See CLAUDE.md's "Supabase migration" section before building on top of the Supabase tables.
- **The automatic lead acknowledgment email sends with no human review** — deliberately, but worth knowing: anyone who submits the public intake form gets an AI-generated email addressed to whatever address they typed in, from the business's real Gmail account. The intake rate limiter (8 requests/10 min per business+IP) is the only abuse mitigation, same as any public contact-form auto-responder. The prompt (`services/aiInsightsService.ts`'s `generateLeadAcknowledgment`) is constrained to never quote prices, promise specific timing, or invent facts — but it's still unreviewed model output going to a real customer.
- **Automatic appointment booking (`services/appointmentBooking.ts`) also sends with no human review** — same risk profile as above, plus it creates a real Calendar event and invites whatever email address the lead submitted. Requires the Calendar API enabled on the Google Cloud project (a separate step from the OAuth scope — see "Google connection" above); silently no-ops otherwise. The alternate-time search is a simple greedy scan (30-min increments, business hours, up to 5 days, first 2 open slots found) — not optimized for anything beyond small-business scheduling volume.
- **Gemini's free tier caps at 20 requests/day** for `gemini-2.5-flash`, and each lead now costs up to 3 calls (analysis, appointment parsing, acknowledgment generation) — roughly 6-7 leads/day before things start failing over to safe defaults (no analysis, no booking, generic acknowledgment; never a crash). A real launch needs a paid Gemini plan.
