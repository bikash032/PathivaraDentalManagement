import { describe, it, expect } from "vitest";
import {
  adToBS,
  adInputToBS,
  bsToAD,
  bsToADInput,
  bsDaysInMonth,
  isValidBSDate,
  getCurrentBSDate,
  bsWeekday,
  bsWeekdayName,
  formatBSDate,
  formatBSDateShort,
  formatBSDateLong,
  formatBSMonthYear,
  toNepaliNumerals,
  addBSMonths,
  clampBSDay,
  BSDateError,
  BS_MIN_YEAR,
  BS_MAX_YEAR,
} from "@/lib/bs-date";

/** Helper: a Date at Nepal-local midnight for an AD calendar day. */
function adDay(iso: string): Date {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d) - (5 * 60 + 45) * 60 * 1000);
}

describe("AD → BS", () => {
  it("converts the reference date", () => {
    expect(adInputToBS("2026-09-15")).toEqual({ year: 2083, month: 5, day: 30 });
  });

  it.each([
    ["2026-04-14", { year: 2083, month: 1, day: 1 }], // BS new year
    ["2026-09-15", { year: 2083, month: 5, day: 30 }],
    ["2000-01-01", { year: 2056, month: 9, day: 17 }],
    ["1990-06-15", { year: 2047, month: 3, day: 1 }],
  ])("converts %s", (ad, expected) => {
    expect(adInputToBS(ad)).toEqual(expected);
  });

  it("resolves the Nepal-local day, not the UTC day", () => {
    // 19:00 UTC is already 00:45 the next day in Nepal (UTC+5:45)
    const lateEvening = new Date("2026-09-15T19:00:00Z");
    expect(adToBS(lateEvening)).toEqual({ year: 2083, month: 5, day: 31 });

    // 18:00 UTC is still 23:45 the same day in Nepal
    const justBefore = new Date("2026-09-15T18:00:00Z");
    expect(adToBS(justBefore)).toEqual({ year: 2083, month: 5, day: 30 });
  });
});

describe("BS → AD", () => {
  it("converts the reference date back", () => {
    expect(bsToADInput({ year: 2083, month: 5, day: 30 })).toBe("2026-09-15");
  });

  it("round-trips every day of a BS month without drift", () => {
    const year = 2083;
    const month = 5;
    for (let day = 1; day <= bsDaysInMonth(year, month); day++) {
      const ad = bsToADInput({ year, month, day });
      expect(adInputToBS(ad)).toEqual({ year, month, day });
    }
  });

  it("round-trips across a BS year boundary", () => {
    for (const bs of [
      { year: 2082, month: 12, day: 30 },
      { year: 2083, month: 1, day: 1 },
      { year: 2083, month: 12, day: 30 },
      { year: 2084, month: 1, day: 1 },
    ]) {
      expect(adInputToBS(bsToADInput(bs))).toEqual(bs);
    }
  });

  it("returns Nepal-local midnight as the instant", () => {
    const instant = bsToAD({ year: 2083, month: 5, day: 30 });
    expect(instant.toISOString()).toBe("2026-09-14T18:15:00.000Z");
    // …which is 2026-09-15 00:00 in Nepal
    expect(adToBS(instant)).toEqual({ year: 2083, month: 5, day: 30 });
  });
});

describe("variable month lengths", () => {
  it("does not assume a fixed month length", () => {
    const lengths2083 = Array.from({ length: 12 }, (_, i) => bsDaysInMonth(2083, i + 1));
    const lengths2084 = Array.from({ length: 12 }, (_, i) => bsDaysInMonth(2084, i + 1));
    expect(lengths2083).not.toEqual(lengths2084);
  });

  it("month lengths are within the real BS range of 29–32 days", () => {
    for (let year = 2080; year <= 2085; year++) {
      for (let month = 1; month <= 12; month++) {
        const len = bsDaysInMonth(year, month);
        expect(len).toBeGreaterThanOrEqual(29);
        expect(len).toBeLessThanOrEqual(32);
      }
    }
  });

  it("a BS year totals 365 or 366 days", () => {
    for (let year = 2080; year <= 2085; year++) {
      const total = Array.from({ length: 12 }, (_, i) => bsDaysInMonth(year, i + 1)).reduce((a, b) => a + b, 0);
      expect([365, 366]).toContain(total);
    }
  });
});

