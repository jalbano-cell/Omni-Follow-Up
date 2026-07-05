"use server";

import { revalidatePath } from "next/cache";
import { verifyEstimateShareToken } from "@/lib/auth";
import { getEstimate, updateEstimate, createNotification } from "@/services/db";
import { logEstimateActivity } from "@/services/activityService";
import { logAction } from "@/lib/logger";
import type { Estimate } from "@/types";

export type PortalActionResult = { ok: true } | { ok: false; error: string };

/**
 * Every portal action re-verifies the share token itself — there is no
 * session here, the token IS the credential. Re-fetches the estimate fresh
 * (rather than trusting anything the client sent) so a stale/tampered page
 * can't act on the wrong record.
 */
async function resolveEstimateFromToken(token: string): Promise<Estimate | null> {
  const payload = await verifyEstimateShareToken(token);
  if (!payload) return null;
  return getEstimate(payload.businessId, payload.estimateId);
}

/**
 * Customer accepts or declines their estimate from the portal — no business
 * owner approval in the loop, since this IS the customer's own response.
 * Refuses to act twice on an already-decided estimate (Booked/Lost).
 */
export async function respondToEstimateAction(token: string, decision: "Booked" | "Lost"): Promise<PortalActionResult> {
  const estimate = await resolveEstimateFromToken(token);
  if (!estimate) {
    return { ok: false, error: "This link is no longer valid." };
  }
  if (estimate.status === "Booked" || estimate.status === "Lost") {
    return { ok: false, error: "This estimate has already been responded to." };
  }

  await updateEstimate(estimate.businessId, estimate.id, {
    status: decision,
    lastContactDate: new Date().toISOString().slice(0, 10),
  });
  logAction("estimate.portal-response", { estimateId: estimate.id, decision });

  await logEstimateActivity(
    estimate.businessId,
    estimate.id,
    decision === "Booked" ? "estimate.booked" : "estimate.lost",
    decision === "Booked" ? "Customer accepted the estimate via the portal." : "Customer declined the estimate via the portal."
  );

  // notifications.lead_id is a real uuid column — only create one when this
  // estimate actually has an originating lead to attach it to (an estimate
  // created without one, e.g. logged directly, has nowhere for it to point).
  if (estimate.leadId) {
    try {
      await createNotification(estimate.businessId, {
        leadId: estimate.leadId,
        type: decision === "Booked" ? "estimate.accepted" : "estimate.declined",
        message: `${estimate.customerName} ${decision === "Booked" ? "accepted" : "declined"} the ${estimate.serviceType} estimate.`,
      });
    } catch (error) {
      logAction("estimate.portal-notify-failed", {
        estimateId: estimate.id,
        error: error instanceof Error ? error.message : "unknown error",
      });
    }
  }

  revalidatePath(`/estimates/${estimate.id}`);
  return { ok: true };
}
