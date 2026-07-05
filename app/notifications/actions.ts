"use server";

import { revalidatePath } from "next/cache";
import { markNotificationRead, markAllNotificationsRead } from "@/services/airtable";
import { getCurrentBusinessId } from "@/lib/session";

export async function markNotificationReadAction(id: string) {
  const businessId = await getCurrentBusinessId();
  await markNotificationRead(businessId, id);
  revalidatePath("/", "layout");
}

export async function markAllNotificationsReadAction() {
  const businessId = await getCurrentBusinessId();
  await markAllNotificationsRead(businessId);
  revalidatePath("/", "layout");
}
