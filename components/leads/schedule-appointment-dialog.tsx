"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { CalendarPlus } from "lucide-react";
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
import { scheduleLeadAppointmentAction } from "@/app/leads/actions";

/**
 * For a lead whose message didn't request a specific time — surfaced on the
 * Lead Details page only when there's no active (requested/approved)
 * Appointment already (see services/leadService.ts's LeadDetail.activeAppointment).
 * Creates the Appointment and approves it in one step
 * (services/appointmentService.ts's scheduleAppointment) — the confirmation
 * email mentions whichever date/time is entered here.
 */
export function ScheduleAppointmentDialog({ leadId, customerName }: { leadId: string; customerName: string }) {
  const [date, setDate] = useState("");
  const [time, setTime] = useState("");
  const [durationMinutes, setDurationMinutes] = useState("60");
  const [price, setPrice] = useState("");
  const [location, setLocation] = useState("");
  const [prepInstructions, setPrepInstructions] = useState("");
  const [isPending, startTransition] = useTransition();

  function schedule() {
    if (!date || !time) {
      toast.error("Date and time are required.");
      return;
    }
    startTransition(async () => {
      const result = await scheduleLeadAppointmentAction(leadId, {
        date,
        time,
        durationMinutes: Number(durationMinutes) || 60,
        price: price.trim() ? Number(price) : null,
        location: location.trim() || null,
        prepInstructions: prepInstructions.trim() || null,
      });
      if (result.ok) {
        toast.success("Appointment scheduled and confirmation sent");
      } else {
        toast.error(result.error);
      }
    });
  }

  return (
    <Dialog>
      <DialogTrigger render={<Button size="sm" />}>
        <CalendarPlus className="size-3.5" />
        Schedule appointment
      </DialogTrigger>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Schedule appointment</DialogTitle>
          <DialogDescription>
            {customerName} didn&apos;t request a specific time — pick one and this creates the Calendar event and
            sends a confirmation email mentioning it. This can&apos;t be undone.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-3">
          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="scheduleDate">Date</Label>
              <Input id="scheduleDate" type="date" value={date} onChange={(e) => setDate(e.target.value)} required />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="scheduleTime">Time</Label>
              <Input id="scheduleTime" type="time" value={time} onChange={(e) => setTime(e.target.value)} required />
            </div>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="scheduleDuration">Duration (minutes)</Label>
            <Input
              id="scheduleDuration"
              type="number"
              min={15}
              step={15}
              value={durationMinutes}
              onChange={(e) => setDurationMinutes(e.target.value)}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="schedulePrice">Price (optional)</Label>
            <Input
              id="schedulePrice"
              type="number"
              step="0.01"
              value={price}
              onChange={(e) => setPrice(e.target.value)}
              placeholder="e.g. 120"
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="scheduleLocation">Location (optional)</Label>
            <Input
              id="scheduleLocation"
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              placeholder="e.g. 123 Main St"
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="schedulePrepInstructions">Prep instructions (optional)</Label>
            <Textarea
              id="schedulePrepInstructions"
              value={prepInstructions}
              onChange={(e) => setPrepInstructions(e.target.value)}
              rows={3}
              placeholder="e.g. Please have your pet leashed on arrival"
            />
          </div>
        </div>

        <DialogFooter>
          <DialogClose render={<Button variant="outline" />}>Cancel</DialogClose>
          <DialogClose render={<Button onClick={schedule} disabled={isPending || !date || !time} />}>
            Schedule
          </DialogClose>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
