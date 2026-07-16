import { NextResponse } from "next/server";
import { getOptionalSession } from "@/lib/session";
import { getBusinessById, hasActiveEntitlement } from "@/services/business";
import { rateLimit } from "@/lib/rateLimit";
import {
  runSupportChat,
  MAX_HISTORY_MESSAGES,
  MAX_MESSAGE_CHARS,
  type SupportMessage,
} from "@/services/support/supportChat";

/**
 * In-app support assistant endpoint ("Ask Omni"). Session-gated: it is NOT in
 * middleware.ts's PUBLIC_PATHS, so only a request carrying a valid session
 * cookie reaches here — and we independently re-resolve the session (rather
 * than trusting middleware) via getOptionalSession, per lib/session.ts's
 * convention. The workspace the chat runs against is the authenticated
 * business's own; the client cannot name a different one.
 */

const RATE_LIMIT_MAX = 20;
const RATE_LIMIT_WINDOW_MS = 60_000;

const CANT_HELP =
  "Sorry — I can't answer that right now. Please reach out to your account manager for help.";

function parseHistory(body: unknown): SupportMessage[] | null {
  if (!body || typeof body !== "object") return null;
  const raw = (body as { messages?: unknown }).messages;
  if (!Array.isArray(raw) || raw.length === 0) return null;

  const messages: SupportMessage[] = [];
  for (const item of raw) {
    if (!item || typeof item !== "object") return null;
    const { role, content } = item as { role?: unknown; content?: unknown };
    if (role !== "user" && role !== "assistant") return null;
    if (typeof content !== "string") return null;
    const trimmed = content.trim();
    if (!trimmed) return null;
    messages.push({ role, content: trimmed.slice(0, MAX_MESSAGE_CHARS) });
  }

  // Keep the most recent turns only, and require the last turn to be the user's.
  const recent = messages.slice(-MAX_HISTORY_MESSAGES);
  if (recent[recent.length - 1].role !== "user") return null;
  return recent;
}

export async function POST(request: Request) {
  const session = await getOptionalSession();
  if (!session) {
    return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  }

  const business = await getBusinessById(session.businessId);
  if (!business || !hasActiveEntitlement(business)) {
    return NextResponse.json({ error: "Workspace unavailable." }, { status: 403 });
  }

  const limit = await rateLimit(`support:${business.id}`, { max: RATE_LIMIT_MAX, windowMs: RATE_LIMIT_WINDOW_MS });
  if (limit.limited) {
    return NextResponse.json(
      { reply: "You're sending messages a little fast — give it a moment and try again." },
      { status: 429 }
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  const messages = parseHistory(body);
  if (!messages) {
    return NextResponse.json({ error: "Invalid messages." }, { status: 400 });
  }

  const result = await runSupportChat(business, messages);
  if (!result.ok) {
    // Missing key / API error — degrade to a graceful in-chat message, not a 500.
    return NextResponse.json({ reply: CANT_HELP });
  }

  return NextResponse.json({ reply: result.reply || CANT_HELP });
}
