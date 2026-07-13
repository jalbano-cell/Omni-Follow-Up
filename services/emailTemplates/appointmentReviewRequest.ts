import type { Appointment, Business } from "@/types";

/**
 * Auto-sent one day after a completed appointment (services/appointmentLifecycle.ts's
 * review-request job) — same ask for every customer, no gating happy vs.
 * unhappy customers toward different destinations. Callers must not call
 * this when `business.googleReviewUrl` is unset (nowhere to send them) — see
 * the job's own eligibility check.
 */
export function buildAppointmentReviewRequestContent(
  appointment: Pick<Appointment, "customerName" | "serviceType">,
  business: Pick<Business, "businessName" | "googleReviewUrl">,
  footer: string
): { subject: string; body: string } {
  const name = appointment.customerName.split(" ")[0] || appointment.customerName;
  const aboutPhrase = appointment.serviceType ? ` for your ${appointment.serviceType}` : "";

  return {
    subject: `How was your visit with ${business.businessName}?`,
    body: [
      `Hi ${name}, thanks again for choosing ${business.businessName}${aboutPhrase}.`,
      `If you have a minute, we'd really appreciate a review: ${business.googleReviewUrl}`,
      footer,
    ].join("\n\n"),
  };
}
