"use client";

import { useTransition } from "react";
import { toast } from "sonner";
import { Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { markReplyReadAction } from "@/app/replies/actions";
import { formatDate } from "@/lib/date";
import type { Reply } from "@/types";

export function ReplyHistoryItem({ reply }: { reply: Reply }) {
  const [isPending, startTransition] = useTransition();

  function markRead() {
    startTransition(async () => {
      await markReplyReadAction(reply.id);
      toast.success("Marked as read");
    });
  }

  return (
    <li className="py-3">
      <div className="flex items-center justify-between gap-4">
        <span className="text-xs font-medium text-muted-foreground">
          {reply.fromEmail} · {formatDate(reply.receivedAt)}
        </span>
        {!reply.isRead && (
          <Badge variant="warning" className="ml-auto">
            New
          </Badge>
        )}
      </div>
      {reply.subject && <p className="mt-1 text-sm font-medium text-foreground">{reply.subject}</p>}
      <p className="mt-1 text-sm text-foreground whitespace-pre-wrap">{reply.bodyText || reply.snippet}</p>
      {!reply.isRead && (
        <Button size="sm" variant="outline" className="mt-2" onClick={markRead} disabled={isPending}>
          <Check className="size-3.5" />
          Mark read
        </Button>
      )}
    </li>
  );
}
