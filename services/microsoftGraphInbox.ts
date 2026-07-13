import { MICROSOFT_GRAPH_API } from "@/config/microsoft";

/**
 * Read-only Microsoft Graph transport — mirrors services/gmailInbox.ts's
 * structure (pure transport, no database writes, no matching/dedup logic).
 * Kept separate from services/microsoftGraphSend.ts's sends, same rationale
 * CLAUDE.md states for gmail.ts/gmailInbox.ts.
 */

interface GraphMessage {
  id: string;
  conversationId: string;
  subject?: string;
  bodyPreview?: string;
  body?: { contentType?: string; content?: string };
  from?: { emailAddress?: { name?: string; address?: string } };
  receivedDateTime: string;
}

export interface ParsedGraphMessage {
  graphMessageId: string;
  conversationId: string;
  fromHeader: string;
  subject: string;
  snippet: string;
  bodyText: string;
  receivedAt: string;
}

/** Duplicated from services/gmailInbox.ts's private stripHtml on purpose — small, self-contained, and each provider's HTML shape can drift independently without one file's tweak silently affecting the other. */
function stripHtml(html: string): string {
  return html
    .replace(/<(script|style)[^>]*>[\s\S]*?<\/\1>/gi, "")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/\s+/g, " ")
    .trim();
}

/** Formats Graph's structured from.emailAddress into the same "Name <email>" (or bare email) shape services/gmailInbox.ts's fromHeader carries, so extractEmailAddress/extractDisplayName work unchanged on either provider's messages. */
function formatFromHeader(from: GraphMessage["from"]): string {
  const address = from?.emailAddress?.address ?? "";
  const name = from?.emailAddress?.name;
  return name && name !== address ? `${name} <${address}>` : address;
}

function parseMessage(message: GraphMessage): ParsedGraphMessage {
  const bodyText =
    message.body?.contentType === "html" ? stripHtml(message.body.content ?? "") : (message.body?.content ?? message.bodyPreview ?? "");

  return {
    graphMessageId: message.id,
    conversationId: message.conversationId,
    fromHeader: formatFromHeader(message.from),
    subject: message.subject ?? "",
    snippet: message.bodyPreview ?? "",
    bodyText,
    receivedAt: message.receivedDateTime,
  };
}

/** Immutable ids stay stable across a folder move (e.g. Drafts -> Sent Items) — see services/microsoftGraphSend.ts's doc comment. */
const IMMUTABLE_ID_HEADERS = { Prefer: 'IdType="ImmutableId"' };

/** Fetches every message in a Graph conversation, parsed into a normalized shape — mirrors services/gmailInbox.ts's getThreadMessages. */
export async function getThreadMessages(input: { accessToken: string; threadId: string }): Promise<ParsedGraphMessage[]> {
  const params = new URLSearchParams({
    $filter: `conversationId eq '${input.threadId}'`,
    $select: "id,conversationId,subject,bodyPreview,body,from,receivedDateTime",
    $orderby: "receivedDateTime asc",
  });

  const res = await fetch(`${MICROSOFT_GRAPH_API}/me/messages?${params.toString()}`, {
    headers: { Authorization: `Bearer ${input.accessToken}`, ...IMMUTABLE_ID_HEADERS },
  });

  if (res.status === 404) {
    return [];
  }
  if (!res.ok) {
    throw new Error(`Microsoft Graph thread fetch failed (${res.status}): ${await res.text()}`);
  }

  const data = (await res.json()) as { value?: GraphMessage[] };
  return (data.value ?? []).map(parseMessage);
}
