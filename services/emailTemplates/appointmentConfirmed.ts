import type { Appointment, Business } from "@/types";
import { formatCurrency } from "@/lib/date";

/**
 * Sent the moment the owner approves a requested appointment
 * (services/appointmentService.ts's approveAppointment) — the one
 * human-approved email in this flow, since a wrong date/time/price here is
 * costly. `scheduledLabel` is caller-formatted (see appointmentRequested.ts's
 * doc comment for why).
 */
export function buildAppointmentConfirmedContent(
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
    subject: "Your appointment is confirmed",
    body: [
      `Hi ${name}, your appointment with ${business.businessName}${aboutPhrase} is confirmed.`,
      details.join("\n"),
      "Reply to this email if anything changes.",
      footer,
    ].join("\n\n"),
  };
}
