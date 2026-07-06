import { NextResponse } from "next/server";
import { handleGmailPushNotification } from "@/services/gmailWatchSync";
import { safeCompare } from "@/lib/timingSafe";
import { logAction } from "@/lib/logger";
import { env } from "@/lib/env";

interface PubSubPushBody {
  message: {
    data: string; // base64-encoded JSON: { emailAddress, historyId }
    messageId: string;
    publishTime: string;
  };
  subscription: string;
}

interface GmailWatchPayload {
  emailAddress: string;
  historyId: number;
}

/**
 * Receives Cloud Pub/Sub push deliveries for Gmail's users.watch notifications
 * (services/gmailWatch.ts registers the watch; services/gmailWatchSync.ts does
 * the actual reply-sync work). Public, unauthenticated-by-session endpoint,
 * same category as /api/intake — authenticated instead by a shared secret in
 * the query string (`?token=`), which is set when creating the Pub/Sub push
 * subscription's endpoint URL. Pub/Sub retries on any non-2xx response, so a
 * bad/unrecognized message still gets a 200 to avoid a retry storm — only a
 * missing/wrong token is rejected.
 */
export async function POST(request: Request) {
  const token = new URL(request.url).searchParams.get("token");
  if (!env.gmailPushSecret || !safeCompare(token, env.gmailPushSecret)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: PubSubPushBody;
  try {
    body = (await request.json()) as PubSubPushBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const data = body?.message?.data;
  if (!data) {
    return NextResponse.json({ ok: true });
  }

  try {
    const payload = JSON.parse(Buffer.from(data, "base64").toString("utf-8")) as GmailWatchPayload;
    await handleGmailPushNotification(payload.emailAddress);
  } catch (error) {
    // Logged, not thrown — a 5xx here would make Pub/Sub retry the same
    // notification indefinitely; the next real notification (or the daily
    // cron) will catch up on anything missed by one bad delivery.
    logAction("gmail.push-handler-failed", { error: error instanceof Error ? error.message : "unknown error" });
  }

  return NextResponse.json({ ok: true });
}
