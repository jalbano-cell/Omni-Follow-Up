"use server";

import { revalidatePath } from "next/cache";
import { updateInquiry } from "@/services/airtable";
import { getCurrentBusinessId } from "@/lib/session";
import { logAction } from "@/lib/logger";

export async function archiveInquiryAction(id: string) {
  const businessId = await getCurrentBusinessId();
  await updateInquiry(businessId, id, { status: "Archived" });
  logAction("inquiry.archive", { inquiryId: id });
  revalidatePath("/");
  revalidatePath("/inquiries");
}
