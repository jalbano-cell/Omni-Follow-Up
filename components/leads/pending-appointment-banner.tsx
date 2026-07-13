"use client";

import { useTransition } from "react";
import { toast } from "sonner";
import { CalendarClock, Check, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { approveLeadAppointmentAction, dismissLeadAppointmentAction } from "@/app/leads/actions";

/** Shown on the Lead Details page when the customer requested a specific date/time and it's still awaiting owner approval — see services/appointmentService.ts's "requested" Appointment status. */
export function PendingAppointmentBanner({ appointmentId, leadId, label }: { appointmentId: string; leadId: string; label: string }) {
  const [isPending, startTransition] = useTransition();

  function approve() {
    startTransition(async () => {
      const result = await approveLeadAppointmentAction(appointmentId, leadId);
      if (result.ok) {
        toast.success("Appointment approved and confirmation sent");
      } else {
        toast.error(result.error);
      }
    });
  }

  function dismiss() {
    startTransition(async () => {
      await dismissLeadAppointmentAction(appointmentId, leadId);
      toast("Appointment request dismissed");
    });
  }

  return (
    <div className="mb-6 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-warning/40 bg-warning/10 px-4 py-3">
      <div className="flex items-center gap-2.5">
        <CalendarClock className="size-4 shrink-0 text-warning-foreground" />
        <p className="text-sm text-foreground">
          Customer requested an appointment for <span className="font-medium">{label}</span>.
        </p>
      </div>
      <div className="flex gap-2">
        <Button size="sm" onClick={approve} disabled={isPending}>
          <Check className="size-3.5" />
          Approve booking
        </Button>
        <Button size="sm" variant="ghost" onClick={dismiss} disabled={isPending}>
          <X className="size-3.5" />
          Dismiss
        </Button>
      </div>
    </div>
  );
}
