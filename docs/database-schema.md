# Database Schema

Postgres via Supabase. Schema lives in `supabase/migrations/*.sql`, applied via the linked Supabase CLI (`supabase db push`) — see `docs/deployment.md`. The TypeScript type layer (`types/supabase.ts`) is generated (`supabase gen types typescript --linked > types/supabase.ts`), never hand-edited — regenerate it after every migration. RLS is intentionally disabled everywhere; see `docs/architecture.md`'s multi-tenancy section for how isolation actually works.

## `workspaces` (one row per tenant business)

Everything per-business configuration lives here: `business_name`, `owner_name`, `owner_email`, `password_hash` (scrypt), follow-up cadence overrides (`follow_up_cadence_*_days`), onboarding progress, Google connection (`google_refresh_token_enc` — AES-256-GCM encrypted, `google_connected_email`, `google_scopes`, `google_connected_at`), `calendar_id`, `industry`, `timezone`, working hours, `email_signature`, `intake_api_key` (+ `_created_at`), `auto_book_appointments` (Phase 6, default null → false), `outbound_webhook_url` (Phase 7), `notify_on_new_lead`/`notify_on_reply` (Phase 7, default null → true).

Every "effective X" nullable field follows the same pattern: a `getEffectiveX(business)` helper in `services/business.ts` resolves the real value with a fallback default — never read the raw nullable column directly outside that file.

## `users`

Phase-6-of-the-original-migration prep — not wired into auth yet. The app still authenticates against `workspaces.password_hash` directly (single login per business, no team/multi-user roster).

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

## `plans` / `subscriptions` (Phase 8)

`plans` is a small seeded table (`free`, `pro` — see the Phase 8 migration) with `price_cents`, `max_leads_per_month`, `max_users`, and a `features` JSONB map. `subscriptions` links a `workspace_id` to a `plan_id` plus placeholder `stripe_customer_id`/`stripe_subscription_id` columns — no Stripe API call exists anywhere yet. A workspace with no `subscriptions` row is implicitly on the Free plan (`services/subscriptionService.ts`'s `getEffectivePlan`).

## Migration history

Started on Airtable, migrated to Supabase (dual-write, then full cutover — `airtable_record_id` columns since dropped). All V1.0-roadmap tables/columns above were added across Phases 1, 2 (reused an already-existing but previously-unwired `estimates.lead_id`), 4, 6, 7, and 8. Every session's businessId/leadId/etc. are Supabase-generated UUIDs.
