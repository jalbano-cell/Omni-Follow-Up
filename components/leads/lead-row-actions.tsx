"use client";

import { useTransition } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { Eye, ArrowRightCircle, Archive, CalendarCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { archiveLeadAction, approveLeadAppointmentAction } from "@/app/leads/actions";
import type { Lead } from "@/types";

export function LeadRowActions({
  lead,
  showView = true,
  estimatesEnabled = true,
  pendingAppointmentId,
  onArchived,
  onAppointmentApproved,
}: {
  lead: Lead;
  showView?: boolean;
  /** Hides "Convert to Estimate" for a workspace the agency has restricted to productMode "appointments_only" — see lib/session.ts's requireEstimatesEnabled. */
  estimatesEnabled?: boolean;
  /**
   * Id of this lead's still-`requested` Appointment, if it has one — shows
   * an "Approve booking" action right in the row so an owner working from
   * the Leads list (or the Dashboard's New Leads card) doesn't have to open
   * the lead or go to /appointments just to confirm a booking request. Omit
   * (or pass null/undefined) to hide it — the Lead Details page passes
   * nothing here since components/leads/pending-appointment-banner.tsx
   * already covers approval there; showing it twice on one page would be
   * redundant.
   */
  pendingAppointmentId?: string | null;
  /**
   * Called immediately after a successful archive, before the server's own
   * revalidatePath-driven refresh lands — lets a list (lead-table.tsx, the
   * Dashboard's New Leads card) update its own rendered rows right away
   * instead of waiting on a full round-trip, so a slow network doesn't read
   * as "the button doesn't work" and invite a flurry of repeat clicks on
   * other rows.
   */
  onArchived?: () => void;
  /** Same optimistic-update idea as onArchived, for the "Approve booking" action below. */
  onAppointmentApproved?: () => void;
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

  function approveAppointment() {
    if (!pendingAppointmentId) return;
    startTransition(async () => {
      try {
        const result = await approveLeadAppointmentAction(pendingAppointmentId, lead.id);
        if (result.ok) {
          onAppointmentApproved?.();
          toast.success("Appointment approved and confirmation sent");
        } else {
          toast.error(result.error);
        }
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "Failed to approve appointment");
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
      {pendingAppointmentId && (
        <Button size="sm" onClick={approveAppointment} disabled={isPending}>
          <CalendarCheck className="size-3.5" />
          Approve booking
        </Button>
      )}
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
