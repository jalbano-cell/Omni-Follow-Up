import { buildAcknowledgmentContent, type AcknowledgmentBookingOutcome } from "@/services/emailTemplates/acknowledgment";
import type { Lead } from "@/types";

export type { AcknowledgmentBookingOutcome };

/**
 * Assembles the lead acknowledgment email: selects the template branch for
 * the resolved booking outcome, injects variables, and appends the sign-off.
 * Single call site for "build this lead's acknowledgment email" — mirrors
 * the shape of the old generateLeadAcknowledgment, minus the failure case,
 * since a template substitution can't fail the way a Gemini call could.
 */
export function buildAcknowledgmentEmail(
  lead: Lead,
  businessName: string,
  booking: AcknowledgmentBookingOutcome = { type: "none" }
): { subject: string; body: string } {
  const content = buildAcknowledgmentContent(lead, businessName, booking);
  return { subject: content.subject, body: `${content.body.trim()}\n\n— ${businessName}` };
}
