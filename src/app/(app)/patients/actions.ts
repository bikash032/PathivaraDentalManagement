"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requirePermission } from "@/lib/auth/current-user";
import { db } from "@/lib/db";
import { nextPatientCode } from "@/lib/patient-code";
import { parsePatientFormData } from "@/lib/validation/patient";
import { flattenZodErrors } from "@/lib/validation/zod-helpers";
import { writeAuditLog } from "@/lib/audit";
import { getRequestIp } from "@/lib/auth/session";

export type PatientFormState = { error?: string; fieldErrors?: Record<string, string> };

export async function createPatientAction(
  _prevState: PatientFormState,
  formData: FormData
): Promise<PatientFormState> {
  const user = await requirePermission("patient.create");
  const parsed = parsePatientFormData(formData);

  if (!parsed.success) {
    return { error: "Please fix the errors below.", fieldErrors: flattenZodErrors(parsed.error) };
  }

  const data = parsed.data;
  const patientCode = await nextPatientCode();

  const patient = await db.patient.create({
    data: {
      patientCode,
      fullName: data.fullName,
      phone: data.phone,
      alternatePhone: data.alternatePhone || null,
      address: data.address || null,
      dateOfBirth: data.dateOfBirth ? new Date(data.dateOfBirth) : null,
      approxAge: data.approxAge ?? null,
      gender: data.gender,
      emergencyContactName: data.emergencyContactName || null,
      emergencyContactPhone: data.emergencyContactPhone || null,
      medicalNotes: data.medicalNotes || null,
      allergies: data.allergies || null,
      notes: data.notes || null,
      createdById: user.id,
    },
  });

  await writeAuditLog({
    userId: user.id,
    action: "patient.create",
    entityType: "Patient",
    entityId: patient.id,
    metadata: { patientCode: patient.patientCode },
    ipAddress: await getRequestIp(),
  });

  revalidatePath("/patients");
  redirect(`/patients/${patient.id}`);
}

export async function updatePatientAction(
  id: string,
  _prevState: PatientFormState,
  formData: FormData
): Promise<PatientFormState> {
  const user = await requirePermission("patient.update");
  const parsed = parsePatientFormData(formData);

  if (!parsed.success) {
    return { error: "Please fix the errors below.", fieldErrors: flattenZodErrors(parsed.error) };
  }

  const data = parsed.data;

  await db.patient.update({
    where: { id },
    data: {
      fullName: data.fullName,
      phone: data.phone,
      alternatePhone: data.alternatePhone || null,
      address: data.address || null,
      dateOfBirth: data.dateOfBirth ? new Date(data.dateOfBirth) : null,
      approxAge: data.approxAge ?? null,
      gender: data.gender,
      emergencyContactName: data.emergencyContactName || null,
      emergencyContactPhone: data.emergencyContactPhone || null,
      medicalNotes: data.medicalNotes || null,
      allergies: data.allergies || null,
      notes: data.notes || null,
    },
  });

  await writeAuditLog({
    userId: user.id,
    action: "patient.update",
    entityType: "Patient",
    entityId: id,
    ipAddress: await getRequestIp(),
  });

  revalidatePath(`/patients/${id}`);
  revalidatePath("/patients");
  redirect(`/patients/${id}`);
}

export async function archivePatientAction(id: string): Promise<void> {
  const user = await requirePermission("patient.archive");
  await db.patient.update({ where: { id }, data: { status: "ARCHIVED" } });

  await writeAuditLog({
    userId: user.id,
    action: "patient.archive",
    entityType: "Patient",
    entityId: id,
    ipAddress: await getRequestIp(),
  });

  revalidatePath(`/patients/${id}`);
  revalidatePath("/patients");
}

export async function reactivatePatientAction(id: string): Promise<void> {
  const user = await requirePermission("patient.archive");
  await db.patient.update({ where: { id }, data: { status: "ACTIVE" } });

  await writeAuditLog({
    userId: user.id,
    action: "patient.reactivate",
    entityType: "Patient",
    entityId: id,
    ipAddress: await getRequestIp(),
  });

  revalidatePath(`/patients/${id}`);
  revalidatePath("/patients");
}
