import { GOOGLE_CALENDAR_API } from "@/config/google";

/**
 * Thin, dependency-free Google Calendar client — pure transport, no database
 * or orchestration knowledge, mirroring services/gmail.ts's shape. Reminder
 * events (services/calendarReminders.ts) stay output-only as documented
 * there. listEvents/createEvent-with-attendees below exist specifically for
 * services/appointmentBooking.ts's real customer-appointment booking flow —
 * a deliberate, separate exception (see CLAUDE.md).
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
  /** Email addresses to invite. Omitted for plain (non-customer-facing) reminder events. */
  attendeeEmails?: string[];
  /** Sends a real Google Calendar invite email to attendees. Only meaningful when attendeeEmails is set. */
  notifyAttendees?: boolean;
}

export async function createEvent(input: CreateEventInput): Promise<string> {
  const sendUpdatesParam = input.notifyAttendees ? "?sendUpdates=all" : "";
  const res = await fetch(
    `${GOOGLE_CALENDAR_API}/calendars/${encodeURIComponent(input.calendarId)}/events${sendUpdatesParam}`,
    {
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
        ...(input.attendeeEmails?.length ? { attendees: input.attendeeEmails.map((email) => ({ email })) } : {}),
      }),
    }
  );

  if (!res.ok) {
    throw new Error(`Calendar event creation failed (${res.status}): ${await res.text()}`);
  }

  const data = (await res.json()) as { id: string };
  return data.id;
}

export interface BusyInterval {
  start: string;
  end: string;
}

/**
 * Lists busy intervals on a calendar between two instants (RFC3339, any
 * offset — Calendar normalizes internally), for services/appointmentBooking.ts
 * to check availability against. Uses events.list (not freebusy.query) since
 * that's unambiguously covered by the calendar.events scope already granted
 * for reminder-event creation — no re-consent needed for existing
 * connections. Only reads start/end; never inspects event content.
 */
export async function listBusyIntervals(input: {
  accessToken: string;
  calendarId: string;
  timeMin: string;
  timeMax: string;
}): Promise<BusyInterval[]> {
  const params = new URLSearchParams({
    timeMin: input.timeMin,
    timeMax: input.timeMax,
    singleEvents: "true",
  });
  const res = await fetch(
    `${GOOGLE_CALENDAR_API}/calendars/${encodeURIComponent(input.calendarId)}/events?${params.toString()}`,
    { headers: { Authorization: `Bearer ${input.accessToken}` } }
  );

  if (!res.ok) {
    throw new Error(`Calendar events list failed (${res.status}): ${await res.text()}`);
  }

  const data = (await res.json()) as {
    items: Array<{ start?: { dateTime?: string; date?: string }; end?: { dateTime?: string; date?: string } }>;
  };
  return (data.items ?? [])
    .filter((event) => event.start && event.end)
    .map((event) => ({
      // All-day events only carry a "date" (no time) — treat as spanning the full day.
      start: (event.start!.dateTime ?? event.start!.date)!,
      end: (event.end!.dateTime ?? event.end!.date)!,
    }));
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
