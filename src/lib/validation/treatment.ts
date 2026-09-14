import { z } from "zod";

export const treatmentSchema = z.object({
  name: z.string().trim().min(2, "Name is required."),
  code: z
    .string()
    .trim()
    .toUpperCase()
    .min(2, "Code is required.")
    .regex(/^[A-Z0-9_-]+$/, "Code may only contain letters, numbers, hyphens, and underscores."),
  description: z.string().trim().optional(),
  defaultPrice: z.coerce.number().nonnegative("Price must be zero or more."),
  isActive: z.coerce.boolean(),
});

export function parseTreatmentFormData(formData: FormData) {
  return treatmentSchema.safeParse({
    name: formData.get("name"),
    code: formData.get("code"),
    description: formData.get("description") || undefined,
    defaultPrice: formData.get("defaultPrice"),
    isActive: formData.get("isActive") === "on",
  });
}
