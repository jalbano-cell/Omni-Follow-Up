/**
 * One row per (workspace, provider) in `mailbox_connections`
 * (migration 0017) — the provider-agnostic mailbox connection store.
 *
 * For Google this table is kept in sync (not authoritative) by
 * services/business.ts's saveGoogleConnection/clearGoogleConnection; every
 * existing Gmail code path still reads/writes `workspaces.google_*`
 * directly and is unaffected by this type or table. For Microsoft this is
 * the only store.
 */
export type MailboxProviderId = "google" | "microsoft";

export interface MailboxConnection {
  id: string;
  businessId: string;
  provider: MailboxProviderId;
  /** AES-256-GCM encrypted (lib/crypto.ts), same scheme as workspaces.google_refresh_token_enc. */
  refreshTokenEnc: string;
  connectedEmail: string;
  scopes: string | null;
  connectedAt: string;
  createdAt: string;
  updatedAt: string;
}
