/**
 * Pure month-grid date math for components/appointments/appointment-calendar.tsx
 * — kept framework-agnostic and separate from the client component so it's
 * unit-testable without React, and so every calculation stays in "civil
 * date" space (plain year/month/day integers) rather than JS Date-as-instant,
 * which would otherwise be skewed by the browser's own local timezone. Every
 * function here uses Date.UTC internally purely as a proleptic-Gregorian
 * calculator, never to represent a real moment in time.
 */

export function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

/** Builds a "YYYY-MM-DD" string from civil-date integers (month is 0-indexed, matching JS Date's convention). */
export function dateKeyFor(year: number, month0: number, day: number): string {
  return `${year}-${pad2(month0 + 1)}-${pad2(day)}`;
}

export function daysInMonth(year: number, month0: number): number {
  return new Date(Date.UTC(year, month0 + 1, 0)).getUTCDate();
}

/** 0 (Sun) - 6 (Sat) that the 1st of the month falls on. */
export function firstWeekday(year: number, month0: number): number {
  return new Date(Date.UTC(year, month0, 1)).getUTCDay();
}

export function monthLabel(year: number, month0: number): string {
  return new Date(Date.UTC(year, month0, 1)).toLocaleDateString("en-US", { month: "long", year: "numeric", timeZone: "UTC" });
}

export interface CalendarCell {
  dateKey: string;
  day: number;
}

/** Full month grid, padded to a whole number of weeks with `null` for the leading/trailing blanks. */
export function buildMonthGrid(year: number, month0: number): Array<CalendarCell | null> {
  const totalDays = daysInMonth(year, month0);
  const leadingBlanks = firstWeekday(year, month0);
  const cells: Array<CalendarCell | null> = [
    ...Array.from({ length: leadingBlanks }, () => null),
    ...Array.from({ length: totalDays }, (_, i) => ({ dateKey: dateKeyFor(year, month0, i + 1), day: i + 1 })),
  ];
  while (cells.length % 7 !== 0) cells.push(null);
  return cells;
}

/** Previous month, wrapping the year at January. */
export function previousMonth(year: number, month0: number): { year: number; month0: number } {
  return month0 === 0 ? { year: year - 1, month0: 11 } : { year, month0: month0 - 1 };
}

/** Next month, wrapping the year at December. */
export function nextMonth(year: number, month0: number): { year: number; month0: number } {
  return month0 === 11 ? { year: year + 1, month0: 0 } : { year, month0: month0 + 1 };
}
