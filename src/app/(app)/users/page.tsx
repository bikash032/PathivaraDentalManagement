import Link from "next/link";
import { requirePermission } from "@/lib/auth/current-user";
import { db } from "@/lib/db";

export default async function UsersPage() {
  await requirePermission("user.manage");

  const users = await db.user.findMany({
    orderBy: { name: "asc" },
    include: { role: { select: { name: true } } },
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold text-ink">Users</h1>
        <Link
          href="/users/new"
          className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary-hover"
        >
          New user
        </Link>
      </div>

      <div className="overflow-x-auto rounded-lg border border-line bg-surface">
        <table className="min-w-full divide-y divide-line text-sm">
          <thead className="bg-page">
            <tr>
              <th className="px-4 py-2 text-left font-medium text-ink-muted">Name</th>
              <th className="px-4 py-2 text-left font-medium text-ink-muted">Email</th>
              <th className="px-4 py-2 text-left font-medium text-ink-muted">Role</th>
              <th className="px-4 py-2 text-left font-medium text-ink-muted">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line-soft">
            {users.map((u) => (
              <tr key={u.id} className="hover:bg-page">
                <td className="px-4 py-2">
                  <Link href={`/users/${u.id}`} className="font-medium text-ink hover:underline hover:text-primary">
                    {u.name}
                  </Link>
                </td>
                <td className="px-4 py-2 text-ink-secondary">{u.email}</td>
                <td className="px-4 py-2 text-ink-secondary">{u.role.name}</td>
                <td className="px-4 py-2">
                  <span
                    className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                      u.isActive ? "bg-success-soft text-success-ink" : "bg-line-soft text-ink-muted"
                    }`}
                  >
                    {u.isActive ? "Active" : "Inactive"}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
