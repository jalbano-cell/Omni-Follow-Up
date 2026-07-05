-- Phase 4 of the V1.0 roadmap: estimate attachments, shown in the customer portal.
--
-- Storage bucket is private — every read/write goes through the server-role
-- client (lib/supabase.ts), same access model as every other table in this
-- app, so no Storage RLS policies are needed. Customer-facing downloads use
-- a short-lived signed URL minted server-side (see services/estimateAttachmentService.ts).
insert into storage.buckets (id, name, public)
values ('estimate-attachments', 'estimate-attachments', false)
on conflict (id) do nothing;

create table if not exists estimate_attachments (
  id uuid primary key default gen_random_uuid(),
  estimate_id uuid not null references estimates (id) on delete cascade,
  workspace_id uuid not null references workspaces (id) on delete cascade,
  file_name text not null,
  storage_path text not null,
  content_type text,
  size_bytes bigint,
  uploaded_at timestamptz not null default now()
);
create index if not exists estimate_attachments_estimate_id_idx on estimate_attachments (estimate_id);
create index if not exists estimate_attachments_workspace_id_idx on estimate_attachments (workspace_id);
