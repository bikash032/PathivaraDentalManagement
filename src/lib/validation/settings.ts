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
