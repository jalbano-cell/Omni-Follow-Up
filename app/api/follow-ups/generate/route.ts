import { NextResponse } from "next/server";
import { runDailyFollowUpJob } from "@/services/followupEngine";

/**
 * Called by the Vercel Cron Job configured in vercel.json (daily at 08:00 UTC).
 * Detects due follow-ups, drafts messages, and queues them as Pending —
 * never sends anything. Every run is logged (see services/followupEngine.ts).
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

  try {
    const log = await runDailyFollowUpJob();
    return NextResponse.json(log);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}
