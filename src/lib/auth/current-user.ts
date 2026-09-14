import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { getSessionToken, hashToken } from "@/lib/auth/session";
import type { PermissionKey } from "@/lib/permissions";

export type CurrentUser = {
  id: string;
  name: string;
  email: string;
  roleId: string;
  roleName: string;
  roleKey: string;
  permissions: Set<string>;
};

/**
 * Resolves the logged-in user for the current request, validating the
 * session against the database (not just trusting the cookie) and checking
 * `isActive` live so a deactivated account loses access immediately.
 * Wrapped in React's `cache()` so multiple calls within one request share a
 * single DB round trip.
 */
export const getCurrentUser = cache(async (): Promise<CurrentUser | null> => {
  const token = await getSessionToken();
  if (!token) return null;

  const tokenHash = hashToken(token);
  const session = await db.session.findUnique({
    where: { tokenHash },
    include: {
      user: {
        include: {
          role: {
            include: { permissions: { include: { permission: true } } },
          },
        },
      },
    },
  });

  if (!session) return null;

  if (session.expiresAt < new Date()) {
    await db.session.delete({ where: { id: session.id } }).catch(() => {});
    return null;
  }

  if (!session.user.isActive) return null;

  return {
    id: session.user.id,
    name: session.user.name,
    email: session.user.email,
    roleId: session.user.roleId,
    roleName: session.user.role.name,
    roleKey: session.user.role.key,
    permissions: new Set(session.user.role.permissions.map((rp) => rp.permission.key)),
  };
});

export async function requireUser(): Promise<CurrentUser> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  return user;
}

export function hasPermission(user: CurrentUser, key: PermissionKey): boolean {
  return user.permissions.has(key);
}

export async function requirePermission(key: PermissionKey): Promise<CurrentUser> {
  const user = await requireUser();
  if (!hasPermission(user, key)) {
    redirect("/forbidden");
  }
  return user;
}
