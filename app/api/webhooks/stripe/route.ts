import { NextResponse } from "next/server";
import type Stripe from "stripe";
import { getStripe } from "@/lib/stripe";
import { env } from "@/lib/env";
import { handleCheckoutSessionCompleted, syncSubscriptionFromStripe, handleInvoicePaymentFailed } from "@/services/stripeService";
import { logAction } from "@/lib/logger";

/**
 * Public endpoint — Stripe posts here with no session cookie, authenticated
 * instead by an HMAC signature over the raw request body (constructEvent
 * below throws if it doesn't match STRIPE_WEBHOOK_SECRET). This is the only
 * path that keeps the `subscriptions` table in sync with what Stripe
 * actually charged/canceled — never trust the client-side checkout redirect
 * alone for that, since a customer can close the tab before it completes.
 */
export async function POST(request: Request) {
  const signature = request.headers.get("stripe-signature");
  if (!signature) {
    return NextResponse.json({ error: "Missing stripe-signature header." }, { status: 400 });
  }

  const rawBody = await request.text();

  let event: Stripe.Event;
  try {
    event = getStripe().webhooks.constructEvent(rawBody, signature, env.stripeWebhookSecret);
  } catch (error) {
    logAction("stripe.webhook-signature-invalid", { error: error instanceof Error ? error.message : "unknown error" });
    return NextResponse.json({ error: "Invalid signature." }, { status: 400 });
  }

  try {
    switch (event.type) {
      case "checkout.session.completed":
        await handleCheckoutSessionCompleted(event.data.object as Stripe.Checkout.Session);
        break;
      case "customer.subscription.updated":
      case "customer.subscription.deleted":
        await syncSubscriptionFromStripe(event.data.object as Stripe.Subscription);
        break;
      case "invoice.payment_failed":
        await handleInvoicePaymentFailed(event.data.object as Stripe.Invoice);
        break;
      default:
        // Unhandled event types are expected — Stripe sends far more events than this app acts on.
        break;
    }
  } catch (error) {
    // Stripe retries a webhook on a non-2xx response — log and still 200 so it doesn't retry
    // forever on a bug in our handling; the raw event is visible in the Stripe Dashboard either way.
    logAction("stripe.webhook-handler-failed", {
      eventType: event.type,
      error: error instanceof Error ? error.message : "unknown error",
    });
  }

  return NextResponse.json({ received: true });
}
