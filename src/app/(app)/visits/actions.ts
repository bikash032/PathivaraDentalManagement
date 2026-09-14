"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requirePermission } from "@/lib/auth/current-user";
import { db } from "@/lib/db";
import { getRequestIp } from "@/lib/auth/session";
import { writeAuditLog } from "@/lib/audit";
import { parseVisitFormData, parsePrescriptionItems } from "@/lib/validation/visit";
import { flattenZodErrors } from "@/lib/validation/zod-helpers";

export type VisitFormState = { error?: string; fieldErrors?: Record<string, string> };

export async function createVisitAction(_prevState: VisitFormState, formData: FormData): Promise<VisitFormState> {
  const user = await requirePermission("visit.create");
  const parsed = parseVisitFormData(formData);

  if (!parsed.success) {
    return { error: "Please fix the errors below.", fieldErrors: flattenZodErrors(parsed.error) };
  }

  const data = parsed.data;
  const items = parsePrescriptionItems(formData);

  const visit = await db.$transaction(async (tx) => {
    const created = await tx.visit.create({
      data: {
        patientId: data.patientId,
        doctorId: data.doctorId,
        appointmentId: data.appointmentId || null,
        chiefComplaint: data.chiefComplaint,
        examination: data.examination || null,
        diagnosis: data.diagnosis || null,
        treatmentNotes: data.treatmentNotes || null,
        clinicalNotes: data.clinicalNotes || null,
        followUpInstructions: data.followUpInstructions || null,
        nextAppointmentDate: data.nextAppointmentDate ? new Date(data.nextAppointmentDate) : null,
        createdById: user.id,
      },
    });

    if (items.length > 0) {
      await tx.prescription.create({
        data: {
          visitId: created.id,
          patientId: data.patientId,
          items: { create: items },
        },
      });
    }

    if (data.appointmentId) {
      await tx.appointment.update({ where: { id: data.appointmentId }, data: { status: "COMPLETED" } });
    }

    return created;
  });

  await writeAuditLog({
    userId: user.id,
    action: "visit.create",
    entityType: "Visit",
    entityId: visit.id,
    ipAddress: await getRequestIp(),
  });

  revalidatePath("/visits");
  revalidatePath(`/patients/${data.patientId}`);
  if (data.appointmentId) revalidatePath(`/appointments/${data.appointmentId}`);
  redirect(`/visits/${visit.id}`);
}

export async function updateVisitAction(
  id: string,
  _prevState: VisitFormState,
  formData: FormData
): Promise<VisitFormState> {
  const user = await requirePermission("visit.update");
  const parsed = parseVisitFormData(formData);

  if (!parsed.success) {
    return { error: "Please fix the errors below.", fieldErrors: flattenZodErrors(parsed.error) };
  }

  const data = parsed.data;
  const items = parsePrescriptionItems(formData);

  await db.$transaction(async (tx) => {
    await tx.visit.update({
      where: { id },
      data: {
        doctorId: data.doctorId,
        chiefComplaint: data.chiefComplaint,
        examination: data.examination || null,
        diagnosis: data.diagnosis || null,
        treatmentNotes: data.treatmentNotes || null,
        clinicalNotes: data.clinicalNotes || null,
        followUpInstructions: data.followUpInstructions || null,
        nextAppointmentDate: data.nextAppointmentDate ? new Date(data.nextAppointmentDate) : null,
      },
    });

    // Replace the prescription wholesale — simplest correct approach for an
    // edit form that resubmits the full item list each time.
    const existingPrescription = await tx.prescription.findFirst({ where: { visitId: id } });
    if (existingPrescription) {
      await tx.prescriptionItem.deleteMany({ where: { prescriptionId: existingPrescription.id } });
      if (items.length > 0) {
        await tx.prescriptionItem.createMany({
          data: items.map((item) => ({ ...item, prescriptionId: existingPrescription.id })),
        });
      } else {
        await tx.prescription.delete({ where: { id: existingPrescription.id } });
      }
    } else if (items.length > 0) {
      const visit = await tx.visit.findUniqueOrThrow({ where: { id } });
      await tx.prescription.create({
        data: { visitId: id, patientId: visit.patientId, items: { create: items } },
      });
    }
  });

  await writeAuditLog({
    userId: user.id,
    action: "visit.update",
    entityType: "Visit",
    entityId: id,
    ipAddress: await getRequestIp(),
  });

  revalidatePath(`/visits/${id}`);
  revalidatePath("/visits");
  redirect(`/visits/${id}`);
}
