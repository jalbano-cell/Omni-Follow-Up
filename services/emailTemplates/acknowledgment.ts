import type { Lead } from "@/types";

/**
 * What (if anything) services/appointmentBooking.ts resolved for this lead's
 * requested appointment — shapes which acknowledgment template branch below
 * applies. "booked" and "alternates" are the only cases where the email may
 * state a specific date/time, because by then it's either a real confirmed
 * Calendar event or a real open slot — never a guess.
 */
export type AcknowledgmentBookingOutcome =
  | { type: "none" }
  | { type: "booked"; dateTimeLabel: string }
  | { type: "alternates"; alternateLabels: string[] };

export interface AcknowledgmentContent {
  subject: string;
  body: string;
}

function firstName(name: string): string {
  return name.split(" ")[0] || name;
}

/** First ~100 characters of the lead's message, word-boundary trimmed — used only to personalize tone, never quoted as a commitment. */
function messageExcerpt(message: string): string {
  const normalized = message.replace(/\s+/g, " ").trim();
  if (normalized.length <= 100) return normalized;
  const truncated = normalized.slice(0, 100);
  const lastSpace = truncated.lastIndexOf(" ");
  return `${truncated.slice(0, lastSpace > 0 ? lastSpace : 100)}…`;
}

/**
 * Template-based acknowledgment email — deterministic replacement for the
 * old Gemini-generated content. Same hard rules the prompt used to enforce,
 * now guaranteed by construction instead of by instruction: no prices, no
 * invented facts, no named person committed to responding, no promised
 * response time when no appointment was resolved. Variables substituted:
 * {{name}}, {{company}}, {{service}}, {{message_excerpt}}.
 */
export function buildAcknowledgmentContent(
  lead: Lead,
  businessName: string,
  booking: AcknowledgmentBookingOutcome
): AcknowledgmentContent {
  const name = firstName(lead.name);
  const excerpt = messageExcerpt(lead.message);
  const aboutPhrase = lead.requestedService ? ` about ${lead.requestedService}` : "";

  if (booking.type === "booked") {
    return {
      subject: "Your appointment is confirmed",
      body: [
        `Hi ${name}, thanks for reaching out to ${businessName}${aboutPhrase} — we've received your message ("${excerpt}").`,
        `Your appointment is confirmed for ${booking.dateTimeLabel}. You'll also receive a calendar invite for this time.`,
        "Looking forward to connecting then — reply to this email if anything changes.",
      ].join("\n\n"),
    };
  }

  if (booking.type === "alternates") {
    return {
      subject: "Let's find a time",
      body: [
        `Hi ${name}, thanks for reaching out to ${businessName}${aboutPhrase} — we've received your message ("${excerpt}").`,
        `Your requested time wasn't available, but these times are open: ${booking.alternateLabels.join(" or ")}.`,
        "Reply and let us know which works, or suggest another time.",
      ].join("\n\n"),
    };
  }

  return {
    subject: "We received your message",
    body: [
      `Hi ${name}, thanks for reaching out to ${businessName}${aboutPhrase} — we've received your message and wanted to confirm it's on our radar.`,
      "We'll follow up with you shortly. In the meantime, feel free to reply to this email if you'd like to add anything.",
    ].join("\n\n"),
  };
}
