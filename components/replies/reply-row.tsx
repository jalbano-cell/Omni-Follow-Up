"use client";

import { useTransition } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { Check } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { markReplyReadAction } from "@/app/replies/actions";
import { formatDate } from "@/lib/date";
import type { ReplyInboxItem } from "@/types";

export function ReplyRow({ reply }: { reply: ReplyInboxItem }) {
  const [isPending, startTransition] = useTransition();

  function markRead() {
    startTransition(async () => {
      await markReplyReadAction(reply.id);
      toast.success("Marked as read");
    });
  }

  return (
    <Card className={`py-4 ${reply.isRead ? "" : "border-primary/40"}`}>
      <CardContent className="px-5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <Link href={`/estimates/${reply.estimateId}`} className="hover:underline">
            <span className="text-sm font-semibold text-foreground">{reply.customerName}</span>
            {reply.businessName && (
              <span className="ml-1.5 text-sm font-normal text-muted-foreground">· {reply.businessName}</span>
            )}
          </Link>
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground">{formatDate(reply.receivedAt)}</span>
            {!reply.isRead && (
              <Badge variant="warning" className="ml-auto">
                New
              </Badge>
            )}
          </div>
        </div>

        <p className="mt-2 text-xs text-muted-foreground">{reply.fromEmail}</p>
        {reply.subject && <p className="mt-1 text-sm font-medium text-foreground">{reply.subject}</p>}
        <p className="mt-2 line-clamp-3 text-sm text-foreground/90 whitespace-pre-wrap">
          {reply.bodyText || reply.snippet}
        </p>

        {!reply.isRead && (
          <div className="mt-4 flex gap-2">
            <Button size="sm" variant="outline" onClick={markRead} disabled={isPending}>
              <Check className="size-3.5" />
              Mark read
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
