const GMAIL_API = "https://gmail.googleapis.com/gmail/v1/users/me";

/**
 * Read-only Gmail transport — deliberately separate from services/gmail.ts
 * (which only ever sends) to keep send/read concerns split. Pure transport:
 * no Airtable, no matching/dedup logic, no orchestration.
 */

interface GmailHeader {
  name: string;
  value: string;
}

interface GmailMessagePart {
  mimeType?: string;
  body?: { data?: string; size?: number };
  parts?: GmailMessagePart[];
}

interface GmailMessage {
  id: string;
  threadId: string;
  snippet: string;
  internalDate: string;
  payload?: {
    headers?: GmailHeader[];
    mimeType?: string;
    body?: { data?: string; size?: number };
    parts?: GmailMessagePart[];
  };
}

export interface ParsedGmailMessage {
  gmailMessageId: string;
  threadId: string;
  fromHeader: string;
  subject: string;
  snippet: string;
  bodyText: string;
  receivedAt: string;
}

function base64UrlDecode(data: string): string {
  const normalized = data.replace(/-/g, "+").replace(/_/g, "/");
  return Buffer.from(normalized, "base64").toString("utf-8");
}

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

/** Recursively searches MIME parts for a text body, preferring text/plain over text/html. */
function findBodyText(part: GmailMessagePart | undefined): { plain: string | null; html: string | null } {
  if (!part) return { plain: null, html: null };

  if (part.mimeType === "text/plain" && part.body?.data) {
    return { plain: base64UrlDecode(part.body.data), html: null };
  }
  if (part.mimeType === "text/html" && part.body?.data) {
    return { plain: null, html: base64UrlDecode(part.body.data) };
  }

  for (const child of part.parts ?? []) {
    const found = findBodyText(child);
    if (found.plain) return found;
    if (found.html && !found.plain) return found;
  }

  return { plain: null, html: null };
}

function parseMessage(message: GmailMessage): ParsedGmailMessage {
  const headers = message.payload?.headers ?? [];
  const getHeader = (name: string) => headers.find((h) => h.name.toLowerCase() === name.toLowerCase())?.value ?? "";

  const { plain, html } = findBodyText({
    mimeType: message.payload?.mimeType,
    body: message.payload?.body,
    parts: message.payload?.parts,
  });
  const bodyText = plain ?? (html ? stripHtml(html) : message.snippet);

  return {
    gmailMessageId: message.id,
    threadId: message.threadId,
    fromHeader: getHeader("From"),
    subject: getHeader("Subject"),
    snippet: message.snippet,
    bodyText,
    receivedAt: new Date(Number(message.internalDate)).toISOString(),
  };
}

/** Fetches every message in a Gmail thread, parsed into a normalized shape. */
export async function getThreadMessages(input: { accessToken: string; threadId: string }): Promise<ParsedGmailMessage[]> {
  const res = await fetch(`${GMAIL_API}/threads/${input.threadId}?format=full`, {
    headers: { Authorization: `Bearer ${input.accessToken}` },
  });

  if (res.status === 404) {
    return [];
  }
  if (!res.ok) {
    throw new Error(`Gmail thread fetch failed (${res.status}): ${await res.text()}`);
  }

  const data = (await res.json()) as { messages?: GmailMessage[] };
  return (data.messages ?? []).map(parseMessage);
}

/** Extracts the bare email address from a "Display Name <email@example.com>" header value. */
export function extractEmailAddress(fromHeader: string): string {
  const match = fromHeader.match(/<([^>]+)>/);
  return (match ? match[1] : fromHeader).trim().toLowerCase();
}
