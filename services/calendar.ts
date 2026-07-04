import { GOOGLE_CALENDAR_API } from "@/config/google";

/**
 * Thin, dependency-free Google Calendar client — pure transport, no Airtable
 * or orchestration knowledge, mirroring services/gmail.ts's shape. Output
 * only: creates/deletes reminder events, never reads availability or books
 * anything on the customer's behalf.
 */

export interface CreateEventInput {
  accessToken: string;
  calendarId: string;
  summary: string;
  description: string;
  /** Local wall-clock date+time, e.g. "2026-07-05T09:00:00" — paired with timeZone, not UTC. */
  startDateTime: string;
  endDateTime: string;
  timeZone: string;
}

export async function createEvent(input: CreateEventInput): Promise<string> {
  const res = await fetch(`${GOOGLE_CALENDAR_API}/calendars/${encodeURIComponent(input.calendarId)}/events`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${input.accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      summary: input.summary,
      description: input.description,
      start: { dateTime: input.startDateTime, timeZone: input.timeZone },
      end: { dateTime: input.endDateTime, timeZone: input.timeZone },
    }),
  });

  if (!res.ok) {
    throw new Error(`Calendar event creation failed (${res.status}): ${await res.text()}`);
  }

  const data = (await res.json()) as { id: string };
  return data.id;
}

export interface DeleteEventInput {
  accessToken: string;
  calendarId: string;
  eventId: string;
}

/** No-ops on 404/410/410 (already deleted or never existed) — deleting a gone event isn't an error here. */
export async function deleteEvent(input: DeleteEventInput): Promise<void> {
  const res = await fetch(
    `${GOOGLE_CALENDAR_API}/calendars/${encodeURIComponent(input.calendarId)}/events/${input.eventId}`,
    { method: "DELETE", headers: { Authorization: `Bearer ${input.accessToken}` } }
  );

  if (!res.ok && res.status !== 404 && res.status !== 410) {
    throw new Error(`Calendar event deletion failed (${res.status}): ${await res.text()}`);
  }
}
