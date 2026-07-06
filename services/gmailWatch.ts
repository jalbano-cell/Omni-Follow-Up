/**
 * Gmail push-notification registration — pure transport, same precedent as
 * services/gmail.ts/gmailInbox.ts (no database/orchestration knowledge).
 * See services/gmailWatchSync.ts for the orchestration (renewal, saving the
 * result) and app/api/webhooks/gmail-push/route.ts for the receiving end.
 */

const GMAIL_API = "https://gmail.googleapis.com/gmail/v1/users/me";

export interface WatchResult {
  historyId: string;
  /** Epoch ms string, as Gmail returns it. */
  expiration: string;
}

/**
 * Registers (or renews — Gmail treats a repeat call as a renewal, not an
 * error) push notifications for the connected mailbox's INBOX to the given
 * Pub/Sub topic. Expires after ~7 days; caller is responsible for renewing
 * before then (services/gmailWatchSync.ts).
 */
export async function startWatch(accessToken: string, topicName: string): Promise<WatchResult> {
  const res = await fetch(`${GMAIL_API}/watch`, {
    method: "POST",
    headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
    body: JSON.stringify({ topicName, labelIds: ["INBOX"], labelFilterAction: "include" }),
  });
  if (!res.ok) {
    throw new Error(`Gmail users.watch failed (${res.status}): ${await res.text()}`);
  }
  const data = (await res.json()) as { historyId: string; expiration: string };
  return { historyId: data.historyId, expiration: data.expiration };
}

/** Stops push notifications for the connected mailbox. */
export async function stopWatch(accessToken: string): Promise<void> {
  const res = await fetch(`${GMAIL_API}/stop`, {
    method: "POST",
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok && res.status !== 404) {
    throw new Error(`Gmail users.stop failed (${res.status}): ${await res.text()}`);
  }
}
