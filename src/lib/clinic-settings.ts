import "server-only";
import { cache } from "react";
import { connection } from "next/server";
import { db } from "@/lib/db";
import { OFFICIAL_CLINIC_ADDRESS, OFFICIAL_CLINIC_NAME } from "@/lib/clinic-branding";
import { CLINIC_TIMEZONE_KEY, DEFAULT_CLINIC_TIMEZONE } from "@/lib/validation/settings";

export type ClinicProfileView = {
  clinicName: string;
  address: string;
  phone: string | null;
  email: string | null;
  panNumber: string | null;
  receiptFooterNote: string | null;
};

/**
 * The clinic identity shown on screens and printouts: the Settings profile,
 * with the official name and address filling any blank field. Cached per
 * request.
 */
export const getClinicProfile = cache(async (): Promise<ClinicProfileView> => {
  // Read at request time: otherwise pages like /login would be prerendered at
  // build time with whatever name the build machine's database held.
  await connection();
  const profile = await db.clinicProfile.findFirst();
  return {
    clinicName: profile?.clinicName?.trim() || OFFICIAL_CLINIC_NAME,
    address: profile?.address?.trim() || OFFICIAL_CLINIC_ADDRESS,
    phone: profile?.phone || null,
    email: profile?.email || null,
    panNumber: profile?.panNumber || null,
    receiptFooterNote: profile?.receiptFooterNote || null,
  };
});

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
