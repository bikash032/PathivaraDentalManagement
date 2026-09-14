import bikramSambat from "bikram-sambat";

/**
 * Bikram Sambat (BS) date handling — the single source of truth for every
 * BS ↔ AD conversion and every BS display string in the application.
 *
 * ARCHITECTURE: PostgreSQL always stores Gregorian/AD `DateTime`. BS exists
 * only at the presentation layer:
 *
 *   UI (BS) → bsToADInput() → server action → Prisma → PostgreSQL (AD)
 *   PostgreSQL (AD) → Prisma → server component → formatBSDate() → UI (BS)
 *
 * Never store a BS value in the database.
 *
 * A BS calendar day is defined in Nepal Time (UTC+5:45), so conversion always
 * resolves the *Nepal-local* calendar day of an instant, not its UTC day.
 * A timestamp of 2026-09-15T19:00:00Z is already 2026-09-16 in Nepal, and
 * therefore the following BS day.
 */

export const NEPAL_OFFSET_MINUTES = 5 * 60 + 45;

/** Month names use the spellings preferred by the clinic. */
export const BS_MONTHS = [
  "बैशाख",
  "जेठ",
  "असार",
  "साउन",
  "भदौ",
  "असोज",
  "कात्तिक",
  "मंसिर",
  "पुष",
  "माघ",
  "फागुन",
  "चैत",
] as const;

export const BS_WEEKDAYS_LONG = [
  "आइतबार",
  "सोमबार",
  "मंगलबार",
  "बुधबार",
  "बिहीबार",
  "शुक्रबार",
  "शनिबार",
] as const;

/** Column headers for the calendar grid, Sunday-first (Nepali week order). */
export const BS_WEEKDAYS_SHORT = ["आइत", "सोम", "मंगल", "बुध", "बिहि", "शुक्र", "शनि"] as const;

/** Range supported by the conversion tables. */
export const BS_MIN_YEAR = 1970;
export const BS_MAX_YEAR = 2090;

export type BSDate = { year: number; month: number; day: number };

export class BSDateError extends Error {}

const NEPALI_DIGITS = ["०", "१", "२", "३", "४", "५", "६", "७", "८", "९"];

/** 2083 → २०८३. Non-digit characters are preserved. */
export function toNepaliNumerals(value: string | number): string {
  return String(value).replace(/\d/g, (d) => NEPALI_DIGITS[Number(d)]);
}

function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

/**
 * The Nepal-local calendar day of an instant, as "YYYY-MM-DD".
 * This is the bridge between a stored UTC timestamp and a BS date.
 */
export function toADInputValue(date: Date): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kathmandu",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

/** AD "YYYY-MM-DD" → BS parts. */
export function adInputToBS(adInput: string): BSDate {
  try {
    return bikramSambat.toBik(adInput);
  } catch {
    throw new BSDateError(`Date ${adInput} is outside the supported Bikram Sambat range.`);
  }
}

/** A stored Date → its BS date, resolved in Nepal Time. */
export function adToBS(date: Date): BSDate {
  return adInputToBS(toADInputValue(date));
}

/** BS parts → AD "YYYY-MM-DD", the value submitted by forms. */
export function bsToADInput(bs: BSDate): string {
  if (!isValidBSDate(bs)) {
    throw new BSDateError(`Invalid Bikram Sambat date: ${bs.year}-${bs.month}-${bs.day}`);
  }
  return bikramSambat.toGreg_text(bs.year, bs.month, bs.day);
}

/**
 * BS parts → the Date instant at Nepal-local midnight of that day.
 * Matches how day ranges are computed elsewhere, so comparisons line up.
 */
export function bsToAD(bs: BSDate): Date {
  const [year, month, day] = bsToADInput(bs).split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day) - NEPAL_OFFSET_MINUTES * 60 * 1000);
}

