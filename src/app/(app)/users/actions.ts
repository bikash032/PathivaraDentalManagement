"use server";

import bcrypt from "bcryptjs";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requirePermission } from "@/lib/auth/current-user";
import { db } from "@/lib/db";
import { getRequestIp } from "@/lib/auth/session";
import { writeAuditLog } from "@/lib/audit";
import { createUserSchema, updateUserSchema, resetPasswordSchema } from "@/lib/validation/user";
import { flattenZodErrors } from "@/lib/validation/zod-helpers";

export type UserFormState = { error?: string; success?: string; fieldErrors?: Record<string, string> };

export async function createUserAction(_prevState: UserFormState, formData: FormData): Promise<UserFormState> {
  const actor = await requirePermission("user.manage");

  const parsed = createUserSchema.safeParse({
    name: formData.get("name"),
    email: formData.get("email"),
    phone: formData.get("phone") || undefined,
    roleId: formData.get("roleId"),
    password: formData.get("password"),
  });

  if (!parsed.success) {
    return { error: "Please fix the errors below.", fieldErrors: flattenZodErrors(parsed.error) };
  }

  const data = parsed.data;

  const existing = await db.user.findUnique({ where: { email: data.email } });
  if (existing) {
    return { error: "A user with this email already exists." };
  }

  const passwordHash = await bcrypt.hash(data.password, 12);
  const user = await db.user.create({
    data: {
      name: data.name,
      email: data.email,
      phone: data.phone || null,
      roleId: data.roleId,
      passwordHash,
    },
  });

  await writeAuditLog({
    userId: actor.id,
    action: "user.create",
    entityType: "User",
    entityId: user.id,
    ipAddress: await getRequestIp(),
  });

  revalidatePath("/users");
  redirect(`/users/${user.id}`);
}

export async function updateUserAction(
  id: string,
  _prevState: UserFormState,
  formData: FormData
): Promise<UserFormState> {
  const actor = await requirePermission("user.manage");

  const parsed = updateUserSchema.safeParse({
    name: formData.get("name"),
    phone: formData.get("phone") || undefined,
    roleId: formData.get("roleId"),
    isActive: formData.get("isActive") === "on",
  });

  if (!parsed.success) {
    return { error: "Please fix the errors below.", fieldErrors: flattenZodErrors(parsed.error) };
  }

  const data = parsed.data;

  if (id === actor.id && !data.isActive) {
    return { error: "You cannot deactivate your own account." };
  }

  await db.user.update({
    where: { id },
    data: { name: data.name, phone: data.phone || null, roleId: data.roleId, isActive: data.isActive },
  });

  await writeAuditLog({
    userId: actor.id,
    action: "user.update",
    entityType: "User",
    entityId: id,
    ipAddress: await getRequestIp(),
  });

  revalidatePath("/users");
  revalidatePath(`/users/${id}`);
  redirect(`/users/${id}`);
}

export async function resetPasswordAction(
  id: string,
  _prevState: UserFormState,
  formData: FormData
): Promise<UserFormState> {
  const actor = await requirePermission("user.manage");

  const parsed = resetPasswordSchema.safeParse({ password: formData.get("password") });
  if (!parsed.success) {
    return { error: "Please fix the errors below.", fieldErrors: flattenZodErrors(parsed.error) };
  }

  const passwordHash = await bcrypt.hash(parsed.data.password, 12);
  await db.user.update({ where: { id }, data: { passwordHash } });

  // Invalidate all existing sessions for this user so the old password's
  // sessions can't keep working after an admin-forced reset.
  await db.session.deleteMany({ where: { userId: id } });

  await writeAuditLog({
    userId: actor.id,
    action: "user.password_reset",
    entityType: "User",
    entityId: id,
    ipAddress: await getRequestIp(),
  });

  revalidatePath(`/users/${id}`);
  return { success: "Password reset. The user's existing sessions have been signed out." };
}
