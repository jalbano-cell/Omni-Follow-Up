import Link from "next/link";
import {
  FileText,
  Clock,
  TrendingDown,
  CheckCircle2,
  ArrowRight,
  BarChart3,
  Inbox,
  CalendarClock,
  CalendarCheck,
  PieChart,
  Activity,
  MessageSquarePlus,
} from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { DatabaseErrorState } from "@/components/layout/database-error-state";
import { StatCard } from "@/components/dashboard/stat-card";
import { StatusBadge } from "@/components/estimates/status-badge";
import { NewLeadsCard } from "@/components/dashboard/new-leads-card";
import { FunnelChart } from "@/components/analytics/funnel-chart";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  getDashboardStats,
  getUpcomingFollowUps,
  getRecentActivity,
  getFollowUpFunnel,
  type DashboardStats,
} from "@/services/analytics";
import { getFollowUpQueue } from "@/services/followupEngine";
import { getReplyInbox } from "@/services/replyMatcher";
import { getEstimates, getLeads, getAppointments } from "@/services/db";
import { getEffectiveTimezone } from "@/services/business";
import { formatCurrency, formatDate, formatZonedDateTime } from "@/lib/date";
import { requireOnboardedBusiness } from "@/lib/session";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";

const EMPTY_STATS: DashboardStats = {
  totalEstimates: 0,
  pendingFollowUps: 0,
  atRiskRevenue: 0,
  atRiskCount: 0,
  bookedJobs: 0,
  bookedRevenue: 0,
};

