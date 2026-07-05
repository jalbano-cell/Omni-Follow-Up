const MS_PER_DAY = 1000 * 60 * 60 * 24;

/** Whole days between an ISO date string and now (today - date). */
export function daysSince(isoDate: string): number {
  const then = new Date(isoDate).getTime();
  const now = Date.now();
  return Math.floor((now - then) / MS_PER_DAY);
}

export function addDays(isoDate: string, days: number): string {
  const date = new Date(isoDate);
  date.setDate(date.getDate() + days);
  return date.toISOString().slice(0, 10);
}

export function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

export function isPastOrToday(isoDate: string): boolean {
  return isoDate <= todayIso();
}

export function formatDate(isoDate: string): string {
  return new Date(isoDate).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export function formatCurrency(value: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(value);
}

/**
 * UTC offset (in minutes, e.g. -240 for EDT) a given instant falls at within
 * an IANA timezone — same Intl-based, no-new-dependency approach the daily
 * cron already uses to stay DST-safe (see app/api/follow-ups/generate/route.ts).
 */
function timezoneOffsetMinutes(instant: Date, timeZone: string): number {
  const parts = new Intl.DateTimeFormat("en-US", { timeZone, timeZoneName: "shortOffset" }).formatToParts(instant);
  const offsetName = parts.find((p) => p.type === "timeZoneName")?.value ?? "GMT+0";
  const match = offsetName.match(/GMT([+-])(\d+)(?::(\d+))?/);
  if (!match) return 0;
  const sign = match[1] === "-" ? -1 : 1;
  return sign * (Number(match[2]) * 60 + Number(match[3] ?? 0));
}

/**
 * Converts a local wall-clock date/time (e.g. "2026-07-06T10:00:00", as
 * Google Calendar's API and services/aiInsightsService.ts's appointment
 * parsing both use) within an IANA timezone into the actual UTC instant.
 * Approximates the DST state using the nominal wall-clock date itself
 * (rather than the true instant, which is what we're solving for) — fine in
 * practice since business-hours appointments never land within hours of a
 * DST transition boundary.
 */
export function zonedDateTimeToUtc(localDateTime: string, timeZone: string): Date {
  const naive = new Date(`${localDateTime}Z`);
  const offsetMinutes = timezoneOffsetMinutes(naive, timeZone);
  return new Date(naive.getTime() - offsetMinutes * 60_000);
}

/** Human-readable label for a UTC instant in a given timezone, e.g. "Monday, July 6 at 10:00 AM". */
export function formatZonedDateTime(instant: Date, timeZone: string): string {
  return instant.toLocaleString("en-US", {
    timeZone,
    weekday: "long",
    month: "long",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}
