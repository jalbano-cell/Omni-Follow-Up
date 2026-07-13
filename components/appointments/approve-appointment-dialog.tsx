"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Check } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogClose,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { approveAppointmentAction } from "@/app/appointments/actions";
import type { Appointment } from "@/types";

/** The one human-approval gate in the appointment lifecycle — creates the Calendar event and sends the confirmation email, both only on a successful approval (services/appointmentService.ts's approveAppointment). */
export function ApproveAppointmentDialog({ appointment }: { appointment: Appointment }) {
  const [price, setPrice] = useState(appointment.price != null ? String(appointment.price) : "");
  const [location, setLocation] = useState(appointment.location ?? "");
  const [prepInstructions, setPrepInstructions] = useState(appointment.prepInstructions ?? "");
  const [isPending, startTransition] = useTransition();

  function approve() {
    startTransition(async () => {
      const result = await approveAppointmentAction(appointment.id, {
        price: price.trim() ? Number(price) : null,
        location: location.trim() || null,
        prepInstructions: prepInstructions.trim() || null,
      });
      if (result.ok) {
        toast.success("Appointment approved and confirmation sent");
      } else {
        toast.error(result.error);
      }
    });
  }

  return (
    <Dialog>
      <DialogTrigger render={<Button size="sm" />}>
        <Check className="size-3.5" />
        Approve
      </DialogTrigger>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Approve appointment</DialogTitle>
          <DialogDescription>
            Creates the Calendar event and sends {appointment.customerName} a confirmation email — this can&apos;t be undone.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-3">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="price">Price (optional)</Label>
            <Input
              id="price"
              type="number"
              step="0.01"
              value={price}
              onChange={(e) => setPrice(e.target.value)}
              placeholder="e.g. 120"
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="location">Location (optional)</Label>
            <Input
              id="location"
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              placeholder="e.g. 123 Main St"
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="prepInstructions">Prep instructions (optional)</Label>
            <Textarea
              id="prepInstructions"
              value={prepInstructions}
              onChange={(e) => setPrepInstructions(e.target.value)}
              rows={3}
              placeholder="e.g. Please have your pet leashed on arrival"
            />
          </div>
        </div>

        <DialogFooter>
          <DialogClose render={<Button variant="outline" />}>Cancel</DialogClose>
          <DialogClose render={<Button onClick={approve} disabled={isPending} />}>Approve</DialogClose>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
