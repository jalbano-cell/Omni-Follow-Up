import { refreshAccessToken } from "@/services/googleOAuth";

const GMAIL_API = "https://gmail.googleapis.com/gmail/v1/users/me";

/**
 * Thin, dependency-free Gmail API client — pure transport, no database or
 * orchestration knowledge. Each call is parameterized with the sending
 * business's own refresh token/address (services/googleOAuth.ts handles the
 * OAuth exchange itself), since Gmail sending is per-tenant, not a single
 * shared account.
 */

function base64UrlEncode(input: string): string {
  return Buffer.from(input, "utf-8")
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

function buildRawMessage(params: {
  to: string;
  from: string;
  subject: string;
  body: string;
  inReplyTo?: string | null;
}): string {
  const headers = [
    `To: ${params.to}`,
    `From: ${params.from}`,
    `Subject: ${params.subject}`,
    `Content-Type: text/plain; charset="UTF-8"`,
    `MIME-Version: 1.0`,
  ];
  if (params.inReplyTo) {
    headers.push(`In-Reply-To: ${params.inReplyTo}`);
    headers.push(`References: ${params.inReplyTo}`);
  }

  return base64UrlEncode(`${headers.join("\r\n")}\r\n\r\n${params.body}`);
}

async function getRfc822MessageId(accessToken: string, gmailMessageId: string): Promise<string | null> {
  const res = await fetch(
    `${GMAIL_API}/messages/${gmailMessageId}?format=metadata&metadataHeaders=Message-Id`,
    { headers: { Authorization: `Bearer ${accessToken}` } }
  );
  if (!res.ok) return null;

  const data = (await res.json()) as { payload?: { headers?: { name: string; value: string }[] } };
  return data.payload?.headers?.find((h) => h.name === "Message-Id")?.value ?? null;
}

export interface SendEmailInput {
  /** The sending business's own Google OAuth refresh token (decrypted). */
  refreshToken: string;
  /** The connected Gmail address to send From. */
  fromEmail: string;
  to: string;
  subject: string;
  body: string;
  /** Existing Gmail thread to reply within, if this customer already has one. */
  threadId?: string | null;
  /** RFC 822 Message-ID header of the prior email in the thread, for In-Reply-To/References. */
  inReplyToMessageId?: string | null;
}

export interface SendEmailResult {
  gmailMessageId: string;
  threadId: string;
  /** RFC 822 Message-ID header of this send — persist it to thread the *next* follow-up. */
  rfc822MessageId: string | null;
}

/** Sends one plain-text email via Gmail, replying in-thread when threadId/inReplyToMessageId are given. */
export async function sendEmail(input: SendEmailInput): Promise<SendEmailResult> {
  const accessToken = await refreshAccessToken(input.refreshToken);
  const subject =
    input.threadId && !/^re:/i.test(input.subject) ? `Re: ${input.subject}` : input.subject;

  const raw = buildRawMessage({
    to: input.to,
    from: input.fromEmail,
    subject,
    body: input.body,
    inReplyTo: input.inReplyToMessageId,
  });

  const res = await fetch(`${GMAIL_API}/messages/send`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      raw,
      ...(input.threadId ? { threadId: input.threadId } : {}),
    }),
  });

  if (!res.ok) {
    throw new Error(`Gmail send failed (${res.status}): ${await res.text()}`);
  }

  const data = (await res.json()) as { id: string; threadId: string };
  const rfc822MessageId = await getRfc822MessageId(accessToken, data.id);

  return { gmailMessageId: data.id, threadId: data.threadId, rfc822MessageId };
}
