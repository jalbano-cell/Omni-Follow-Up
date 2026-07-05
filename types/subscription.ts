export type PlanFeature = "emailTemplates" | "customerPortal" | "publicApi" | "webhooks";

export interface Plan {
  id: string;
  name: string;
  priceCents: number;
  /** Null means unlimited. */
  maxLeadsPerMonth: number | null;
  maxUsers: number;
  features: Record<PlanFeature, boolean>;
}

export type SubscriptionStatus = "active" | "trialing" | "past_due" | "canceled";

export interface Subscription {
  id: string;
  businessId: string;
  planId: string;
  status: SubscriptionStatus;
  /** Placeholder — nothing in the app calls the Billing API yet (see services/subscriptionService.ts). */
  billingCustomerId: string | null;
  billingSubscriptionId: string | null;
  currentPeriodEnd: string | null;
}
