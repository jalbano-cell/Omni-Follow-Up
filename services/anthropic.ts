import Anthropic from "@anthropic-ai/sdk";
import { env } from "@/lib/env";

/**
 * Thin, dependency-free wrapper around the Anthropic Messages API — pure
 * transport, no database or classification logic (that lives in
 * services/leadClassification.ts). The client is constructed lazily inside
 * callClaudeHaiku, not at module load, so importing this file never throws
 * even when ANTHROPIC_API_KEY is unset — only an actual call attempt does,
 * and even then it returns a tagged failure rather than throwing.
 */

/**
 * Pinned to the dated snapshot (not the floating "claude-haiku-4-5" alias)
 * so classifier behavior can't shift under an in-flight prompt-tuning
 * session — confirmed against this SDK's own Model union
 * (node_modules/@anthropic-ai/sdk/resources/messages/messages.d.ts).
 */
export const CLASSIFIER_MODEL = "claude-haiku-4-5-20251001";

const MAX_TOKENS = 150;
const REQUEST_TIMEOUT_MS = 15_000;

let client: Anthropic | null = null;

function getClient(): Anthropic | null {
  if (!env.anthropicApiKey) return null;
  if (!client) client = new Anthropic({ apiKey: env.anthropicApiKey });
  return client;
}

export type AnthropicCallResult =
  | { ok: true; text: string; modelUsed: string }
  | { ok: false; reason: "missing_api_key" }
  | { ok: false; reason: "api_error"; error: string };

/**
 * One call to Claude Haiku with the classifier's cached system prompt.
 * `systemPrompt` must be byte-identical across calls to hit Anthropic's
 * prompt cache (marked `cache_control: { type: "ephemeral" }`); `userContent`
 * (the per-email subject/sender/body) is never cached, since it's different
 * on every call. Never throws — every failure mode (missing key, rate limit,
 * timeout, network error) comes back as an `ok: false` result for the caller
 * to log and treat as "leave unclassified for retry."
 */
export async function callClaudeHaiku(input: { systemPrompt: string; userContent: string }): Promise<AnthropicCallResult> {
  const anthropic = getClient();
  if (!anthropic) {
    return { ok: false, reason: "missing_api_key" };
  }

  try {
    const response = await anthropic.messages.create(
      {
        model: CLASSIFIER_MODEL,
        max_tokens: MAX_TOKENS,
        temperature: 0,
        system: [{ type: "text", text: input.systemPrompt, cache_control: { type: "ephemeral" } }],
        messages: [{ role: "user", content: input.userContent }],
      },
      { timeout: REQUEST_TIMEOUT_MS }
    );

    const text = response.content
      .filter((block): block is Anthropic.TextBlock => block.type === "text")
      .map((block) => block.text)
      .join("");

    return { ok: true, text, modelUsed: response.model };
  } catch (error) {
    return { ok: false, reason: "api_error", error: error instanceof Error ? error.message : "unknown error" };
  }
}
