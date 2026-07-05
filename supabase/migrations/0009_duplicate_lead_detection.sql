-- Duplicate lead detection: a nullable self-reference flagging a likely re-submission.
-- Never blocks/silently prevents creation — the new Lead always saves; this column just
-- surfaces a review banner (services/duplicateLeadDetection.ts) pointing at the earlier match.
alter table leads add column if not exists possible_duplicate_of_lead_id uuid references leads(id);
create index if not exists idx_leads_possible_duplicate on leads (workspace_id) where possible_duplicate_of_lead_id is not null;
