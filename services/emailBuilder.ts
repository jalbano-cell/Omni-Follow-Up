import { buildAcknowledgmentContent, type AcknowledgmentBookingOutcome } from "@/services/emailTemplates/acknowledgment";
import { getEmailTemplate, renderTemplate } from "@/services/emailTemplateService";
import type { Business, Lead } from "@/types";

export type { AcknowledgmentBookingOutcome };

/**
 * Assembles the lead acknowledgment email: for a resolved appointment
 * (booked/alternates) the content stays system-rendered — see
 * services/emailTemplates/acknowledgment.ts — since it carries real-time
 * confirmed data, not customizable marketing copy. For the plain "none"
 * outcome, it renders the business's (possibly customized) "acknowledgment"
 * template instead. Either way, the sign-off is appended the same way
 * afterward, and this can't fail the way a Gemini call used to.
 */
export async function buildAcknowledgmentEmail(
  lead: Lead,
  business: Business,
  booking: AcknowledgmentBookingOutcome = { type: "none" }
): Promise<{ subject: string; body: string }> {
  const content =
    booking.type === "none"
      ? renderTemplate(await getEmailTemplate(business.id, "acknowledgment"), {
          customer_name: lead.name.split(" ")[0] || lead.name,
          company: lead.company,
          service: lead.requestedService || "your inquiry",
          business_name: business.businessName,
        })
      : buildAcknowledgmentContent(lead, business.businessName, booking);

  return { subject: content.subject, body: `${content.body.trim()}\n\n— ${business.businessName}` };
}
