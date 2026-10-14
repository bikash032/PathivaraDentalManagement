/**
 * A valid Nepali mobile number that no other record holds.
 *
 * Patient phone numbers are unique at the database level, so fixtures cannot
 * reuse a literal like "9841234567" — the second run of a spec would collide
 * with the patient the first run registered.
 */
export function uniquePhone(): string {
  const tail = Math.floor(Math.random() * 100_000_000)
    .toString()
    .padStart(8, "0");
  return `98${tail}`;
}
