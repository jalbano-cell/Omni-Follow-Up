import { Badge } from "@/components/ui/badge";
import { CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { PLAN_LABELS, PLAN_MAX_USERS } from "@/config/constants";
import type { WorkspacePlan, WorkspaceStatus } from "@/types";

const STATUS_BADGE_VARIANT: Record<WorkspaceStatus, "success" | "warning" | "destructive"> = {
  active: "success",
  inactive: "warning",
  suspended: "destructive",
};

const STATUS_LABEL: Record<WorkspaceStatus, string> = {
  active: "Active",
  inactive: "Inactive",
  suspended: "Suspended",
};

/**
 * Read-only — access is agency-provisioned (services/business.ts's
 * hasActiveEntitlement), not self-serve, so there's no upgrade/manage-billing
 * action to offer here anymore (see the removed BillingCard/Billing wiring).
 */
export function PlanCard({ plan, status }: { plan: WorkspacePlan; status: WorkspaceStatus }) {
  const maxUsers = PLAN_MAX_USERS[plan];

  return (
    <>
      <CardHeader className="px-0">
        <CardTitle className="text-base">Plan</CardTitle>
        <CardDescription>Managed by your account team — contact them to change your plan.</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4 px-0">
        <div className="flex items-center gap-2 rounded-lg border border-border px-4 py-3">
          <span className="text-sm font-medium text-foreground">{PLAN_LABELS[plan]}</span>
          <Badge variant="secondary" className="ml-auto">
            {maxUsers === null ? "Unlimited seats" : `${maxUsers} seat${maxUsers === 1 ? "" : "s"}`}
          </Badge>
          <Badge variant={STATUS_BADGE_VARIANT[status]}>{STATUS_LABEL[status]}</Badge>
        </div>
      </CardContent>
    </>
  );
}
