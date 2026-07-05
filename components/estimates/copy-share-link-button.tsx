"use client";

import { useTransition } from "react";
import { toast } from "sonner";
import { Link2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { getEstimateShareUrlAction } from "@/app/estimates/actions";

export function CopyShareLinkButton({ estimateId }: { estimateId: string }) {
  const [isPending, startTransition] = useTransition();

  function copyLink() {
    startTransition(async () => {
      const url = await getEstimateShareUrlAction(estimateId);
      await navigator.clipboard.writeText(url);
      toast.success("Customer link copied");
    });
  }

  return (
    <Button size="sm" variant="outline" onClick={copyLink} disabled={isPending}>
      <Link2 className="size-3.5" />
      Copy customer link
    </Button>
  );
}
