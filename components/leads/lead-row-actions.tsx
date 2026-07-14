"use client";

import { useTransition } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { Eye, ArrowRightCircle, Archive } from "lucide-react";
import { Button } from "@/components/ui/button";
import { LeadAssignDialog } from "@/components/leads/lead-assign-dialog";
import { archiveLeadAction } from "@/app/leads/actions";
import type { Lead } from "@/types";

export function LeadRowActions({
  lead,
  showView = true,
  estimatesEnabled = true,
  onArchived,
}: {
  lead: Lead;
  showView?: boolean;
  /** Hides "Convert to Estimate" for a workspace the agency has restricted to productMode "appointments_only" — see lib/session.ts's requireEstimatesEnabled. */
  estimatesEnabled?: boolean;
  /**
   * Called immediately after a successful archive, before the server's own
   * revalidatePath-driven refresh lands — lets a list (lead-table.tsx, the
   * Dashboard's New Leads card) update its own rendered rows right away
   * instead of waiting on a full round-trip, so a slow network doesn't read
   * as "the button doesn't work" and invite a flurry of repeat clicks on
   * other rows.
   */
  onArchived?: () => void;
}) {
  const [isPending, startTransition] = useTransition();

  function archive() {
    startTransition(async () => {
      try {
        await archiveLeadAction(lead.id);
        onArchived?.();
        toast.success("Lead archived");
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "Failed to archive lead");
      }
    });
  }

  return (
    <div className="flex flex-wrap items-center justify-end gap-1.5">
      {showView && (
        <Button variant="outline" size="sm" render={<Link href={`/leads/${lead.id}`} />}>
          <Eye className="size-3.5" />
          View
        </Button>
      )}
      <LeadAssignDialog leadId={lead.id} currentAssignee={lead.assignedTo} />
      {lead.status === "New Inquiry" && (
        <>
          {estimatesEnabled && (
            <Button variant="outline" size="sm" render={<Link href={`/estimates/new?fromLead=${lead.id}`} />}>
              <ArrowRightCircle className="size-3.5" />
              Convert to Estimate
            </Button>
          )}
          <Button variant="ghost" size="sm" onClick={archive} disabled={isPending}>
            <Archive className="size-3.5" />
            Archive
          </Button>
        </>
      )}
    </div>
  );
}
