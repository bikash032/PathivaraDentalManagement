"use server";

import { z } from "zod";
import bcrypt from "bcryptjs";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { createSession, getRequestIp } from "@/lib/auth/session";
import { isRateLimited, recordFailedAttempt, clearAttempts } from "@/lib/rate-limit";
import { writeAuditLog } from "@/lib/audit";

const loginSchema = z.object({
  email: z.string().trim().toLowerCase().email(),
  password: z.string().min(1),
});

export type LoginState = { error?: string };

export async function loginAction(_prevState: LoginState, formData: FormData): Promise<LoginState> {
  const parsed = loginSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });

  if (!parsed.success) {
    return { error: "Enter a valid email and password." };
  }

  const { email, password } = parsed.data;
  const ipAddress = await getRequestIp();
  const rateLimitKey = `${email}:${ipAddress ?? "unknown"}`;

  if (isRateLimited(rateLimitKey)) {
    return { error: "Too many failed attempts. Please wait 15 minutes and try again." };
  }

  const user = await db.user.findUnique({ where: { email } });
  const passwordValid = user ? await bcrypt.compare(password, user.passwordHash) : false;

  if (!user || !passwordValid || !user.isActive) {
    recordFailedAttempt(rateLimitKey);
    await writeAuditLog({
      userId: user?.id ?? null,
      action: "auth.login_failed",
      entityType: "User",
      entityId: user?.id ?? null,
      ipAddress,
    });
    return { error: "Invalid email or password." };
  }

  clearAttempts(rateLimitKey);
  await createSession(user.id);
  await writeAuditLog({
    userId: user.id,
    action: "auth.login",
    entityType: "User",
    entityId: user.id,
    ipAddress,
  });

  redirect("/dashboard");
}
