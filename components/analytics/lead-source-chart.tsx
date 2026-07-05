import type { LeadSourceBreakdownItem } from "@/services/analytics";

export function LeadSourceChart({ items }: { items: LeadSourceBreakdownItem[] }) {
  const maxCount = Math.max(1, ...items.map((i) => i.count));

  return (
    <div className="flex flex-col gap-4">
      {items.map((item) => {
        const widthPct = (item.count / maxCount) * 100;
        return (
          <div key={item.source}>
            <div className="mb-1.5 flex items-center justify-between text-sm">
              <span className="font-medium text-foreground">{item.source}</span>
              <span className="text-muted-foreground">{item.count}</span>
            </div>
            <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
              <div
                className="h-full rounded-full bg-primary/70"
                style={{ width: `${Math.max(widthPct, item.count > 0 ? 2 : 0)}%` }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}
