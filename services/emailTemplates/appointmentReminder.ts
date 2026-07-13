import type { Appointment, Business } from "@/types";
import { formatCurrency } from "@/lib/date";

export const APPOINTMENT_REMINDER_SUBJECT = "Reminder: your upcoming appointment";

/**
 * Drafted automatically by services/appointmentLifecycle.ts's
 * runAppointmentReminderDraftJob once an approved appointment enters its
 * reminder window (services/business.ts's getEffectiveReminderHoursBefore
 * before scheduledStart) — but unlike the review-request/rebook-reminder
 * templates, this one is NOT auto-sent: the owner must approve it first via
 * services/appointmentService.ts's approveReminder, same human-in-the-loop
 * gate as the Estimate Follow-up Queue. Deliberately returns only the body
 * (no footer, no subject) — same split as services/followupEngine.ts's
 * draftFollowUpMessage — since this gets *stored* as `appointments.reminder_message`
 * and may be edited by the owner before sending; the compliance footer is
 * appended fresh (a new unsubscribe token) at send time instead of baked in
 * at draft time. `scheduledLabel` is caller-formatted (see
 * appointmentRequested.ts's doc comment for why).
 */
export function buildAppointmentReminderBody(
  appointment: Pick<Appointment, "customerName" | "serviceType" | "price" | "location" | "prepInstructions">,
  business: Pick<Business, "businessName">,
  scheduledLabel: string
): string {
  const name = appointment.customerName.split(" ")[0] || appointment.customerName;
  const aboutPhrase = appointment.serviceType ? ` for ${appointment.serviceType}` : "";

  const details = [
    `Date & time: ${scheduledLabel}`,
    appointment.price != null ? `Price: ${formatCurrency(appointment.price)}` : null,
    appointment.location ? `Location: ${appointment.location}` : null,
    appointment.prepInstructions ? `Before your appointment: ${appointment.prepInstructions}` : null,
  ].filter((line): line is string => Boolean(line));

  return [
    `Hi ${name}, just a reminder about your upcoming appointment with ${business.businessName}${aboutPhrase}.`,
    details.join("\n"),
    "Reply to this email if you need to reschedule.",
  ].join("\n\n");
}
