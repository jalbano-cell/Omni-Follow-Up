"use client";

import { useTransition } from "react";
import { toast } from "sonner";
import { RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { syncRepliesAction } from "@/app/replies/actions";

export function SyncRepliesButton() {
  const [isPending, startTransition] = useTransition();

  function handleClick() {
    startTransition(async () => {
      const result = await syncRepliesAction();
      if (result.errors.length > 0) {
        toast.error(`Checked, but hit an error: ${result.errors[0]}`);
      } else {
        toast.success(result.created === 0 ? "No new replies" : `Found ${result.created} new repl${result.created === 1 ? "y" : "ies"}`);
      }
    });
  }

  return (
    <Button variant="outline" onClick={handleClick} disabled={isPending}>
      <RefreshCw className={`size-4 ${isPending ? "animate-spin" : ""}`} />
      Check for new replies
    </Button>
  );
}
