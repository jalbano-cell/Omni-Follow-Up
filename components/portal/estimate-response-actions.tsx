"use client";

import { useState, useTransition } from "react";
import { CheckCircle2, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { respondToEstimateAction } from "@/app/e/actions";
import type { EstimateStatus } from "@/types";

export function EstimateResponseActions({ token, status }: { token: string; status: EstimateStatus }) {
  const [isPending, startTransition] = useTransition();
  const [result, setResult] = useState<"Booked" | "Lost" | null>(
    status === "Booked" || status === "Lost" ? status : null
  );
  const [error, setError] = useState<string | null>(null);

  function respond(decision: "Booked" | "Lost") {
    startTransition(async () => {
      const outcome = await respondToEstimateAction(token, decision);
      if (outcome.ok) {
        setResult(decision);
        setError(null);
      } else {
        setError(outcome.error);
      }
    });
  }

  if (result === "Booked") {
    return (
      <div className="flex items-center gap-2 text-sm text-success">
        <CheckCircle2 className="size-4" />
        You accepted this estimate — we&apos;ll be in touch.
      </div>
    );
  }

  if (result === "Lost") {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <XCircle className="size-4" />
        You declined this estimate.
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex gap-2">
        <Button className="flex-1" onClick={() => respond("Booked")} disabled={isPending}>
          <CheckCircle2 className="size-3.5" />
          Accept estimate
        </Button>
        <Button className="flex-1" variant="outline" onClick={() => respond("Lost")} disabled={isPending}>
          <XCircle className="size-3.5" />
          Decline
        </Button>
      </div>
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  );
}
