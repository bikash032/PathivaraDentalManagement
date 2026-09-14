"use server";

import { revalidatePath } from "next/cache";
import { requirePermission } from "@/lib/auth/current-user";
import { db } from "@/lib/db";
import { getRequestIp } from "@/lib/auth/session";
import { writeAuditLog } from "@/lib/audit";
import {
  clinicProfileSchema,
  paymentMethodSchema,
  timezoneSchema,
  CLINIC_TIMEZONE_KEY,
} from "@/lib/validation/settings";
import { flattenZodErrors } from "@/lib/validation/zod-helpers";

export type SettingsFormState = { error?: string; success?: string; fieldErrors?: Record<string, string> };

export async function updateClinicProfileAction(
  _prevState: SettingsFormState,
  formData: FormData
): Promise<SettingsFormState> {
  const user = await requirePermission("settings.manage");

  const parsed = clinicProfileSchema.safeParse({
    clinicName: formData.get("clinicName"),
    address: formData.get("address") || undefined,
    phone: formData.get("phone") || undefined,
    email: formData.get("email") || undefined,
    panNumber: formData.get("panNumber") || undefined,
    receiptFooterNote: formData.get("receiptFooterNote") || undefined,
  });

  if (!parsed.success) {
    return { error: "Please fix the errors below.", fieldErrors: flattenZodErrors(parsed.error) };
  }

  const data = parsed.data;
  const existing = await db.clinicProfile.findFirst();

  if (existing) {
    await db.clinicProfile.update({
      where: { id: existing.id },
      data: {
        clinicName: data.clinicName,
        address: data.address || null,
        phone: data.phone || null,
        email: data.email || null,
        panNumber: data.panNumber || null,
        receiptFooterNote: data.receiptFooterNote || null,
      },
    });
  } else {
    await db.clinicProfile.create({
      data: {
        clinicName: data.clinicName,
        address: data.address || null,
        phone: data.phone || null,
        email: data.email || null,
        panNumber: data.panNumber || null,
        receiptFooterNote: data.receiptFooterNote || null,
      },
    });
  }

  await writeAuditLog({
    userId: user.id,
    action: "settings.clinic_profile_update",
    entityType: "ClinicProfile",
    ipAddress: await getRequestIp(),
  });

  revalidatePath("/settings");
  return { success: "Clinic profile updated." };
}

export async function updateTimezoneAction(
  _prevState: SettingsFormState,
  formData: FormData
): Promise<SettingsFormState> {
  const user = await requirePermission("settings.manage");

  const parsed = timezoneSchema.safeParse({ timezone: formData.get("timezone") });
  if (!parsed.success) {
    return { error: "Select a supported timezone." };
  }

  await db.appSetting.upsert({
    where: { key: CLINIC_TIMEZONE_KEY },
    update: { value: parsed.data.timezone },
    create: { key: CLINIC_TIMEZONE_KEY, value: parsed.data.timezone },
  });

  await writeAuditLog({
    userId: user.id,
    action: "settings.timezone_update",
    entityType: "AppSetting",
    entityId: CLINIC_TIMEZONE_KEY,
    metadata: { timezone: parsed.data.timezone },
    ipAddress: await getRequestIp(),
  });

  revalidatePath("/settings");
  return { success: `Clinic timezone set to ${parsed.data.timezone}.` };
}

export async function createPaymentMethodAction(
  _prevState: SettingsFormState,
  formData: FormData
): Promise<SettingsFormState> {
  const user = await requirePermission("settings.manage");

  const parsed = paymentMethodSchema.safeParse({ name: formData.get("name") });
  if (!parsed.success) {
    return { error: "Please fix the errors below.", fieldErrors: flattenZodErrors(parsed.error) };
  }

  const existing = await db.paymentMethod.findUnique({ where: { name: parsed.data.name } });
  if (existing) {
    return { error: "A payment method with this name already exists." };
  }

  await db.paymentMethod.create({ data: { name: parsed.data.name } });

  await writeAuditLog({
    userId: user.id,
    action: "settings.payment_method_create",
    entityType: "PaymentMethod",
    ipAddress: await getRequestIp(),
  });

  revalidatePath("/settings/payment-methods");
  return { success: "Payment method added." };
}

export async function togglePaymentMethodAction(id: string, isActive: boolean): Promise<void> {
  const user = await requirePermission("settings.manage");
  await db.paymentMethod.update({ where: { id }, data: { isActive } });

  await writeAuditLog({
    userId: user.id,
    action: "settings.payment_method_toggle",
    entityType: "PaymentMethod",
    entityId: id,
    metadata: { isActive },
    ipAddress: await getRequestIp(),
  });

  revalidatePath("/settings/payment-methods");
}

export async function updateRolePermissionsAction(roleId: string, formData: FormData): Promise<void> {
  const user = await requirePermission("role.manage");

  const role = await db.role.findUniqueOrThrow({ where: { id: roleId } });
  if (role.key === "SUPER_ADMIN") {
    // Super Admin always has every permission — see Phase 2 design decision.
    // Refuse to edit it here rather than risk a self-lockout.
    return;
  }

  const grantedKeys = formData.getAll("permissionKey").map(String);

  await db.$transaction(async (tx) => {
    const permissions = await tx.permission.findMany({ where: { key: { in: grantedKeys } } });
    await tx.rolePermission.deleteMany({ where: { roleId } });
    if (permissions.length > 0) {
      await tx.rolePermission.createMany({
        data: permissions.map((p) => ({ roleId, permissionId: p.id })),
      });
    }
  });

  await writeAuditLog({
    userId: user.id,
    action: "role.permissions_update",
    entityType: "Role",
    entityId: roleId,
    metadata: { permissionCount: grantedKeys.length },
    ipAddress: await getRequestIp(),
  });

  revalidatePath("/settings/roles");
}
