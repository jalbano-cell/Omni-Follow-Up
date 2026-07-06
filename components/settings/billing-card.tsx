import { Badge } from "@/components/ui/badge";
import { CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { SubmitButton } from "@/components/estimates/submit-button";
import { upgradeToProAction, manageBillingAction } from "@/app/settings/actions";
import type { Plan, Subscription } from "@/types";

const STATUS_BADGE_VARIANT: Record<Subscription["status"], "success" | "warning" | "destructive" | "secondary"> = {
  active: "success",
  trialing: "secondary",
  past_due: "warning",
  canceled: "destructive",
};

const STATUS_LABEL: Record<Subscription["status"], string> = {
  active: "Active",
  trialing: "Trial",
  past_due: "Payment issue",
  canceled: "Canceled",
};

export function BillingCard({
  plan,
  subscription,
  leadsUsedThisMonth,
  checkoutStatus,
}: {
  plan: Plan;
  subscription: Subscription | null;
  leadsUsedThisMonth: number;
  checkoutStatus?: "success" | "cancelled";
}) {
  const isPro = plan.id === "pro";
  const usagePct = plan.maxLeadsPerMonth ? Math.min(100, (leadsUsedThisMonth / plan.maxLeadsPerMonth) * 100) : 0;

  return (
    <>
      <CardHeader className="px-0">
        <CardTitle className="text-base">Plan &amp; billing</CardTitle>
        <CardDescription>
          {isPro ? "Billed monthly via Stripe." : "Upgrade to Pro for unlimited leads, the public API, and outbound webhooks."}
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4 px-0">
        {checkoutStatus === "success" && (
          <p className="rounded-lg border border-success/40 bg-success/10 px-3 py-2 text-xs text-foreground">
            You&apos;re on Pro! If the plan below still says Free, give it a few seconds and refresh.
          </p>
        )}
        {checkoutStatus === "cancelled" && (
          <p className="rounded-lg border border-border bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
            Checkout canceled — you&apos;re still on {plan.name}.
          </p>
        )}

        <div className="flex items-center gap-2 rounded-lg border border-border px-4 py-3">
          <span className="text-sm font-medium text-foreground">{plan.name}</span>
          {plan.priceCents > 0 && (
            <span className="text-xs text-muted-foreground">${(plan.priceCents / 100).toFixed(0)}/mo</span>
          )}
          {subscription ? (
            <Badge variant={STATUS_BADGE_VARIANT[subscription.status]} className="ml-auto">
              {STATUS_LABEL[subscription.status]}
            </Badge>
          ) : (
            <Badge variant="secondary" className="ml-auto">
              {plan.maxLeadsPerMonth ? `${plan.maxLeadsPerMonth} leads/mo` : "Unlimited leads"}
            </Badge>
          )}
        </div>

        <div>
          <div className="mb-1.5 flex items-center justify-between text-xs text-muted-foreground">
            <span>Leads this month</span>
            <span>
              {plan.maxLeadsPerMonth ? `${leadsUsedThisMonth} / ${plan.maxLeadsPerMonth}` : `${leadsUsedThisMonth} (unlimited)`}
            </span>
          </div>
          {plan.maxLeadsPerMonth !== null && (
            <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
              <div
                className={`h-full rounded-full ${usagePct >= 100 ? "bg-destructive" : "bg-primary"}`}
                style={{ width: `${Math.max(usagePct, leadsUsedThisMonth > 0 ? 2 : 0)}%` }}
              />
            </div>
          )}
        </div>

        {subscription?.status === "past_due" && (
          <p className="text-xs text-destructive">
            Your last payment failed — use Manage billing below to update your payment method before Pro access lapses.
          </p>
        )}

        <div className="flex gap-2">
          {!isPro && (
            <form action={upgradeToProAction}>
              <SubmitButton>Upgrade to Pro</SubmitButton>
            </form>
          )}
          {subscription?.stripeCustomerId && (
            <form action={manageBillingAction}>
              <Button type="submit" variant="outline">
                Manage billing
              </Button>
            </form>
          )}
        </div>
      </CardContent>
    </>
  );
}
