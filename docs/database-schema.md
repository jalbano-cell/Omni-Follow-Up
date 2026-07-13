# Database Schema

Postgres via Supabase. Schema lives in `supabase/migrations/*.sql`, applied via the linked Supabase CLI (`supabase db push`) — see `docs/deployment.md`. The TypeScript type layer (`types/supabase.ts`) is generated (`supabase gen types typescript --linked > types/supabase.ts`), never hand-edited — regenerate it after every migration. RLS is intentionally disabled everywhere; see `docs/architecture.md`'s multi-tenancy section for how isolation actually works.

## `workspaces` (one row per tenant business)

Everything per-business configuration lives here: `business_name`, `owner_name`, `owner_email`, `password_hash` (scrypt), follow-up cadence overrides (`follow_up_cadence_*_days`), onboarding progress, Google connection (`google_refresh_token_enc` — AES-256-GCM encrypted, `google_connected_email`, `google_scopes`, `google_connected_at`), `calendar_id`, `industry`, `timezone`, working hours, `email_signature`, `intake_api_key` (+ `_created_at`), `auto_book_appointments` (Phase 6, default null → false), `outbound_webhook_url` (Phase 7), `notify_on_new_lead`/`notify_on_reply` (Phase 7, default null → true), `monitor_gmail_inbox` (default null → false, but `services/business.ts`'s `saveGoogleConnection` sets it `true` the moment Google connects — Gmail is the primary lead source, this is an opt-out not an opt-in), `session_token_version` (migration 0011, revocation counter), `gmail_watch_history_id`/`gmail_watch_expiration` (migration 0012, real-time reply sync — see `services/gmailWatchSync.ts`), and `plan`/`status` (migration 0015, agency-provisioned entitlement — see CLAUDE.md's "Access & entitlement" section).

Every "effective X" nullable field follows the same pattern: a `getEffectiveX(business)` helper in `services/business.ts` resolves the real value with a fallback default — never read the raw nullable column directly outside that file.

## `users` (team members)

An invited teammate, distinct from the workspace's own owner login (`workspaces.password_hash`, unchanged). `email`, `workspace_id`, `role` (`'owner'` default value is unused in practice — every row the app creates is `'member'`; the actual owner login has no `users` row at all), `password_hash` (null until the invite is accepted), `name`, `invite_token`/`invite_token_expires_at` (7-day, cleared on acceptance), `accepted_at`, and its own `session_token_version` (migration 0014, independent of `workspaces.session_token_version` so one login's logout can't revoke another's). See CLAUDE.md's "Team members" section and `services/userService.ts`.

## `leads`

Every inbound business inquiry. `lead_id` is the human-readable ID (`LEAD-XXXXXXXX-XXXX`); `source` is one of `config/constants.ts`'s `LEAD_SOURCES` (Website Form/Gmail/Manual Entry/CSV Import/Webhook — Phase 3). AI-Lead-Intelligence fields (`ai_summary`, `ai_category`, `ai_priority`, etc. — despite the name, populated by a deterministic rule engine, `services/automation/leadClassifier.ts`, not an LLM). `pending_appointment_date_time`/`pending_appointment_duration_minutes` (Phase 6) hold a reviewable appointment recommendation when auto-booking is off. `converted_estimate_id` links to the Estimate once converted.

## `estimates`

`estimate_number` (Phase 1, human-readable, `EST-XXXXXXXX-XXXX`) is the `{{estimate_number}}` merge variable. `lead_id` (nullable FK back to `leads` — set at conversion time, Phase 2) lets estimate-lifecycle events also log to the originating Lead's timeline. `status` is one of Sent/Follow-up 1/Follow-up 2/Booked/Lost. `gmail_thread_id`/`gmail_last_message_id` track the email thread for reply-in-thread continuity.

## `followups`

One row per drafted/sent follow-up for an estimate. `status`: Pending (shown as "Draft")/Approved/Sent/Rejected/Failed. `message` is the drafted body — stored once, human-editable before send, never re-rendered from the template at send time (only the subject is re-rendered fresh).

## `replies`

Customer replies matched to an estimate's Gmail thread (`services/replyMatcher.ts` — matches by `gmail_thread_id` + `customer_email`, nothing more sophisticated). Never mutates the Estimate; purely informational.

## `activity_logs`

Durable per-Lead event history (the Lead Details page's Timeline). `action` (a free-string, e.g. `lead.created`, `estimate.followup_sent`, `lead.appointment_recommended`) + `description`. See `services/activityService.ts`'s `logLeadActivity`/`logEstimateActivity` — the latter (Phase 2) resolves an Estimate's `lead_id` back-link so estimate-lifecycle events land on the right Lead's timeline.

## `notifications`

In-app notification-bell feed. `lead_id` is a real (non-nullable) `uuid` column — creating one for an estimate/event with no originating lead is a no-op (see the Phase 4/7 caller guards in `app/e/actions.ts` and `services/replyMatcher.ts`).

## `email_templates` (Phase 1)

One row per `(workspace_id, template_key)` override; absence of a row means "use the built-in default" (`services/emailTemplateService.ts`'s `DEFAULT_TEMPLATES`). Keys: `acknowledgment`, `followup_1`, `followup_2`, `final_followup`.

## `estimate_attachments` (Phase 4)

Metadata rows for files in the private `estimate-attachments` Supabase Storage bucket (`storage_path`, `file_name`, `content_type`, `size_bytes`). Every read/write goes through the service-role client; customer downloads use a short-lived signed URL, never direct bucket access.

## `lead_classifications` (migration `0016`)

Decision log for the inbound-email lead classifier (`services/leadClassification.ts`) — Step 1 only, classify and log, nothing downstream depends on it. One row per `(workspace_id, gmail_thread_id)` (upserted, never duplicated), recording what Claude Haiku decided about a scanned Gmail thread: `is_lead`/`confidence`/`reason`/`intent`, `model_used`, the full `raw_response`, and `status` (`classified` or `unclassified` — the latter on any API/parse failure, retried on the next scan). Also stores a denormalized `subject`/`from_header` (not part of the original spec's column list) purely so `/admin/classifications` can show the source email next to the verdict without a live Gmail re-fetch per row. Deliberately separate from `leads.ai_*` (`services/automation/leadClassifier.ts`) — that's a different pipeline stage (scoring an already-created Lead), and this table never creates, blocks, or alters a Lead row.

## Migration history

Started on Airtable, migrated to Supabase (dual-write, then full cutover — `airtable_record_id` columns since dropped). All V1.0-roadmap tables/columns above were added across Phases 1, 2 (reused an already-existing but previously-unwired `estimates.lead_id`), 4, 6, and 7. Every session's businessId/leadId/etc. are Supabase-generated UUIDs.

A `plans`/`subscriptions` table pair briefly existed (Phase 8) backing Billing-gated Free/Pro billing — migration `0015_workspace_entitlements.sql` dropped both when billing became agency-provisioned instead (see CLAUDE.md's "Access & entitlement" section). If you see either referenced in old commit messages, that's what it was.
