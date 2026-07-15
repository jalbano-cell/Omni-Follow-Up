import type { Appointment, Business } from "@/types";
import { formatCurrency } from "@/lib/date";

/**
 * Auto-sent by services/appointmentLifecycle.ts's runAppointmentReminderJob
 * once an approved appointment enters its reminder window
 * (services/business.ts's getEffectiveReminderHoursBefore before
 * scheduledStart) — same auto-send shape as appointmentReviewRequest.ts/
 * appointmentRebookReminder.ts now, not a drafted-then-approved message.
 * `scheduledLabel` is caller-formatted (see appointmentRequested.ts's doc
 * comment for why).
 */
export function buildAppointmentReminderContent(
  appointment: Pick<Appointment, "customerName" | "serviceType" | "price" | "location" | "prepInstructions">,
  business: Pick<Business, "businessName">,
  scheduledLabel: string,
  footer: string
): { subject: string; body: string } {
  const name = appointment.customerName.split(" ")[0] || appointment.customerName;
  const aboutPhrase = appointment.serviceType ? ` for ${appointment.serviceType}` : "";

  const details = [
    `Date & time: ${scheduledLabel}`,
    appointment.price != null ? `Price: ${formatCurrency(appointment.price)}` : null,
    appointment.location ? `Location: ${appointment.location}` : null,
    appointment.prepInstructions ? `Before your appointment: ${appointment.prepInstructions}` : null,
  ].filter((line): line is string => Boolean(line));

  return {
    subject: "Reminder: your upcoming appointment",
    body: [
      `Hi ${name}, just a reminder about your upcoming appointment with ${business.businessName}${aboutPhrase}.`,
      details.join("\n"),
      "Reply to this email if you need to reschedule.",
      footer,
    ].join("\n\n"),
  };
}
