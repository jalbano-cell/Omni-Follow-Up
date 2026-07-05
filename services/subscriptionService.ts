import { selectById, selectWhere } from "@/lib/supabase";
import { getLeads } from "@/services/db";
import type { Database } from "@/types/supabase";
import type { Plan, PlanFeature, Subscription } from "@/types";

/**
 * Subscription/plan scaffolding for the eventual Billing integration — no
 * Billing SDK call exists anywhere yet (billingCustomerId/billingSubscriptionId
 * are placeholder columns). A workspace with no `subscriptions` row is
 * implicitly on the 'free' plan, same nullable-override-with-default
 * pattern used everywhere else in this app.
 */

const FREE_PLAN_ID = "free";

type PlanRow = Database["public"]["Tables"]["plans"]["Row"];
type SubscriptionRow = Database["public"]["Tables"]["subscriptions"]["Row"];

function toPlan(row: PlanRow): Plan {
  return {
    id: row.id,
    name: row.name,
    priceCents: row.price_cents,
    maxLeadsPerMonth: row.max_leads_per_month,
    maxUsers: row.max_users,
    features: (row.features ?? {}) as Record<PlanFeature, boolean>,
  };
}

function toSubscription(row: SubscriptionRow): Subscription {
  return {
    id: row.id,
    businessId: row.workspace_id,
    planId: row.plan_id,
    status: row.status as Subscription["status"],
    billingCustomerId: row.billing_customer_id,
    billingSubscriptionId: row.billing_subscription_id,
    currentPeriodEnd: row.current_period_end,
  };
}

async function getPlan(planId: string): Promise<Plan> {
  const row = await selectById("plans", planId);
  if (!row) {
    throw new Error(`Unknown plan id: ${planId}`);
  }
  return toPlan(row);
}

export async function getSubscription(businessId: string): Promise<Subscription | null> {
  const rows = await selectWhere("subscriptions", { workspace_id: businessId });
  return rows[0] ? toSubscription(rows[0]) : null;
}

/** The plan a business is actually on — falls back to Free when no subscription row exists yet. */
export async function getEffectivePlan(businessId: string): Promise<Plan> {
  const subscription = await getSubscription(businessId);
  return getPlan(subscription?.planId ?? FREE_PLAN_ID);
}

/**
 * Whether a plan includes a given feature. Always resolves the real
 * plan/feature lookup (not hardcoded), but nothing in the app calls this to
 * actually block access yet — it establishes the shape for when feature
 * gating goes live, deliberately not wired into any UI/route yet.
 */
export async function checkFeatureGate(businessId: string, feature: PlanFeature): Promise<boolean> {
  const plan = await getEffectivePlan(businessId);
  return plan.features[feature] ?? false;
}

/** Leads created so far in the current calendar month — computed live, no counter table to drift out of sync (same philosophy as services/analytics.ts). */
export async function getLeadsThisMonthUsage(businessId: string): Promise<number> {
  const leads = await getLeads(businessId);
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  return leads.filter((lead) => new Date(lead.createdTime) >= monthStart).length;
}
