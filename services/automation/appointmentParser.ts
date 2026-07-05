import { logAction } from "@/lib/logger";
import type { Lead } from "@/types";

/**
 * Deterministic replacement for the old Gemini-backed appointment extraction
 * — regex/pattern matching only, no network calls. Deliberately conservative,
 * same as before: requires BOTH a date signal and a time signal in the
 * message to count as "requested"; anything vaguer resolves to
 * { requested: false }, same as any parse failure. Never throws.
 */
export interface RequestedAppointment {
  requested: boolean;
  /** Local wall-clock "YYYY-MM-DDTHH:MM:00" — paired with the business's timezone, not UTC. Set only when requested is true. */
  dateTime: string | null;
  durationMinutes: number;
}

const MONTHS: Record<string, number> = {
  jan: 0, january: 0,
  feb: 1, february: 1,
  mar: 2, march: 2,
  apr: 3, april: 3,
  may: 4,
  jun: 5, june: 5,
  jul: 6, july: 6,
  aug: 7, august: 7,
  sep: 8, sept: 8, september: 8,
  oct: 9, october: 9,
  nov: 10, november: 10,
  dec: 11, december: 11,
};

const WEEKDAYS = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];

function pad(n: number): string {
  return String(n).padStart(2, "0");
}

function toDateStr(date: Date): string {
  return `${date.getUTCFullYear()}-${pad(date.getUTCMonth() + 1)}-${pad(date.getUTCDate())}`;
}

/** Rolls a month/day onto the nearest occurrence at or after `today` when no year is given. */
function resolveYear(today: Date, month: number, day: number): number {
  const candidate = new Date(Date.UTC(today.getUTCFullYear(), month, day));
  return candidate.getTime() < today.getTime() ? today.getUTCFullYear() + 1 : today.getUTCFullYear();
}

function findDate(text: string, today: Date): string | null {
  // ISO: 2026-01-15
  const iso = text.match(/\b(\d{4})-(\d{2})-(\d{2})\b/);
  if (iso) {
    return `${iso[1]}-${iso[2]}-${iso[3]}`;
  }

  // Month name: "Jan 1, 2026", "January 15th"
  const monthName = text.match(
    /\b(jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:t(?:ember)?)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)\.?\s+(\d{1,2})(?:st|nd|rd|th)?(?:,?\s+(\d{4}))?\b/i
  );
  if (monthName) {
    const month = MONTHS[monthName[1].toLowerCase()];
    const day = Number(monthName[2]);
    const year = monthName[3] ? Number(monthName[3]) : resolveYear(today, month, day);
    return `${year}-${pad(month + 1)}-${pad(day)}`;
  }

  // Slash date: 1/15 or 1/15/2026 or 1/15/26 (month/day)
  const slash = text.match(/\b(\d{1,2})\/(\d{1,2})(?:\/(\d{2,4}))?\b/);
  if (slash) {
    const month = Number(slash[1]) - 1;
    const day = Number(slash[2]);
    if (month >= 0 && month <= 11 && day >= 1 && day <= 31) {
      let year: number;
      if (slash[3]) {
        year = slash[3].length === 2 ? 2000 + Number(slash[3]) : Number(slash[3]);
      } else {
        year = resolveYear(today, month, day);
      }
      return `${year}-${pad(month + 1)}-${pad(day)}`;
    }
  }

  // Relative terms
  if (/\btomorrow\b/i.test(text)) {
    const d = new Date(today.getTime() + 24 * 60 * 60 * 1000);
    return toDateStr(d);
  }
  if (/\bnext week\b/i.test(text)) {
    const d = new Date(today.getTime() + 7 * 24 * 60 * 60 * 1000);
    return toDateStr(d);
  }
  if (/\btoday\b/i.test(text)) {
    return toDateStr(today);
  }

  // Weekday name — resolves to the next occurrence strictly after today.
  const weekdayMatch = text.match(/\b(sunday|monday|tuesday|wednesday|thursday|friday|saturday)\b/i);
  if (weekdayMatch) {
    const targetDow = WEEKDAYS.indexOf(weekdayMatch[1].toLowerCase());
    const todayDow = today.getUTCDay();
    let offset = (targetDow - todayDow + 7) % 7;
    if (offset === 0) offset = 7;
    const d = new Date(today.getTime() + offset * 24 * 60 * 60 * 1000);
    return toDateStr(d);
  }

  return null;
}

function findTime(text: string): { hour: number; minute: number } | null {
  // 12-hour: "3pm", "3:30 pm", "10 AM"
  const twelveHour = text.match(/\b(1[0-2]|0?[1-9])(?::([0-5]\d))?\s?(am|pm)\b/i);
  if (twelveHour) {
    let hour = Number(twelveHour[1]);
    const minute = twelveHour[2] ? Number(twelveHour[2]) : 0;
    const meridiem = twelveHour[3].toLowerCase();
    if (meridiem === "pm" && hour !== 12) hour += 12;
    if (meridiem === "am" && hour === 12) hour = 0;
    return { hour, minute };
  }

  // 24-hour: "15:00", "9:30"
  const twentyFourHour = text.match(/\b([01]?\d|2[0-3]):([0-5]\d)\b/);
  if (twentyFourHour) {
    return { hour: Number(twentyFourHour[1]), minute: Number(twentyFourHour[2]) };
  }

  return null;
}

function findDurationMinutes(text: string): number {
  const minutesMatch = text.match(/\b(\d+)\s?(?:minutes|mins|min)\b/i);
  if (minutesMatch) return Number(minutesMatch[1]);
  const hoursMatch = text.match(/\b(\d+)\s?(?:hours|hrs|hr|hour)\b/i);
  if (hoursMatch) return Number(hoursMatch[1]) * 60;
  return 30;
}

/**
 * Extracts a requested appointment date/time from a lead's message, if any,
 * using regex/pattern matching anchored to the business's local "today"
 * (same timezone-aware anchor the old Gemini prompt used, via the en-CA
 * YYYY-MM-DD trick). Kept async only so callers (services/appointmentBooking.ts)
 * don't need to change.
 */
export async function parseRequestedAppointment(lead: Lead, businessTimezone: string): Promise<RequestedAppointment> {
  const fallback: RequestedAppointment = { requested: false, dateTime: null, durationMinutes: 30 };
  try {
    const todayStr = new Date().toLocaleDateString("en-CA", { timeZone: businessTimezone }); // en-CA gives YYYY-MM-DD
    const today = new Date(`${todayStr}T00:00:00Z`);

    const dateStr = findDate(lead.message, today);
    const time = findTime(lead.message);
    if (!dateStr || !time) {
      return fallback;
    }

    return {
      requested: true,
      dateTime: `${dateStr}T${pad(time.hour)}:${pad(time.minute)}:00`,
      durationMinutes: findDurationMinutes(lead.message),
    };
  } catch (error) {
    logAction("lead.appointment-parse-failed", {
      leadId: lead.leadId,
      error: error instanceof Error ? error.message : "unknown error",
    });
    return fallback;
  }
}
