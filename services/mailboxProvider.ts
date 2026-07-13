import { googleMailboxProvider } from "@/services/providers/googleMailboxProvider";
import { microsoftMailboxProvider } from "@/services/providers/microsoftMailboxProvider";
import { getMailboxConnection } from "@/services/mailboxConnections";
import type { Business, MailboxProviderId } from "@/types";

/**
 * Provider-agnostic mailbox interface — one implementation per provider
 * (services/providers/googleMailboxProvider.ts, .../microsoftMailboxProvider.ts).
 * Every method mirrors an existing transport function 1:1 so each
 * implementation is a thin, near-zero-duplication adapter — see each
 * provider file's doc comment for the exact mapping. The OAuth routes
 * (app/api/oauth/<provider>/start|callback) call the concrete
 * googleOAuth.ts/microsoftOAuth.ts functions directly, same pattern for
 * both providers, rather than going through this interface — it's
 * followupSender.ts/replyMatcher.ts that dispatch through
 * getMailboxProvider/resolveActiveMailboxConnection below.
 */

export interface ExchangedTokens {
  accessToken: string;
  /** Only present on the first consent for most providers — omitted on subsequent grants for the same client/user. */
  refreshToken: string | null;
  scope: string;
}

export interface SendMailInput {
  /** Decrypted refresh token — send() refreshes internally before sending, same as services/gmail.ts's sendEmail. */
  refreshToken: string;
  fromEmail: string;
  to: string;
  subject: string;
  body: string;
  /** Existing provider thread/conversation to reply within, if this customer already has one. */
  threadId?: string | null;
  /** RFC 822 Message-ID header of the prior email in the thread, for In-Reply-To/References. */
  inReplyToMessageId?: string | null;
}

export interface SendMailResult {
  providerMessageId: string;
  providerThreadId: string;
  /** RFC 822 Message-ID header of this send — persist it to thread the *next* follow-up. */
  rfc822MessageId: string | null;
}

export interface ListRepliesInput {
  /** Already-refreshed access token — callers call refresh() once and reuse it across multiple listReplies() calls (see services/replyMatcher.ts's existing per-business-not-per-thread refresh pattern). */
  accessToken: string;
  threadId: string;
}

export interface ParsedMailMessage {
  providerMessageId: string;
  providerThreadId: string;
  fromHeader: string;
  subject: string;
  snippet: string;
  bodyText: string;
  receivedAt: string;
}

export interface AuthUrlResult {
  url: string;
  /** Set only by providers using PKCE (Microsoft) — the caller must carry this through to exchangeCode(). Google's implementation always returns undefined here; it doesn't use PKCE. */
  codeVerifier?: string;
}

export interface MailboxProvider {
  readonly id: MailboxProviderId;

  /** Builds the provider's OAuth consent URL. Returns the codeVerifier alongside it for PKCE providers, since generating the PKCE pair happens inside this call. */
  getAuthUrl(state: string, redirectUri: string): AuthUrlResult;

  /** Exchanges an authorization code for tokens. `codeVerifier` is required for PKCE providers (Microsoft) and ignored otherwise (Google). */
  exchangeCode(code: string, redirectUri: string, codeVerifier?: string): Promise<ExchangedTokens>;

  /** The connected account's own email address, given a valid access token. */
  getAccountEmail(accessToken: string): Promise<string>;

  /** Mints a fresh access token from a stored (decrypted) refresh token. Throws the literal string "invalid_grant" if the refresh token has been revoked — same contract as services/googleOAuth.ts's refreshAccessToken; callers should catch it and clear the connection. */
  refresh(refreshToken: string): Promise<string>;

  send(input: SendMailInput): Promise<SendMailResult>;

  listReplies(input: ListRepliesInput): Promise<ParsedMailMessage[]>;
}

/** Resolves a MailboxProvider implementation by id. */
export function getMailboxProvider(id: MailboxProviderId): MailboxProvider {
  if (id === "google") return googleMailboxProvider;
  if (id === "microsoft") return microsoftMailboxProvider;
  throw new Error(`Mailbox provider "${id}" isn't implemented yet.`);
}

export interface ActiveMailboxConnection {
  provider: MailboxProviderId;
  refreshTokenEnc: string;
  connectedEmail: string;
}

/**
 * Resolves which mailbox provider a business currently sends/reads
 * through — services/followupSender.ts and services/replyMatcher.ts call
 * this instead of checking business.googleRefreshTokenEnc directly, so
 * they don't care which provider is behind a business.
 *
 * Google takes priority when a business has both connected (uncommon, but
 * possible — nothing stops connecting both). This preserves exact existing
 * behavior for every business that connected before Microsoft existed:
 * Google is checked first, straight off workspaces.google_* (still the
 * authoritative source for it, untouched by any of this), before ever
 * looking at mailbox_connections. Microsoft is only consulted when Google
 * isn't connected.
 */
export async function resolveActiveMailboxConnection(business: Business): Promise<ActiveMailboxConnection | null> {
  if (business.googleRefreshTokenEnc && business.googleConnectedEmail) {
    return { provider: "google", refreshTokenEnc: business.googleRefreshTokenEnc, connectedEmail: business.googleConnectedEmail };
  }

  const microsoft = await getMailboxConnection(business.id, "microsoft");
  if (microsoft) {
    return { provider: "microsoft", refreshTokenEnc: microsoft.refreshTokenEnc, connectedEmail: microsoft.connectedEmail };
  }

  return null;
}
