import { getEstimates, getLeads } from "@/services/db";
import { listInboxMessageIds, getMessage, extractEmailAddress, extractDisplayName } from "@/services/gmailInbox";
import { refreshAccessToken } from "@/services/googleOAuth";
import { createLeadFromSubmission } from "@/services/leadService";
import { classifyAndLogMessage } from "@/services/leadClassification";
import { getEffectiveGmailLeadMonitoring } from "@/services/business";
import { decrypt } from "@/lib/crypto";
import { logAction } from "@/lib/logger";
import type { Business } from "@/types";

export interface GmailCaptureResult {
  messagesScanned: number;
  created: number;
  errors: string[];
}

/**
 * Looks back this many days on every scan (rather than tracking a per-business
 * cursor) — cheap to re-scan since dedup is by Gmail message ID against
 * existing Leads, and this naturally recovers from a missed/failed cron run
 * without needing a stored "last synced" watermark.
 */
const LOOKBACK_QUERY = "in:inbox -in:chats -in:sent newer_than:3d";

/**
 * Scans one business's Gmail inbox for new customer inquiries and creates a
 * Lead (source "Gmail") for each one not already known. Two disjoint
 * concerns intentionally split from services/replyMatcher.ts: that file
 * follows KNOWN Estimate threads looking for replies; this one looks at the
 * whole inbox for messages that AREN'T on a known thread yet, i.e. a
 * first-contact inquiry. A message on a thread that already belongs to an
 * Estimate (real or a Gmail-lead not yet converted) is skipped here — it's
 * either replyMatcher's job or already has a Lead.
 *
 * Also runs services/leadClassification.ts's Claude Haiku classifier on
 * every candidate here, reusing this same fetched message rather than
 * re-fetching it — deliberately a side-by-side, log-only step (Step 1: no
 * gating). It never affects whether a Lead gets created below, and its own
 * classifyAndLogMessage never throws, so a classification hiccup can't
 * break lead capture and vice versa.
 */
export async function captureLeadsFromGmailForBusiness(business: Business, appHost: string): Promise<GmailCaptureResult> {
  // An appointments_only workspace (services/business.ts's Business.productMode,
  // agency-set via /admin) only ever accepts leads/bookings through the
  // website form intake (POST /api/intake) — it never scans the connected
  // Gmail inbox for new inquiries, regardless of the monitorGmailInbox
  // setting below. Guarded here (not just at the cron route's business-list
  // filter) so every caller — the daily cron and the admin's manual "run
  // classification now" button — is covered.
  if (business.productMode === "appointments_only") {
    return { messagesScanned: 0, created: 0, errors: [] };
  }
  if (!business.googleRefreshTokenEnc || !getEffectiveGmailLeadMonitoring(business)) {
    return { messagesScanned: 0, created: 0, errors: [] };
  }

  const [estimates, leads] = await Promise.all([getEstimates(business.id), getLeads(business.id)]);
  const knownThreadIds = new Set<string>([
    ...estimates.filter((e) => !!e.gmailThreadId).map((e) => e.gmailThreadId!),
    ...leads.filter((l) => !!l.gmailThreadId).map((l) => l.gmailThreadId!),
  ]);
  const knownMessageIds = new Set(leads.filter((l) => !!l.gmailMessageId).map((l) => l.gmailMessageId!));

  const accessToken = await refreshAccessToken(decrypt(business.googleRefreshTokenEnc));
  const candidates = await listInboxMessageIds({ accessToken, query: LOOKBACK_QUERY });

  let created = 0;
  const errors: string[] = [];

  for (const candidate of candidates) {
    if (knownThreadIds.has(candidate.threadId) || knownMessageIds.has(candidate.id)) continue;

    try {
      const message = await getMessage({ accessToken, messageId: candidate.id });
      if (!message) continue;

      const fromEmail = extractEmailAddress(message.fromHeader);
      if (!fromEmail || fromEmail === business.googleConnectedEmail?.toLowerCase() || fromEmail === business.ownerEmail.toLowerCase()) {
        // No usable sender, or it's the business's own address (a sent/self message the query missed) — not a customer inquiry.
        continue;
      }

      const messageBody = [message.subject, message.bodyText].filter(Boolean).join("\n\n").trim();

      await classifyAndLogMessage(business.id, message);

      await createLeadFromSubmission(
        business,
        {
          name: extractDisplayName(message.fromHeader),
          email: fromEmail,
          message: messageBody || "(No message body.)",
          leadSource: "Gmail",
          gmailMessageId: message.gmailMessageId,
          gmailThreadId: message.threadId,
        },
        appHost
      );

      knownThreadIds.add(message.threadId);
      knownMessageIds.add(message.gmailMessageId);
      created += 1;
    } catch (error) {
      errors.push(`message ${candidate.id}: ${error instanceof Error ? error.message : "unknown error"}`);
    }
  }

  return { messagesScanned: candidates.length, created, errors };
}

export interface GmailCaptureLog {
  timestamp: string;
  businessId: string;
  messagesScanned: number;
  leadsCreated: number;
  errors: string[];
}

/** Per-business loop, piggybacked on the same daily cron invocation as the follow-up draft/reply-sync jobs — see app/api/follow-ups/generate/route.ts and CLAUDE.md's note on Vercel's Hobby-plan cron limits. */
export async function runDailyGmailLeadCaptureJob(businesses: Business[], appHost: string): Promise<GmailCaptureLog[]> {
  const logs: GmailCaptureLog[] = [];

  for (const business of businesses) {
    const timestamp = new Date().toISOString();
    let log: GmailCaptureLog;
    try {
      const result = await captureLeadsFromGmailForBusiness(business, appHost);
      log = { timestamp, businessId: business.id, messagesScanned: result.messagesScanned, leadsCreated: result.created, errors: result.errors };
    } catch (error) {
      log = { timestamp, businessId: business.id, messagesScanned: 0, leadsCreated: 0, errors: [error instanceof Error ? error.message : "unknown error"] };
    }
    logAction("gmail-lead-capture.sync", { ...log });
    logs.push(log);
  }

  return logs;
}
