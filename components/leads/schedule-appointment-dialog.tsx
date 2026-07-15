"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { CalendarPlus, CalendarClock, DollarSign, MapPin, ClipboardList } from "lucide-react";
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { scheduleLeadAppointmentAction } from "@/app/leads/actions";

const DURATION_OPTIONS = [
  { label: "30 minutes", value: "30" },
  { label: "45 minutes", value: "45" },
  { label: "1 hour", value: "60" },
  { label: "1.5 hours", value: "90" },
  { label: "2 hours", value: "120" },
  { label: "3 hours", value: "180" },
];

/** Tomorrow's date, "YYYY-MM-DD" — just a friendly starting point in the date picker, not a real timezone computation (the owner can change it; the server is what actually converts using the business's own timezone). */
function tomorrowIso(): string {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  return d.toISOString().slice(0, 10);
}

/** Formats a "YYYY-MM-DD" string as "Weekday, Month Day" without ever constructing a timezone-sensitive instant — pure civil-date math, same precedent as lib/calendarGrid.ts. */
function formatFriendlyDate(dateStr: string): string {
  if (!dateStr) return "";
  const [y, m, d] = dateStr.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    timeZone: "UTC",
  });
}

/** "HH:mm" (24h) -> "h:mm AM/PM" — plain string/number math, no Date object involved. */
function formatFriendlyTime(timeStr: string): string {
  if (!timeStr) return "";
  const [h, m] = timeStr.split(":").map(Number);
  const period = h >= 12 ? "PM" : "AM";
  const hour12 = h % 12 === 0 ? 12 : h % 12;
  return `${hour12}:${String(m).padStart(2, "0")} ${period}`;
}

/** Adds `minutes` to an "HH:mm" string, wrapping across midnight — used to preview the end time from the chosen duration. */
function addMinutesToTime(timeStr: string, minutes: number): string {
  const [h, m] = timeStr.split(":").map(Number);
  const total = ((h * 60 + m + minutes) % (24 * 60) + 24 * 60) % (24 * 60);
  return `${String(Math.floor(total / 60)).padStart(2, "0")}:${String(total % 60).padStart(2, "0")}`;
}

/**
 * For a lead whose message didn't request a specific time — surfaced on the
 * Lead Details page only when there's no active (requested/approved)
 * Appointment already (see services/leadService.ts's LeadDetail.activeAppointment).
 * Creates the Appointment and approves it in one step
 * (services/appointmentService.ts's scheduleAppointment) — the confirmation
 * email mentions whichever date/time is entered here.
 */
export function ScheduleAppointmentDialog({ leadId, customerName }: { leadId: string; customerName: string }) {
  const [date, setDate] = useState(tomorrowIso());
  const [time, setTime] = useState("09:00");
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

  const previewLabel =
    date && time
      ? `${formatFriendlyDate(date)} · ${formatFriendlyTime(time)} – ${formatFriendlyTime(
          addMinutesToTime(time, Number(durationMinutes) || 60)
        )}`
      : null;

  return (
    <Dialog>
      <DialogTrigger render={<Button size="sm" />}>
        <CalendarPlus className="size-3.5" />
        Schedule appointment
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Schedule appointment</DialogTitle>
          <DialogDescription>
            {customerName} didn&apos;t request a specific time — pick one below. This creates the Calendar event and
            sends a confirmation email mentioning it, and can&apos;t be undone.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-3">
            <p className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">When</p>
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
              <Label htmlFor="scheduleDuration">Duration</Label>
              <Select value={durationMinutes} onValueChange={(value) => value && setDurationMinutes(value)}>
                <SelectTrigger id="scheduleDuration" className="w-full">
                  <SelectValue>
                    {(value: string) => DURATION_OPTIONS.find((option) => option.value === value)?.label ?? value}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {DURATION_OPTIONS.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {previewLabel && (
              <div className="flex items-center gap-2.5 rounded-lg bg-primary/5 px-3 py-2.5 text-sm text-foreground">
                <CalendarClock className="size-4 shrink-0 text-primary" />
                <span className="font-medium">{previewLabel}</span>
              </div>
            )}
          </div>

          <div className="flex flex-col gap-3 border-t border-border pt-4">
            <p className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">Details (optional)</p>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="schedulePrice" className="flex items-center gap-1.5">
                <DollarSign className="size-3.5 text-muted-foreground" />
                Price
              </Label>
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
              <Label htmlFor="scheduleLocation" className="flex items-center gap-1.5">
                <MapPin className="size-3.5 text-muted-foreground" />
                Location
              </Label>
              <Input
                id="scheduleLocation"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                placeholder="e.g. 123 Main St"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="schedulePrepInstructions" className="flex items-center gap-1.5">
                <ClipboardList className="size-3.5 text-muted-foreground" />
                Prep instructions
              </Label>
              <Textarea
                id="schedulePrepInstructions"
                value={prepInstructions}
                onChange={(e) => setPrepInstructions(e.target.value)}
                rows={3}
                placeholder="e.g. Please have your pet leashed on arrival"
              />
            </div>
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
