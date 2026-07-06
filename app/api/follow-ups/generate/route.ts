import { NextResponse } from "next/server";
import { runDailyFollowUpJob } from "@/services/followupEngine";
import { runDailyReplySyncJob } from "@/services/replyMatcher";
import { runDailyGmailLeadCaptureJob } from "@/services/gmailLeadCapture";
import { runGmailWatchRenewalJob } from "@/services/gmailWatchSync";
import { getAllActiveBusinesses, getEffectiveTimezone } from "@/services/business";
import { safeCompare } from "@/lib/timingSafe";
import { getBearerToken } from "@/lib/apiAuth";
import type { Business } from "@/types";

const TARGET_LOCAL_HOUR = 8;

/**
 * Vercel Cron schedules are always UTC, but each business's own effective
 * timezone (`getEffectiveTimezone` — falls back to APP_TIMEZONE when unset)
 * shifts between standard/daylight time across the year. vercel.json
 * schedules this route at every UTC hour that lands on 8am local for some
 * timezone in TIMEZONE_OPTIONS (config/constants.ts) across both DST states
 * — an invocation that doesn't land on 8am for a given business just skips
 * that business, so every business still gets its jobs run once a day at
 * 8am its own local time, without a manual DST-season update.
 */
function isTargetLocalHour(timezone: string): boolean {
  const hour = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    hour: "numeric",
    hour12: false,
  }).format(new Date());
  return Number(hour) === TARGET_LOCAL_HOUR;
}

/**
 * Called by the Vercel Cron Job configured in vercel.json, once per UTC hour
 * that covers some business's 8am local time. Detects due follow-ups, drafts
 * messages, and queues them as Pending — never sends anything. Also syncs
 * incoming Gmail replies for every connected business (see
 * services/replyMatcher.ts) and, for businesses that opted in, scans their
 * Gmail inbox for new customer inquiries and creates Leads from them (see
 * services/gmailLeadCapture.ts) — both piggybacked onto this same invocation
 * rather than their own cron schedule; the "Check for new replies" button
 * covers anything more immediate. Every run is logged, only for the
 * businesses actually processed this invocation.
 *
 * If CRON_SECRET is set, requests must carry `Authorization: Bearer <CRON_SECRET>`,
 * which Vercel automatically attaches to its own cron invocations.
 */
export async function GET(request: Request) {
  const cronSecret = process.env.CRON_SECRET;

  // Fail closed in production: an unset CRON_SECRET there would leave this
  // job-triggering endpoint (Gmail scans, reply syncs) open to anyone who
  // finds the URL. In dev we allow it unset for convenience.
  if (!cronSecret) {
    if (process.env.NODE_ENV === "production") {
      return NextResponse.json({ error: "Server misconfigured: CRON_SECRET is required." }, { status: 500 });
    }
  } else if (!safeCompare(getBearerToken(request), cronSecret)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const allBusinesses = await getAllActiveBusinesses();

  // Gmail watch renewal isn't tied to a business's 8am local slot (a
  // registration just needs renewing before it expires, whenever this route
  // happens to run), so it checks every active business on every invocation
  // — a no-op for anyone not within 24h of expiring, and never blocks the
  // 8am-gated jobs below even if a renewal call fails.
  await runGmailWatchRenewalJob(allBusinesses);

  const dueBusinesses: Business[] = allBusinesses.filter((business) =>
    isTargetLocalHour(getEffectiveTimezone(business))
  );

  if (dueBusinesses.length === 0) {
    return NextResponse.json({ skipped: true, reason: "no business at 8am local this hour" });
  }

  try {
    const followUpLogs = await runDailyFollowUpJob(dueBusinesses);
    const replySyncLogs = await runDailyReplySyncJob(dueBusinesses);
    const gmailCaptureLogs = await runDailyGmailLeadCaptureJob(dueBusinesses);
    return NextResponse.json({ followUps: followUpLogs, replySync: replySyncLogs, gmailLeadCapture: gmailCaptureLogs });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}
