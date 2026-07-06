import { startWatch } from "@/services/gmailWatch";
import { refreshAccessToken } from "@/services/googleOAuth";
import { saveGmailWatch, getBusinessByGoogleEmail } from "@/services/business";
import { syncRepliesForBusiness } from "@/services/replyMatcher";
import { decrypt } from "@/lib/crypto";
import { logAction } from "@/lib/logger";
import { env } from "@/lib/env";
import type { Business } from "@/types";

/** Renew when less than this long remains — Gmail watch registrations last ~7 days. */
const RENEWAL_WINDOW_MS = 24 * 60 * 60 * 1000;

/**
 * (Re)registers Gmail push notifications for one business's inbox, if
 * configured and due. Best-effort, same pattern as calendar reminders/
 * appointment booking: any failure (not connected, Pub/Sub not set up,
 * Google API error) is logged and swallowed — push is an enhancement on top
 * of the daily cron/manual "Check for new replies" sync, never a dependency
 * for either of those to keep working.
 */
export async function ensureGmailWatch(business: Business): Promise<void> {
  if (!env.gmailPubsubTopic || !business.googleRefreshTokenEnc) {
    return;
  }

  const expiresAt = business.gmailWatchExpiration ? new Date(business.gmailWatchExpiration).getTime() : 0;
  if (expiresAt - Date.now() > RENEWAL_WINDOW_MS) {
    return; // still fresh
  }

  try {
    const accessToken = await refreshAccessToken(decrypt(business.googleRefreshTokenEnc));
    const result = await startWatch(accessToken, env.gmailPubsubTopic);
    await saveGmailWatch(business.id, { historyId: result.historyId, expiration: new Date(Number(result.expiration)).toISOString() });
    logAction("gmail.watch-registered", { businessId: business.id, expiration: result.expiration });
  } catch (error) {
    logAction("gmail.watch-register-failed", {
      businessId: business.id,
      error: error instanceof Error ? error.message : "unknown error",
    });
  }
}

/** Piggybacked onto the daily cron (app/api/follow-ups/generate/route.ts) alongside reply sync/Gmail lead capture. */
export async function runGmailWatchRenewalJob(businesses: Business[]): Promise<void> {
  for (const business of businesses) {
    await ensureGmailWatch(business);
  }
}

/**
 * Handles one Gmail push notification (app/api/webhooks/gmail-push/route.ts):
 * resolves the business by the notified mailbox's address and re-runs the
 * exact same matching pass the daily cron/manual button already use — no
 * separate history.list-based diffing, so there's exactly one reply-matching
 * code path to reason about (services/replyMatcher.ts's syncRepliesForBusiness).
 * historyId from the payload isn't otherwise used; Gmail requires it in the
 * notification but a full incremental resync from the known estimate threads
 * is cheap enough at this product's scale to not need the delta.
 */
export async function handleGmailPushNotification(emailAddress: string): Promise<void> {
  const business = await getBusinessByGoogleEmail(emailAddress);
  if (!business) {
    logAction("gmail.push-unknown-business", { emailAddress });
    return;
  }
  const result = await syncRepliesForBusiness(business);
  logAction("gmail.push-sync-completed", { businessId: business.id, created: result.created, errors: result.errors.length });
}
