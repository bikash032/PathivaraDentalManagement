import { z } from "zod";

export const visitSchema = z.object({
  patientId: z.string().min(1, "Select a patient."),
  doctorId: z.string().min(1, "Select a doctor."),
  appointmentId: z.string().optional(),
  chiefComplaint: z.string().trim().min(1, "Chief complaint is required."),
  examination: z.string().trim().optional(),
  diagnosis: z.string().trim().optional(),
  treatmentNotes: z.string().trim().optional(),
  clinicalNotes: z.string().trim().optional(),
  followUpInstructions: z.string().trim().optional(),
  nextAppointmentDate: z.string().trim().optional(),
});

export function parseVisitFormData(formData: FormData) {
  return visitSchema.safeParse({
    patientId: formData.get("patientId"),
    doctorId: formData.get("doctorId"),
    appointmentId: formData.get("appointmentId") || undefined,
    chiefComplaint: formData.get("chiefComplaint"),
    examination: formData.get("examination") || undefined,
    diagnosis: formData.get("diagnosis") || undefined,
    treatmentNotes: formData.get("treatmentNotes") || undefined,
    clinicalNotes: formData.get("clinicalNotes") || undefined,
    followUpInstructions: formData.get("followUpInstructions") || undefined,
    nextAppointmentDate: formData.get("nextAppointmentDate") || undefined,
  });
}

const prescriptionItemSchema = z.object({
  medicineName: z.string().trim().min(1),
  dosage: z.string().trim().optional(),
  frequency: z.string().trim().optional(),
  durationDays: z.coerce.number().int().positive().optional(),
  instructions: z.string().trim().optional(),
});

export type PrescriptionItemInput = z.infer<typeof prescriptionItemSchema>;

export function parsePrescriptionItems(formData: FormData): PrescriptionItemInput[] {
  const names = formData.getAll("medicineName[]").map(String);
  const dosages = formData.getAll("dosage[]").map(String);
  const frequencies = formData.getAll("frequency[]").map(String);
  const durations = formData.getAll("durationDays[]").map(String);
  const instructions = formData.getAll("instructions[]").map(String);

  const items: PrescriptionItemInput[] = [];
  for (let i = 0; i < names.length; i++) {
    if (!names[i]?.trim()) continue;
    const parsed = prescriptionItemSchema.safeParse({
      medicineName: names[i],
      dosage: dosages[i] || undefined,
      frequency: frequencies[i] || undefined,
      durationDays: durations[i] || undefined,
      instructions: instructions[i] || undefined,
    });
    if (parsed.success) items.push(parsed.data);
  }
  return items;
}
