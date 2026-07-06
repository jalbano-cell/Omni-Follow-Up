import Link from "next/link";
import { PageHeader } from "@/components/layout/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { SubmitButton } from "@/components/estimates/submit-button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { getAllActiveBusinesses } from "@/services/business";
import { updateWorkspaceEntitlementAction } from "@/app/admin/actions";
import { requireAdmin } from "@/lib/session";
import { PLAN_LABELS } from "@/config/constants";
import type { WorkspacePlan, WorkspaceStatus } from "@/types";

export const dynamic = "force-dynamic";

const PLAN_OPTIONS: WorkspacePlan[] = ["grow", "transform"];
const STATUS_OPTIONS: WorkspaceStatus[] = ["active", "inactive", "suspended"];

const STATUS_BADGE_VARIANT: Record<WorkspaceStatus, "success" | "warning" | "destructive"> = {
  active: "success",
  inactive: "warning",
  suspended: "destructive",
};

/**
 * Agency-only workspace provisioning (lib/session.ts's requireAdmin — gated
 * to the one workspace named in ADMIN_WORKSPACE_ID). getAllActiveBusinesses
 * despite its cron-oriented name returns every workspace with no filter,
 * which is exactly what's needed here.
 */
export default async function AdminPage() {
  await requireAdmin();
  const businesses = await getAllActiveBusinesses();

  return (
    <>
      <PageHeader
        title="Admin"
        description="Provision and manage client workspace access."
        action={
          <Button render={<Link href="/admin/new" />}>New workspace</Button>
        }
      />

      <div className="flex flex-col gap-3">
        {businesses.map((business) => (
          <div key={business.id} className="flex flex-col gap-3 rounded-lg border border-border px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex flex-col">
              <span className="text-sm font-medium text-foreground">{business.businessName}</span>
              <span className="text-xs text-muted-foreground">{business.ownerEmail}</span>
            </div>
            <form action={updateWorkspaceEntitlementAction.bind(null, business.id)} className="flex items-center gap-2">
              <Select name="plan" defaultValue={business.plan}>
                <SelectTrigger className="w-32">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PLAN_OPTIONS.map((plan) => (
                    <SelectItem key={plan} value={plan}>
                      {PLAN_LABELS[plan]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select name="status" defaultValue={business.status}>
                <SelectTrigger className="w-32">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {STATUS_OPTIONS.map((status) => (
                    <SelectItem key={status} value={status}>
                      {status[0].toUpperCase() + status.slice(1)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Badge variant={STATUS_BADGE_VARIANT[business.status]}>{business.status}</Badge>
              <SubmitButton size="sm">Save</SubmitButton>
            </form>
          </div>
        ))}
      </div>
    </>
  );
}
