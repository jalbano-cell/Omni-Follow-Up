import type { Appointment, Business } from "@/types";

/**
 * The instant, no-approval acknowledgment sent the moment a booking request
 * is parsed from a Lead's message (services/appointmentService.ts's
 * createAppointmentFromLead) — deliberately never states the appointment is
 * locked in, since nothing is confirmed until the owner approves it
 * (services/emailTemplates/appointmentConfirmed.ts). `scheduledLabel` is a
 * caller-formatted, timezone-aware string (e.g. services/business.ts's
 * getEffectiveTimezone + lib/date.ts's formatZonedDateTime) — this file stays
 * pure of timezone logic, same precedent as the existing acknowledgment.ts.
 */
export function buildAppointmentRequestedContent(
  appointment: Pick<Appointment, "customerName" | "serviceType">,
  business: Pick<Business, "businessName">,
  scheduledLabel: string,
  footer: string
): { subject: string; body: string } {
  const name = appointment.customerName.split(" ")[0] || appointment.customerName;
  const aboutPhrase = appointment.serviceType ? ` for ${appointment.serviceType}` : "";

  return {
    subject: "We've got your booking request",
    body: [
      `Hi ${name}, thanks for requesting an appointment with ${business.businessName}${aboutPhrase} for ${scheduledLabel}.`,
      "This time isn't locked in yet — we'll send you a booking confirmation shortly once it's approved.",
      footer,
    ].join("\n\n"),
  };
}
