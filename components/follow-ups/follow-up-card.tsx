"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { Check, Pencil, X } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  approveFollowUpAction,
  editFollowUpMessageAction,
  skipFollowUpAction,
} from "@/app/follow-ups/actions";
import { formatCurrency } from "@/lib/date";
import type { FollowUpQueueItem } from "@/types";

export function FollowUpCard({ item }: { item: FollowUpQueueItem }) {
  const [isPending, startTransition] = useTransition();
  const [isEditing, setIsEditing] = useState(false);
  const [message, setMessage] = useState(item.message);

  function approve() {
    startTransition(async () => {
      await approveFollowUpAction(item.id);
      toast.success("Approved — ready to send");
    });
  }

  function skip() {
    startTransition(async () => {
      await skipFollowUpAction(item.id);
      toast("Skipped");
    });
  }

  function saveEdit() {
    startTransition(async () => {
      await editFollowUpMessageAction(item.id, message);
      setIsEditing(false);
      toast.success("Message updated");
    });
  }

  return (
    <Card className="py-4">
      <CardContent className="px-5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <Link href={`/estimates/${item.estimateId}`} className="hover:underline">
            <span className="text-sm font-semibold text-foreground">{item.customerName}</span>
            {item.businessName && (
              <span className="ml-1.5 text-sm font-normal text-muted-foreground">· {item.businessName}</span>
            )}
          </Link>
          <span className="text-xs text-muted-foreground">
            {formatCurrency(item.estimateValue)} · {item.daysSinceSent} days since sent
          </span>
        </div>

        {isEditing ? (
          <Textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            rows={4}
            className="mt-3"
            autoFocus
          />
        ) : (
          <p className="mt-3 text-sm text-foreground/90">{item.message}</p>
        )}

        <div className="mt-4 flex gap-2">
          {isEditing ? (
            <>
              <Button size="sm" onClick={saveEdit} disabled={isPending}>
                <Check className="size-3.5" />
                Save
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  setMessage(item.message);
                  setIsEditing(false);
                }}
                disabled={isPending}
              >
                Cancel
              </Button>
            </>
          ) : (
            <>
              <Button size="sm" onClick={approve} disabled={isPending}>
                <Check className="size-3.5" />
                Approve
              </Button>
              <Button size="sm" variant="outline" onClick={() => setIsEditing(true)} disabled={isPending}>
                <Pencil className="size-3.5" />
                Edit
              </Button>
              <Button size="sm" variant="ghost" onClick={skip} disabled={isPending}>
                <X className="size-3.5" />
                Skip
              </Button>
            </>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
