import { NextResponse } from "next/server";
import { generateDueFollowUps } from "@/services/followupEngine";

/**
 * Intended for a Vercel Cron Job (not yet configured) to call daily.
 * Generates draft follow-ups for estimates that are due — never sends anything.
 */
export async function GET() {
  try {
    const created = await generateDueFollowUps();
    return NextResponse.json({ created: created.length });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}
