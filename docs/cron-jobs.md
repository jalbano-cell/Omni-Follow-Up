# Cron Jobs

One cron endpoint, one job, run twice a day to handle DST correctly.

## `POST /api/follow-ups/generate`

Configured in `vercel.json` to fire at **both 12:00 and 13:00 UTC**. The target is 8am **America/Toronto** (`APP_TIMEZONE`, `config/constants.ts`), which shifts between EDT (UTC-4) and EST (UTC-5) across the year — rather than needing a manual schedule edit twice a year, the route itself checks the actual current hour in `America/Toronto` and no-ops unless it's 8am there. Exactly one of the two invocations does anything on any given day, year-round.

Cron only runs once the project is deployed to Vercel — it does nothing in local dev (there's no local cron scheduler; trigger it manually via the "Check for due follow-ups" button in the UI, or call the route directly with `CRON_SECRET` if set).

## What it does

Two jobs run per invocation, looping over every active business:

1. **`services/followupEngine.ts`'s `runDailyFollowUpJob`** — drafts a follow-up for every open estimate whose `nextFollowUpDate` has arrived, using the business's own (possibly-customized, Phase 1) email template. Never sends anything.
2. **`services/replyMatcher.ts`'s `runDailyReplySyncJob`** — syncs new customer replies into the Reply Inbox for every business with Gmail connected.

One tenant's error (database failure, expired token, etc.) is caught and logged without aborting the run for every other business. Each run produces a `DailyRunLog`/`ReplySyncLog` per business, printed to the console (Vercel's function logs are the durable record) and best-effort written to `/logs/daily-run/<date>-<businessId>.json` (skipped silently in production, where Vercel's filesystem is read-only outside `/tmp`).

## Auth

Set `CRON_SECRET` as a Vercel project environment variable to require `Authorization: Bearer <CRON_SECRET>` on this endpoint — Vercel sends this automatically on its own scheduled invocations once the variable is set. Optional but recommended; without it, anyone who finds the URL can trigger a run (harmless beyond noise/rate — the job is idempotent, drafting never duplicates an estimate that already has an unresolved follow-up queued).
