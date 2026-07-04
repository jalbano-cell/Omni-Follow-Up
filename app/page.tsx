import Link from "next/link";
import { FileText, Clock, TrendingDown, CheckCircle2, ArrowRight, BarChart3 } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { AirtableErrorState } from "@/components/layout/airtable-error-state";
import { StatCard } from "@/components/dashboard/stat-card";
import { StatusBadge } from "@/components/estimates/status-badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { getDashboardStats } from "@/services/analytics";
import { getFollowUpQueue } from "@/services/followupEngine";
import { getEstimates } from "@/services/airtable";
import { formatCurrency, formatDate } from "@/lib/date";
import { requireOnboardedBusiness } from "@/lib/session";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const { id: businessId } = await requireOnboardedBusiness();

  let stats;
  let followUpQueue;
  let recentEstimates;

  try {
    [stats, followUpQueue, recentEstimates] = await Promise.all([
      getDashboardStats(businessId),
      getFollowUpQueue(businessId),
      getEstimates(businessId).then((estimates) => estimates.slice(0, 5)),
    ]);
  } catch (error) {
    return (
      <>
        <PageHeader title="Dashboard" description="Your estimate follow-up overview." />
        <AirtableErrorState message={error instanceof Error ? error.message : "Unknown error"} />
      </>
    );
  }

  return (
    <>
      <PageHeader
        title="Dashboard"
        description="Your estimate follow-up overview."
        action={
          <Button variant="outline" render={<Link href="/analytics" />}>
            <BarChart3 className="size-4" />
            View analytics
          </Button>
        }
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Total Estimates" value={String(stats.totalEstimates)} icon={FileText} />
        <StatCard
          label="Pending Follow-ups"
          value={String(stats.pendingFollowUps)}
          icon={Clock}
          tone="warning"
        />
        <StatCard
          label="At-Risk Revenue"
          value={formatCurrency(stats.atRiskRevenue)}
          icon={TrendingDown}
          tone="warning"
          hint={`${stats.atRiskCount} estimate${stats.atRiskCount === 1 ? "" : "s"} overdue for follow-up`}
        />
        <StatCard
          label="Booked Jobs"
          value={String(stats.bookedJobs)}
          icon={CheckCircle2}
          tone="success"
          hint={formatCurrency(stats.bookedRevenue)}
        />
      </div>

      <div className="mt-8 grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card className="py-5">
          <CardHeader className="flex flex-row items-center justify-between px-5">
            <CardTitle className="text-base">Follow-ups waiting</CardTitle>
            <Button variant="ghost" size="sm" render={<Link href="/follow-ups" />}>
              Review queue <ArrowRight className="size-3.5" />
            </Button>
          </CardHeader>
          <CardContent className="px-5">
            {followUpQueue.length === 0 ? (
              <p className="py-8 text-center text-sm text-muted-foreground">
                Nothing waiting on you — you&apos;re all caught up.
              </p>
            ) : (
              <ul className="divide-y divide-border">
                {followUpQueue.slice(0, 5).map((item) => (
                  <li key={item.id} className="py-3">
                    <div className="flex items-center justify-between gap-3">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium text-foreground">
                          {item.customerName}
                          {item.businessName && (
                            <span className="font-normal text-muted-foreground"> · {item.businessName}</span>
                          )}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {item.daysSinceSent} days since sent · {formatCurrency(item.estimateValue)}
                        </p>
                      </div>
                    </div>
                    <p className="mt-1.5 line-clamp-1 text-xs text-muted-foreground/80">{item.message}</p>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card className="py-5">
          <CardHeader className="flex flex-row items-center justify-between px-5">
            <CardTitle className="text-base">Recent estimates</CardTitle>
            <Button variant="ghost" size="sm" render={<Link href="/estimates" />}>
              View all <ArrowRight className="size-3.5" />
            </Button>
          </CardHeader>
          <CardContent className="px-5">
            {recentEstimates.length === 0 ? (
              <p className="py-8 text-center text-sm text-muted-foreground">
                No estimates yet.{" "}
                <Link href="/estimates/new" className="text-primary hover:underline">
                  Add your first one
                </Link>
                .
              </p>
            ) : (
              <ul className="divide-y divide-border">
                {recentEstimates.map((estimate) => (
                  <li key={estimate.id} className="flex items-center justify-between py-3">
                    <Link href={`/estimates/${estimate.id}`} className="min-w-0 hover:opacity-80">
                      <p className="truncate text-sm font-medium text-foreground">
                        {estimate.customerName}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {formatDate(estimate.dateSent)} · {formatCurrency(estimate.estimateValue)}
                      </p>
                    </Link>
                    <StatusBadge status={estimate.status} />
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>
    </>
  );
}
