-- Phase 7 of the V1.0 roadmap: outbound webhook + notification preferences.
alter table workspaces add column if not exists outbound_webhook_url text;
alter table workspaces add column if not exists notify_on_new_lead boolean;
alter table workspaces add column if not exists notify_on_reply boolean;
