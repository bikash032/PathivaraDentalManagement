import { z } from "zod";

export const APPOINTMENT_DURATIONS = [15, 30, 45, 60, 90] as const;

export const appointmentSchema = z.object({
  patientId: z.string().min(1, "Select a patient."),
  doctorId: z.string().min(1, "Select a doctor."),
  date: z.string().min(1, "Select a date."),
  time: z.string().min(1, "Select a time."),
  durationMinutes: z.coerce.number().int().positive(),
  reason: z.string().trim().optional(),
  notes: z.string().trim().optional(),
});

export type AppointmentInput = z.infer<typeof appointmentSchema>;

export function parseAppointmentFormData(formData: FormData) {
  return appointmentSchema.safeParse({
    patientId: formData.get("patientId"),
    doctorId: formData.get("doctorId"),
    date: formData.get("date"),
    time: formData.get("time"),
    durationMinutes: formData.get("durationMinutes"),
    reason: formData.get("reason") || undefined,
    notes: formData.get("notes") || undefined,
  });
}

/**
 * Combines a `date` (yyyy-mm-dd) and `time` (HH:mm) picked in Nepal Time
 * into the correct UTC instant, independent of the server's own timezone.
 */
export function combineDateTimeNepal(date: string, time: string): Date {
  const NEPAL_OFFSET_MINUTES = 5 * 60 + 45;
  const [year, month, day] = date.split("-").map(Number);
  const [hour, minute] = time.split(":").map(Number);
  const utcMs = Date.UTC(year, month - 1, day, hour, minute) - NEPAL_OFFSET_MINUTES * 60 * 1000;
  return new Date(utcMs);
}
