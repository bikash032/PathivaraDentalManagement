import { requirePermission } from "@/lib/auth/current-user";
import { db } from "@/lib/db";
import { NewUserForm } from "../user-form";
import { createUserAction } from "../actions";

export default async function NewUserPage() {
  await requirePermission("user.manage");
  const roles = await db.role.findMany({ orderBy: { name: "asc" } });

  return (
    <div className="max-w-md space-y-6">
      <h1 className="text-xl font-semibold text-ink">New user</h1>
      <div className="rounded-lg border border-line bg-surface p-6">
        <NewUserForm action={createUserAction} roles={roles} />
      </div>
    </div>
  );
}
