import { z } from "zod";

// Nepali mobile numbers: 10 digits starting with 96, 97, or 98.
export const nepaliPhoneRegex = /^9[678]\d{8}$/;

export const nepaliPhoneSchema = z
  .string()
  .trim()
  .regex(nepaliPhoneRegex, "Enter a valid 10-digit Nepali mobile number (starting with 96, 97, or 98).");

const optionalPhone = z
  .string()
  .trim()
  .optional()
  .refine((v) => !v || nepaliPhoneRegex.test(v), {
    message: "Enter a valid 10-digit Nepali mobile number (starting with 96, 97, or 98).",
  });

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
