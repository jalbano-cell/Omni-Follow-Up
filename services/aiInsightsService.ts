import { updateLead } from "@/services/airtable";
import { logLeadActivity } from "@/services/activityService";
import { logAction } from "@/lib/logger";
import { env } from "@/lib/env";
import type { Lead } from "@/types";

/**
 * AI Lead Intelligence — analyzes a newly created Lead and writes a
 * summary/category/priority/opportunity estimate/next action/response
 * urgency back onto it. This is analysis and recommendation only: it never
 * sends an email, never contacts the customer, and never changes a Lead's
 * status. The business owner reviews, edits, or dismisses what it produces
 * (see updateAiInsights/dismissAiInsights/restoreAiInsights in
 * services/leadService.ts) — nothing here acts on its own.
 */

const GEMINI_MODEL = "gemini-2.5-flash";

const RESPONSE_SCHEMA = {
  type: "OBJECT",
  properties: {
    summary: { type: "STRING", description: "2-3 sentence summary of the customer's request." },
    category: {
      type: "STRING",
      description:
        "The best-fit category for this lead. Prefer one of: Website, SEO, Automation, AI Agent, Restaurant, General Inquiry — but use a more specific label if none of those genuinely fit.",
    },
    priority: { type: "STRING", enum: ["High", "Medium", "Low"] },
    priorityReason: { type: "STRING", description: "Why this priority level, in one sentence." },
    opportunityValueRange: {
      type: "STRING",
      description: 'A rough dollar range only, e.g. "$1,500-$3,000". Never a single precise figure.',
    },
    opportunityConfidence: {
      type: "STRING",
      description: "One sentence explaining how confident that range estimate is and why.",
    },
    suggestedNextAction: {
      type: "STRING",
      description:
        "Prefer one of: Schedule discovery call, Prepare proposal, Request more information, Refer elsewhere — but phrase it more specifically if that's clearer.",
    },
    responseUrgency: { type: "STRING", enum: ["Today", "24 hours", "3 days", "1 week"] },
    responseUrgencyReason: { type: "STRING", description: "Why this response urgency, in one sentence." },
  },
  required: [
    "summary",
    "category",
    "priority",
    "priorityReason",
    "opportunityValueRange",
    "opportunityConfidence",
    "suggestedNextAction",
    "responseUrgency",
    "responseUrgencyReason",
  ],
};

interface GeminiInsights {
  summary: string;
  category: string;
  priority: "High" | "Medium" | "Low";
  priorityReason: string;
  opportunityValueRange: string;
  opportunityConfidence: string;
  suggestedNextAction: string;
  responseUrgency: "Today" | "24 hours" | "3 days" | "1 week";
  responseUrgencyReason: string;
}

function buildPrompt(lead: Lead): string {
  return [
    "Analyze this inbound website inquiry for a small business and produce lead intelligence for the business owner to review. Only analyze and recommend — you are not drafting a reply and this will never be sent to the customer.",
    "",
    `Customer name: ${lead.name}`,
    `Company: ${lead.company || "Not provided"}`,
    `Requested service: ${lead.requestedService || "Not specified"}`,
    `Message: "${lead.message}"`,
  ].join("\n");
}

async function callGeminiJson<T>(prompt: string, schema: Record<string, unknown>): Promise<T> {
  const apiKey = env.geminiApiKey;
  if (!apiKey) {
    throw new Error("GEMINI_API_KEY is not configured.");
  }

  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${apiKey}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { responseMimeType: "application/json", responseSchema: schema },
      }),
    }
  );

  if (!res.ok) {
    throw new Error(`Gemini request failed: ${res.status} ${await res.text()}`);
  }

  const data = await res.json();
  const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) {
    throw new Error("Gemini returned no content.");
  }

  return JSON.parse(text) as T;
}

/**
 * Runs AI Lead Intelligence for a lead and writes the results onto it.
 * Best-effort: on any failure (missing key, network error, malformed
 * response) the lead's AI fields are left as-is and aiStatus becomes
 * "failed" — it must never fabricate a value. Called synchronously from
 * createLeadFromSubmission so every new lead is analyzed automatically, and
 * again from leadService.ts's regenerateAiInsights for a manual re-run.
 */
