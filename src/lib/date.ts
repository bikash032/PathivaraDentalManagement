/**
 * Nepal-time primitives for AD dates: day boundaries and the "YYYY-MM-DD" /
 * "HH:mm" values exchanged with form inputs. Storage and querying are always
 * AD/UTC.
 *
 * User-facing *display* is Bikram Sambat — those formatters live in
 * `@/lib/bs-date` and are re-exported here so this module stays the single
 * date entry point for the rest of the app.
 */
export {
  formatBSDate,
  formatBSDateTime,
  formatBSDateShort,
  formatBSDateLong,
  adToBS,
  bsToAD,
  getCurrentBSDate,
} from "@/lib/bs-date";

import {
  getCurrentBSDate as currentBSDate,
  bsToADInput,
  bsWeekday,
  bsDaysInMonth,
  addBSMonths,
  type BSDate,
} from "@/lib/bs-date";

const NEPAL_OFFSET_MINUTES = 5 * 60 + 45; // Nepal Time is UTC+5:45

/**
 * Returns the UTC instants corresponding to local midnight-to-midnight
 * "today" in Nepal Time, regardless of the server's own system timezone.
 * Use this instead of new Date().setHours(0,0,0,0), which follows whatever
 * timezone the server happens to be running in.
 */
export function getTodayRangeNepal(now: Date = new Date()): { start: Date; end: Date } {
  const nepalNow = new Date(now.getTime() + NEPAL_OFFSET_MINUTES * 60 * 1000);
  const y = nepalNow.getUTCFullYear();
  const m = nepalNow.getUTCMonth();
  const d = nepalNow.getUTCDate();
  const startUtcMs = Date.UTC(y, m, d, 0, 0, 0) - NEPAL_OFFSET_MINUTES * 60 * 1000;
  const endUtcMs = Date.UTC(y, m, d + 1, 0, 0, 0) - NEPAL_OFFSET_MINUTES * 60 * 1000;
  return { start: new Date(startUtcMs), end: new Date(endUtcMs) };
}

/**
 * Same as getTodayRangeNepal but for an arbitrary yyyy-mm-dd date string
 * (as produced by an <input type="date"> picked in Nepal Time).
 */
export function getDayRangeNepal(dateStr: string): { start: Date; end: Date } {
  const [year, month, day] = dateStr.split("-").map(Number);
  const startUtcMs = Date.UTC(year, month - 1, day, 0, 0, 0) - NEPAL_OFFSET_MINUTES * 60 * 1000;
  const endUtcMs = Date.UTC(year, month - 1, day + 1, 0, 0, 0) - NEPAL_OFFSET_MINUTES * 60 * 1000;
  return { start: new Date(startUtcMs), end: new Date(endUtcMs) };
}

/** yyyy-mm-dd in Nepal Time, for pre-filling a date input. */
export function toNepalDateInputValue(date: Date): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kathmandu",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

/** yyyy-mm-01 for the current month in Nepal Time — a sensible default report start date. */
export function currentMonthStartNepal(): string {
  const today = toNepalDateInputValue(new Date());
  return `${today.slice(0, 7)}-01`;
}

/** HH:mm in Nepal Time, for pre-filling <input type="time">. */
export function toNepalTimeInputValue(date: Date): string {
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Kathmandu",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(date);
}

// ---------------------------------------------------------------------------
// AD day arithmetic and BS-aware quick ranges (used by date-range filters)
// ---------------------------------------------------------------------------

/**
 * Shift an AD "YYYY-MM-DD" by whole days. Uses UTC arithmetic so it never
 * drifts across a DST or timezone boundary — the string in, string out.
 */
export function addADDays(dateStr: string, delta: number): string {
  const [y, m, d] = dateStr.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d + delta)).toISOString().slice(0, 10);
}

/** Whole days from `from` to `to` (0 when they are the same day). */
export function adDaysBetween(from: string, to: string): number {
  const [fy, fm, fd] = from.split("-").map(Number);
  const [ty, tm, td] = to.split("-").map(Number);
  const ms = Date.UTC(ty, tm - 1, td) - Date.UTC(fy, fm - 1, fd);
  return Math.round(ms / 86_400_000);
}

export const QUICK_RANGES = [
  { key: "today", label: "Today" },
  { key: "yesterday", label: "Yesterday" },
  { key: "this-week", label: "This week" },
  { key: "this-month", label: "This month" },
  { key: "last-month", label: "Last month" },
] as const;

export type QuickRangeKey = (typeof QUICK_RANGES)[number]["key"];

function bsMonthRange(year: number, month: number): { from: string; to: string } {
  return {
    from: bsToADInput({ year, month, day: 1 }),
    to: bsToADInput({ year, month, day: bsDaysInMonth(year, month) }),
  };
}

/**
 * Preset ranges as inclusive AD "YYYY-MM-DD" bounds.
 *
 * Weeks and months follow the *Bikram Sambat* calendar, which is what the
 * clinic sees: the week starts on आइतबार (Sunday) and a BS month is 29–32
 * days long, so its end is looked up rather than assumed.
 */
export function bsQuickRange(
  key: QuickRangeKey,
  today: BSDate = currentBSDate()
): { from: string; to: string } {
  const todayAD = bsToADInput(today);

  switch (key) {
    case "today":
      return { from: todayAD, to: todayAD };
    case "yesterday": {
      const day = addADDays(todayAD, -1);
      return { from: day, to: day };
    }
    case "this-week": {
      const from = addADDays(todayAD, -bsWeekday(today));
      return { from, to: addADDays(from, 6) };
    }
    case "this-month":
      return bsMonthRange(today.year, today.month);
    case "last-month": {
      const prev = addBSMonths(today.year, today.month, -1);
      return bsMonthRange(prev.year, prev.month);
    }
  }
}
