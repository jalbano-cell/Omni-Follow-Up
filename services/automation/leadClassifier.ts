import { updateLead } from "@/services/db";
import { logLeadActivity } from "@/services/activityService";
import { logAction } from "@/lib/logger";
import type { Lead } from "@/types";

/**
 * Deterministic replacement for the old Gemini-backed lead analysis — same
 * output shape the Lead Details page already renders (see
 * components/leads/ai-insights-card.tsx), just produced by keyword rules and
 * lookup tables instead of an LLM call. No network access, no randomness:
 * the same lead always classifies the same way.
 */
export interface LeadClassification {
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

const CATEGORY_RULES: Array<{ category: string; pattern: RegExp }> = [
  { category: "Website", pattern: /\b(website|site|web design|webpage)\b/i },
  { category: "SEO", pattern: /\b(seo|search ranking|rankings?)\b/i },
  { category: "Automation", pattern: /\b(automation|automate|workflow system)\b/i },
  { category: "AI Agent", pattern: /\b(ai agent|chatbot|virtual assistant)\b/i },
  { category: "Restaurant", pattern: /\brestaurant\b/i },
  { category: "Quote Request", pattern: /\b(quote|estimate|price|pricing|cost)\b/i },
];

const OPPORTUNITY_BY_CATEGORY: Record<string, string> = {
  Website: "$1,500 - $5,000",
  SEO: "$500 - $2,500/mo",
  Automation: "$2,000 - $8,000",
  "AI Agent": "$3,000 - $10,000",
  Restaurant: "$1,000 - $4,000",
  "Quote Request": "$500 - $3,000",
  "General Inquiry": "$500 - $2,000",
};

const URGENT_PATTERN = /\b(urgent|asap|emergency|immediately)\b/i;
const TODAY_PATTERN = /\btoday\b/i;
/** Matches dollar figures like "$5,000", "$5000", "5k" — used only to flag high-value leads, never shown verbatim. */
const BUDGET_PATTERN = /\$\s?([\d,]+(?:\.\d+)?)\s?(k)?\b|\b(\d[\d,]*)\s?(k)\b/gi;

function classifyCategory(text: string): string {
  for (const rule of CATEGORY_RULES) {
    if (rule.pattern.test(text)) return rule.category;
  }
  return "General Inquiry";
}

/** True if any dollar figure in the text is at or above $5,000, accounting for a trailing "k" shorthand. */
function hasHighBudgetSignal(text: string): boolean {
  for (const match of text.matchAll(BUDGET_PATTERN)) {
    const raw = (match[1] ?? match[3] ?? "").replace(/,/g, "");
    const isThousands = Boolean(match[2] ?? match[4]);
    const value = Number(raw) * (isThousands ? 1000 : 1);
    if (Number.isFinite(value) && value >= 5000) return true;
  }
  return false;
}

function classifyPriority(text: string): { priority: LeadClassification["priority"]; reason: string } {
  if (URGENT_PATTERN.test(text) || TODAY_PATTERN.test(text)) {
    return {
      priority: "High",
      reason: 'Message uses urgent language ("urgent"/"asap"/"today") requesting fast attention.',
    };
  }
  if (hasHighBudgetSignal(text)) {
    return {
      priority: "High",
      reason: "Message mentions a budget at or above the $5,000 high-value threshold.",
    };
  }
  if (text.trim().length < 40) {
    return {
      priority: "Low",
      reason: "Message is brief with limited detail — likely needs clarification before it can be prioritized.",
    };
  }
  return {
    priority: "Medium",
    reason: "Standard inquiry with enough detail to act on — no urgency or budget signal detected.",
  };
}

function suggestedNextAction(priority: LeadClassification["priority"], category: string): string {
  if (priority === "High" && category === "Quote Request") return "Prepare proposal";
  if (priority === "High") return "Schedule discovery call";
  return "Request more information";
}

function classifyUrgency(
  text: string,
  priority: LeadClassification["priority"]
): { urgency: LeadClassification["responseUrgency"]; reason: string } {
  if (URGENT_PATTERN.test(text) || TODAY_PATTERN.test(text)) {
    return { urgency: "Today", reason: 'Message language ("urgent"/"asap"/"today") calls for a same-day response.' };
  }
  if (priority === "High") {
    return { urgency: "24 hours", reason: "High-priority lead — respond within a business day." };
  }
  if (priority === "Medium") {
    return { urgency: "3 days", reason: "Standard inquiry — respond within a few business days." };
  }
  return { urgency: "1 week", reason: "Low-priority, low-detail inquiry — a week's response window is reasonable." };
}

function buildSummary(message: string): string {
  const normalized = message.replace(/\s+/g, " ").trim();
  if (normalized.length <= 200) return normalized;
  const truncated = normalized.slice(0, 200);
  const lastSpace = truncated.lastIndexOf(" ");
  return `${truncated.slice(0, lastSpace > 0 ? lastSpace : 200)}…`;
}

/** Classifies a lead's message into the same fields analyzeLead used to write via Gemini — pure and synchronous. */
export function classifyLead(lead: Lead): LeadClassification {
  const text = `${lead.requestedService} ${lead.message}`;
  const category = classifyCategory(text);
  const { priority, reason: priorityReason } = classifyPriority(text);
  const { urgency, reason: urgencyReason } = classifyUrgency(text, priority);

  return {
    summary: buildSummary(lead.message),
    category,
    priority,
    priorityReason,
    opportunityValueRange: OPPORTUNITY_BY_CATEGORY[category] ?? OPPORTUNITY_BY_CATEGORY["General Inquiry"],
    opportunityConfidence: `Rough estimate based on typical ${category} project pricing — not a specific quote for this lead.`,
    suggestedNextAction: suggestedNextAction(priority, category),
    responseUrgency: urgency,
    responseUrgencyReason: urgencyReason,
  };
}

/**
 * Runs the rule engine for a lead and writes the results onto it. Unlike the
 * old Gemini-backed version, classification itself can't fail — the only
 * failure mode left is the database write, which is caught and logged the
 * same way (aiStatus becomes "failed" rather than throwing) so callers can
 * keep treating this as never-throws. Called synchronously from
 * createLeadFromSubmission so every new lead is classified automatically,
 * and again from leadService.ts's regenerateAiInsights for a manual re-run.
 */
export async function analyzeLead(businessId: string, lead: Lead): Promise<void> {
  const insights = classifyLead(lead);
  try {
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
      `Analysis complete — ${insights.priority} priority, ${insights.category}.`
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
