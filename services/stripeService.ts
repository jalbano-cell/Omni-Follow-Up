import type Stripe from "stripe";
import { getStripe } from "@/lib/stripe";
import { selectWhere, insertRow, updateRow } from "@/lib/supabase";
import { getPlan, PRO_PLAN_ID } from "@/services/subscriptionService";
import { logAction } from "@/lib/logger";
import type { Database } from "@/types/supabase";
import type { Business, SubscriptionStatus } from "@/types";

type SubscriptionUpdate = Database["public"]["Tables"]["subscriptions"]["Update"];

/**
 * All real Stripe API calls live here — services/subscriptionService.ts owns
 * plan/feature/usage lookups against our own database, this file owns
 * talking to Stripe and keeping the `subscriptions` table in sync with it.
 * Only the Pro plan ever gets a Stripe Price/Checkout — Free is never
 * checked out, it's just the absence of an active subscription row.
 */

/**
 * Creates the Pro plan's Stripe Product/Price on first use and remembers the
 * Price ID on the `plans` row — idempotent, and self-healing if the stored
 * price ID no longer resolves (e.g. the account switched from test-mode
 * keys to live-mode keys, which are entirely separate Stripe universes).
 */
export async function ensureProStripePrice(): Promise<string> {
  const plan = await getPlan(PRO_PLAN_ID);
  const stripe = getStripe();

  if (plan.stripePriceId) {
    try {
      const existing = await stripe.prices.retrieve(plan.stripePriceId);
      if (existing.active) return existing.id;
    } catch {
      // Doesn't exist in the currently configured Stripe mode — fall through and recreate.
    }
  }

  const product = await stripe.products.create({ name: `OmniFollowUp ${plan.name}` });
  const price = await stripe.prices.create({
    product: product.id,
    unit_amount: plan.priceCents,
    currency: "usd",
    recurring: { interval: "month" },
  });

  await updateRow("plans", plan.id, { stripe_price_id: price.id });
  logAction("stripe.price-created", { planId: plan.id, priceId: price.id });
  return price.id;
}

async function getSubscriptionRow(businessId: string) {
  const rows = await selectWhere("subscriptions", { workspace_id: businessId });
  return rows[0] ?? null;
}

/** Redirects the business's owner to a Stripe-hosted Checkout page for the Pro plan. Reuses an existing Stripe Customer if this business has one (e.g. a past cancellation), so payment history stays on one Customer record. */
export async function createCheckoutSession(
  business: Business,
  urls: { successUrl: string; cancelUrl: string }
): Promise<string> {
  const stripe = getStripe();
  const priceId = await ensureProStripePrice();
  const existing = await getSubscriptionRow(business.id);

  const session = await stripe.checkout.sessions.create({
    mode: "subscription",
    line_items: [{ price: priceId, quantity: 1 }],
    customer: existing?.stripe_customer_id ?? undefined,
    customer_email: existing?.stripe_customer_id ? undefined : business.ownerEmail,
    client_reference_id: business.id,
    metadata: { businessId: business.id },
    subscription_data: { metadata: { businessId: business.id } },
    success_url: urls.successUrl,
    cancel_url: urls.cancelUrl,
  });

  if (!session.url) {
    throw new Error("Stripe did not return a Checkout URL.");
  }
  return session.url;
}

/** Redirects to the Stripe-hosted Billing Portal, where a customer can update payment method, view invoices, or cancel — deliberately not rebuilt as custom UI here. */
export async function createBillingPortalSession(business: Business, urls: { returnUrl: string }): Promise<string> {
  const existing = await getSubscriptionRow(business.id);
  if (!existing?.stripe_customer_id) {
    throw new Error("No billing account yet — upgrade to Pro first.");
  }

  const stripe = getStripe();
  const session = await stripe.billingPortal.sessions.create({
    customer: existing.stripe_customer_id,
    return_url: urls.returnUrl,
  });
  return session.url;
}

