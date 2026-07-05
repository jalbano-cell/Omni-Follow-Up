export type PlanFeature = "emailTemplates" | "customerPortal" | "publicApi" | "webhooks";

export interface Plan {
  id: string;
  name: string;
  priceCents: number;
  /** Null means unlimited. */
  maxLeadsPerMonth: number | null;
  maxUsers: number;
  features: Record<PlanFeature, boolean>;
  /** The Stripe Price backing this plan's checkout — null until first created (see services/stripeService.ts's ensureProStripePrice). Free has no Stripe price; it's never checked out. */
  stripePriceId: string | null;
}

export type SubscriptionStatus = "active" | "trialing" | "past_due" | "canceled";

export interface Subscription {
  id: string;
  businessId: string;
  planId: string;
  status: SubscriptionStatus;
  stripeCustomerId: string | null;
  stripeSubscriptionId: string | null;
  currentPeriodEnd: string | null;
}
