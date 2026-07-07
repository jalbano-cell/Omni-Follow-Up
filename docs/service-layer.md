# Service Layer

Every external I/O and unit of business logic lives in `/services`. Pages/API routes/Server Actions call these; they never call Supabase, Gmail, or Google Calendar directly. Grouped below by concern.

## Data access

- **`db.ts`** — the central CRUD layer for Leads/Estimates/FollowUps/Replies/ActivityLog/Notifications. Every tenant-owned function takes `businessId` explicitly; direct-id lookups verify `workspace_id` ownership on the fetched row.
- **`business.ts`** — `workspaces` CRUD, every `getEffectiveX(business)` helper (cadence, calendar id, timezone, working hours, auto-booking, notification prefs) that resolves a nullable per-business override against its default, `hasActiveEntitlement` (the one access gate — see CLAUDE.md's "Access & entitlement" section), and `createBusinessForAgency` (agency-provisioned signup, `app/admin/actions.ts` — sets `plan`/`status` explicitly instead of the self-serve defaults, with an unusable placeholder password until the owner claims it).
- **`userService.ts`** — team members: `inviteTeamMember`/`acceptInvite`/`removeTeamMember` (see CLAUDE.md's "Team members" section), plus `createOwnerClaim`/`claimWorkspaceOwnership` (CLAUDE.md's "Admin provisioning" section) — the same `users`-table invite/token infrastructure repurposed as a one-time "claim this new workspace as its owner" link rather than "join an existing one," transient (the row is deleted once claimed).
- **`activityService.ts`** — the only way an `activity_logs` row gets written. `logLeadActivity` (direct) and `logEstimateActivity` (Phase 2 — resolves an Estimate's `lead_id` back-link, no-ops if none). Always also bumps the Lead's `last_activity_at`.
- **`emailTemplateService.ts`** (Phase 1) — get/list/upsert/reset for the 4 customizable email templates, plus `templateKeyForEstimateStage`. Re-exports the pure `services/emailTemplates/render.ts` (merge-variable substitution + sample data — deliberately dependency-free so it's safe to import into a client component for live previews).
- **`estimateAttachmentService.ts`** (Phase 4) — Supabase Storage upload/list/delete/signed-download-URL for estimate attachments, plus `deleteAttachmentsForEstimate` (called from `db.ts`'s `deleteEstimate` so files aren't orphaned).

## Lead lifecycle

- **`leadService.ts`** — the one place "what happens when a lead arrives/converts/archives/gets assigned/noted" lives: `createLeadFromSubmission` (the notification email, AI-Lead-Intelligence analysis, acknowledgment email, webhook dispatch — all best-effort side effects after the authoritative DB write), `archiveLead`, `markLeadConverted`, `revertLeadConversion`, AI-insights edit/dismiss/restore/regenerate, and (Phase 6) `approveRecommendedAppointment`/`dismissRecommendedAppointment`.
- **`automation/leadClassifier.ts`** — deterministic rule-engine replacement for what used to be a Gemini call. Keyword/lookup-table classification into the same `ai*` fields the UI already renders. No AI/LLM anywhere in this codebase.
- **`automation/appointmentParser.ts`** — regex/pattern-based date+time extraction from a lead's message (also a former-Gemini-call replacement). Conservative: requires both a date signal and a time signal.
- **`appointmentBooking.ts`** — `resolveAppointmentBooking` (checks Calendar availability; when `getEffectiveAutoBooking` is on, books immediately via `createEvent`; when off — the default — returns a `"recommended"` result instead) and `bookRecommendedAppointment` (the Phase 6 approval-time booking call).
- **`intakeService.ts`** — HTTP-facing concerns only for `POST /api/intake`-family requests: validation/sanitization, honeypot spam check, in-memory rate limiting, the request audit log. Delegates to `leadService.ts` for everything else. `source` is now a parameter (Phase 3/5), not hardcoded.

## Estimate/follow-up lifecycle

- **`followupEngine.ts`** — drafts a follow-up message (`draftFollowUpMessage`, now rendering the business's email template — Phase 1) for every open estimate due for one; `generateDueFollowUps` (manual trigger) and `runDailyFollowUpJob` (cron entry point) both funnel through `generateFollowUpDrafts`. Never sends anything.
- **`followupSender.ts`** — the only path that ever calls `gmail.ts`'s send. `sendApprovedFollowUp` requires the follow-up to already be Approved/Failed; advances the estimate's stage using the business's cadence; logs a `estimate.followup_sent` activity entry (Phase 2).
- **`replyMatcher.ts`** — matches incoming Gmail messages to an estimate by thread+email; creates `Replies` rows and (Phase 2/7) an `estimate.reply_received` activity entry + optional in-app Notification. Never interprets or acts on a reply.

## Google integrations

- **`gmail.ts`** (send) / **`gmailInbox.ts`** (read) — pure transport, deliberately two files. See `docs/google-integrations.md`.
- **`googleOAuth.ts`** — token exchange/refresh.
- **`calendar.ts`** — pure transport (busy-interval lookup, event creation).
- **`calendarReminders.ts`** — output-only Calendar reminders for the owner (never books, never checks availability — a different, narrower concern than `appointmentBooking.ts`).

## Read-only / computed

- **`analytics.ts`** — revenue trend, pipeline funnel, reply-rate, all computed live on every page load, no snapshot table.
- **`emailBuilder.ts`** — assembles the final acknowledgment email (template-rendered "none" case, or system-rendered booked/alternates branches from `emailTemplates/acknowledgment.ts`), appends the sign-off.

See `docs/api.md` for how the public `/api/v1/*` routes are thin adapters over this same layer via `lib/apiAuth.ts`.
