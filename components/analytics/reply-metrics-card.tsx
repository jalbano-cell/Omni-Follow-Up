import type { ReplyMetrics } from "@/services/analytics";

export function ReplyMetricsCard({ metrics }: { metrics: ReplyMetrics }) {
  return (
    <div className="grid grid-cols-2 gap-4">
      <div>
        <p className="text-2xl font-semibold text-foreground">{metrics.replyRate}%</p>
        <p className="mt-1 text-xs text-muted-foreground">
          Reply rate ({metrics.estimatesWithReply} of {metrics.estimatesWithThread} sent estimates)
        </p>
      </div>
      <div>
        <p className="text-2xl font-semibold text-foreground">
          {metrics.avgDaysToFirstReply ?? "—"}
          {metrics.avgDaysToFirstReply !== null && <span className="text-base font-normal text-muted-foreground"> days</span>}
        </p>
        <p className="mt-1 text-xs text-muted-foreground">Average time to first reply</p>
      </div>
    </div>
  );
}
