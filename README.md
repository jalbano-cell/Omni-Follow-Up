# FollowUpQuote

Estimate follow-up automation for local service businesses. Track sent estimates, get nudged on which ones need a follow-up, review AI-free drafted follow-up messages, and see at-risk revenue at a glance.

This is **not** a CRM, a website builder, or an email sender (yet) — see [CLAUDE.md](./CLAUDE.md) for scope and architecture rules, and [ui-ux-pro-max.md](./ui-ux-pro-max.md) for the design system this project follows.

## Stack

Next.js 15 (App Router) · TypeScript · Tailwind CSS v4 · shadcn/ui · Airtable (data store) · Vercel-ready

## Getting started

```bash
npm install
cp .env.example .env.local   # fill in your Airtable credentials
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). Without Airtable configured, every data page shows a friendly "not connected" state instead of crashing.

### Airtable setup

Create a base with two tables:

**Estimates**
`customerName`, `customerEmail`, `businessName`, `serviceType`, `estimateValue` (number), `dateSent` (date), `status` (single select: Sent, Follow-up 1, Follow-up 2, Booked, Lost), `nextFollowUpDate` (date), `lastContactDate` (date), `notes` (long text)

**FollowUps**
`estimateId` (text — Airtable record ID of the linked estimate), `message` (long text), `status` (single select: Pending, Sent, Approved, Rejected), `scheduledDate` (date)

Generate a Personal Access Token at [airtable.com/create/tokens](https://airtable.com/create/tokens) with `data.records:read` and `data.records:write` scopes on that base, then set:

```
AIRTABLE_API_KEY=pat...
AIRTABLE_BASE_ID=app...
```

## Scripts

- `npm run dev` — start the dev server
- `npm run build` — production build
- `npm run lint` — ESLint

## How the follow-up engine works

`services/followupEngine.ts` finds open estimates whose `nextFollowUpDate` has arrived, drafts a message based on the follow-up stage, and writes a `Pending` record to FollowUps — it never sends anything. Trigger it manually from the Follow-up Queue page, or hit `GET /api/follow-ups/generate` (wired up for a future Vercel Cron Job). Approving a follow-up in the queue marks it `Approved` ("ready to send") — actual sending arrives with the Gmail API integration in a later phase.
