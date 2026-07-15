"use client";

import { useEffect, useState, useTransition } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { ArrowRight, CalendarCheck, Check } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { approveAppointmentAction } from "@/app/appointments/actions";
import type { Appointment } from "@/types";

/**
 * The Dashboard's "Pending appointment requests" card — same optimistic
 * local-state pattern as components/dashboard/new-leads-card.tsx (an
 * approval only disappearing once the Server Component round-trips reads
 * as "the button doesn't work"). Adds a bare one-click "Approve" per row,
 * same shape as components/leads/lead-row-actions.tsx's "Approve booking" —
 * this card was the one place customer bookings surfaced with no
 * quick-approve action at all.
 */
export function PendingAppointmentsCard({
  appointments: appointmentsProp,
  scheduledLabels,
}: {
  appointments: Appointment[];
  /** Timezone-formatted scheduledStart label per appointment id, computed server-side (see app/page.tsx). */
  scheduledLabels: Record<string, string>;
}) {
  const [appointments, setAppointments] = useState(appointmentsProp);
  useEffect(() => setAppointments(appointmentsProp), [appointmentsProp]);
  const [isPending, startTransition] = useTransition();

  function approve(id: string) {
    startTransition(async () => {
      const result = await approveAppointmentAction(id, {});
      if (result.ok) {
        setAppointments((prev) => prev.filter((a) => a.id !== id));
        toast.success("Appointment approved and confirmation sent");
      } else {
        toast.error(result.error);
      }
    });
  }

  return (
    <Card className="py-5">
      <CardHeader className="flex flex-row items-center justify-between px-5">
        <CardTitle className="flex items-center gap-2 text-base">
          <CalendarCheck className="size-4 text-muted-foreground" />
          Pending appointment requests
        </CardTitle>
        <Button variant="ghost" size="sm" render={<Link href="/appointments" />}>
          View all <ArrowRight className="size-3.5" />
        </Button>
      </CardHeader>
      <CardContent className="px-5">
        {appointments.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">
            No appointment requests waiting — they show up here as customers book through your website.
          </p>
        ) : (
          <ul className="divide-y divide-border">
            {appointments.slice(0, 5).map((appointment) => (
              <li key={appointment.id} className="flex items-center justify-between gap-3 py-3">
                <Link href="/appointments" className="min-w-0 hover:opacity-80">
                  <p className="truncate text-sm font-medium text-foreground">
                    {appointment.customerName}
                    {appointment.serviceType && (
                      <span className="font-normal text-muted-foreground"> · {appointment.serviceType}</span>
                    )}
                  </p>
                  <p className="text-xs text-muted-foreground">{scheduledLabels[appointment.id] ?? ""}</p>
                </Link>
                <Button size="sm" onClick={() => approve(appointment.id)} disabled={isPending} className="shrink-0">
                  <Check className="size-3.5" />
                  Approve
                </Button>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