export async function analyzeLead(businessId: string, lead: Lead): Promise<void> {
  try {
    const insights = await callGeminiJson<GeminiInsights>(buildPrompt(lead), RESPONSE_SCHEMA);
    await updateLead(businessId, lead.id, {
      aiSummary: insights.summary,
      aiCategory: insights.category,
      aiPriority: insights.priority,
      aiPriorityReason: insights.priorityReason,
      aiOpportunityValueRange: insights.opportunityValueRange,
      aiOpportunityConfidence: insights.opportunityConfidence,
      suggestedNextAction: insights.suggestedNextAction,
      aiResponseUrgency: insights.responseUrgency,
      aiResponseUrgencyReason: insights.responseUrgencyReason,
      aiGeneratedAt: new Date().toISOString(),
      aiStatus: "completed",
    });
    await logLeadActivity(
      businessId,
      lead.id,
      "lead.ai_analyzed",
      `AI analysis complete — ${insights.priority} priority, ${insights.category}.`
    );
  } catch (error) {
    logAction("lead.ai-analysis-failed", {
      businessId,
      leadId: lead.leadId,
      error: error instanceof Error ? error.message : "unknown error",
    });
    try {
      await updateLead(businessId, lead.id, { aiStatus: "failed" });
    } catch {
      // Best-effort — if even this write fails the lead just stays "pending".
    }
  }
}

/**
 * Automatic lead acknowledgment email — sent to the CUSTOMER, not the
 * business owner, with no human review. This is a deliberate, narrow
 * exception to this codebase's normal rule (see CLAUDE.md's "Sending is
 * approval-gated" — that rule governs the Follow-up Queue's estimate/
 * negotiation emails, not this). Because nothing reviews this content before
 * it goes out, the prompt is written to make the model unable to say
 * anything that could be wrong: no prices, no commitments, no specific
 * response-time promises, no invented details — just a short, warm "we got
 * your message" note personalized only by category/summary framing.
 */
const ACKNOWLEDGMENT_SCHEMA = {
  type: "OBJECT",
  properties: {
    subject: { type: "STRING", description: "Short email subject line, e.g. \"We received your message\"." },
    body: { type: "STRING", description: "2-4 sentence plain-text email body, no greeting salutation line needed beyond the first sentence." },
  },
  required: ["subject", "body"],
};

interface AcknowledgmentContent {
  subject: string;
  body: string;
}

/**
 * What (if anything) services/appointmentBooking.ts resolved for this lead's
 * requested appointment — shapes the acknowledgment prompt below. "booked"
 * and "alternates" are the only cases where the email may state a specific
 * date/time, because by then it's either a real confirmed Calendar event or
 * a real open slot — never a guess.
 */
export type AcknowledgmentBookingOutcome =
  | { type: "none" }
  | { type: "booked"; dateTimeLabel: string }
  | { type: "alternates"; alternateLabels: string[] };

function buildAcknowledgmentPrompt(lead: Lead, businessName: string, booking: AcknowledgmentBookingOutcome): string {
  const base = [
    `You are writing the body of a short automatic acknowledgment email sent immediately and with NO human review to a customer who just submitted an inquiry through ${businessName}'s website contact form.`,
    "",
    "Hard rules, because nobody will proofread this before it sends:",
    "- Do NOT quote or imply any price, discount, or cost figure.",
    "- Do NOT invent any fact, detail, or commitment that isn't directly in the customer's message below, or explicitly given to you below.",
    "- Do NOT name a specific person as who will respond — no one has been assigned yet.",
    "- Keep it to 2-4 sentences: warm, professional, brief.",
    "- Do NOT include any sign-off, closing line, or the business name at the end — that's appended separately. End right after the last sentence of the message itself.",
  ];

  if (booking.type === "booked") {
    base.push(
      `- The customer's requested appointment IS confirmed and booked for: ${booking.dateTimeLabel}. State this specific date/time clearly and warmly — this is a real confirmed booking, not a guess.`,
      "- Mention they'll also receive a calendar invite for this time."
    );
  } else if (booking.type === "alternates") {
    base.push(
      `- The customer's exact requested time was not available. These alternate times ARE actually open: ${booking.alternateLabels.join(" or ")}. Offer these specific alternates and ask them to reply with which one works, or suggest another time.`
    );
  } else {
    base.push(
      "- Do NOT promise a specific response time (no \"within 24 hours\", no specific day/time) — only ever say something vague like \"shortly\" or \"soon\".",
      "- You may reference their request in a short general phrase (e.g. their category of inquiry) so it doesn't feel like a totally generic auto-reply, but stay vague enough to never risk being factually wrong."
    );
  }

  base.push(
    "",
    `Customer name: ${lead.name}`,
    `Business name: ${businessName}`,
    `Customer's message: "${lead.message}"`
  );

  return base.join("\n");
}

