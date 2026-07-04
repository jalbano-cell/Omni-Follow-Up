import { PageHeader } from "@/components/layout/page-header";
import { AirtableErrorState } from "@/components/layout/airtable-error-state";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { FunnelChart } from "@/components/analytics/funnel-chart";
import { RevenueTrendChart } from "@/components/analytics/revenue-trend-chart";
import { ReplyMetricsCard } from "@/components/analytics/reply-metrics-card";
import { getFollowUpFunnel, getRevenueTrend, getReplyMetrics } from "@/services/analytics";
import { requireOnboardedBusiness } from "@/lib/session";

export const dynamic = "force-dynamic";

export default async function AnalyticsPage() {
  const { id: businessId } = await requireOnboardedBusiness();

  let funnel;
  let trend;
  let replyMetrics;
  try {
    [funnel, trend, replyMetrics] = await Promise.all([
      getFollowUpFunnel(businessId),
      getRevenueTrend(businessId),
      getReplyMetrics(businessId),
    ]);
  } catch (error) {
    return (
      <>
        <PageHeader title="Analytics" description="Pipeline health and revenue trend." />
        <AirtableErrorState message={error instanceof Error ? error.message : "Unknown error"} />
      </>
    );
  }

  return (
    <>
      <PageHeader title="Analytics" description="Pipeline health and revenue trend." />

      <Card className="py-5">
        <CardHeader className="px-5">
          <CardTitle className="text-base">Revenue trend</CardTitle>
          <CardDescription>Booked revenue by month, last 6 months.</CardDescription>
        </CardHeader>
        <CardContent className="px-5">
          <RevenueTrendChart points={trend} />
        </CardContent>
      </Card>

      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-3">
        <Card className="py-5 lg:col-span-2">
          <CardHeader className="px-5">
            <CardTitle className="text-base">Pipeline funnel</CardTitle>
            <CardDescription>Every estimate, by current stage.</CardDescription>
          </CardHeader>
          <CardContent className="px-5">
            <FunnelChart items={funnel} />
          </CardContent>
        </Card>

        <Card className="py-5">
          <CardHeader className="px-5">
            <CardTitle className="text-base">Reply engagement</CardTitle>
            <CardDescription>Based on replies in the same email thread.</CardDescription>
          </CardHeader>
          <CardContent className="px-5">
            <ReplyMetricsCard metrics={replyMetrics} />
          </CardContent>
        </Card>
      </div>
    </>
  );
}
