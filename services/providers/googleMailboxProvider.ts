import { buildAuthUrl, exchangeCodeForTokens, getGoogleAccountEmail, refreshAccessToken } from "@/services/googleOAuth";
import { sendEmail } from "@/services/gmail";
import { getThreadMessages } from "@/services/gmailInbox";
import type {
  MailboxProvider,
  AuthUrlResult,
  SendMailInput,
  SendMailResult,
  ListRepliesInput,
  ParsedMailMessage,
} from "@/services/mailboxProvider";

/**
 * Google implementation of MailboxProvider — a pure passthrough to the
 * existing, untouched Gmail transport files (services/googleOAuth.ts,
 * services/gmail.ts, services/gmailInbox.ts). No logic is duplicated or
 * reimplemented here, only field-name mapping between this interface's
 * generic shapes and Gmail's own (gmailMessageId/threadId, etc.):
 *
 *   getAuthUrl     -> googleOAuth.ts's buildAuthUrl
 *   exchangeCode   -> googleOAuth.ts's exchangeCodeForTokens
 *   getAccountEmail-> googleOAuth.ts's getGoogleAccountEmail
 *   refresh        -> googleOAuth.ts's refreshAccessToken
 *   send           -> gmail.ts's sendEmail
 *   listReplies    -> gmailInbox.ts's getThreadMessages
 *
 * Not called from anywhere yet (services/followupSender.ts,
 * services/replyMatcher.ts, etc. still call the concrete functions above
 * directly) — this exists so a future provider-agnostic call site has a
 * Google implementation ready the moment it needs one, without the working
 * Gmail flow itself changing at all.
 */
export const googleMailboxProvider: MailboxProvider = {
  id: "google",

  getAuthUrl(state: string, redirectUri: string): AuthUrlResult {
    return { url: buildAuthUrl(state, redirectUri) };
  },

  async exchangeCode(code: string, redirectUri: string) {
    return exchangeCodeForTokens(code, redirectUri);
  },

  async getAccountEmail(accessToken: string): Promise<string> {
    return getGoogleAccountEmail(accessToken);
  },

  async refresh(refreshToken: string): Promise<string> {
    return refreshAccessToken(refreshToken);
  },

  async send(input: SendMailInput): Promise<SendMailResult> {
    const result = await sendEmail({
      refreshToken: input.refreshToken,
      fromEmail: input.fromEmail,
      to: input.to,
      subject: input.subject,
      body: input.body,
      threadId: input.threadId,
      inReplyToMessageId: input.inReplyToMessageId,
    });
    return {
      providerMessageId: result.gmailMessageId,
      providerThreadId: result.threadId,
      rfc822MessageId: result.rfc822MessageId,
    };
  },

  async listReplies(input: ListRepliesInput): Promise<ParsedMailMessage[]> {
    const messages = await getThreadMessages({ accessToken: input.accessToken, threadId: input.threadId });
    return messages.map((m) => ({
      providerMessageId: m.gmailMessageId,
      providerThreadId: m.threadId,
      fromHeader: m.fromHeader,
      subject: m.subject,
      snippet: m.snippet,
      bodyText: m.bodyText,
      receivedAt: m.receivedAt,
    }));
  },
};
