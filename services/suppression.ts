import { getSupabase } from "@/lib/supabase";

/**
 * Per-contact (workspace + email) suppression list — CASL unsubscribe.
 * Checked before every automated send in the appointment lifecycle (instant
 * pending-ack, review request, rebook reminder — see
 * services/appointmentService.ts and services/appointmentLifecycle.ts).
 * Unsubscribing kills the whole downstream sequence for that contact, not
 * just one email, since this is checked independently by every auto-send
 * call site rather than only at the point of the original send.
 */

/** Case-insensitive lookup — uses ilike directly, same convention as services/business.ts's getBusinessByEmail. */
export async function isContactSuppressed(businessId: string, email: string): Promise<boolean> {
  const { data, error } = await getSupabase()
    .from("suppressed_contacts")
    .select("id")
    .eq("workspace_id", businessId)
    .ilike("email", email.trim())
    .limit(1)
    .maybeSingle();
  if (error) throw new Error(`Supabase select on "suppressed_contacts" failed: ${error.message}`);
  return data !== null;
}

/** Idempotent — upserting an already-suppressed contact is a no-op, not an error. */
export async function suppressContact(businessId: string, email: string, reason?: string): Promise<void> {
  if (await isContactSuppressed(businessId, email)) return;

  const { error } = await getSupabase().from("suppressed_contacts").insert({
    workspace_id: businessId,
    email: email.trim().toLowerCase(),
    reason: reason ?? null,
  });

  if (error) {
    throw new Error(`Supabase insert on "suppressed_contacts" failed: ${error.message}`);
  }
}
