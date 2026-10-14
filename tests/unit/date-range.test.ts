import { describe, it, expect } from "vitest";
import {
  addADDays,
  adDaysBetween,
  bsQuickRange,
  getDayRangeNepal,
  QUICK_RANGES,
} from "@/lib/date";
import { adInputToBS, bsDaysInMonth, bsToADInput, bsWeekday } from "@/lib/bs-date";

const NEPAL_OFFSET_MS = (5 * 60 + 45) * 60 * 1000;

/** The UTC instant of Nepal-local midnight on an AD calendar day. */
function nepalMidnight(iso: string): Date {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d) - NEPAL_OFFSET_MS);
}

/** The inclusive-range bounds the appointments page queries with. */
function rangeFor(from: string, to: string) {
  return { start: getDayRangeNepal(from).start, end: getDayRangeNepal(to).end };
}

function inRange(instant: Date, from: string, to: string): boolean {
  const { start, end } = rangeFor(from, to);
  return instant >= start && instant < end;
}

describe("addADDays", () => {
  it.each([
    ["2026-09-01", 1, "2026-09-02"],
    ["2026-09-30", 1, "2026-10-01"],
    ["2026-09-01", -1, "2026-08-31"],
    ["2026-01-01", -1, "2025-12-31"],
    ["2024-02-28", 1, "2024-02-29"], // leap year
    ["2026-09-01", 0, "2026-09-01"],
  ])("shifts %s by %i days", (date, delta, expected) => {
    expect(addADDays(date, delta)).toBe(expected);
  });
});

describe("adDaysBetween", () => {
  it("is 0 for the same day", () => {
    expect(adDaysBetween("2026-09-01", "2026-09-01")).toBe(0);
  });

  it("counts across months and years", () => {
    expect(adDaysBetween("2026-09-01", "2026-09-20")).toBe(19);
    expect(adDaysBetween("2026-12-31", "2027-01-01")).toBe(1);
  });

  it("is negative when the range is inverted", () => {
    expect(adDaysBetween("2026-09-20", "2026-09-01")).toBe(-19);
  });
});

describe("inclusive From → To range", () => {
  it("includes midnight on the From date", () => {
    expect(inRange(nepalMidnight("2026-09-01"), "2026-09-01", "2026-09-20")).toBe(true);
  });

  it("includes the last minute of the To date", () => {
    const lateOnToDate = new Date(nepalMidnight("2026-09-21").getTime() - 60_000);
    expect(inRange(lateOnToDate, "2026-09-01", "2026-09-20")).toBe(true);
  });

  it("excludes midnight on the day after the To date", () => {
    expect(inRange(nepalMidnight("2026-09-21"), "2026-09-01", "2026-09-20")).toBe(false);
  });

  it("excludes the last minute before the From date", () => {
    const justBefore = new Date(nepalMidnight("2026-09-01").getTime() - 60_000);
    expect(inRange(justBefore, "2026-09-01", "2026-09-20")).toBe(false);
  });

  it("covers a full single day when From equals To", () => {
    const { start, end } = rangeFor("2026-09-15", "2026-09-15");
    expect(end.getTime() - start.getTime()).toBe(86_400_000);
    expect(inRange(nepalMidnight("2026-09-15"), "2026-09-15", "2026-09-15")).toBe(true);
    expect(inRange(nepalMidnight("2026-09-16"), "2026-09-15", "2026-09-15")).toBe(false);
  });

  it.each([
    ["one week", "2026-09-01", "2026-09-07", 7],
    ["one month", "2026-09-01", "2026-09-30", 30],
    ["same day", "2026-09-01", "2026-09-01", 1],
  ])("spans %s as whole days", (_label, from, to, days) => {
    const { start, end } = rangeFor(from, to);
    expect((end.getTime() - start.getTime()) / 86_400_000).toBe(days);
  });

  it("keeps a late-evening UTC timestamp on its Nepal calendar day", () => {
    // 2026-09-20T19:00Z is already 2026-09-21 00:45 in Nepal, so it belongs to
    // the next day and must fall outside a range ending on the 20th.
    const instant = new Date("2026-09-20T19:00:00Z");
    expect(inRange(instant, "2026-09-01", "2026-09-20")).toBe(false);
    expect(inRange(instant, "2026-09-21", "2026-09-21")).toBe(true);
  });

  it("keeps an early-morning UTC timestamp on its Nepal calendar day", () => {
    // 2026-09-01T00:30Z is 06:15 on 2026-09-01 in Nepal — inside the range.
    expect(inRange(new Date("2026-09-01T00:30:00Z"), "2026-09-01", "2026-09-20")).toBe(true);
    // 2026-08-31T19:00Z is 00:45 on 2026-09-01 in Nepal — also inside.
    expect(inRange(new Date("2026-08-31T19:00:00Z"), "2026-09-01", "2026-09-20")).toBe(true);
  });
});

describe("bsQuickRange", () => {
  // 2026-09-15 = BS 2083-05-30, a Tuesday (मंगलबार).
  const today = adInputToBS("2026-09-15");

  it("returns a single day for today", () => {
    expect(bsQuickRange("today", today)).toEqual({ from: "2026-09-15", to: "2026-09-15" });
  });

  it("returns a single day for yesterday", () => {
    expect(bsQuickRange("yesterday", today)).toEqual({ from: "2026-09-14", to: "2026-09-14" });
  });

  it("starts the week on Sunday and runs seven days", () => {
    const week = bsQuickRange("this-week", today);
    expect(adDaysBetween(week.from, week.to)).toBe(6);
    expect(bsWeekday(adInputToBS(week.from))).toBe(0); // आइतबार
    expect(bsWeekday(adInputToBS(week.to))).toBe(6); // शनिबार
    expect(week.from <= "2026-09-15" && "2026-09-15" <= week.to).toBe(true);
  });

  it("spans the whole BS month, whose length varies", () => {
    const month = bsQuickRange("this-month", today);
    expect(month.from).toBe(bsToADInput({ year: 2083, month: 5, day: 1 }));
    expect(adDaysBetween(month.from, month.to) + 1).toBe(bsDaysInMonth(2083, 5));
  });

  it("spans the whole previous BS month", () => {
    const month = bsQuickRange("last-month", today);
    expect(month.from).toBe(bsToADInput({ year: 2083, month: 4, day: 1 }));
    expect(adDaysBetween(month.from, month.to) + 1).toBe(bsDaysInMonth(2083, 4));
    // and it ends the day before this month starts
    expect(addADDays(month.to, 1)).toBe(bsQuickRange("this-month", today).from);
  });

  it("rolls last-month back across the BS new year", () => {
    const baisakh = adInputToBS("2026-04-20"); // BS 2083-01-07
    const month = bsQuickRange("last-month", baisakh);
    expect(month.from).toBe(bsToADInput({ year: 2082, month: 12, day: 1 }));
    expect(adDaysBetween(month.from, month.to) + 1).toBe(bsDaysInMonth(2082, 12));
  });

  it("never produces an inverted range", () => {
    for (const { key } of QUICK_RANGES) {
      const range = bsQuickRange(key, today);
      expect(range.from <= range.to).toBe(true);
    }
  });
});
