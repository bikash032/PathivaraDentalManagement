import { notFound } from "next/navigation";
import { requirePermission } from "@/lib/auth/current-user";
import { db } from "@/lib/db";
import { EditUserForm, ResetPasswordForm } from "../user-form";
import { updateUserAction, resetPasswordAction } from "../actions";

export default async function UserDetailPage({ params }: { params: Promise<{ id: string }> }) {
  await requirePermission("user.manage");
  const { id } = await params;

  const [user, roles] = await Promise.all([
    db.user.findUnique({ where: { id } }),
    db.role.findMany({ orderBy: { name: "asc" } }),
  ]);
  if (!user) notFound();

  const boundUpdate = updateUserAction.bind(null, user.id);
  const boundReset = resetPasswordAction.bind(null, user.id);

  return (
    <div className="max-w-md space-y-8">
      <div>
        <h1 className="text-xl font-semibold text-slate-900">{user.name}</h1>
        <p className="mt-1 text-sm text-slate-500">{user.email}</p>
      </div>

      <div className="rounded-lg border border-slate-200 bg-white p-6">
        <h2 className="mb-4 text-sm font-semibold text-slate-900">Details</h2>
        <EditUserForm
          action={boundUpdate}
          roles={roles}
          initialValues={{
            name: user.name,
            phone: user.phone ?? "",
            roleId: user.roleId,
            isActive: user.isActive,
          }}
        />
      </div>

      <div className="rounded-lg border border-slate-200 bg-white p-6">
        <h2 className="mb-4 text-sm font-semibold text-slate-900">Reset password</h2>
        <ResetPasswordForm action={boundReset} />
      </div>
    </div>
  );
}
