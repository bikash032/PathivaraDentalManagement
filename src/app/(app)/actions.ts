"use server";

import { redirect } from "next/navigation";
import { destroySession, getRequestIp } from "@/lib/auth/session";
import { getCurrentUser } from "@/lib/auth/current-user";
import { writeAuditLog } from "@/lib/audit";

export async function logoutAction(): Promise<void> {
  const user = await getCurrentUser();
  const ipAddress = await getRequestIp();

  await destroySession();

  if (user) {
    await writeAuditLog({
      userId: user.id,
      action: "auth.logout",
      entityType: "User",
      entityId: user.id,
      ipAddress,
    });
  }

  redirect("/login");
}
