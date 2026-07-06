import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { env } from "@/lib/env";
import type { Database } from "@/types/supabase";

/**
 * Server-only Supabase client, using the service_role-equivalent secret key.
 * Every read/write in this app happens server-side (Server Components/Server
 * Actions/API routes) with tenant isolation enforced in application code via
 * workspace_id filtering — the same model Airtable used, just against Postgres
 * now. This client bypasses Row Level Security; never import it into a "use
 * client" component or send its key to the browser.
 */
let client: SupabaseClient<Database> | null = null;

export function getSupabase(): SupabaseClient<Database> {
  if (!client) {
    client = createClient<Database>(env.supabaseUrl, env.supabaseServiceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
  }
  return client;
}

type TableName = keyof Database["public"]["Tables"];
type Row<T extends TableName> = Database["public"]["Tables"][T]["Row"];
type Insert<T extends TableName> = Database["public"]["Tables"][T]["Insert"];
type Update<T extends TableName> = Database["public"]["Tables"][T]["Update"];

/** Thrown for any Supabase error — callers decide whether to catch (best-effort) or let it propagate (authoritative write). */
export class SupabaseQueryError extends Error {
  constructor(
    public table: TableName,
    public operation: "select" | "insert" | "update" | "delete",
    cause: string
  ) {
    super(`Supabase ${operation} on "${table}" failed: ${cause}`);
  }
}

/**
 * supabase-js's `.from()` doesn't narrow properly through a generic `T extends
 * TableName` parameter (a known upstream limitation — it resolves to `never`
 * internally). The untyped view here is an implementation detail; every
 * exported function below still has a fully typed signature for callers.
 */
function untyped() {
  return getSupabase() as unknown as {
    from(table: string): {
      insert(values: unknown): { select(): { single(): Promise<{ data: unknown; error: { message: string } | null }> } };
      update(values: unknown): {
        match(m: Record<string, unknown>): {
          select(): { single(): Promise<{ data: unknown; error: { message: string; code?: string } | null }> };
        };
      };
      select(): {
        eq(col: string, val: string): { maybeSingle(): Promise<{ data: unknown; error: { message: string; code?: string } | null }> };
        match(m: Record<string, unknown>): {
          order(col: string, opts: { ascending: boolean }): Promise<{ data: unknown[] | null; error: { message: string } | null }>;
        } & Promise<{ data: unknown[] | null; error: { message: string } | null }>;
      };
      delete(): { match(m: Record<string, unknown>): Promise<{ error: { message: string } | null }> };
    };
  };
}

/** Inserts one row and returns it, typed to the table's Row shape. */
export async function insertRow<T extends TableName>(table: T, values: Insert<T>): Promise<Row<T>> {
  const { data, error } = await untyped().from(table).insert(values).select().single();
  if (error) throw new SupabaseQueryError(table, "insert", error.message);
  return data as Row<T>;
}

/**
 * Updates one row by id and returns the updated row. `scope` (typically
 * `{ workspace_id }`) is ANDed into the match so the write itself is
 * tenant-scoped in Postgres, not just guarded by an application-code
 * ownership pre-check — a defense-in-depth backstop for the fact that RLS is
 * disabled (see the class comment above and supabase/migrations/0001). If the
 * scope doesn't match, no row updates and `.single()` errors, same as "not found".
 */
export async function updateRow<T extends TableName>(
  table: T,
  id: string,
  values: Update<T>,
  scope?: Partial<Row<T>>
): Promise<Row<T>> {
  const { data, error } = await untyped()
    .from(table)
    .update(values)
    .match({ id, ...(scope ?? {}) })
    .select()
    .single();
  if (error) throw new SupabaseQueryError(table, "update", error.message);
  return data as Row<T>;
}

/** Postgres error code for a value that can't parse as the column's type (e.g. a non-UUID string against a uuid primary key). */
const POSTGRES_INVALID_TEXT_REPRESENTATION = "22P02";

/**
 * Fetches one row by id, or null if it doesn't exist. A malformed id (e.g. a
 * stale pre-Supabase-cutover session's Airtable-style record id showing up
 * as a businessId) can never match a uuid primary key — Postgres rejects it
 * before it even gets to run the query, so that's treated the same as "no
 * row found" rather than allowed to throw and crash whatever page expected
 * a graceful null (see lib/session.ts's requireOnboardedBusiness).
 */
export async function selectById<T extends TableName>(table: T, id: string): Promise<Row<T> | null> {
  const { data, error } = await untyped().from(table).select().eq("id", id).maybeSingle();
  if (error) {
    if (error.code === POSTGRES_INVALID_TEXT_REPRESENTATION) return null;
    throw new SupabaseQueryError(table, "select", error.message);
  }
  return data as Row<T> | null;
}

/** Fetches every row matching an equality filter (e.g. { workspace_id: id }), optionally ordered. */
export async function selectWhere<T extends TableName>(
  table: T,
  match: Partial<Row<T>>,
  options?: { orderBy?: keyof Row<T> & string; ascending?: boolean }
): Promise<Row<T>[]> {
  const query = untyped().from(table).select().match(match as Record<string, unknown>);
  const { data, error } = options?.orderBy
    ? await query.order(options.orderBy, { ascending: options.ascending ?? false })
    : await query;
  if (error) throw new SupabaseQueryError(table, "select", error.message);
  return (data ?? []) as Row<T>[];
}

/** Deletes one row by id, optionally tenant-scoped via `scope` (see updateRow). */
export async function deleteRow<T extends TableName>(table: T, id: string, scope?: Partial<Row<T>>): Promise<void> {
  const { error } = await untyped().from(table).delete().match({ id, ...(scope ?? {}) });
  if (error) throw new SupabaseQueryError(table, "delete", error.message);
}
