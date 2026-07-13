# Omni Follow Up Public API (v1)

A versioned REST API for integrating external systems (form builders, other CRMs, phone systems, custom scripts) with Omni Follow Up. Every route lives under `/api/v1/` and is a thin adapter over the same service layer the app itself uses — see `lib/apiAuth.ts` for the shared auth/response helpers.

## Authentication

Every request needs an `Authorization: Bearer <api_key>` header, where `<api_key>` is the business's own **Website intake API key** (the same key used for `POST /api/intake`, provisioned automatically on signup — `services/business.ts`'s `getBusinessByIntakeApiKey`/`rotateIntakeApiKey`; not currently surfaced in Settings UI). One key per business, full access to that business's own data — there are no scopes/permissions yet.

```
Authorization: Bearer <api_key>
```

A missing or invalid key returns `401 { "error": "Invalid or missing API key." }`.

## Leads

### `POST /api/v1/leads`
Creates a lead. Identical validation/rate-limiting/spam-detection pipeline as the website intake form (`services/intakeService.ts`) — this is also the exact handler `POST /api/v1/webhooks/leads` uses; the two are interchangeable, kept as separate paths only so an integration's URL reads clearly. Every lead created this way is recorded with `leadSource: "Webhook"`.

Body:
```json
{ "name": "...", "email": "...", "phone": "...", "company": "...", "service": "...", "message": "..." }
```
`name`, `email`, and `message` are required. Response: `201 { "success": true, "leadId": "LEAD-..." }`, or `400`/`429`/`502` matching the same error shapes as `POST /api/intake`.

### `GET /api/v1/leads`
Lists every lead for the authenticated business, newest first. Optional `?status=` filter — one of `New Inquiry`, `Converted`, `Archived`.

Response: `200 { "leads": [Lead, ...] }` (the same `Lead` shape used throughout the app — see `types/lead.ts`).

### `PATCH /api/v1/leads/:id`
Updates `status`, `assignedTo`, or `internalNotes` on one lead (any subset). AI-analysis fields aren't externally settable.

Body: `{ "status": "Converted", "assignedTo": "Jordan", "internalNotes": "..." }` (all optional)

Response: `200 { "lead": Lead }`, or `404` if the id doesn't belong to this business.

## Estimates

### `POST /api/v1/estimates`
Creates an estimate, same required fields as the New Estimate form.

Body:
```json
{ "customerName": "...", "customerEmail": "...", "serviceType": "...", "estimateValue": 2400, "dateSent": "2026-07-05", "notes": "..." }
```
`customerName`, `customerEmail`, `serviceType`, and `estimateValue` are required; `dateSent` defaults to today, `notes` defaults to empty. `nextFollowUpDate` is computed from the business's own follow-up cadence, same as the New Estimate form.

Response: `201 { "estimate": Estimate }` (see `types/estimate.ts`), or `400` with a `fields` array listing what's missing/invalid.

### `GET /api/v1/estimates`
Lists every estimate for the authenticated business.

Response: `200 { "estimates": [Estimate, ...] }`.

## Webhooks (inbound)

### `POST /api/v1/webhooks/leads`
Exactly `POST /api/v1/leads` under a URL that reads more naturally for webhook-style integrations (Zapier, a form builder's "webhook" action, etc). See above.

## Notes

- All responses include permissive CORS headers (`Access-Control-Allow-Origin: *`) — every route also implements `OPTIONS` for preflight.
- There's no request signing beyond the bearer key, no per-route rate limiting distinct from the intake endpoint's, and no API versioning strategy beyond the `/v1/` prefix yet — treat this as a v1 in the literal sense.
