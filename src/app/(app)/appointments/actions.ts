"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requirePermission } from "@/lib/auth/current-user";
import { db } from "@/lib/db";
import { getRequestIp } from "@/lib/auth/session";
import { writeAuditLog } from "@/lib/audit";
import { parseAppointmentFormData, combineDateTimeNepal } from "@/lib/validation/appointment";
import { flattenZodErrors } from "@/lib/validation/zod-helpers";
import { getDayRangeNepal } from "@/lib/date";
import type { AppointmentStatus } from "@/generated/prisma/client";

export type AppointmentFormState = { error?: string; fieldErrors?: Record<string, string> };

async function findOverlap(
  doctorId: string,
  scheduledAt: Date,
  durationMinutes: number,
  excludeAppointmentId?: string
) {
  const dayKey = scheduledAt.toISOString().slice(0, 10);
  const { start, end } = getDayRangeNepal(dayKey);

  const candidates = await db.appointment.findMany({
    where: {
      doctorId,
      status: { notIn: ["CANCELLED", "NO_SHOW"] },
      id: excludeAppointmentId ? { not: excludeAppointmentId } : undefined,
      scheduledAt: { gte: start, lt: end },
    },
  });

  const newStart = scheduledAt.getTime();
  const newEnd = newStart + durationMinutes * 60_000;

  return candidates.find((existing) => {
    const existingStart = existing.scheduledAt.getTime();
    const existingEnd = existingStart + existing.durationMinutes * 60_000;
    return existingStart < newEnd && existingEnd > newStart;
  });
}

export async function createAppointmentAction(
  _prevState: AppointmentFormState,
  formData: FormData
): Promise<AppointmentFormState> {
  const user = await requirePermission("appointment.create");
  const parsed = parseAppointmentFormData(formData);

  if (!parsed.success) {
    return { error: "Please fix the errors below.", fieldErrors: flattenZodErrors(parsed.error) };
  }

  const data = parsed.data;
  const scheduledAt = combineDateTimeNepal(data.date, data.time);

  const overlap = await findOverlap(data.doctorId, scheduledAt, data.durationMinutes);
  if (overlap) {
    return { error: "This doctor already has an appointment that overlaps this time slot." };
  }

  const appointment = await db.appointment.create({
    data: {
      patientId: data.patientId,
      doctorId: data.doctorId,
      scheduledAt,
      durationMinutes: data.durationMinutes,
      reason: data.reason || null,
      notes: data.notes || null,
      createdById: user.id,
    },
  });

  await writeAuditLog({
    userId: user.id,
    action: "appointment.create",
    entityType: "Appointment",
    entityId: appointment.id,
    ipAddress: await getRequestIp(),
  });

  revalidatePath("/appointments");
  revalidatePath(`/patients/${data.patientId}`);
  redirect(`/appointments/${appointment.id}`);
}

export async function updateAppointmentAction(
  id: string,
  _prevState: AppointmentFormState,
  formData: FormData
): Promise<AppointmentFormState> {
  const user = await requirePermission("appointment.update");
  const parsed = parseAppointmentFormData(formData);

  if (!parsed.success) {
    return { error: "Please fix the errors below.", fieldErrors: flattenZodErrors(parsed.error) };
  }

  const data = parsed.data;
  const scheduledAt = combineDateTimeNepal(data.date, data.time);

  const overlap = await findOverlap(data.doctorId, scheduledAt, data.durationMinutes, id);
  if (overlap) {
    return { error: "This doctor already has an appointment that overlaps this time slot." };
  }

  const appointment = await db.appointment.update({
    where: { id },
    data: {
      patientId: data.patientId,
      doctorId: data.doctorId,
      scheduledAt,
      durationMinutes: data.durationMinutes,
      reason: data.reason || null,
      notes: data.notes || null,
    },
  });

  await writeAuditLog({
    userId: user.id,
    action: "appointment.update",
    entityType: "Appointment",
    entityId: id,
    ipAddress: await getRequestIp(),
  });

  revalidatePath("/appointments");
  revalidatePath(`/appointments/${id}`);
  revalidatePath(`/patients/${appointment.patientId}`);
  redirect(`/appointments/${id}`);
}

const CANCEL_STATUSES: AppointmentStatus[] = ["CANCELLED", "NO_SHOW"];

export async function updateAppointmentStatusAction(id: string, status: AppointmentStatus): Promise<void> {
  const permission = CANCEL_STATUSES.includes(status) ? "appointment.cancel" : "appointment.update";
  const user = await requirePermission(permission);

  const appointment = await db.appointment.update({ where: { id }, data: { status } });

  await writeAuditLog({
    userId: user.id,
    action: "appointment.status_change",
    entityType: "Appointment",
    entityId: id,
    metadata: { status },
    ipAddress: await getRequestIp(),
  });

  revalidatePath("/appointments");
  revalidatePath(`/appointments/${id}`);
  revalidatePath(`/patients/${appointment.patientId}`);
  revalidatePath("/dashboard");
}
