# Internal Documentation

Start with `docs/developer-onboarding.md` if you're new. Otherwise, jump to what you need:

- [`architecture.md`](./architecture.md) — directory map, layering rules, multi-tenancy model
- [`database-schema.md`](./database-schema.md) — every table
- [`service-layer.md`](./service-layer.md) — what each `/services` file does
- [`api-routes.md`](./api-routes.md) — every HTTP route, internal and public
- [`api.md`](./api.md) — the public `/api/v1/*` REST API's full request/response contract
- [`auth-flow.md`](./auth-flow.md) — the 4 independent auth mechanisms in this app
- [`google-integrations.md`](./google-integrations.md) — Gmail, Calendar, OAuth
- [`cron-jobs.md`](./cron-jobs.md) — the daily automation
- [`environment-variables.md`](./environment-variables.md) — full env var reference
- [`deployment.md`](./deployment.md) — how a change actually ships
- [`developer-onboarding.md`](./developer-onboarding.md) — clone-to-running-locally

`CLAUDE.md` (repo root) is the canonical product/architecture rules and non-goals reference — read it alongside these, not instead of them.