/**
 * Generates the acknowledgment email's subject/body via Gemini. Returns null
 * on any failure (missing key, network error, malformed response) — the
 * caller (services/leadService.ts's sendLeadAcknowledgmentEmail) treats that
 * as "skip sending," never as license to fall back to placeholder text.
 *
 * The sign-off is appended here in code, not left to the model — asking
 * Gemini to format "— {business}" on its own line produced inconsistent
 * results (sometimes no line break, sometimes "---" instead of an em dash).
 * Enforcing it deterministically is more robust than relying on prompt
 * compliance for something this mechanical.
 */
export async function generateLeadAcknowledgment(
  lead: Lead,
  businessName: string,
  booking: AcknowledgmentBookingOutcome = { type: "none" }
): Promise<AcknowledgmentContent | null> {
  try {
    const content = await callGeminiJson<AcknowledgmentContent>(
      buildAcknowledgmentPrompt(lead, businessName, booking),
      ACKNOWLEDGMENT_SCHEMA
    );
    return { subject: content.subject, body: `${content.body.trim()}\n\n— ${businessName}` };
  } catch (error) {
    logAction("lead.acknowledgment-generate-failed", {
      leadId: lead.leadId,
      error: error instanceof Error ? error.message : "unknown error",
    });
    return null;
  }
}

/** What Gemini extracted from a lead's message about a requested appointment — never fabricated, defaults to "not requested" on any ambiguity or failure. */
export interface RequestedAppointment {
  requested: boolean;
  /** Local wall-clock "YYYY-MM-DDTHH:MM:00" — paired with the business's timezone, not UTC. Set only when requested is true. */
  dateTime: string | null;
  durationMinutes: number;
}

const APPOINTMENT_SCHEMA = {
  type: "OBJECT",
  properties: {
    requested: {
      type: "BOOLEAN",
      description:
        "True only if the customer's message asks for a specific, unambiguous date AND time to meet/call/consult. False for vague requests (\"sometime next week\", \"whenever works\") or no scheduling request at all.",
    },
    date: { type: "STRING", description: "YYYY-MM-DD, only if requested is true and a specific date is clear." },
    time: { type: "STRING", description: "24-hour HH:MM, only if requested is true and a specific time is clear." },
    durationMinutes: {
      type: "NUMBER",
      description: "Reasonable estimated meeting length in minutes if inferable, otherwise 30.",
    },
  },
  required: ["requested"],
};

interface GeminiAppointmentResponse {
  requested: boolean;
  date?: string;
  time?: string;
  durationMinutes?: number;
}

/**
 * Extracts a requested appointment date/time from a lead's message, if any.
 * Deliberately conservative: requires BOTH a specific date and a specific
 * time to count as "requested" — anything vaguer resolves to
 * { requested: false }, same as any failure. Never throws.
 */
export async function parseRequestedAppointment(lead: Lead, businessTimezone: string): Promise<RequestedAppointment> {
  const fallback: RequestedAppointment = { requested: false, dateTime: null, durationMinutes: 30 };
  try {
    const today = new Date().toLocaleDateString("en-CA", { timeZone: businessTimezone }); // en-CA gives YYYY-MM-DD
    const prompt = [
      `Today's date is ${today} (timezone: ${businessTimezone}). A customer submitted this inquiry:`,
      `"${lead.message}"`,
      "",
      "Does it request a specific date AND time to meet, call, or consult? If a date is relative (e.g. \"next Tuesday\") or missing a year, resolve it to the correct upcoming calendar date given today's date above.",
    ].join("\n");

    const result = await callGeminiJson<GeminiAppointmentResponse>(prompt, APPOINTMENT_SCHEMA);
    if (!result.requested || !result.date || !result.time) {
      return fallback;
    }
    return {
      requested: true,
      dateTime: `${result.date}T${result.time}:00`,
      durationMinutes: result.durationMinutes && result.durationMinutes > 0 ? result.durationMinutes : 30,
    };
  } catch (error) {
    logAction("lead.appointment-parse-failed", {
      leadId: lead.leadId,
      error: error instanceof Error ? error.message : "unknown error",
    });
    return fallback;
  }
}
