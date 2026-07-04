import { NextResponse } from "next/server";
import { runDailyFollowUpJob } from "@/services/followupEngine";

const TARGET_LOCAL_HOUR = 8;
const TARGET_TIMEZONE = "America/Toronto";

/**
 * Vercel Cron schedules are always UTC, but Toronto shifts between EDT/EST
 * across the year. vercel.json schedules this route at both 12:00 and 13:00
 * UTC (covering both offsets) — whichever invocation doesn't land on 8am
 * Toronto local time is a no-op, so the job effectively runs once a day at
 * 8am local time year-round without needing a manual DST-season update.
 */
function isTargetLocalHour(): boolean {
  const hour = new Intl.DateTimeFormat("en-US", {
    timeZone: TARGET_TIMEZONE,
    hour: "numeric",
    hour12: false,
  }).format(new Date());
  return Number(hour) === TARGET_LOCAL_HOUR;
}

/**
 * Called by the Vercel Cron Job configured in vercel.json. Detects due
 * follow-ups, drafts messages, and queues them as Pending — never sends
 * anything. Every run is logged (see services/followupEngine.ts).
 *
 * If CRON_SECRET is set, requests must carry `Authorization: Bearer <CRON_SECRET>`,
 * which Vercel automatically attaches to its own cron invocations.
 */
export async function GET(request: Request) {
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret) {
    const authHeader = request.headers.get("authorization");
    if (authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  if (!isTargetLocalHour()) {
    return NextResponse.json({ skipped: true, reason: "not 8am America/Toronto yet" });
  }

  try {
    const logs = await runDailyFollowUpJob();
    return NextResponse.json(logs);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}
