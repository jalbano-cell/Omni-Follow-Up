import { getEstimates, getReplies, createReply } from "@/services/airtable";
import { getThreadMessages, extractEmailAddress } from "@/services/gmailInbox";
import { refreshAccessToken } from "@/services/googleOAuth";
import { decrypt } from "@/lib/crypto";
import { logAction } from "@/lib/logger";
import type { Business, ReplyInboxItem } from "@/types";

export interface ReplySyncResult {
  estimatesChecked: number;
  created: number;
  errors: string[];
}

/**
 * Syncs incoming customer replies for one business. Matches purely by Gmail
 * thread ID (every outbound send already threads onto the estimate) plus
 * the estimate's customerEmail — a message from any other address on the
 * same thread is not treated as a reply. Never changes an Estimate's status
 * or creates a follow-up; a reply is surfaced, not interpreted.
 *
 * Known limitation: a reply from a different address, or deep in an old
 * part of a long thread, won't be matched — this is a v1 tradeoff for
 * staying simple, not a full inbound-parsing engine.
 */
export async function syncRepliesForBusiness(business: Business): Promise<ReplySyncResult> {
  if (!business.googleRefreshTokenEnc) {
    return { estimatesChecked: 0, created: 0, errors: [] };
  }

  const [estimates, existingReplies] = await Promise.all([
    getEstimates(business.id),
    getReplies(business.id),
  ]);
  const estimatesWithThread = estimates.filter((e) => !!e.gmailThreadId);
  const knownMessageIds = new Set(existingReplies.map((r) => r.gmailMessageId));

  const accessToken = await refreshAccessToken(decrypt(business.googleRefreshTokenEnc));

  let created = 0;
  const errors: string[] = [];

  for (const estimate of estimatesWithThread) {
    try {
      const messages = await getThreadMessages({ accessToken, threadId: estimate.gmailThreadId! });
      const customerEmail = estimate.customerEmail.toLowerCase();

      for (const message of messages) {
        if (knownMessageIds.has(message.gmailMessageId)) continue;
        if (extractEmailAddress(message.fromHeader) !== customerEmail) continue;

        await createReply(business.id, {
          estimateId: estimate.id,
          gmailMessageId: message.gmailMessageId,
          gmailThreadId: message.threadId,
          fromEmail: extractEmailAddress(message.fromHeader),
          subject: message.subject,
          snippet: message.snippet,
          bodyText: message.bodyText,
          receivedAt: message.receivedAt,
        });
        knownMessageIds.add(message.gmailMessageId);
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
