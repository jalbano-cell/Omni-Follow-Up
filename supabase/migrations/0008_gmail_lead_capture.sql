-- Gmail inbox lead capture: dedup columns on leads + a per-business opt-in toggle.
-- Default OFF (nullable, mirrors auto_book_appointments / notify_on_* pattern) — a business
-- must explicitly enable inbox monitoring in Settings before any Gmail message becomes a Lead.
alter table leads add column if not exists gmail_message_id text;
alter table leads add column if not exists gmail_thread_id text;

-- Partial index: only rows that actually came from Gmail need fast lookup here.
create index if not exists idx_leads_gmail_message_id on leads (workspace_id, gmail_message_id) where gmail_message_id is not null;
create index if not exists idx_leads_gmail_thread_id on leads (workspace_id, gmail_thread_id) where gmail_thread_id is not null;

alter table workspaces add column if not exists monitor_gmail_inbox boolean;