export default async function DashboardPage() {
  const business = await requireOnboardedBusiness();
  const businessId = business.id;
  // Leads and Recent Activity are universal (see CLAUDE.md's Appointments
  // section) — everything else on this page belongs to one surface or the
  // other and is skipped (both the fetch and the section) when an admin has
  // restricted this workspace to just one via /admin.
  const showEstimates = business.productMode !== "appointments_only";
  const showAppointments = business.productMode !== "estimates_only";

  let stats;
  let followUpQueue;
  let recentEstimates;
  let unreadReplies;
  let upcomingFollowUps;
  let funnel;
  let recentActivity;
  let newLeads;
  let pendingAppointments;

  try {
    [stats, followUpQueue, recentEstimates, unreadReplies, upcomingFollowUps, funnel, recentActivity, newLeads, pendingAppointments] =
      await Promise.all([
        showEstimates ? getDashboardStats(businessId) : Promise.resolve(EMPTY_STATS),
        showEstimates ? getFollowUpQueue(businessId) : Promise.resolve([]),
        showEstimates ? getEstimates(businessId).then((estimates) => estimates.slice(0, 5)) : Promise.resolve([]),
        showEstimates ? getReplyInbox(businessId).then((replies) => replies.filter((r) => !r.isRead)) : Promise.resolve([]),
        showEstimates ? getUpcomingFollowUps(businessId) : Promise.resolve([]),
        showEstimates ? getFollowUpFunnel(businessId) : Promise.resolve([]),
        getRecentActivity(businessId, 8),
        getLeads(businessId).then((leads) => leads.filter((l) => l.status === "New Inquiry")),
        showAppointments
          ? getAppointments(businessId).then((appointments) => appointments.filter((a) => a.status === "requested"))
          : Promise.resolve([]),
      ]);
  } catch (error) {
    return (
      <>
        <PageHeader title="Dashboard" description="Your estimate follow-up overview." />
        <DatabaseErrorState message={error instanceof Error ? error.message : "Unknown error"} />
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

      {(newLeads.length > 0 || pendingAppointments.length > 0) && (
        <div className="mb-6 flex flex-col gap-3">
          {newLeads.length > 0 && (
            <Link
              href="/leads"
              className="flex items-center gap-3 rounded-lg border border-warning/30 bg-warning/10 px-4 py-3 transition-colors hover:bg-warning/15"
            >
              <MessageSquarePlus className="size-4.5 shrink-0 text-warning" strokeWidth={2} />
              <p className="text-sm text-foreground">
                <span className="font-medium">
                  {newLeads.length} new {newLeads.length === 1 ? "lead" : "leads"}
                </span>{" "}
                waiting for review.
              </p>
              <ArrowRight className="ml-auto size-3.5 shrink-0 text-muted-foreground" />
            </Link>
          )}
          {pendingAppointments.length > 0 && (
            <Link
              href="/appointments"
              className="flex items-center gap-3 rounded-lg border border-warning/30 bg-warning/10 px-4 py-3 transition-colors hover:bg-warning/15"
            >
              <CalendarCheck className="size-4.5 shrink-0 text-warning" strokeWidth={2} />
              <p className="text-sm text-foreground">
                <span className="font-medium">
                  {pendingAppointments.length} appointment{pendingAppointments.length === 1 ? "" : "s"}
                </span>{" "}
                waiting for approval.
              </p>
              <ArrowRight className="ml-auto size-3.5 shrink-0 text-muted-foreground" />
            </Link>
          )}
        </div>
      )}

      {showEstimates && (
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
      )}

      {showEstimates && (
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
      )}

      <div className="mt-6">
        <NewLeadsCard leads={newLeads} estimatesEnabled={showEstimates} />
      </div>

      {showAppointments && (
      <div className="mt-6">
        <Card className="py-5">
          <CardHeader className="flex flex-row items-center justify-between px-5">
            <CardTitle className="flex items-center gap-2 text-base">
              <CalendarCheck className="size-4 text-muted-foreground" />
              Pending appointment requests
            </CardTitle>
            <Button variant="ghost" size="sm" render={<Link href="/appointments" />}>
              View all <ArrowRight className="size-3.5" />
            </Button>
          </CardHeader>
          <CardContent className="px-5">
            {pendingAppointments.length === 0 ? (
              <p className="py-8 text-center text-sm text-muted-foreground">
                No appointment requests waiting — they show up here as customers book through your website.
              </p>
            ) : (
              <ul className="divide-y divide-border">
                {pendingAppointments.slice(0, 5).map((appointment) => (
                  <li key={appointment.id} className="flex items-center justify-between py-3">
                    <Link href="/appointments" className="min-w-0 hover:opacity-80">
                      <p className="truncate text-sm font-medium text-foreground">
                        {appointment.customerName}
                        {appointment.serviceType && (
                          <span className="font-normal text-muted-foreground"> · {appointment.serviceType}</span>
                        )}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {formatZonedDateTime(new Date(appointment.scheduledStart), getEffectiveTimezone(business))}
                      </p>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>
      )}

      {showEstimates && (
      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card className="py-5">
          <CardHeader className="flex flex-row items-center justify-between px-5">
            <CardTitle className="flex items-center gap-2 text-base">
              <Inbox className="size-4 text-muted-foreground" />
              New replies
            </CardTitle>
            <Button variant="ghost" size="sm" render={<Link href="/replies" />}>
              View inbox <ArrowRight className="size-3.5" />
            </Button>
          </CardHeader>
          <CardContent className="px-5">
            {unreadReplies.length === 0 ? (
              <p className="py-8 text-center text-sm text-muted-foreground">No unread replies.</p>
            ) : (
              <ul className="divide-y divide-border">
                {unreadReplies.slice(0, 5).map((reply) => (
                  <li key={reply.id} className="py-3">
                    <p className="truncate text-sm font-medium text-foreground">{reply.customerName}</p>
                    <p className="mt-0.5 line-clamp-1 text-xs text-muted-foreground">{reply.snippet}</p>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card className="py-5">
          <CardHeader className="flex flex-row items-center justify-between px-5">
            <CardTitle className="flex items-center gap-2 text-base">
              <CalendarClock className="size-4 text-muted-foreground" />
              Upcoming follow-ups
            </CardTitle>
          </CardHeader>
          <CardContent className="px-5">
            {upcomingFollowUps.length === 0 ? (
              <p className="py-8 text-center text-sm text-muted-foreground">Nothing scheduled ahead yet.</p>
            ) : (
              <ul className="divide-y divide-border">
                {upcomingFollowUps.map((item) => (
                  <li key={item.id} className="flex items-center justify-between py-3">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-foreground">{item.customerName}</p>
                      <p className="text-xs text-muted-foreground">
                        {item.serviceType} · {formatCurrency(item.estimateValue)}
                      </p>
                    </div>
                    <span className="shrink-0 text-xs text-muted-foreground">
                      {formatDate(item.nextFollowUpDate)}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>
      )}

      <div className={cn("mt-6 grid grid-cols-1 gap-6", showEstimates && "lg:grid-cols-2")}>
        {showEstimates && (
        <Card className="py-5">
          <CardHeader className="px-5">
            <CardTitle className="flex items-center gap-2 text-base">
              <PieChart className="size-4 text-muted-foreground" />
              Estimate pipeline
            </CardTitle>
          </CardHeader>
          <CardContent className="px-5">
            <FunnelChart items={funnel} />
          </CardContent>
        </Card>
        )}

        <Card className="py-5">
          <CardHeader className="px-5">
            <CardTitle className="flex items-center gap-2 text-base">
              <Activity className="size-4 text-muted-foreground" />
              Recent activity
            </CardTitle>
          </CardHeader>
          <CardContent className="px-5">
            {recentActivity.length === 0 ? (
              <p className="py-8 text-center text-sm text-muted-foreground">No activity yet.</p>
            ) : (
              <ul className="divide-y divide-border">
                {recentActivity.map((item) => (
                  <li key={item.id} className="flex items-center justify-between py-3">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-foreground">{item.customerName}</p>
                      <p className="text-xs text-muted-foreground">{item.description}</p>
                    </div>
                    <span className="shrink-0 text-xs text-muted-foreground">{formatDate(item.timestamp)}</span>
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
