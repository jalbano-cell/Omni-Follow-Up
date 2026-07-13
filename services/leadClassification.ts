import { getSupabase } from "@/lib/supabase";
import { callClaudeHaiku } from "@/services/anthropic";
import { logAction } from "@/lib/logger";
import type { ParsedGmailMessage } from "@/services/gmailInbox";

/**
 * Step 1 of the inbound-email lead classifier: classify and log, nothing
 * else. This never creates, blocks, or alters a Lead row — it only records
 * what Claude Haiku decided about a Gmail thread, for review at
 * /admin/classifications while the prompt gets tuned. Deliberately separate
 * from services/automation/leadClassifier.ts, the existing deterministic
 * (non-LLM) classifier that scores an already-created Lead's
 * priority/category — different pipeline stage, different question, and
 * that file's "no AI/LLM" rule doesn't apply here (see CLAUDE.md).
 */

const BODY_TRUNCATE_CHARS = 1500;

const CLASSIFIER_INTENTS = [
  "new_work_request",
  "existing_customer",
  "supplier_vendor",
  "spam_promo",
  "personal",
  "other",
] as const;

export type ClassifierIntent = (typeof CLASSIFIER_INTENTS)[number];

/**
 * Byte-identical on every call — this exact string is what Anthropic's
 * prompt cache keys on (services/anthropic.ts marks it `cache_control:
 * ephemeral`). Never interpolate per-business or per-email content into
 * this constant; that belongs in the user message instead.
 */
const SYSTEM_PROMPT = `You are a lead-qualification classifier for local service businesses (plumbers, HVAC, contractors, and similar trades). You will be shown one inbound email: its sender, subject, and body. Decide whether it is a genuine, NEW inbound request for potential new work or service.

A "lead" is narrowly defined as: a prospective or existing customer asking about, requesting a quote/estimate for, or describing a problem they want help with — i.e. potential NEW business for this company.

These are NEVER leads, no matter how they're worded:
- Invoices, receipts, billing statements, or payment confirmations
- Newsletters, marketing emails, or promotional offers
- Supplier or vendor correspondence (ordering materials, account statements, purchase orders)
- Personal or social email unrelated to business
- Automated notifications, calendar invites, or other system-generated mail
- Spam

A message from an existing customer only counts as a lead if they're asking about NEW work — a reply about a job already in progress, a status check, or scheduling an already-agreed appointment is NOT a lead.

Respond with ONLY this JSON object and nothing else — no markdown formatting, no code fences, no explanation before or after it:
{"is_lead": boolean, "confidence": number between 0 and 1, "reason": "short string, one sentence", "intent": "new_work_request" | "existing_customer" | "supplier_vendor" | "spam_promo" | "personal" | "other"}`;

interface ParsedClassification {
  is_lead: boolean;
  confidence: number;
  reason: string;
  intent: ClassifierIntent;
}

