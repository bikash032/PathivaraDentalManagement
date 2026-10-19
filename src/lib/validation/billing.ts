import { z } from "zod";

export const TREATMENT_STATUSES = ["PLANNED", "IN_PROGRESS", "COMPLETED", "CANCELLED"] as const;

const invoiceItemSchema = z.object({
  treatmentId: z.string().optional(),
  description: z.string().trim().min(1),
  quantity: z.coerce.number().int().positive(),
  unitPrice: z.coerce.number().nonnegative(),
  discount: z.coerce.number().nonnegative().default(0),
  doctorId: z.string().optional(),
  treatmentStatus: z.enum(TREATMENT_STATUSES).default("PLANNED"),
  tooth: z.string().trim().max(40, "Keep the tooth note under 40 characters.").optional(),
});

export type InvoiceItemInput = z.infer<typeof invoiceItemSchema>;

export const invoiceSchema = z.object({
  patientId: z.string().min(1, "Select a patient."),
  visitId: z.string().optional(),
  discountAmount: z.coerce.number().nonnegative().default(0),
  notes: z.string().trim().optional(),
});

export function parseInvoiceFormData(formData: FormData) {
  return invoiceSchema.safeParse({
    patientId: formData.get("patientId"),
    visitId: formData.get("visitId") || undefined,
    discountAmount: formData.get("discountAmount") || 0,
    notes: formData.get("notes") || undefined,
  });
}

export function parseInvoiceItems(formData: FormData): InvoiceItemInput[] {
  const treatmentIds = formData.getAll("treatmentId[]").map(String);
  const descriptions = formData.getAll("description[]").map(String);
  const quantities = formData.getAll("quantity[]").map(String);
  const unitPrices = formData.getAll("unitPrice[]").map(String);
  const discounts = formData.getAll("discount[]").map(String);
  const doctorIds = formData.getAll("doctorId[]").map(String);
  const statuses = formData.getAll("treatmentStatus[]").map(String);
  const teeth = formData.getAll("tooth[]").map(String);

  const items: InvoiceItemInput[] = [];
  for (let i = 0; i < descriptions.length; i++) {
    if (!descriptions[i]?.trim()) continue;
    const parsed = invoiceItemSchema.safeParse({
      treatmentId: treatmentIds[i] || undefined,
      description: descriptions[i],
      quantity: quantities[i] || 1,
      unitPrice: unitPrices[i] || 0,
      discount: discounts[i] || 0,
      doctorId: doctorIds[i] || undefined,
      treatmentStatus: statuses[i] || undefined,
      tooth: teeth[i] || undefined,
    });
    if (parsed.success) items.push(parsed.data);
  }
  return items;
}

export const recordPaymentSchema = z.object({
  amount: z.coerce.number().positive("Amount must be greater than zero."),
  paymentMethodId: z.string().min(1, "Select a payment method."),
  paymentDate: z.string().min(1, "Select a date."),
  reference: z.string().trim().optional(),
  notes: z.string().trim().optional(),
});

const amountField = z.coerce.number().positive("Amount must be greater than zero.");

/** Cash received with no invoice yet: becomes the patient's unallocated credit. */
export const advancePaymentSchema = recordPaymentSchema.extend({
  patientId: z.string().min(1, "Select a patient."),
});

export const applyCreditSchema = z.object({ amount: amountField });

export const refundSchema = z.object({
  paymentId: z.string().min(1, "Select the receipt to refund."),
  amount: amountField,
  paymentMethodId: z.string().min(1, "Select a payment method."),
  paymentDate: z.string().min(1, "Select a date."),
  reason: z.string().trim().min(3, "Give a reason for the refund."),
});

/** Who performed a billed treatment, at which appointment, and its progress. */
export const itemTreatmentSchema = z.object({
  doctorId: z.string().optional(),
  appointmentId: z.string().optional(),
  treatmentStatus: z.enum(TREATMENT_STATUSES),
  completedDate: z.string().optional(),
  tooth: z.string().trim().max(40, "Keep the tooth note under 40 characters.").optional(),
});
