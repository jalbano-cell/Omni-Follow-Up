import { getSupabase, selectWhere } from "@/lib/supabase";
import type { Database } from "@/types/supabase";
import type { MailboxConnection, MailboxProviderId } from "@/types";

/**
 * Provider-agnostic mailbox connection store (`mailbox_connections`,
 * migration 0017) — one row per (workspace, provider). This is the live,
 * canonical store for any NEW provider (Microsoft). For Google it's kept in
 * sync (not authoritative) by services/business.ts's
 * saveGoogleConnection/clearGoogleConnection — every existing Gmail code
 * path still reads/writes `workspaces.google_*` directly and never calls
 * anything in this file.
 */

type MailboxConnectionRow = Database["public"]["Tables"]["mailbox_connections"]["Row"];

function toMailboxConnection(row: MailboxConnectionRow): MailboxConnection {
  return {
    id: row.id,
    businessId: row.workspace_id,
    provider: row.provider as MailboxProviderId,
    refreshTokenEnc: row.refresh_token_enc,
    connectedEmail: row.connected_email,
    scopes: row.scopes,
    connectedAt: row.connected_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export async function getMailboxConnection(businessId: string, provider: MailboxProviderId): Promise<MailboxConnection | null> {
  const rows = await selectWhere("mailbox_connections", { workspace_id: businessId, provider });
  return rows[0] ? toMailboxConnection(rows[0]) : null;
}

export async function getMailboxConnectionsForBusiness(businessId: string): Promise<MailboxConnection[]> {
  const rows = await selectWhere("mailbox_connections", { workspace_id: businessId });
  return rows.map(toMailboxConnection);
}

/** Upserts on (workspace_id, provider) — reconnecting a provider updates the existing row instead of creating a duplicate. */
export async function upsertMailboxConnection(
  businessId: string,
  provider: MailboxProviderId,
  input: { refreshTokenEnc: string; connectedEmail: string; scopes: string | null }
): Promise<void> {
  const { error } = await getSupabase()
    .from("mailbox_connections")
    .upsert(
      {
        workspace_id: businessId,
        provider,
        refresh_token_enc: input.refreshTokenEnc,
        connected_email: input.connectedEmail,
        scopes: input.scopes,
        connected_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
      { onConflict: "workspace_id,provider" }
    );

  if (error) {
    throw new Error(`Supabase upsert on "mailbox_connections" failed: ${error.message}`);
  }
}

export async function deleteMailboxConnection(businessId: string, provider: MailboxProviderId): Promise<void> {
  const { error } = await getSupabase().from("mailbox_connections").delete().match({ workspace_id: businessId, provider });

  if (error) {
    throw new Error(`Supabase delete on "mailbox_connections" failed: ${error.message}`);
  }
}