describe("validation — invalid dates are rejected, not silently converted", () => {
  it("rejects a day beyond the month's real length", () => {
    expect(bsDaysInMonth(2083, 8)).toBe(29);
    expect(isValidBSDate({ year: 2083, month: 8, day: 30 })).toBe(false);
    expect(() => bsToADInput({ year: 2083, month: 8, day: 30 })).toThrow(BSDateError);
  });

  it("accepts the last valid day of that same month", () => {
    expect(isValidBSDate({ year: 2083, month: 8, day: 29 })).toBe(true);
  });

  it("rejects month 0 and 13", () => {
    expect(isValidBSDate({ year: 2083, month: 0, day: 1 })).toBe(false);
    expect(isValidBSDate({ year: 2083, month: 13, day: 1 })).toBe(false);
  });

  it("rejects day 0 and negative days", () => {
    expect(isValidBSDate({ year: 2083, month: 5, day: 0 })).toBe(false);
    expect(isValidBSDate({ year: 2083, month: 5, day: -3 })).toBe(false);
  });

  it("rejects non-integer parts", () => {
    expect(isValidBSDate({ year: 2083, month: 5, day: 1.5 })).toBe(false);
  });

  it("rejects years outside the supported range", () => {
    expect(isValidBSDate({ year: BS_MIN_YEAR - 1, month: 1, day: 1 })).toBe(false);
    expect(isValidBSDate({ year: BS_MAX_YEAR + 1, month: 1, day: 1 })).toBe(false);
    expect(isValidBSDate({ year: BS_MIN_YEAR, month: 1, day: 1 })).toBe(true);
  });

  it("throws a typed error for an AD date outside the supported range", () => {
    expect(() => adInputToBS("1850-01-01")).toThrow(BSDateError);
  });
});

describe("weekdays", () => {
  it("derives the weekday from the real AD date", () => {
    // 2026-09-15 is a Tuesday → मंगलबार
    expect(bsWeekday({ year: 2083, month: 5, day: 30 })).toBe(2);
    expect(bsWeekdayName({ year: 2083, month: 5, day: 30 })).toBe("मंगलबार");
  });

  it("advances the weekday by one across consecutive days", () => {
    const a = bsWeekday({ year: 2083, month: 5, day: 30 });
    const b = bsWeekday({ year: 2083, month: 5, day: 31 });
    expect(b).toBe((a + 1) % 7);
  });
});

describe("formatting", () => {
  const date = adDay("2026-09-15");

  it("formats short, medium and long", () => {
    expect(formatBSDateShort(date)).toBe("२०८३/०५/३०");
    expect(formatBSDate(date)).toBe("३० भदौ २०८३");
    expect(formatBSDateLong(date)).toBe("३० भदौ २०८३, मंगलबार");
  });

  it("formats a calendar header", () => {
    expect(formatBSMonthYear(2083, 5)).toBe("भदौ २०८३");
  });

  it("converts numerals to Devanagari", () => {
    expect(toNepaliNumerals(2083)).toBe("२०८३");
    expect(toNepaliNumerals("2083-05-30")).toBe("२०८३-०५-३०");
  });

  it("uses the clinic's preferred month spellings", () => {
    // these AD dates are the 1st of BS 2083 months 7, 9 and 11
    expect(formatBSDate(adDay("2026-10-18"))).toBe("१ कात्तिक २०८३");
    expect(formatBSDate(adDay("2026-12-16"))).toBe("१ पुष २०८३");
    expect(formatBSDate(adDay("2027-02-13"))).toBe("१ फागुन २०८३");
  });
});

describe("calendar navigation", () => {
  it("moves to the next and previous month across a year boundary", () => {
    expect(addBSMonths(2083, 12, 1)).toEqual({ year: 2084, month: 1 });
    expect(addBSMonths(2083, 1, -1)).toEqual({ year: 2082, month: 12 });
  });

  it("moves by a year", () => {
    expect(addBSMonths(2083, 5, 12)).toEqual({ year: 2084, month: 5 });
    expect(addBSMonths(2083, 5, -12)).toEqual({ year: 2082, month: 5 });
  });

  it("clamps a day when switching to a shorter month", () => {
    // day 32 exists in month 3 (32 days) but not month 8 (29 days)
    expect(bsDaysInMonth(2083, 3)).toBe(32);
    expect(clampBSDay(2083, 8, 32)).toBe(29);
  });
});

describe("today", () => {
  it("returns a valid, in-range BS date for the current moment", () => {
    const today = getCurrentBSDate();
    expect(isValidBSDate(today)).toBe(true);
    expect(today.year).toBeGreaterThanOrEqual(BS_MIN_YEAR);
    expect(today.year).toBeLessThanOrEqual(BS_MAX_YEAR);
  });

  it("matches a conversion of the current Nepal-local day", () => {
    expect(getCurrentBSDate()).toEqual(adToBS(new Date()));
  });
});
