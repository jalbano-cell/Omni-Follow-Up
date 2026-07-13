import type { Appointment, Business } from "@/types";

/**
 * Auto-sent services/business.ts's getEffectiveRebookIntervalDays after a
 * completed appointment (services/appointmentLifecycle.ts's rebook-reminder
 * job) — general recurring reactivation (e.g. "your pet is due for another
 * groom"), not the estimate follow-up chaser. No dedicated public booking
 * page exists in this app yet, so the call to action is simply replying to
 * this email — same "as little technical setup as possible" precedent as
 * everything else here.
 */
export function buildAppointmentRebookReminderContent(
  appointment: Pick<Appointment, "customerName" | "serviceType">,
  business: Pick<Business, "businessName">,
  footer: string
): { subject: string; body: string } {
  const name = appointment.customerName.split(" ")[0] || appointment.customerName;
  const serviceLabel = appointment.serviceType || "your next appointment";

  return {
    subject: `Time to rebook ${serviceLabel}?`,
    body: [
      `Hi ${name}, it's about time for ${serviceLabel} again with ${business.businessName}.`,
      "Reply to this email and we'll get you booked in.",
      footer,
    ].join("\n\n"),
  };
}
