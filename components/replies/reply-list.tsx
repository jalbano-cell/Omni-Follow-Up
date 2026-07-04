import { ReplyRow } from "@/components/replies/reply-row";
import type { ReplyInboxItem } from "@/types";

export function ReplyList({ items }: { items: ReplyInboxItem[] }) {
  if (items.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-border py-20 text-center">
        <p className="text-sm text-muted-foreground">
          No replies yet. Once a customer replies to a follow-up thread, it&apos;ll show up here.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      {items.map((item) => (
        <ReplyRow key={item.id} reply={item} />
      ))}
    </div>
  );
}
