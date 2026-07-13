import { getEstimates, getReplies, createReply, createNotification } from "@/services/db";
import { extractEmailAddress } from "@/services/gmailInbox";
import { getMailboxProvider, resolveActiveMailboxConnection } from "@/services/mailboxProvider";
import { logEstimateActivity } from "@/services/activityService";
import { getEffectiveNotifyOnReply } from "@/services/business";
import { decrypt } from "@/lib/crypto";
import { logAction } from "@/lib/logger";
import type { Business, ReplyInboxItem } from "@/types";

export interface ReplySyncResult {
  estimatesChecked: number;
  created: number;
  errors: string[];
}

/**
 * Syncs incoming customer replies for one business, through whichever
 * mailbox provider it has connected (services/mailboxProvider.ts's
 * resolveActiveMailboxConnection — Google or Microsoft). Matches purely by
 * provider thread id (every outbound send already threads onto the
 * estimate — see types/estimate.ts's gmailThreadId doc comment on why that
 * column holds either provider's thread id) plus the estimate's
 * customerEmail — a message from any other address on the same thread is
 * not treated as a reply. Never changes an Estimate's status or creates a
 * follow-up; a reply is surfaced, not interpreted.
 *
 * Known limitation: a reply from a different address, or deep in an old
 * part of a long thread, won't be matched — this is a v1 tradeoff for
 * staying simple, not a full inbound-parsing engine.
 */
export async function syncRepliesForBusiness(business: Business): Promise<ReplySyncResult> {
  const connection = await resolveActiveMailboxConnection(business);
  if (!connection) {
    return { estimatesChecked: 0, created: 0, errors: [] };
  }
  const provider = getMailboxProvider(connection.provider);

  const [estimates, existingReplies] = await Promise.all([
    getEstimates(business.id),
    getReplies(business.id),
  ]);
  const estimatesWithThread = estimates.filter((e) => !!e.gmailThreadId);
  const knownMessageIds = new Set(existingReplies.map((r) => r.gmailMessageId));

  const accessToken = await provider.refresh(decrypt(connection.refreshTokenEnc));

  let created = 0;
  const errors: string[] = [];

  for (const estimate of estimatesWithThread) {
    try {
      const messages = await provider.listReplies({ accessToken, threadId: estimate.gmailThreadId! });
      const customerEmail = estimate.customerEmail.toLowerCase();

      for (const message of messages) {
        if (knownMessageIds.has(message.providerMessageId)) continue;
        if (extractEmailAddress(message.fromHeader) !== customerEmail) continue;

        await createReply(business.id, {
          estimateId: estimate.id,
          gmailMessageId: message.providerMessageId,
          gmailThreadId: message.providerThreadId,
          fromEmail: extractEmailAddress(message.fromHeader),
          subject: message.subject,
          snippet: message.snippet,
          bodyText: message.bodyText,
          receivedAt: message.receivedAt,
        });
        await logEstimateActivity(business.id, estimate.id, "estimate.reply_received", "Customer replied.");

        if (getEffectiveNotifyOnReply(business) && estimate.leadId) {
          try {
            await createNotification(business.id, {
              leadId: estimate.leadId,
              type: "estimate.reply_received",
              message: `${estimate.customerName} replied on the ${estimate.serviceType} estimate.`,
            });
          } catch (error) {
            logAction("reply.notify-inapp-failed", {
              businessId: business.id,
              estimateId: estimate.id,
              error: error instanceof Error ? error.message : "unknown error",
            });
          }
        }

        knownMessageIds.add(message.providerMessageId);
        created += 1;
      }
    } catch (error) {
      errors.push(`estimate ${estimate.id}: ${error instanceof Error ? error.message : "unknown error"}`);
    }
  }

  return { estimatesChecked: estimatesWithThread.length, created, errors };
}

/** Replies joined with their parent estimate, for the inbox UI — unread first, then most recent. */
export async function getReplyInbox(businessId: string): Promise<ReplyInboxItem[]> {
  const [replies, estimates] = await Promise.all([getReplies(businessId), getEstimates(businessId)]);
  const estimateById = new Map(estimates.map((e) => [e.id, e]));

  return replies
    .map((reply) => {
      const estimate = estimateById.get(reply.estimateId);
      return {
        ...reply,
        customerName: estimate?.customerName ?? "Unknown customer",
        businessName: estimate?.businessName ?? "",
      };
    })
    .sort((a, b) => {
      if (a.isRead !== b.isRead) return a.isRead ? 1 : -1;
      return b.receivedAt.localeCompare(a.receivedAt);
    });
}

export interface ReplySyncLog {
  timestamp: string;
  businessId: string;
  estimatesChecked: number;
  repliesCreated: number;
  errors: string[];
}

/**
 * Per-business loop, called once a day alongside the follow-up draft job
 * (see app/api/follow-ups/generate/route.ts) rather than its own Vercel
 * Cron schedule — Vercel's Hobby plan caps how many/how-often cron jobs can
 * run, and piggybacking avoids that limit entirely. The "Check for new
 * replies" button in the UI covers anything more immediate.
 */
export async function runDailyReplySyncJob(businesses: Business[]): Promise<ReplySyncLog[]> {
  const logs: ReplySyncLog[] = [];

  for (const business of businesses) {
    const timestamp = new Date().toISOString();
    let log: ReplySyncLog;
    try {
      const result = await syncRepliesForBusiness(business);
      log = { timestamp, businessId: business.id, estimatesChecked: result.estimatesChecked, repliesCreated: result.created, errors: result.errors };
    } catch (error) {
      log = { timestamp, businessId: business.id, estimatesChecked: 0, repliesCreated: 0, errors: [error instanceof Error ? error.message : "unknown error"] };
    }
    logAction("replies.sync", { ...log });
    logs.push(log);
  }

  return logs;
}