/** Days in a BS month — genuinely varies by year (29–32). */
export function bsDaysInMonth(year: number, month: number): number {
  if (month < 1 || month > 12 || year < BS_MIN_YEAR || year > BS_MAX_YEAR) {
    throw new BSDateError(`Invalid Bikram Sambat month: ${year}-${month}`);
  }
  return bikramSambat.daysInMonth(year, month);
}

export function isValidBSDate(bs: BSDate): boolean {
  const { year, month, day } = bs;
  if (!Number.isInteger(year) || !Number.isInteger(month) || !Number.isInteger(day)) return false;
  if (year < BS_MIN_YEAR || year > BS_MAX_YEAR) return false;
  if (month < 1 || month > 12) return false;
  if (day < 1) return false;
  try {
    return day <= bikramSambat.daysInMonth(year, month);
  } catch {
    return false;
  }
}

/** Today's BS date, in Nepal Time. */
export function getCurrentBSDate(): BSDate {
  return adToBS(new Date());
}

/** Weekday index (0 = आइतबार/Sunday) for a BS date, derived from the real AD date. */
export function bsWeekday(bs: BSDate): number {
  const [year, month, day] = bsToADInput(bs).split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day)).getUTCDay();
}

export function bsWeekdayName(bs: BSDate): string {
  return BS_WEEKDAYS_LONG[bsWeekday(bs)];
}

// ---------------------------------------------------------------------------
// Display formats — all take a stored Date and render BS
// ---------------------------------------------------------------------------

/** २०८३/०५/३० */
export function formatBSDateShort(date: Date): string {
  const bs = adToBS(date);
  return toNepaliNumerals(`${bs.year}/${pad2(bs.month)}/${pad2(bs.day)}`);
}

/** ३० भदौ २०८३ */
export function formatBSDate(date: Date): string {
  const bs = adToBS(date);
  return `${toNepaliNumerals(bs.day)} ${BS_MONTHS[bs.month - 1]} ${toNepaliNumerals(bs.year)}`;
}

/** ३० भदौ २०८३, मंगलबार */
export function formatBSDateLong(date: Date): string {
  const bs = adToBS(date);
  return `${formatBSDate(date)}, ${bsWeekdayName(bs)}`;
}

/** Same as the BS parts formatter but for a BSDate you already hold. */
export function formatBSParts(bs: BSDate): string {
  return `${toNepaliNumerals(bs.day)} ${BS_MONTHS[bs.month - 1]} ${toNepaliNumerals(bs.year)}`;
}

/** भदौ २०८३ — calendar header. */
export function formatBSMonthYear(year: number, month: number): string {
  return `${BS_MONTHS[month - 1]} ${toNepaliNumerals(year)}`;
}

/** Time of day in Nepal Time, with Nepali numerals: १०:३० AM */
export function formatNepalTime(date: Date, timeZone = "Asia/Kathmandu"): string {
  const time = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  }).format(date);
  return toNepaliNumerals(time);
}

/** ३० भदौ २०८३, १०:३० AM */
export function formatBSDateTime(date: Date, timeZone = "Asia/Kathmandu"): string {
  return `${formatBSDate(date)}, ${formatNepalTime(date, timeZone)}`;
}

// ---------------------------------------------------------------------------
// Calendar grid helpers (used by the BS date picker)
// ---------------------------------------------------------------------------

export function addBSMonths(year: number, month: number, delta: number): { year: number; month: number } {
  const total = year * 12 + (month - 1) + delta;
  return { year: Math.floor(total / 12), month: (total % 12) + 1 };
}

export function clampBSDay(year: number, month: number, day: number): number {
  return Math.min(day, bsDaysInMonth(year, month));
}

/** Weekday index of the 1st of a BS month — where the grid starts. */
export function bsMonthStartWeekday(year: number, month: number): number {
  return bsWeekday({ year, month, day: 1 });
}

export function isBSYearInRange(year: number): boolean {
  return year >= BS_MIN_YEAR && year <= BS_MAX_YEAR;
}
