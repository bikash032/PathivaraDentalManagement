// The `bikram-sambat` package (Apache-2.0) ships no TypeScript types, so we
// declare the subset of its API that this project uses.
declare module "bikram-sambat" {
  interface BikramDate {
    year: number;
    month: number;
    day: number;
  }

  /** Days in a given BS month — varies by year, so never assume a fixed length. */
  export function daysInMonth(year: number, month: number): number;

  /** Gregorian "YYYY-MM-DD" → BS parts. Throws on an unsupported date. */
  export function toBik(gregorian: string): BikramDate;

  /** BS parts → Gregorian parts. Throws on an invalid BS date. */
  export function toGreg(year: number, month: number, day: number): BikramDate;

  /** BS parts → Gregorian "YYYY-MM-DD". Throws on an invalid BS date. */
  export function toGreg_text(year: number, month: number, day: number): string;

  const bikramSambat: {
    daysInMonth: typeof daysInMonth;
    toBik: typeof toBik;
    toGreg: typeof toGreg;
    toGreg_text: typeof toGreg_text;
  };

  export default bikramSambat;
}
