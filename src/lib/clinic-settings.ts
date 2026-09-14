import "server-only";
import { cache } from "react";
import { db } from "@/lib/db";
import { CLINIC_TIMEZONE_KEY, DEFAULT_CLINIC_TIMEZONE } from "@/lib/validation/settings";

/**
 * The clinic's timezone, used for time-of-day display. Cached per request.
 *
 * Note: Bikram Sambat calendar *dates* are always resolved in Nepal Time,
 * because a BS day is defined in NPT. This setting therefore affects the
 * clock time shown alongside a date, not which BS day a timestamp falls on.
 */
export const getClinicTimezone = cache(async (): Promise<string> => {
  const setting = await db.appSetting.findUnique({ where: { key: CLINIC_TIMEZONE_KEY } });
  return setting?.value ?? DEFAULT_CLINIC_TIMEZONE;
});
