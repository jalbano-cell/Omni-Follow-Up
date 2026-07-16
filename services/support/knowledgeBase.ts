import type { WorkspaceProductMode } from "@/types";

/**
 * Curated, product-mode-aware knowledge base for the in-app support assistant
 * ("Ask Omni"). This is the ONLY source of app-behavior facts the assistant is
 * given — it is assembled into the system prompt (prompt-cached, same pattern
 * as services/anthropic.ts's classifier) so the bot answers "how does X work"
 * questions from here rather than from the model's priors.
 *
 * It is deliberately assembled per productMode: a workspace the agency has
 * restricted to "appointments_only" (see lib/session.ts) has no Estimates /
 * Follow-up Queue / Replies surface, so the bot must never describe those to
 * that client — and vice-versa for "estimates_only". The mode-specific blocks
 * below mirror the exact nav-gating the app already does.
 */

const CORE = `
# About OmniFollowUp

OmniFollowUp is a tool that helps local service businesses follow up with their
customers automatically, so leads and jobs don't slip through the cracks. Every
business logs into its own private workspace — you only ever see your own data.

## Leads
- The **Leads** page is the inbox for new inquiries (from your website contact
  form, integrations, or manual/CSV import).
- Each new lead is automatically reviewed by AI, which adds a short summary,
  a priority (High/Medium/Low), and a suggested next action.
- From a lead you can add internal notes, archive it, or take the next step
  (see the mode-specific sections below).

## Settings
- **Business hours & time zone** — used so reminders and follow-ups go out at
  the right local time.
- **Email templates** — the wording of the automated emails your customers
  receive. You can edit these.
- **Gmail connection** — connect your Gmail so emails send from your own
  address. Without a connected mailbox, the app can't send email on your behalf.
- Only the workspace owner can change billing, the Gmail connection, API keys,
  outbound webhooks, and team members. Everything else is shared by your team.

## Email compliance (CASL)
- Every automated email includes an unsubscribe link and a compliance footer,
  and anyone who unsubscribes is suppressed automatically — you don't have to
  manage that by hand.
`.trim();

const ESTIMATES = `
## Estimates & the Follow-up Queue
- When a lead becomes a real quote, you convert it into an **Estimate**.
- OmniFollowUp then sends a sequence of polite follow-up emails to that customer
  on a schedule (the cadence), nudging them toward a decision.
- The **Follow-up Queue** shows drafts that are ready to go — you review and
  approve, edit, skip, or send each one. Nothing goes out without your say-so.
- The **Replies** page collects customer responses so you can see who answered.
- You control the follow-up cadence and the email wording in Settings.
`.trim();

const APPOINTMENTS = `
## Appointments
- The **Appointments** page has a calendar and list of your bookings.
- When a customer's message includes a time, OmniFollowUp can create a pending
  **booking request**. You approve it (from the Appointments page or right from
  the lead) to confirm it — or you can schedule one yourself with the
  "Schedule appointment" button on a lead.
- Approving an appointment can add it to your connected Google Calendar.
- A **reminder email is sent automatically 3 hours before** an approved
  appointment — there's nothing to approve, it just goes.
- After the appointment, the app can send a review request, and later a
  rebook reminder, to keep customers coming back.
- You can flag an appointment as completed, a no-show, or cancelled.
`.trim();

/** Assemble the knowledge base for a workspace's product surface. */
export function buildKnowledgeBase(productMode: WorkspaceProductMode): string {
  const sections = [CORE];
  if (productMode !== "appointments_only") sections.push(ESTIMATES);
  if (productMode !== "estimates_only") sections.push(APPOINTMENTS);
  return sections.join("\n\n");
}
