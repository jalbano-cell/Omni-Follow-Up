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

async function callGemini(prompt: string): Promise<GeminiInsights> {
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
        generationConfig: { responseMimeType: "application/json", responseSchema: RESPONSE_SCHEMA },
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

  return JSON.parse(text) as GeminiInsights;
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
    const insights = await callGemini(buildPrompt(lead));
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
