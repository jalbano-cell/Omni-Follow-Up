import { listBusyIntervals, createEvent } from "@/services/calendar";
import { refreshAccessToken } from "@/services/googleOAuth";
import { getEffectiveCalendarId, getEffectiveTimezone, getEffectiveWorkingHours } from "@/services/business";
import { parseRequestedAppointment } from "@/services/aiInsightsService";
import { decrypt } from "@/lib/crypto";
import { zonedDateTimeToUtc, formatZonedDateTime } from "@/lib/date";
import { logAction } from "@/lib/logger";
import type { Business, Lead } from "@/types";

/**
 * Real, automatic (no human approval) appointment booking for a lead that
 * requests a specific date/time — a deliberate, narrow exception alongside
 * the automatic acknowledgment email (see CLAUDE.md). Reuses the same
 * Google OAuth connection as Gmail/reminders; unlike
 * services/calendarReminders.ts (strictly output-only), this DOES read
 * availability and DOES book a real event with the customer invited.
 */

const MAX_ALTERNATES = 2;
const MAX_SCAN_DAYS = 5;
const SLOT_STEP_MINUTES = 30;

export type AppointmentBookingResult =
  | { type: "none" }
  | { type: "booked"; label: string; eventId: string }
  | { type: "alternates"; labels: string[] };

function overlaps(aStart: number, aEnd: number, bStart: number, bEnd: number): boolean {
  return aStart < bEnd && bStart < aEnd;
}

/** Adds minutes to a naive local "YYYY-MM-DDTHH:MM:SS" wall-clock string — pure calendar arithmetic, no zone math needed. */
function addMinutesToLocalDateTime(localDateTime: string, minutes: number): string {
  const naive = new Date(`${localDateTime}Z`);
  naive.setUTCMinutes(naive.getUTCMinutes() + minutes);
  return naive.toISOString().slice(0, 19);
}

/** Every candidate slot start, in order, across the scan window — business hours only, in SLOT_STEP_MINUTES increments. */
function buildCandidateSlots(
  scanFrom: Date,
  timezone: string,
  workingHours: { start: number; end: number }
): Date[] {
  const slots: Date[] = [];
  for (let dayOffset = 0; dayOffset < MAX_SCAN_DAYS; dayOffset++) {
    const day = new Date(scanFrom.getTime() + dayOffset * 24 * 60 * 60 * 1000);
    const dateStr = day.toLocaleDateString("en-CA", { timeZone: timezone });
    for (let minutes = workingHours.start * 60; minutes < workingHours.end * 60; minutes += SLOT_STEP_MINUTES) {
      const hh = String(Math.floor(minutes / 60)).padStart(2, "0");
      const mm = String(minutes % 60).padStart(2, "0");
      const slotUtc = zonedDateTimeToUtc(`${dateStr}T${hh}:${mm}:00`, timezone);
      if (slotUtc.getTime() > scanFrom.getTime()) {
        slots.push(slotUtc);
      }
    }
  }
  return slots;
}

/**
 * Parses a lead's message for a requested date/time and, if found, either
 * books it (real Calendar event, customer invited) or finds up to
 * MAX_ALTERNATES nearby open slots to offer instead. Returns { type: "none" }
 * if no appointment was requested, Gmail/Calendar isn't connected, or
 * anything fails — best-effort, never throws, and the caller
 * (services/leadService.ts) falls back to the plain acknowledgment email in
 * every "none" case.
 */
export async function resolveAppointmentBooking(business: Business, lead: Lead): Promise<AppointmentBookingResult> {
  if (!business.googleRefreshTokenEnc || !business.googleConnectedEmail) {
    return { type: "none" };
  }

  const timezone = getEffectiveTimezone(business);
  const requested = await parseRequestedAppointment(lead, timezone);
  if (!requested.requested || !requested.dateTime) {
    return { type: "none" };
  }

  try {
    const accessToken = await refreshAccessToken(decrypt(business.googleRefreshTokenEnc));
    const calendarId = getEffectiveCalendarId(business);
    const workingHours = getEffectiveWorkingHours(business);
    const durationMs = requested.durationMinutes * 60_000;

    const requestedStartUtc = zonedDateTimeToUtc(requested.dateTime, timezone);
    const now = new Date();
    const scanFrom = requestedStartUtc.getTime() < now.getTime() ? now : requestedStartUtc;
    const scanWindowEnd = new Date(scanFrom.getTime() + MAX_SCAN_DAYS * 24 * 60 * 60 * 1000);

    const busy = await listBusyIntervals({
      accessToken,
      calendarId,
      timeMin: scanFrom.toISOString(),
      timeMax: scanWindowEnd.toISOString(),
    });
    const busyIntervals = busy.map((b) => ({ start: new Date(b.start).getTime(), end: new Date(b.end).getTime() }));
    const isFree = (startUtc: Date) => {
      const startMs = startUtc.getTime();
      const endMs = startMs + durationMs;
      return !busyIntervals.some((b) => overlaps(startMs, endMs, b.start, b.end));
    };

    const requestedLocalHour = Number(
      new Intl.DateTimeFormat("en-US", { timeZone: timezone, hour: "numeric", hour12: false }).format(requestedStartUtc)
    );
    const withinBusinessHours = requestedLocalHour >= workingHours.start && requestedLocalHour < workingHours.end;
    const isFuture = requestedStartUtc.getTime() > now.getTime();

    if (isFuture && withinBusinessHours && isFree(requestedStartUtc)) {
      const eventId = await createEvent({
        accessToken,
        calendarId,
        summary: `Appointment with ${lead.name}`,
        description: `Booked automatically from a website inquiry (Lead ${lead.leadId}).${
          lead.requestedService ? ` Re: ${lead.requestedService}.` : ""
        } Message: "${lead.message}"`,
        startDateTime: requested.dateTime,
        endDateTime: addMinutesToLocalDateTime(requested.dateTime, requested.durationMinutes),
        timeZone: timezone,
        attendeeEmails: [lead.email],
        notifyAttendees: true,
      });
      return { type: "booked", label: formatZonedDateTime(requestedStartUtc, timezone), eventId };
    }

    const alternates: Date[] = [];
    for (const candidate of buildCandidateSlots(scanFrom, timezone, workingHours)) {
      if (isFree(candidate)) {
        alternates.push(candidate);
        if (alternates.length >= MAX_ALTERNATES) break;
      }
    }

    if (alternates.length === 0) {
      return { type: "none" };
    }
    return { type: "alternates", labels: alternates.map((a) => formatZonedDateTime(a, timezone)) };
  } catch (error) {
    logAction("lead.appointment-booking-failed", {
      businessId: business.id,
      leadId: lead.leadId,
      error: error instanceof Error ? error.message : "unknown error",
    });
    return { type: "none" };
  }
}