/** Stripe subscription statuses collapse onto our 4-value SubscriptionStatus — incomplete/unpaid/paused all read as "needs attention" (past_due) since this app doesn't have a distinct UI state for each of Stripe's finer-grained ones. */
function mapStripeStatus(status: Stripe.Subscription.Status): SubscriptionStatus {
  switch (status) {
    case "trialing":
      return "trialing";
    case "active":
      return "active";
    case "canceled":
    case "incomplete_expired":
      return "canceled";
    default:
      return "past_due";
  }
}

async function upsertSubscriptionRow(businessId: string, fields: SubscriptionUpdate): Promise<void> {
  const existing = await getSubscriptionRow(businessId);
  const withTimestamp: SubscriptionUpdate = { ...fields, updated_at: new Date().toISOString() };
  if (existing) {
    await updateRow("subscriptions", existing.id, withTimestamp);
  } else {
    await insertRow("subscriptions", {
      workspace_id: businessId,
      plan_id: fields.plan_id ?? PRO_PLAN_ID,
      status: fields.status ?? "active",
      ...withTimestamp,
    });
  }
}

/** checkout.session.completed — the moment a business's card is charged for the first time. */
export async function handleCheckoutSessionCompleted(session: Stripe.Checkout.Session): Promise<void> {
  const businessId = session.client_reference_id ?? session.metadata?.businessId;
  if (!businessId || !session.customer || !session.subscription) {
    logAction("stripe.checkout-completed-missing-data", { sessionId: session.id });
    return;
  }

  await upsertSubscriptionRow(businessId, {
    plan_id: PRO_PLAN_ID,
    status: "active",
    stripe_customer_id: String(session.customer),
    stripe_subscription_id: String(session.subscription),
  });
  logAction("stripe.checkout-completed", { businessId, sessionId: session.id });
}

/** customer.subscription.updated / customer.subscription.deleted — plan status changes after checkout (renewal, cancellation, payment recovery, etc). Looked up by Stripe subscription ID rather than metadata, since Stripe is the source of truth for which subscription this is. */
export async function syncSubscriptionFromStripe(subscription: Stripe.Subscription): Promise<void> {
  const rows = await selectWhere("subscriptions", { stripe_subscription_id: subscription.id });
  const existing = rows[0];
  if (!existing) {
    logAction("stripe.subscription-sync-skipped", { stripeSubscriptionId: subscription.id, reason: "no matching local subscription" });
    return;
  }

  const status = mapStripeStatus(subscription.status);
  const isEnded = status === "canceled";
  // current_period_end lives per subscription item (not on the subscription itself) as of this API version.
  const periodEnd = subscription.items.data[0]?.current_period_end;

  await updateRow("subscriptions", existing.id, {
    status,
    plan_id: isEnded ? "free" : PRO_PLAN_ID,
    current_period_end: periodEnd ? new Date(periodEnd * 1000).toISOString() : null,
    updated_at: new Date().toISOString(),
  });
  logAction("stripe.subscription-synced", { businessId: existing.workspace_id, status, stripeSubscriptionId: subscription.id });
}

/** invoice.payment_failed — a renewal charge didn't go through; Stripe will retry per its own dunning schedule, this just reflects the "needs attention" state locally until it either recovers (subscription.updated -> active) or gets canceled. */
export async function handleInvoicePaymentFailed(invoice: Stripe.Invoice): Promise<void> {
  // As of this API version, an invoice's originating subscription is nested under `parent`, not a top-level field.
  const subscriptionRef = invoice.parent?.subscription_details?.subscription;
  const stripeSubscriptionId = typeof subscriptionRef === "string" ? subscriptionRef : subscriptionRef?.id;
  if (!stripeSubscriptionId) return;

  const rows = await selectWhere("subscriptions", { stripe_subscription_id: stripeSubscriptionId });
  const existing = rows[0];
  if (!existing) return;

  await updateRow("subscriptions", existing.id, { status: "past_due", updated_at: new Date().toISOString() });
  logAction("stripe.invoice-payment-failed", { businessId: existing.workspace_id, stripeSubscriptionId });
}
