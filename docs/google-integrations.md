# Google Integrations

One shared Google Cloud OAuth client serves every tenant; each business grants its own consent and gets its own refresh token (`docs/auth-flow.md`).

## Scopes granted in one consent flow

`gmail.send`, `gmail.readonly`, `calendar.events` — all three are requested together when a business clicks "Connect Google Account" (onboarding or Settings). There is no separate connect flow for Calendar — don't add one; reuse the existing refresh token.

## Gmail

- **`services/gmail.ts`** (send) — pure transport. Builds the raw RFC 822 MIME message, handles `Re:` subject prefixing and In-Reply-To/References threading for follow-up continuity. The *only* caller is `services/followupSender.ts`'s `sendApprovedFollowUp` — nothing else in the app sends a follow-up/negotiation email.
- **`services/gmailInbox.ts`** (read) — pure transport, deliberately a separate file from `gmail.ts`. Fetches a thread's messages for `services/replyMatcher.ts`.
- **`gmail.readonly` requires Google's sensitive-scope app verification** before the consent screen works for real external users beyond manually-added test accounts — start that review process well before a public launch.

## Calendar — two separate, deliberately different features

1. **Reminders** (`services/calendarReminders.ts`) — output-only, always. Creates a short reminder event when a follow-up is drafted (nudging the owner to review it), deletes it once sent/skipped. Never reads availability, never books anything customer-facing.
2. **Appointment booking** (`services/appointmentBooking.ts`) — DOES read availability, and (Phase 6: only when `getEffectiveAutoBooking` is on, default off) DOES book a real event with the customer as an attendee. When off, produces a reviewable recommendation instead (see `docs/service-layer.md`). This is the one narrow exception to "reminders are output-only" — don't generalize from it back into `calendarReminders.ts`.

## A real gotcha: enabling the scope ≠ enabling the API

Granting the `calendar.events` OAuth scope in the consent screen does **not** enable the Google Calendar *API* on the underlying Google Cloud project — those are two separate steps in Google Cloud Console. If Calendar reminders or appointment booking silently aren't working for a connected business, check `https://console.developers.google.com/apis/api/calendar-json.googleapis.com/overview?project=<project-number>` before assuming it's a code bug. This failed silently (403 `SERVICE_DISABLED`, caught and logged, never surfaced to the UI) during this project's own appointment-booking development — the failure mode is real, not hypothetical.

## Failure handling

Every Google-dependent operation degrades gracefully: Gmail not connected → notification/acknowledgment emails are skipped (logged, not thrown); Calendar API errors → appointment resolution falls back to `{ type: "none" }`; a revoked refresh token (`invalid_grant`) clears the connection and prompts reconnect rather than retrying forever.
