import { hasActiveEntitlement } from "@/services/business";
import { logAction } from "@/lib/logger";
import type { Business } from "@/types";

/**
 * Outbound event dispatch — the opposite direction from the inbound
 * intake/webhook endpoints (POST /api/intake, /api/v1/webhooks/leads):
 * those receive leads from external systems, this notifies an external URL
 * of what happened here. Best-effort, fire-and-forget: a business's webhook
 * endpoint being slow or down must never affect the request that triggered
 * the event. No retry queue — if it fails, it's logged and dropped, same
 * "good enough for v1" tradeoff as the rest of this app's best-effort sends.
 */

const DISPATCH_TIMEOUT_MS = 5000;

export type WebhookEvent = "lead.created" | "estimate.booked" | "estimate.lost";

export async function dispatchWebhookEvent(
  business: Business,
  event: WebhookEvent,
  data: Record<string, unknown>
): Promise<void> {
  if (!business.outboundWebhookUrl) return;
  // Belt-and-suspenders: Settings already blocks setting a URL on an inactive
  // workspace, but one that was active when the URL was set and then got
  // suspended/deactivated by the agency shouldn't keep firing.
  if (!hasActiveEntitlement(business)) return;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), DISPATCH_TIMEOUT_MS);

  try {
    await fetch(business.outboundWebhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ event, businessId: business.id, timestamp: new Date().toISOString(), data }),
      signal: controller.signal,
    });
  } catch (error) {
    logAction("webhook.dispatch-failed", {
      businessId: business.id,
      event,
      error: error instanceof Error ? error.message : "unknown error",
    });
  } finally {
    clearTimeout(timeout);
  }
}
