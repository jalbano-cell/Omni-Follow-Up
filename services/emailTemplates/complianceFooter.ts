import type { Business } from "@/types";

/**
 * CASL-required footer (sender identification + a working unsubscribe
 * mechanism) appended to every appointment-lifecycle automated email
 * (services/emailTemplates/appointmentRequested.ts,
 * appointmentReviewRequest.ts, appointmentRebookReminder.ts — the
 * human-approved confirmation email in appointmentConfirmed.ts gets it too,
 * for consistency, even though it isn't in the auto-send suppression list).
 * Not retrofitted onto this app's other existing sends (the customizable
 * follow-up templates, the plain lead acknowledgment) — out of scope here.
 */
export function buildComplianceFooter(business: Pick<Business, "businessName" | "ownerEmail" | "mailingAddress">, unsubscribeUrl: string): string {
  const lines = [
    "—",
    business.businessName,
    business.mailingAddress || null,
    `Questions? Reply to this email or contact ${business.ownerEmail}.`,
    `Don't want these emails? Unsubscribe: ${unsubscribeUrl}`,
  ].filter((line): line is string => Boolean(line));

  return lines.join("\n");
}
