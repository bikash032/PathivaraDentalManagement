import { z } from "zod";

// Nepali mobile numbers: 10 digits starting with 96, 97, or 98.
export const nepaliPhoneRegex = /^9[678]\d{8}$/;

const PHONE_MESSAGE =
  "Enter a valid 10-digit Nepali mobile number (starting with 96, 97, or 98).";

/**
 * Reduces the ways a Nepali mobile number can be typed to the single bare
 * 10-digit form the database already stores, so that +977-9852828286,
 * 09852828286 and 9852828286 are one number rather than three.
 *
 * Both prefix strips are length-guarded on purpose: 9779852828 is itself a
 * valid local number, so "977" is only a country code when a full 10 digits
 * follow it.
 */
export function normalizeNepaliPhone(input: string): string {
  let value = input.replace(/[\s\-().]/g, "").replace(/^\+/, "");
  if (value.length === 13 && value.startsWith("977")) value = value.slice(3);
  if (value.length === 11 && value.startsWith("0")) value = value.slice(1);
  return value;
}

export const nepaliPhoneSchema = z
  .string()
  .trim()
  .transform(normalizeNepaliPhone)
  .refine((v) => nepaliPhoneRegex.test(v), { message: PHONE_MESSAGE });

const optionalPhone = z
  .string()
  .trim()
  .optional()
  .transform((v) => (v ? normalizeNepaliPhone(v) : v))
  .refine((v) => !v || nepaliPhoneRegex.test(v), { message: PHONE_MESSAGE });

export const patientSchema = z.object({
  fullName: z.string().trim().min(2, "Full name is required."),
  phone: nepaliPhoneSchema,
  alternatePhone: optionalPhone,
  address: z.string().trim().optional(),
  dateOfBirth: z.string().trim().optional(),
  approxAge: z.coerce.number().int().min(0).max(150).optional(),
  gender: z.enum(["MALE", "FEMALE", "OTHER"]),
  emergencyContactName: z.string().trim().optional(),
  emergencyContactPhone: optionalPhone,
  medicalNotes: z.string().trim().optional(),
  allergies: z.string().trim().optional(),
  notes: z.string().trim().optional(),
});

export type PatientInput = z.infer<typeof patientSchema>;

export function parsePatientFormData(formData: FormData) {
  return patientSchema.safeParse({
    fullName: formData.get("fullName"),
    phone: formData.get("phone"),
    alternatePhone: formData.get("alternatePhone") || undefined,
    address: formData.get("address") || undefined,
    dateOfBirth: formData.get("dateOfBirth") || undefined,
    approxAge: formData.get("approxAge") || undefined,
    gender: formData.get("gender"),
    emergencyContactName: formData.get("emergencyContactName") || undefined,
    emergencyContactPhone: formData.get("emergencyContactPhone") || undefined,
    medicalNotes: formData.get("medicalNotes") || undefined,
    allergies: formData.get("allergies") || undefined,
    notes: formData.get("notes") || undefined,
  });
}

/** Single wording for a phone collision, shared by the form, the API and the server action. */
export function phoneTakenMessage(fullName: string): string {
  return `Phone number is already used by ${fullName}.`;
}
