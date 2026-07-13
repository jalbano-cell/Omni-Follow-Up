import { AppointmentCard } from "@/components/appointments/appointment-card";
import type { Appointment } from "@/types";

export function AppointmentList({
  items,
  scheduledLabels,
}: {
  items: Appointment[];
  /** Timezone-formatted scheduledStart label per appointment id, computed server-side (see app/appointments/page.tsx) — components stay pure of timezone logic, same precedent as components/leads/pending-appointment-banner.tsx. */
  scheduledLabels: Record<string, string>;
}) {
  if (items.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-border py-20 text-center">
        <p className="text-sm text-muted-foreground">No appointments yet — they show up here as customers book through your website.</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      {items.map((appointment) => (
        <AppointmentCard key={appointment.id} appointment={appointment} scheduledLabel={scheduledLabels[appointment.id] ?? ""} />
      ))}
    </div>
  );
}
