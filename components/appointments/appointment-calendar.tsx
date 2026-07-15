"use client";

import { useMemo, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { buildMonthGrid, monthLabel, nextMonth, previousMonth } from "@/lib/calendarGrid";
import type { AppointmentStatus } from "@/types";

export interface CalendarAppointment {
  id: string;
  customerName: string;
  serviceType: string;
  status: AppointmentStatus;
  /** "YYYY-MM-DD" in the business's own timezone (app/appointments/page.tsx) — never derived client-side, so this stays pure of timezone logic. */
  dateKey: string;
  /** Time-only label in the business's own timezone, e.g. "2:00 PM". */
  timeLabel: string;
  /** Raw UTC ISO — only used to sort same-day chips chronologically (a lexical ISO sort is always chronological, regardless of timezone). */
  scheduledStart: string;
}

const WEEKDAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MAX_CHIPS_PER_DAY = 3;

const STATUS_DOT_CLASS: Record<AppointmentStatus, string> = {
  requested: "bg-warning",
  approved: "bg-primary",
  completed: "bg-success",
  no_show: "bg-destructive",
  cancelled: "bg-muted-foreground",
};

/**
 * Month-grid calendar for Appointments — shows every appointment with a
 * confirmed time (status other than "requested", since a requested slot
 * isn't locked in yet and displaying it as booked would contradict CLAUDE.md's
 * "never implies the slot is locked in" rule) on the day it's scheduled.
 * Clicking a day (or its "+N more" overflow) selects it via onSelectDate —
 * the parent (components/appointments/appointments-view.tsx) uses that to
 * filter the existing AppointmentList below, reusing AppointmentCard's full
 * actions (approve/no-show/cancel) rather than duplicating them here.
 */
export function AppointmentCalendar({
  appointments,
  initialYear,
  initialMonth,
  todayKey,
  selectedDate,
  onSelectDate,
}: {
  appointments: CalendarAppointment[];
  /** Current year/month (0-indexed) in the business's own timezone, computed server-side. */
  initialYear: number;
  initialMonth: number;
  /** "YYYY-MM-DD" for today in the business's own timezone — highlights the current day. */
  todayKey: string;
  selectedDate: string | null;
  onSelectDate: (dateKey: string) => void;
}) {
  const [viewYear, setViewYear] = useState(initialYear);
  const [viewMonth, setViewMonth] = useState(initialMonth);

  const byDate = useMemo(() => {
    const map = new Map<string, CalendarAppointment[]>();
    for (const appt of appointments) {
      const list = map.get(appt.dateKey) ?? [];
      list.push(appt);
      map.set(appt.dateKey, list);
    }
    for (const list of map.values()) {
      list.sort((a, b) => a.scheduledStart.localeCompare(b.scheduledStart));
    }
    return map;
  }, [appointments]);

  function goToPreviousMonth() {
    const { year, month0 } = previousMonth(viewYear, viewMonth);
    setViewYear(year);
    setViewMonth(month0);
  }

  function goToNextMonth() {
    const { year, month0 } = nextMonth(viewYear, viewMonth);
    setViewYear(year);
    setViewMonth(month0);
  }

  function goToToday() {
    setViewYear(initialYear);
    setViewMonth(initialMonth);
  }

  const cells = buildMonthGrid(viewYear, viewMonth);

  return (
    <div className="overflow-hidden rounded-lg border border-border">
      <div className="flex items-center justify-between border-b border-border bg-muted/30 px-4 py-3">
        <p className="text-sm font-semibold text-foreground">{monthLabel(viewYear, viewMonth)}</p>
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="sm" onClick={goToToday}>
            Today
          </Button>
          <Button variant="outline" size="icon" aria-label="Previous month" onClick={goToPreviousMonth}>
            <ChevronLeft className="size-4" />
          </Button>
          <Button variant="outline" size="icon" aria-label="Next month" onClick={goToNextMonth}>
            <ChevronRight className="size-4" />
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-7 gap-px bg-border">
        {WEEKDAY_LABELS.map((label) => (
          <div key={label} className="bg-muted/30 px-2 py-1.5 text-center text-xs font-medium text-muted-foreground">
            {label}
          </div>
        ))}
        {cells.map((cell, i) => {
          if (!cell) return <div key={`blank-${i}`} className="min-h-[96px] bg-muted/10" />;
          const dayAppointments = byDate.get(cell.dateKey) ?? [];
          const isToday = cell.dateKey === todayKey;
          const isSelected = cell.dateKey === selectedDate;
          const visible = dayAppointments.slice(0, MAX_CHIPS_PER_DAY);
          const overflow = dayAppointments.length - visible.length;

          return (
            <button
              key={cell.dateKey}
              type="button"
              onClick={() => onSelectDate(cell.dateKey)}
              className={cn(
                "flex min-h-[96px] flex-col items-stretch gap-1 bg-background p-1.5 text-left transition-colors hover:bg-muted/40",
                isSelected && "ring-2 ring-inset ring-primary"
              )}
            >
              <span
                className={cn(
                  "flex size-5 items-center justify-center rounded-full text-xs",
                  isToday ? "bg-primary font-semibold text-primary-foreground" : "text-muted-foreground"
                )}
              >
                {cell.day}
              </span>
              <div className="flex flex-col gap-0.5">
                {visible.map((appt) => (
                  <span
                    key={appt.id}
                    className={cn(
                      "flex items-center gap-1 truncate rounded px-1 py-0.5 text-[11px] leading-tight",
                      appt.status === "cancelled" || appt.status === "no_show"
                        ? "text-muted-foreground line-through"
                        : "text-foreground"
                    )}
                  >
                    <span className={cn("size-1.5 shrink-0 rounded-full", STATUS_DOT_CLASS[appt.status])} />
                    <span className="shrink-0 font-medium">{appt.timeLabel}</span>
                    <span className="truncate">{appt.customerName}</span>
                  </span>
                ))}
                {overflow > 0 && <span className="px-1 text-[11px] text-muted-foreground">+{overflow} more</span>}
              </div>
            </button>
          );
        })}
      </div>

      <div className="flex flex-wrap items-center gap-3 border-t border-border px-4 py-2.5 text-xs text-muted-foreground">
        <span className="flex items-center gap-1.5">
          <span className="size-1.5 rounded-full bg-primary" /> Approved
        </span>
        <span className="flex items-center gap-1.5">
          <span className="size-1.5 rounded-full bg-success" /> Completed
        </span>
        <span className="flex items-center gap-1.5">
          <span className="size-1.5 rounded-full bg-destructive" /> No-show
        </span>
        <span className="flex items-center gap-1.5">
          <span className="size-1.5 rounded-full bg-muted-foreground" /> Cancelled
        </span>
      </div>
    </div>
  );
}
