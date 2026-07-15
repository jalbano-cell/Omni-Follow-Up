import Link from "next/link";
import { Building2, Users, CheckCircle2, MailWarning } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { SubmitButton } from "@/components/estimates/submit-button";
import { StatCard } from "@/components/dashboard/stat-card";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { getAllBusinesses } from "@/services/business";
import { updateWorkspaceEntitlementAction } from "@/app/admin/actions";
import { requireAdmin } from "@/lib/session";
import { PRODUCT_MODE_LABELS, PRODUCT_MODE_OPTIONS } from "@/config/constants";
import type { WorkspaceStatus } from "@/types";

export const dynamic = "force-dynamic";

const STATUS_OPTIONS: WorkspaceStatus[] = ["active", "inactive", "suspended"];

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
 * Agency-only workspace provisioning (lib/session.ts's requireAdmin — gated
 * to the one workspace named in ADMIN_WORKSPACE_ID). getAllBusinesses
 * despite its cron-oriented name returns every workspace with no filter,
 * which is exactly what's needed here.
 */
export default async function AdminPage() {
  await requireAdmin();
  const businesses = await getAllBusinesses();

  const activeCount = businesses.filter((b) => b.status === "active").length;
  const needsAttentionCount = businesses.length - activeCount;
  const needsGoogleSetupCount = businesses.filter((b) => !b.googleRefreshTokenEnc).length;

  return (
    <>
      <PageHeader
        title="Admin"
        description="Provision and manage client workspace access."
        action={
          <div className="flex gap-2">
            <Button variant="outline" render={<Link href="/admin/classifications" />}>
              Lead classifications
            </Button>
            <Button render={<Link href="/admin/new" />}>New workspace</Button>
          </div>
        }
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard label="Workspaces" value={String(businesses.length)} icon={Building2} />
        <StatCard
          label="Active"
          value={String(activeCount)}
          icon={CheckCircle2}
          tone="success"
          hint={needsAttentionCount > 0 ? `${needsAttentionCount} need attention` : undefined}
        />
        <StatCard
          label="Needs Google setup"
          value={String(needsGoogleSetupCount)}
          icon={MailWarning}
          tone={needsGoogleSetupCount > 0 ? "warning" : "default"}
        />
      </div>

      <div className="mt-6 overflow-hidden rounded-lg border border-border">
        <div className="flex items-center justify-between border-b border-border bg-muted/30 px-4 py-3">
          <p className="flex items-center gap-2 text-sm font-medium text-foreground">
            <Users className="size-4 text-muted-foreground" />
            Workspaces
          </p>
          <span className="text-xs text-muted-foreground">{businesses.length} total</span>
        </div>

        {businesses.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <p className="text-sm text-muted-foreground">
              No workspaces yet. Click &quot;New workspace&quot; to provision your first client.
            </p>
          </div>
        ) : (
          <div className="divide-y divide-border">
            {businesses.map((business) => (
              <div
                key={business.id}
                className="flex flex-col gap-4 px-4 py-4 transition-colors hover:bg-muted/20 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="flex min-w-0 items-center gap-3">
                  <div className="flex size-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-sm font-semibold text-primary">
                    {business.businessName.charAt(0).toUpperCase()}
                  </div>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-foreground">{business.businessName}</p>
                    <p className="truncate text-xs text-muted-foreground">{business.ownerEmail}</p>
                    <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                      <Badge variant={STATUS_BADGE_VARIANT[business.status]}>{STATUS_LABEL[business.status]}</Badge>
                      <Badge variant="outline">{PRODUCT_MODE_LABELS[business.productMode]}</Badge>
                    </div>
                  </div>
                </div>

                <form
                  action={updateWorkspaceEntitlementAction.bind(null, business.id)}
                  className="flex shrink-0 flex-wrap items-end gap-2 sm:flex-nowrap"
                >
                  <div className="flex flex-col gap-1">
                    <Label className="text-[10px] text-muted-foreground">Status</Label>
                    <Select name="status" defaultValue={business.status} items={STATUS_LABEL}>
                      <SelectTrigger className="w-32">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {STATUS_OPTIONS.map((status) => (
                          <SelectItem key={status} value={status}>
                            {STATUS_LABEL[status]}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="flex flex-col gap-1">
                    <Label className="text-[10px] text-muted-foreground">Product mode</Label>
                    <Select name="productMode" defaultValue={business.productMode} items={PRODUCT_MODE_LABELS}>
                      <SelectTrigger className="w-40">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {PRODUCT_MODE_OPTIONS.map((mode) => (
                          <SelectItem key={mode} value={mode}>
                            {PRODUCT_MODE_LABELS[mode]}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <SubmitButton size="sm">Save</SubmitButton>
                </form>
              </div>
            ))}
          </div>
        )}
      </div>
    </>
  );
}
