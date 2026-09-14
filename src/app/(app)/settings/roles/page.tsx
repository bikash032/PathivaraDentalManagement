import { requirePermission } from "@/lib/auth/current-user";
import { db } from "@/lib/db";
import { PERMISSIONS } from "@/lib/permissions";
import { updateRolePermissionsAction } from "../actions";

export default async function RolesSettingsPage() {
  await requirePermission("role.manage");

  const roles = await db.role.findMany({
    orderBy: { name: "asc" },
    include: { permissions: { select: { permission: { select: { key: true } } } } },
  });

  const categories = Array.from(new Set(PERMISSIONS.map((p) => p.category)));

  return (
    <div className="space-y-6">
      {roles.map((role) => {
        const grantedKeys = new Set(role.permissions.map((rp) => rp.permission.key));
        const isSuperAdmin = role.key === "SUPER_ADMIN";

        return (
          <div
            key={role.id}
            data-testid={`role-card-${role.key}`}
            className="rounded-lg border border-slate-200 bg-white p-5"
          >
            <div className="mb-3 flex items-center justify-between">
              <div>
                <h2 className="text-sm font-semibold text-slate-900">{role.name}</h2>
                {role.description ? <p className="text-xs text-slate-500">{role.description}</p> : null}
              </div>
              {isSuperAdmin ? (
                <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-500">
                  Always full access
                </span>
              ) : null}
            </div>

            <form action={updateRolePermissionsAction.bind(null, role.id)} className="space-y-4">
              {categories.map((category) => (
                <fieldset key={category} disabled={isSuperAdmin}>
                  <legend className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-500">
                    {category}
                  </legend>
                  <div className="grid grid-cols-1 gap-1 sm:grid-cols-2 lg:grid-cols-3">
                    {PERMISSIONS.filter((p) => p.category === category).map((p) => (
                      <label key={p.key} className="flex items-center gap-2 text-sm text-slate-700">
                        <input
                          type="checkbox"
                          name="permissionKey"
                          value={p.key}
                          defaultChecked={isSuperAdmin || grantedKeys.has(p.key)}
                          className="h-4 w-4 rounded border-slate-300"
                        />
                        {p.description}
                      </label>
                    ))}
                  </div>
                </fieldset>
              ))}

              {!isSuperAdmin ? (
                <button
                  type="submit"
                  className="rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800"
                >
                  Save permissions
                </button>
              ) : null}
            </form>
          </div>
        );
      })}
    </div>
  );
}
