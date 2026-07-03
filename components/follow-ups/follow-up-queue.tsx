import Link from "next/link";
import { FollowUpCard } from "@/components/follow-ups/follow-up-card";
import type { FollowUpQueueItem } from "@/types";

export function FollowUpQueue({ items }: { items: FollowUpQueueItem[] }) {
  if (items.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-border py-20 text-center">
        <p className="text-sm text-muted-foreground">
          No follow-ups pending review.{" "}
          <Link href="/estimates" className="text-primary hover:underline">
            View estimates
          </Link>{" "}
          or check for newly due ones above.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      {items.map((item) => (
        <FollowUpCard key={item.id} item={item} />
      ))}
    </div>
  );
}
