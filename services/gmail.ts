import { env } from "@/lib/env";

const TOKEN_URL = "https://oauth2.googleapis.com/token";
const GMAIL_API = "https://gmail.googleapis.com/gmail/v1/users/me";

/**
 * Thin, dependency-free Gmail API client. Assumes OAuth consent has already
 * happened out-of-band (Google Cloud Console + OAuth Playground or an
 * install-time consent screen) and that a long-lived refresh token for
 * GMAIL_USER_EMAIL has been captured into GMAIL_REFRESH_TOKEN — this module
 * only performs the server-side refresh-token -> access-token exchange, it
 * never runs an interactive consent flow itself.
 */

interface AccessTokenResponse {
  access_token: string;
  expires_in: number;
  token_type: string;
}

async function getAccessToken(): Promise<string> {
  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: env.gmailClientId,
      client_secret: env.gmailClientSecret,
      refresh_token: env.gmailRefreshToken,
      grant_type: "refresh_token",
    }),
  });

  if (!res.ok) {
    throw new Error(`Gmail OAuth token refresh failed (${res.status}): ${await res.text()}`);
  }

  const data = (await res.json()) as AccessTokenResponse;
  return data.access_token;
}

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
  const accessToken = await getAccessToken();
  const from = env.gmailUserEmail;
  const subject =
    input.threadId && !/^re:/i.test(input.subject) ? `Re: ${input.subject}` : input.subject;

  const raw = buildRawMessage({
    to: input.to,
    from,
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
