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
}: {
  lead: Lead;
  showView?: boolean;
  /** Hides "Convert to Estimate" for a workspace the agency has restricted to productMode "appointments_only" — see lib/session.ts's requireEstimatesEnabled. */
  estimatesEnabled?: boolean;
}) {
  const [isPending, startTransition] = useTransition();

  function archive() {
    startTransition(async () => {
      await archiveLeadAction(lead.id);
      toast.success("Lead archived");
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