/** Strips markdown code fences / stray surrounding text the model might add despite instructions, then extracts the first {...} object. */
function extractJsonObject(raw: string): string | null {
  const stripped = raw.replace(/```(?:json)?/gi, "").trim();
  const match = stripped.match(/\{[\s\S]*\}/);
  return match ? match[0] : null;
}

function isValidClassification(value: unknown): value is ParsedClassification {
  if (!value || typeof value !== "object") return false;
  const v = value as Record<string, unknown>;
  return (
    typeof v.is_lead === "boolean" &&
    typeof v.confidence === "number" &&
    v.confidence >= 0 &&
    v.confidence <= 1 &&
    typeof v.reason === "string" &&
    typeof v.intent === "string" &&
    (CLASSIFIER_INTENTS as readonly string[]).includes(v.intent)
  );
}

/** Safe-parses a raw model response into a validated classification, or null on any parse/shape failure — never throws, never guesses a label. Exported for unit testing only; every other caller goes through classifyAndLogThread. */
export function safeParseClassification(raw: string): ParsedClassification | null {
  const jsonText = extractJsonObject(raw);
  if (!jsonText) return null;

  try {
    const parsed = JSON.parse(jsonText);
    return isValidClassification(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

interface UpsertClassificationInput {
  workspaceId: string;
  gmailThreadId: string;
  gmailMessageId: string | null;
  subject: string;
  fromHeader: string;
  status: "classified" | "unclassified";
  isLead: boolean | null;
  confidence: number | null;
  reason: string | null;
  intent: string | null;
  modelUsed: string | null;
  rawResponse: string | null;
}

/** Upserts on (workspace_id, gmail_thread_id) — classifying the same thread twice updates the existing row instead of creating a duplicate. */
async function upsertClassification(input: UpsertClassificationInput): Promise<void> {
  const { error } = await getSupabase()
    .from("lead_classifications")
    .upsert(
      {
        workspace_id: input.workspaceId,
        gmail_thread_id: input.gmailThreadId,
        gmail_message_id: input.gmailMessageId,
        subject: input.subject,
        from_header: input.fromHeader,
        status: input.status,
        is_lead: input.isLead,
        confidence: input.confidence,
        reason: input.reason,
        intent: input.intent,
        model_used: input.modelUsed,
        raw_response: input.rawResponse,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "workspace_id,gmail_thread_id" }
    );

  if (error) {
    throw new Error(`Supabase upsert on "lead_classifications" failed: ${error.message}`);
  }
}

/**
 * Classifies one Gmail thread and logs the decision. Guaranteed never to
 * throw or reject — every failure mode (missing API key, Anthropic API
 * error, unparseable response, or even a Supabase write failure) is caught,
 * logged via logAction, and best-effort recorded as an `unclassified` row
 * for retry on the next scan. Callers (e.g. services/gmailLeadCapture.ts)
 * can await this with no try/catch of their own and no risk of it breaking
 * whatever else is happening in the same loop iteration.
 */
export async function classifyAndLogThread(input: {
  workspaceId: string;
  gmailThreadId: string;
  gmailMessageId: string;
  subject: string;
  fromHeader: string;
  bodyText: string;
}): Promise<void> {
  try {
    const userContent = `From: ${input.fromHeader}\nSubject: ${input.subject}\n\n${input.bodyText.slice(0, BODY_TRUNCATE_CHARS)}`;

    const result = await callClaudeHaiku({ systemPrompt: SYSTEM_PROMPT, userContent });

    if (!result.ok) {
      const reason =
        result.reason === "missing_api_key"
          ? "Anthropic API key not configured (ANTHROPIC_API_KEY unset) — classification skipped."
          : `Anthropic API error: ${result.error}`;
      logAction("lead-classification.call-failed", { workspaceId: input.workspaceId, threadId: input.gmailThreadId, reason: result.reason });
      await upsertClassification({
        workspaceId: input.workspaceId,
        gmailThreadId: input.gmailThreadId,
        gmailMessageId: input.gmailMessageId,
        subject: input.subject,
        fromHeader: input.fromHeader,
        status: "unclassified",
        isLead: null,
        confidence: null,
        reason,
        intent: null,
        modelUsed: null,
        rawResponse: null,
      });
      return;
    }

    const parsed = safeParseClassification(result.text);

    if (!parsed) {
      logAction("lead-classification.parse-failed", { workspaceId: input.workspaceId, threadId: input.gmailThreadId, rawResponse: result.text });
      await upsertClassification({
        workspaceId: input.workspaceId,
        gmailThreadId: input.gmailThreadId,
        gmailMessageId: input.gmailMessageId,
        subject: input.subject,
        fromHeader: input.fromHeader,
        status: "unclassified",
        isLead: null,
        confidence: null,
        reason: "Failed to parse classifier response as valid JSON — see raw_response.",
        intent: null,
        modelUsed: result.modelUsed,
        rawResponse: result.text,
      });
      return;
    }

    await upsertClassification({
      workspaceId: input.workspaceId,
      gmailThreadId: input.gmailThreadId,
      gmailMessageId: input.gmailMessageId,
      subject: input.subject,
      fromHeader: input.fromHeader,
      status: "classified",
      isLead: parsed.is_lead,
      confidence: parsed.confidence,
      reason: parsed.reason,
      intent: parsed.intent,
      modelUsed: result.modelUsed,
      rawResponse: result.text,
    });
  } catch (error) {
    // Belt-and-suspenders — e.g. a Supabase write failure inside the try
    // block above. Classification must never break the caller's batch.
    logAction("lead-classification.unexpected-error", {
      workspaceId: input.workspaceId,
      threadId: input.gmailThreadId,
      error: error instanceof Error ? error.message : "unknown error",
    });
  }
}

/** Convenience wrapper taking a parsed Gmail message directly (services/gmailInbox.ts's shape), so call sites don't need to destructure it themselves. */
export async function classifyAndLogMessage(workspaceId: string, message: ParsedGmailMessage): Promise<void> {
  await classifyAndLogThread({
    workspaceId,
    gmailThreadId: message.threadId,
    gmailMessageId: message.gmailMessageId,
    subject: message.subject,
    fromHeader: message.fromHeader,
    bodyText: message.bodyText,
  });
}

export interface LeadClassificationRow {
  id: string;
  workspaceId: string;
  gmailThreadId: string;
  gmailMessageId: string | null;
  subject: string | null;
  fromHeader: string | null;
  isLead: boolean | null;
  confidence: number | null;
  reason: string | null;
  intent: string | null;
  modelUsed: string | null;
  rawResponse: string | null;
  status: string;
  createdAt: string;
  updatedAt: string;
}

/** Every classification decision across every business, newest first — backs the /admin/classifications review list. */
export async function getAllLeadClassifications(limit = 200): Promise<LeadClassificationRow[]> {
  const { data, error } = await getSupabase()
    .from("lead_classifications")
    .select()
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) {
    throw new Error(`Supabase select on "lead_classifications" failed: ${error.message}`);
  }

  return (data ?? []).map((row) => ({
    id: row.id,
    workspaceId: row.workspace_id,
    gmailThreadId: row.gmail_thread_id,
    gmailMessageId: row.gmail_message_id,
    subject: row.subject,
    fromHeader: row.from_header,
    isLead: row.is_lead,
    confidence: row.confidence,
    reason: row.reason,
    intent: row.intent,
    modelUsed: row.model_used,
    rawResponse: row.raw_response,
    status: row.status,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }));
}
