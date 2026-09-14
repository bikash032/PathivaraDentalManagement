"use server";

import { z } from "zod";
import bcrypt from "bcryptjs";
import { requireUser } from "@/lib/auth/current-user";
import { getRequestIp } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { writeAuditLog } from "@/lib/audit";

const changePasswordSchema = z.object({
  currentPassword: z.string().min(1),
  newPassword: z.string().min(8, "New password must be at least 8 characters."),
  confirmPassword: z.string().min(1),
});

export type ChangePasswordState = { error?: string; success?: string };

export async function changePasswordAction(
  _prevState: ChangePasswordState,
  formData: FormData
): Promise<ChangePasswordState> {
  const user = await requireUser();

  const parsed = changePasswordSchema.safeParse({
    currentPassword: formData.get("currentPassword"),
    newPassword: formData.get("newPassword"),
    confirmPassword: formData.get("confirmPassword"),
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input." };
  }

  const { currentPassword, newPassword, confirmPassword } = parsed.data;

  if (newPassword !== confirmPassword) {
    return { error: "New password and confirmation do not match." };
  }

  const dbUser = await db.user.findUniqueOrThrow({ where: { id: user.id } });
  const currentValid = await bcrypt.compare(currentPassword, dbUser.passwordHash);
  if (!currentValid) {
    return { error: "Current password is incorrect." };
  }

  const passwordHash = await bcrypt.hash(newPassword, 12);
  await db.user.update({ where: { id: user.id }, data: { passwordHash } });

  await writeAuditLog({
    userId: user.id,
    action: "auth.password_changed",
    entityType: "User",
    entityId: user.id,
    ipAddress: await getRequestIp(),
  });

  return { success: "Password updated." };
}
