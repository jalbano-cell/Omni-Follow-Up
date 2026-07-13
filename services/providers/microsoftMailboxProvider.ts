import { generatePkcePair } from "@/lib/pkce";
import {
  buildAuthUrl,
  exchangeCodeForTokens,
  getMicrosoftAccountEmail,
  refreshAccessToken,
} from "@/services/microsoftOAuth";
import { sendEmail } from "@/services/microsoftGraphSend";
import { getThreadMessages } from "@/services/microsoftGraphInbox";
import type { MailboxProvider, AuthUrlResult, SendMailInput, SendMailResult, ListRepliesInput, ParsedMailMessage } from "@/services/mailboxProvider";

/**
 * Microsoft implementation of MailboxProvider — a thin adapter over
 * services/microsoftOAuth.ts/microsoftGraphSend.ts/microsoftGraphInbox.ts,
 * same pattern as services/providers/googleMailboxProvider.ts is over
 * services/googleOAuth.ts/gmail.ts/gmailInbox.ts:
 *
 *   getAuthUrl     -> microsoftOAuth.ts's buildAuthUrl (+ generates the PKCE pair here, per the interface's AuthUrlResult contract)
 *   exchangeCode   -> microsoftOAuth.ts's exchangeCodeForTokens
 *   getAccountEmail-> microsoftOAuth.ts's getMicrosoftAccountEmail
 *   refresh        -> microsoftOAuth.ts's refreshAccessToken
 *   send           -> microsoftGraphSend.ts's sendEmail
 *   listReplies    -> microsoftGraphInbox.ts's getThreadMessages
 */
export const microsoftMailboxProvider: MailboxProvider = {
  id: "microsoft",

  getAuthUrl(state: string, redirectUri: string): AuthUrlResult {
    const { codeVerifier, codeChallenge } = generatePkcePair();
    return { url: buildAuthUrl(state, redirectUri, codeChallenge), codeVerifier };
  },

  async exchangeCode(code: string, redirectUri: string, codeVerifier?: string) {
    if (!codeVerifier) {
      throw new Error("Microsoft token exchange requires a PKCE code_verifier.");
    }
    return exchangeCodeForTokens(code, redirectUri, codeVerifier);
  },

  async getAccountEmail(accessToken: string): Promise<string> {
    return getMicrosoftAccountEmail(accessToken);
  },

  async refresh(refreshToken: string): Promise<string> {
    return refreshAccessToken(refreshToken);
  },

  async send(input: SendMailInput): Promise<SendMailResult> {
    const result = await sendEmail({
      refreshToken: input.refreshToken,
      to: input.to,
      subject: input.subject,
      body: input.body,
      threadId: input.threadId,
      inReplyToMessageId: input.inReplyToMessageId,
    });
    return {
      providerMessageId: result.graphMessageId,
      providerThreadId: result.conversationId,
      rfc822MessageId: result.rfc822MessageId,
    };
  },

  async listReplies(input: ListRepliesInput): Promise<ParsedMailMessage[]> {
    const messages = await getThreadMessages({ accessToken: input.accessToken, threadId: input.threadId });
    return messages.map((m) => ({
      providerMessageId: m.graphMessageId,
      providerThreadId: m.conversationId,
      fromHeader: m.fromHeader,
      subject: m.subject,
      snippet: m.snippet,
      bodyText: m.bodyText,
      receivedAt: m.receivedAt,
    }));
  },
};
