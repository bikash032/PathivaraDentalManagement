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

export function formatDateNepal(date: Date): string {
  return new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Kathmandu",
    dateStyle: "medium",
  }).format(date);
}
