import { formatCurrency } from "@/lib/date";
import { STATUS_BADGE_VARIANT } from "@/config/constants";
import type { FollowUpFunnelItem } from "@/services/analytics";

const BAR_COLOR: Record<string, string> = {
  secondary: "bg-muted-foreground/40",
  warning: "bg-warning",
  success: "bg-success",
  destructive: "bg-destructive",
};

export function FunnelChart({ items }: { items: FollowUpFunnelItem[] }) {
  const maxCount = Math.max(1, ...items.map((i) => i.count));

  return (
    <div className="flex flex-col gap-4">
      {items.map((item) => {
        const widthPct = (item.count / maxCount) * 100;
        const barColor = BAR_COLOR[STATUS_BADGE_VARIANT[item.status]] ?? "bg-muted-foreground/40";
        return (
          <div key={item.status}>
            <div className="mb-1.5 flex items-center justify-between text-sm">
              <span className="font-medium text-foreground">{item.status}</span>
              <span className="text-muted-foreground">
                {item.count} · {formatCurrency(item.value)}
              </span>
            </div>
            <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
              <div
                className={`h-full rounded-full ${barColor}`}
                style={{ width: `${Math.max(widthPct, item.count > 0 ? 2 : 0)}%` }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}
