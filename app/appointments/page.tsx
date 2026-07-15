import { PageHeader } from "@/components/layout/page-header";
import { DatabaseErrorState } from "@/components/layout/database-error-state";
import { AppointmentsView } from "@/components/appointments/appointments-view";
import type { CalendarAppointment } from "@/components/appointments/appointment-calendar";
import { getAppointments } from "@/services/db";
import { getEffectiveTimezone } from "@/services/business";
import { formatZonedDateTime, formatZonedTime, zonedDateKey } from "@/lib/date";
import { requireAppointmentsEnabled } from "@/lib/session";
import type { AppointmentStatus } from "@/types";

export const dynamic = "force-dynamic";

/** Requested/Approved need attention first; terminal statuses sort after, most recent first. */
const STATUS_PRIORITY: Record<AppointmentStatus, number> = {
  requested: 0,
  approved: 1,
  completed: 2,
  no_show: 3,
  cancelled: 3,
};

export default async function AppointmentsPage() {
  const business = await requireAppointmentsEnabled();

  let appointments;
  try {
    appointments = await getAppointments(business.id);
  } catch (error) {
    return (
      <>
        <PageHeader title="Appointments" description="Booking requests, confirmed appointments, and their lifecycle." />
        <DatabaseErrorState message={error instanceof Error ? error.message : "Unknown error"} />
      </>
    );
  }

  const timezone = getEffectiveTimezone(business);
  const scheduledLabels = Object.fromEntries(
    appointments.map((a) => [a.id, formatZonedDateTime(new Date(a.scheduledStart), timezone)])
  );

  const sorted = [...appointments].sort((a, b) => {
    const priorityDiff = STATUS_PRIORITY[a.status] - STATUS_PRIORITY[b.status];
    if (priorityDiff !== 0) return priorityDiff;
    return a.scheduledStart.localeCompare(b.scheduledStart);
  });

  // The calendar only ever shows a confirmed time — a "requested" slot isn't
  // locked in yet (see CLAUDE.md's Appointments section), so displaying it
  // as booked would be misleading; it stays List-only until approved.
  const calendarAppointments: CalendarAppointment[] = appointments
    .filter((a) => a.status !== "requested")
    .map((a) => ({
      id: a.id,
      customerName: a.customerName,
      serviceType: a.serviceType,
      status: a.status,
      dateKey: zonedDateKey(new Date(a.scheduledStart), timezone),
      timeLabel: formatZonedTime(new Date(a.scheduledStart), timezone),
      scheduledStart: a.scheduledStart,
    }));

  const now = new Date();
  const nowParts = new Intl.DateTimeFormat("en-US", { timeZone: timezone, year: "numeric", month: "numeric" }).formatToParts(now);
  const initialYear = Number(nowParts.find((p) => p.type === "year")?.value ?? now.getUTCFullYear());
  const initialMonth = Number(nowParts.find((p) => p.type === "month")?.value ?? now.getUTCMonth() + 1) - 1;
  const todayKey = zonedDateKey(now, timezone);

  return (
    <>
      <PageHeader title="Appointments" description="Booking requests, confirmed appointments, and their lifecycle." />
      <AppointmentsView
        items={sorted}
        scheduledLabels={scheduledLabels}
        calendarAppointments={calendarAppointments}
        initialYear={initialYear}
        initialMonth={initialMonth}
        todayKey={todayKey}
      />
    </>
  );
}
