"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requirePermission } from "@/lib/auth/current-user";
import { db } from "@/lib/db";
import { getRequestIp } from "@/lib/auth/session";
import { writeAuditLog } from "@/lib/audit";
import { parseTreatmentFormData } from "@/lib/validation/treatment";
import { flattenZodErrors } from "@/lib/validation/zod-helpers";

export type TreatmentFormState = { error?: string; fieldErrors?: Record<string, string> };

export async function createTreatmentAction(
  _prevState: TreatmentFormState,
  formData: FormData
): Promise<TreatmentFormState> {
  const user = await requirePermission("treatment.manage");
  const parsed = parseTreatmentFormData(formData);

  if (!parsed.success) {
    return { error: "Please fix the errors below.", fieldErrors: flattenZodErrors(parsed.error) };
  }

  const data = parsed.data;
  const existing = await db.treatment.findUnique({ where: { code: data.code } });
  if (existing) {
    return { error: "A treatment with this code already exists." };
  }

  const treatment = await db.treatment.create({
    data: {
      name: data.name,
      code: data.code,
      description: data.description || null,
      defaultPrice: data.defaultPrice,
      isActive: data.isActive,
    },
  });

  await writeAuditLog({
    userId: user.id,
    action: "treatment.create",
    entityType: "Treatment",
    entityId: treatment.id,
    ipAddress: await getRequestIp(),
  });

  revalidatePath("/treatments");
  redirect("/treatments");
}

export async function updateTreatmentAction(
  id: string,
  _prevState: TreatmentFormState,
  formData: FormData
): Promise<TreatmentFormState> {
  const user = await requirePermission("treatment.manage");
  const parsed = parseTreatmentFormData(formData);

  if (!parsed.success) {
    return { error: "Please fix the errors below.", fieldErrors: flattenZodErrors(parsed.error) };
  }

  const data = parsed.data;
  const existing = await db.treatment.findUnique({ where: { code: data.code } });
  if (existing && existing.id !== id) {
    return { error: "A treatment with this code already exists." };
  }

  await db.treatment.update({
    where: { id },
    data: {
      name: data.name,
      code: data.code,
      description: data.description || null,
      defaultPrice: data.defaultPrice,
      isActive: data.isActive,
    },
  });

  await writeAuditLog({
    userId: user.id,
    action: "treatment.update",
    entityType: "Treatment",
    entityId: id,
    ipAddress: await getRequestIp(),
  });

  revalidatePath("/treatments");
  revalidatePath(`/treatments/${id}`);
  redirect("/treatments");
}
