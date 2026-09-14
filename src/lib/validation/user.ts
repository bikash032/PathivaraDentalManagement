import { z } from "zod";
import { nepaliPhoneSchema } from "./patient";

export const createUserSchema = z.object({
  name: z.string().trim().min(2, "Name is required."),
  email: z.string().trim().toLowerCase().email("Enter a valid email."),
  phone: z.union([nepaliPhoneSchema, z.literal("")]).optional(),
  roleId: z.string().min(1, "Select a role."),
  password: z.string().min(8, "Password must be at least 8 characters."),
});

export const updateUserSchema = z.object({
  name: z.string().trim().min(2, "Name is required."),
  phone: z.union([nepaliPhoneSchema, z.literal("")]).optional(),
  roleId: z.string().min(1, "Select a role."),
  isActive: z.coerce.boolean(),
});

export const resetPasswordSchema = z.object({
  password: z.string().min(8, "Password must be at least 8 characters."),
});
