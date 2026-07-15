import { describe, it, expect } from "vitest";
import { buildMonthGrid, dateKeyFor, daysInMonth, firstWeekday, monthLabel, nextMonth, previousMonth } from "@/lib/calendarGrid";

describe("dateKeyFor", () => {
  it("zero-pads month and day", () => {
    expect(dateKeyFor(2026, 0, 3)).toBe("2026-01-03");
    expect(dateKeyFor(2026, 11, 25)).toBe("2026-12-25");
  });
});

describe("daysInMonth", () => {
  it("handles a 31-day month", () => {
    expect(daysInMonth(2026, 0)).toBe(31); // January
  });
  it("handles a 30-day month", () => {
    expect(daysInMonth(2026, 3)).toBe(30); // April
  });
  it("handles February in a leap year", () => {
    expect(daysInMonth(2028, 1)).toBe(29);
  });
  it("handles February in a non-leap year", () => {
    expect(daysInMonth(2026, 1)).toBe(28);
  });
});

describe("firstWeekday", () => {
  it("matches the known weekday July 1, 2026 falls on (Wednesday)", () => {
    expect(firstWeekday(2026, 6)).toBe(3);
  });
});

describe("monthLabel", () => {
  it("formats as \"Month YYYY\"", () => {
    expect(monthLabel(2026, 6)).toBe("July 2026");
  });
});

describe("previousMonth / nextMonth", () => {
  it("steps back a month within a year", () => {
    expect(previousMonth(2026, 6)).toEqual({ year: 2026, month0: 5 });
  });
  it("wraps the year going back from January", () => {
    expect(previousMonth(2026, 0)).toEqual({ year: 2025, month0: 11 });
  });
  it("steps forward a month within a year", () => {
    expect(nextMonth(2026, 6)).toEqual({ year: 2026, month0: 7 });
  });
  it("wraps the year going forward from December", () => {
    expect(nextMonth(2026, 11)).toEqual({ year: 2027, month0: 0 });
  });
});

describe("buildMonthGrid", () => {
  it("pads to a whole number of weeks", () => {
    const grid = buildMonthGrid(2026, 6); // July 2026
    expect(grid.length % 7).toBe(0);
  });

  it("leads with the correct number of blank cells before day 1", () => {
    const grid = buildMonthGrid(2026, 6); // July 1, 2026 is a Wednesday (index 3)
    expect(grid.slice(0, 3)).toEqual([null, null, null]);
    expect(grid[3]).toEqual({ dateKey: "2026-07-01", day: 1 });
  });

  it("includes every day of the month exactly once", () => {
    const grid = buildMonthGrid(2026, 6);
    const days = grid.filter((c): c is NonNullable<typeof c> => c !== null).map((c) => c.day);
    expect(days).toEqual(Array.from({ length: 31 }, (_, i) => i + 1));
  });
});
