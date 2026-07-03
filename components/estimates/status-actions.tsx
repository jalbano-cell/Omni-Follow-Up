"use client";

import { useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { updateEstimateStatusAction } from "@/app/estimates/actions";
import { ESTIMATE_STATUSES } from "@/config/constants";
import type { EstimateStatus } from "@/types";

export function StatusActions({
  estimateId,
  currentStatus,
}: {
  estimateId: string;
  currentStatus: EstimateStatus;
}) {
  const [isPending, startTransition] = useTransition();

  function setStatus(status: EstimateStatus) {
    startTransition(async () => {
      await updateEstimateStatusAction(estimateId, status);
      toast.success(`Marked as ${status}`);
    });
  }

  return (
    <div className="flex flex-col gap-1.5">
      {ESTIMATE_STATUSES.map((status) => (
        <Button
          key={status}
          variant={status === currentStatus ? "default" : "outline"}
          size="sm"
          disabled={isPending || status === currentStatus}
          onClick={() => setStatus(status)}
          className="justify-start"
        >
          {status}
        </Button>
      ))}
    </div>
  );
}
