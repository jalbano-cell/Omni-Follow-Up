-- Real Stripe billing: the one column the app needs to remember which Stripe
-- Price backs the Pro plan (created lazily on first checkout attempt, see
-- services/stripeService.ts's ensureProStripePrice) — everything else
-- (customer id, subscription id, status, period end) already exists on
-- subscriptions from the Phase 8 scaffolding migration.
alter table plans add column if not exists stripe_price_id text;
