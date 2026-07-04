"use server";

import { revalidatePath } from "next/cache";
import { markReplyRead } from "@/services/airtable";
import { getBusinessById } from "@/services/business";
import { syncRepliesForBusiness } from "@/services/replyMatcher";
import { getCurrentBusinessId } from "@/lib/session";
import { logAction } from "@/lib/logger";

export async function markReplyReadAction(id: string) {
  const businessId = await getCurrentBusinessId();
  await markReplyRead(businessId, id);
  logAction("reply.mark-read", { replyId: id });
  revalidatePath("/replies");
}

/** Manual trigger (e.g. the "Check for new replies" button) — returns how many new replies were found. */
export async function syncRepliesAction(): Promise<{ created: number; errors: string[] }> {
  const businessId = await getCurrentBusinessId();
  const business = await getBusinessById(businessId);
  if (!business) {
    return { created: 0, errors: ["Business not found."] };
  }

  const result = await syncRepliesForBusiness(business);
  logAction("reply.manual-sync", { businessId, created: result.created, errors: result.errors.length });
  revalidatePath("/replies");
  return { created: result.created, errors: result.errors };
}
