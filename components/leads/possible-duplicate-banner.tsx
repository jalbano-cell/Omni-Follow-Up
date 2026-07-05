"use client";

import { useTransition } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { Copy, Check, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { mergeDuplicateLeadAction, dismissDuplicateLeadAction } from "@/app/leads/actions";
import type { Lead } from "@/types";

/** Shown on the Lead Details page when this lead was flagged as a likely re-submission of an earlier one — see services/duplicateLeadDetection.ts. Never auto-resolved; the owner explicitly merges (archives this lead as a duplicate) or dismisses (confirms these are separate leads). */
export function PossibleDuplicateBanner({ leadId, original }: { leadId: string; original: Lead }) {
  const [isPending, startTransition] = useTransition();

  function merge() {
    startTransition(async () => {
      const result = await mergeDuplicateLeadAction(leadId);
      if (result.ok) {
        toast.success(`Merged as a duplicate of ${original.leadId}`);
      } else {
        toast.error(result.error);
      }
    });
  }

  function dismiss() {
    startTransition(async () => {
      await dismissDuplicateLeadAction(leadId);
      toast("Marked as not a duplicate");
    });
  }

  return (
    <div className="mb-6 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-warning/40 bg-warning/10 px-4 py-3">
      <div className="flex items-center gap-2.5">
        <Copy className="size-4 shrink-0 text-warning-foreground" />
        <p className="text-sm text-foreground">
          Possible duplicate of{" "}
          <Link href={`/leads/${original.id}`} className="font-medium underline underline-offset-2">
            {original.leadId} ({original.name})
          </Link>
          .
        </p>
      </div>
      <div className="flex gap-2">
        <Button size="sm" onClick={merge} disabled={isPending}>
          <Check className="size-3.5" />
          Merge (archive this one)
        </Button>
        <Button size="sm" variant="ghost" onClick={dismiss} disabled={isPending}>
          <X className="size-3.5" />
          Not a duplicate
        </Button>
      </div>
    </div>
  );
}
