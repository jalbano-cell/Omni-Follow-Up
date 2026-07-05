import Stripe from "stripe";
import { env } from "@/lib/env";

/**
 * Server-only Stripe client singleton — mirrors lib/supabase.ts's getSupabase().
 * Never import this into a "use client" component; nothing here needs
 * Stripe.js/client-side keys since checkout and the billing portal are both
 * Stripe-hosted redirect flows (see services/stripeService.ts).
 */
let client: Stripe | null = null;

export function getStripe(): Stripe {
  if (!client) {
    client = new Stripe(env.stripeSecretKey);
  }
  return client;
}
