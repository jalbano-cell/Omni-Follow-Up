import { refreshAccessToken } from "@/services/microsoftOAuth";
import { MICROSOFT_GRAPH_API } from "@/config/microsoft";

/**
 * Thin, dependency-free Microsoft Graph mail-send client — pure transport,
 * mirrors services/gmail.ts's structure and behavior exactly (same "Re:"
 * subject-prefix-on-reply rule, same refresh-before-every-call pattern).
 * Kept as its own file, separate from services/microsoftGraphInbox.ts's
 * reads, matching CLAUDE.md's stated rule for gmail.ts/gmailInbox.ts —
 * don't merge those either.
 *
 * Threading works differently than Gmail's own-owned threadId param: Graph
 * doesn't accept a client-supplied conversationId on create (it's system-
 * assigned from the subject + headers), so this relies on setting the
 * standard `In-Reply-To`/`References` internet message headers on the
 * draft — the same RFC 5322 mechanism Gmail's raw-MIME send uses — which
 * Graph (and every mail client) groups into a conversation from. The
 * `threadId` input is accepted for interface-shape symmetry but isn't sent
 * anywhere; the resulting conversationId is read back from Graph's own
 * response instead.
 */

export interface SendGraphEmailInput {
  refreshToken: string;
  to: string;
  subject: string;
  body: string;
  /** Accepted for symmetry with services/gmail.ts's SendEmailInput; not sent to Graph (see file doc comment) — the resulting conversationId is what matters going forward. */
  threadId?: string | null;
  /** RFC 822 Message-ID of the prior email in the thread — set as the In-Reply-To/References header on the new draft. */
  inReplyToMessageId?: string | null;
}

export interface SendGraphEmailResult {
  graphMessageId: string;
  conversationId: string;
  /** Graph's own internetMessageId, assigned at draft creation (before send) — RFC 822 Message-ID equivalent. */
  rfc822MessageId: string | null;
}

interface DraftMessageResponse {
  id: string;
  conversationId: string;
  internetMessageId?: string;
}

/**
 * Immutable ids don't change when a message moves folders (Drafts -> Sent
 * Items on send) — without this header Graph can return the classic
 * "Outlook ID" format, which is NOT guaranteed stable across that move,
 * silently breaking a later reply-to-this-message call.
 */
const IMMUTABLE_ID_HEADERS = { Prefer: 'IdType="ImmutableId"' };

/** Sends one plain-text email via Microsoft Graph, replying in-thread when inReplyToMessageId is given. */
export async function sendEmail(input: SendGraphEmailInput): Promise<SendGraphEmailResult> {
  const accessToken = await refreshAccessToken(input.refreshToken);
  const subject = input.threadId && !/^re:/i.test(input.subject) ? `Re: ${input.subject}` : input.subject;

  const draftBody: Record<string, unknown> = {
    subject,
    body: { contentType: "Text", content: input.body },
    toRecipients: [{ emailAddress: { address: input.to } }],
  };
  if (input.inReplyToMessageId) {
    draftBody.internetMessageHeaders = [
      { name: "In-Reply-To", value: input.inReplyToMessageId },
      { name: "References", value: input.inReplyToMessageId },
    ];
  }

  const createRes = await fetch(`${MICROSOFT_GRAPH_API}/me/messages`, {
    method: "POST",
    headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json", ...IMMUTABLE_ID_HEADERS },
    body: JSON.stringify(draftBody),
  });
  if (!createRes.ok) {
    throw new Error(`Microsoft Graph draft creation failed (${createRes.status}): ${await createRes.text()}`);
  }
  const draft = (await createRes.json()) as DraftMessageResponse;

  const sendRes = await fetch(`${MICROSOFT_GRAPH_API}/me/messages/${draft.id}/send`, {
    method: "POST",
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!sendRes.ok) {
    throw new Error(`Microsoft Graph send failed (${sendRes.status}): ${await sendRes.text()}`);
  }

  return {
    graphMessageId: draft.id,
    conversationId: draft.conversationId,
    rfc822MessageId: draft.internetMessageId ?? null,
  };
}
