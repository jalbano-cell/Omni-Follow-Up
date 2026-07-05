"use server";

import { revalidatePath } from "next/cache";
import { markNotificationRead, markAllNotificationsRead } from "@/services/airtable";
import { getCurrentBusinessId } from "@/lib/session";
import { logAction } from "@/lib/logger";

/**
 * Both actions below swallow every error rather than letting one propagate
 * to the client — a header-bell click crashing the whole page (Next.js's
 * generic "Application error: a client-side exception") is a much worse
 * outcome than a notification silently failing to mark read.
 */
export async function markNotificationReadAction(id: string) {
  try {
    const businessId = await getCurrentBusinessId();
    await markNotificationRead(businessId, id);
    revalidatePath("/", "layout");
  } catch (error) {
    logAction("notification.mark-read-failed", { id, error: error instanceof Error ? error.message : "unknown error" });
  }
}

export async function markAllNotificationsReadAction() {
  try {
    const businessId = await getCurrentBusinessId();
    await markAllNotificationsRead(businessId);
    revalidatePath("/", "layout");
  } catch (error) {
    logAction("notification.mark-all-read-failed", { error: error instanceof Error ? error.message : "unknown error" });
  }
}
