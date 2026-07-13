"use client";

import { useTransition } from "react";
import { toast } from "sonner";
import { RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { runLeadClassificationNowAction } from "@/app/admin/actions";

/** Manual trigger for tuning the classifier prompt against real inbox messages without waiting for the daily cron — see the action's doc comment for what it actually runs. */
export function ClassifyNowButton() {
  const [isPending, startTransition] = useTransition();

  function run() {
    startTransition(async () => {
      const result = await runLeadClassificationNowAction();
      if (result.error) {
        toast.error(result.error);
      } else if (result.summary) {
        toast.success(result.summary);
      }
    });
  }

  return (
    <Button size="sm" variant="outline" onClick={run} disabled={isPending}>
      <RefreshCw className={`size-3.5 ${isPending ? "animate-spin" : ""}`} />
      {isPending ? "Classifying…" : "Classify now"}
    </Button>
  );
}
