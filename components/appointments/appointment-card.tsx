"use client";

import { useTransition } from "react";
import { toast } from "sonner";
import { X, UserX, Ban } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { AppointmentStatusBadge } from "@/components/appointments/appointment-status-badge";
import { ApproveAppointmentDialog } from "@/components/appointments/approve-appointment-dialog";
import { AppointmentReminderSection } from "@/components/appointments/appointment-reminder-section";
import { dismissAppointmentAction, flagNoShowAction, flagCancelledAction } from "@/app/appointments/actions";
import { formatCurrency } from "@/lib/date";
import type { Appointment } from "@/types";

export function AppointmentCard({ appointment, scheduledLabel }: { appointment: Appointment; scheduledLabel: string }) {
  const [isPending, startTransition] = useTransition();

  function dismiss() {
    startTransition(async () => {
      const result = await dismissAppointmentAction(appointment.id);
      if (result.ok) toast("Appointment request dismissed");
      else toast.error(result.error);
    });
  }

  function noShow() {
    startTransition(async () => {
      const result = await flagNoShowAction(appointment.id);
      if (result.ok) toast("Marked as a no-show");
      else toast.error(result.error);
    });
  }

  function cancel() {
    startTransition(async () => {
      const result = await flagCancelledAction(appointment.id);
      if (result.ok) toast("Appointment cancelled");
      else toast.error(result.error);
    });
  }

  return (
    <Card className="py-4">
      <CardContent className="px-5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <span className="text-sm font-semibold text-foreground">{appointment.customerName}</span>
            {appointment.serviceType && (
              <span className="ml-1.5 text-sm font-normal text-muted-foreground">· {appointment.serviceType}</span>
            )}
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground">{scheduledLabel}</span>
            <AppointmentStatusBadge status={appointment.status} />
          </div>
        </div>

        <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
          <span>{appointment.customerEmail}</span>
          {appointment.customerPhone && <span>{appointment.customerPhone}</span>}
          {appointment.price != null && <span>{formatCurrency(appointment.price)}</span>}
          {appointment.location && <span>{appointment.location}</span>}
        </div>

        {appointment.sourceMessage && appointment.status === "requested" && (
          <p className="mt-3 text-sm text-foreground/90">&ldquo;{appointment.sourceMessage}&rdquo;</p>
        )}

        {appointment.status === "requested" && (
          <div className="mt-4 flex gap-2">
            <ApproveAppointmentDialog appointment={appointment} />
            <Button size="sm" variant="ghost" onClick={dismiss} disabled={isPending}>
              <X className="size-3.5" />
              Dismiss
            </Button>
          </div>
        )}

        {appointment.status === "approved" && (
          <>
            <div className="mt-4 flex gap-2">
              <Button size="sm" variant="outline" onClick={noShow} disabled={isPending}>
                <UserX className="size-3.5" />
                Mark no-show
              </Button>
              <Button size="sm" variant="ghost" onClick={cancel} disabled={isPending}>
                <Ban className="size-3.5" />
                Cancel
              </Button>
            </div>
            <AppointmentReminderSection appointment={appointment} />
          </>
        )}
      </CardContent>
    </Card>
  );
}
