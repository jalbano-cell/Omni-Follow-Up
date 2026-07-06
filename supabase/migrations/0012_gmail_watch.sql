-- ---------------------------------------------------------------------------
-- Gmail push notifications (real-time reply sync)
-- ---------------------------------------------------------------------------
-- Gmail's users.watch API registers a Cloud Pub/Sub push subscription that
-- notifies app/api/webhooks/gmail-push/route.ts the moment new mail arrives,
-- instead of waiting for the once-a-day cron or the manual "Check for new
-- replies" button (see services/gmailWatchSync.ts). A watch registration
-- expires after ~7 days and must be renewed; these two columns are all the
-- state needed to do that (historyId isn't currently used for delta sync —
-- the push handler just re-runs the existing full syncRepliesForBusiness
-- pass for that business — but Gmail returns it from every watch call, so
-- it's stored for future use rather than discarded).
alter table workspaces add column if not exists gmail_watch_history_id text;
alter table workspaces add column if not exists gmail_watch_expiration timestamptz;
