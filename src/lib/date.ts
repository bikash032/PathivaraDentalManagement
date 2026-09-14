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

export function formatDateTimeNepal(date: Date): string {
  return new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Kathmandu",
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
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

export function formatDateNepal(date: Date): string {
  return new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Kathmandu",
    dateStyle: "medium",
  }).format(date);
}

/** yyyy-mm-dd in Nepal Time, for pre-filling <input type="date">. */
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
