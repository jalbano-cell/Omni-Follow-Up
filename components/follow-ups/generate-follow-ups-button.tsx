"use client";

import { useTransition } from "react";
import { toast } from "sonner";
import { RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { generateFollowUpsAction } from "@/app/follow-ups/actions";

export function GenerateFollowUpsButton() {
  const [isPending, startTransition] = useTransition();

  function handleClick() {
    startTransition(async () => {
      const count = await generateFollowUpsAction();
      toast.success(count === 0 ? "Nothing new is due" : `Drafted ${count} follow-up${count === 1 ? "" : "s"}`);
    });
  }

  return (
    <Button variant="outline" onClick={handleClick} disabled={isPending}>
      <RefreshCw className={`size-4 ${isPending ? "animate-spin" : ""}`} />
      Check for due follow-ups
    </Button>
  );
}
