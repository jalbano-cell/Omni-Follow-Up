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
        eq(col: string, val: string): { select(): { single(): Promise<{ data: unknown; error: { message: string } | null }> } };
      };
      select(): {
        eq(col: string, val: string): { maybeSingle(): Promise<{ data: unknown; error: { message: string } | null }> };
        match(m: Record<string, unknown>): {
          order(col: string, opts: { ascending: boolean }): Promise<{ data: unknown[] | null; error: { message: string } | null }>;
        } & Promise<{ data: unknown[] | null; error: { message: string } | null }>;
      };
      delete(): { eq(col: string, val: string): Promise<{ error: { message: string } | null }> };
    };
  };
}

/** Inserts one row and returns it, typed to the table's Row shape. */
export async function insertRow<T extends TableName>(table: T, values: Insert<T>): Promise<Row<T>> {
  const { data, error } = await untyped().from(table).insert(values).select().single();
  if (error) throw new SupabaseQueryError(table, "insert", error.message);
  return data as Row<T>;
}

/** Updates one row by id and returns the updated row. */
export async function updateRow<T extends TableName>(table: T, id: string, values: Update<T>): Promise<Row<T>> {
  const { data, error } = await untyped().from(table).update(values).eq("id", id).select().single();
  if (error) throw new SupabaseQueryError(table, "update", error.message);
  return data as Row<T>;
}

/** Fetches one row by id, or null if it doesn't exist. */
export async function selectById<T extends TableName>(table: T, id: string): Promise<Row<T> | null> {
  const { data, error } = await untyped().from(table).select().eq("id", id).maybeSingle();
  if (error) throw new SupabaseQueryError(table, "select", error.message);
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

/** Deletes one row by id. */
export async function deleteRow<T extends TableName>(table: T, id: string): Promise<void> {
  const { error } = await untyped().from(table).delete().eq("id", id);
  if (error) throw new SupabaseQueryError(table, "delete", error.message);
}
