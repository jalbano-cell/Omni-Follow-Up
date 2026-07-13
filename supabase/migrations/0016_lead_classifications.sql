-- ---------------------------------------------------------------------------
-- Inbound-email lead classification (Step 1: classify and log only)
-- ---------------------------------------------------------------------------
-- Decision log for services/leadClassification.ts, which calls Claude Haiku
-- (Anthropic API) to judge whether a newly-scanned Gmail thread is a genuine
-- new-work lead. Deliberately separate from `leads` — this never creates,
-- blocks, or alters a Lead row; it only records what the classifier decided,
-- for review at /admin/classifications while the prompt gets tuned. Also
-- deliberately separate from services/automation/leadClassifier.ts (the
-- existing deterministic, non-LLM classifier that scores an already-created
-- Lead's priority/category) — different pipeline stage, different question.
create table if not exists lead_classifications (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces (id) on delete cascade,
  gmail_thread_id text not null,
  -- The specific message classified — informational/traceability only, not
  -- part of the dedup key (a thread only ever gets one decision row; a later
  -- reply on the same thread re-classifies in place via the upsert below).
  gmail_message_id text,
  -- Denormalized copy of what was actually classified (not part of the
  -- user's original column spec) — kept so /admin/classifications can show
  -- the source email next to the model's verdict for calibration, without a
  -- live Gmail re-fetch per row on every page load.
  subject text,
  from_header text,
  -- Null while unclassified (API/parse failure) — see `status`.
  is_lead boolean,
  confidence numeric,
  reason text,
  intent text,
  model_used text,
  -- Full raw model response, kept even on success for prompt-tuning review;
  -- essential on failure, since that's the only record of what came back.
  raw_response text,
  -- 'classified' | 'unclassified' (missing key, API error, or JSON parse
  -- failure — eligible for retry on the next scan, never guessed).
  status text not null default 'unclassified',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- One decision per thread per business — classifying the same thread twice
-- (e.g. a re-scan before the lookback window rolls past it) upserts in place
-- rather than creating duplicate log rows.
create unique index if not exists lead_classifications_workspace_thread_idx
  on lead_classifications (workspace_id, gmail_thread_id);
create index if not exists lead_classifications_workspace_id_idx
  on lead_classifications (workspace_id);
