"use client";

import { useMemo, useState } from "react";
import { List, CalendarDays, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { AppointmentList } from "@/components/appointments/appointment-list";
import { AppointmentCalendar, type CalendarAppointment } from "@/components/appointments/appointment-calendar";
import { cn } from "@/lib/utils";
import type { Appointment } from "@/types";

/**
 * Owns the List/Calendar toggle and the calendar's day-selection filter —
 * the two views share the same underlying `items`/`scheduledLabels` (see
 * app/appointments/page.tsx) so approving/dismissing/flagging an
 * appointment from either view stays exactly the same AppointmentCard
 * component and Server Actions, just filtered differently above it.
 */
export function AppointmentsView({
  items,
  scheduledLabels,
  calendarAppointments,
  initialYear,
  initialMonth,
  todayKey,
}: {
  items: Appointment[];
  scheduledLabels: Record<string, string>;
  calendarAppointments: CalendarAppointment[];
  initialYear: number;
  initialMonth: number;
  todayKey: string;
}) {
  const [view, setView] = useState<"list" | "calendar">("list");
  const [selectedDate, setSelectedDate] = useState<string | null>(null);

  const dateKeyById = useMemo(() => new Map(calendarAppointments.map((a) => [a.id, a.dateKey])), [calendarAppointments]);

  const filteredItems = useMemo(() => {
    if (!selectedDate) return items;
    return items.filter((item) => dateKeyById.get(item.id) === selectedDate);
  }, [items, dateKeyById, selectedDate]);

  const selectedDateLabel = selectedDate
    ? new Date(`${selectedDate}T00:00:00`).toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })
    : null;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex w-fit rounded-lg border border-border p-0.5">
        <button
          type="button"
          onClick={() => setView("list")}
          className={cn(
            "flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
            view === "list" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"
          )}
        >
          <List className="size-3.5" />
          List
        </button>
        <button
          type="button"
          onClick={() => setView("calendar")}
          className={cn(
            "flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
            view === "calendar" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"
          )}
        >
          <CalendarDays className="size-3.5" />
          Calendar
        </button>
      </div>

      {view === "list" ? (
        <AppointmentList items={items} scheduledLabels={scheduledLabels} />
      ) : (
        <>
          <AppointmentCalendar
            appointments={calendarAppointments}
            initialYear={initialYear}
            initialMonth={initialMonth}
            todayKey={todayKey}
            selectedDate={selectedDate}
            onSelectDate={(dateKey) => setSelectedDate((current) => (current === dateKey ? null : dateKey))}
          />

          {selectedDate && (
            <div className="flex flex-col gap-3">
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium text-foreground">{selectedDateLabel}</p>
                <Button variant="ghost" size="sm" onClick={() => setSelectedDate(null)}>
                  <X className="size-3.5" />
                  Clear
                </Button>
              </div>
              {filteredItems.length === 0 ? (
                <p className="rounded-lg border border-dashed border-border py-10 text-center text-sm text-muted-foreground">
                  Nothing booked on this day.
                </p>
              ) : (
                <AppointmentList items={filteredItems} scheduledLabels={scheduledLabels} />
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}
