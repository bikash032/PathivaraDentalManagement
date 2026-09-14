import { z } from "zod";

export const clinicProfileSchema = z.object({
  clinicName: z.string().trim().min(2, "Clinic name is required."),
  address: z.string().trim().optional(),
  phone: z.string().trim().optional(),
  email: z.union([z.string().trim().email(), z.literal("")]).optional(),
  panNumber: z.string().trim().optional(),
  receiptFooterNote: z.string().trim().optional(),
});

export const paymentMethodSchema = z.object({
  name: z.string().trim().min(1, "Name is required."),
});

export const CLINIC_TIMEZONE_KEY = "clinic.timezone";
export const DEFAULT_CLINIC_TIMEZONE = "Asia/Kathmandu";

/** IANA zones offered in Settings. Bikram Sambat dates are always resolved
 *  in Nepal Time, so this governs time-of-day display. */
export const SUPPORTED_TIMEZONES = [
  "Asia/Kathmandu",
  "Asia/Kolkata",
  "Asia/Dhaka",
  "UTC",
] as const;

export const timezoneSchema = z.object({
  timezone: z.enum(SUPPORTED_TIMEZONES),
});
