export type PlanFeature = "emailTemplates" | "customerPortal" | "publicApi" | "webhooks";

export interface Plan {
  id: string;
  name: string;
  priceCents: number;
  /** Null means unlimited. */
  maxLeadsPerMonth: number | null;
  maxUsers: number;
  features: Record<PlanFeature, boolean>;
  /** The Billing Price backing this plan's checkout — null until first created (see services/billingService.ts's ensureProBillingPrice). Free has no Billing price; it's never checked out. */
  billingPriceId: string | null;
}

export type SubscriptionStatus = "active" | "trialing" | "past_due" | "canceled";

export interface Subscription {
  id: string;
  businessId: string;
  planId: string;
  status: SubscriptionStatus;
  billingCustomerId: string | null;
  billingSubscriptionId: string | null;
  currentPeriodEnd: string | null;
}
