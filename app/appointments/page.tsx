import { PageHeader } from "@/components/layout/page-header";
import { DatabaseErrorState } from "@/components/layout/database-error-state";
import { AppointmentList } from "@/components/appointments/appointment-list";
import { getAppointments } from "@/services/db";
import { getEffectiveTimezone } from "@/services/business";
import { formatZonedDateTime } from "@/lib/date";
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

  return (
    <>
      <PageHeader title="Appointments" description="Booking requests, confirmed appointments, and their lifecycle." />
      <AppointmentList items={sorted} scheduledLabels={scheduledLabels} />
    </>
  );
}
