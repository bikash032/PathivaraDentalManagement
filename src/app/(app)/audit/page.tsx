import Link from "next/link";
import { requirePermission } from "@/lib/auth/current-user";
import { db } from "@/lib/db";
import { formatBSDateTime } from "@/lib/date";
import { getClinicTimezone } from "@/lib/clinic-settings";
import type { Prisma } from "@/generated/prisma/client";

const PAGE_SIZE = 50;

export default async function AuditLogPage({
  searchParams,
}: {
  searchParams: Promise<{ action?: string; entityType?: string; page?: string }>;
}) {
  await requirePermission("audit.view");
  const params = await searchParams;
  const page = Math.max(1, Number(params.page) || 1);

  const where: Prisma.AuditLogWhereInput = {
    ...(params.action ? { action: { contains: params.action, mode: "insensitive" } } : {}),
    ...(params.entityType ? { entityType: params.entityType } : {}),
  };

  const timezone = await getClinicTimezone();
  const [entries, total, entityTypes] = await Promise.all([
    db.auditLog.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      include: { user: { select: { name: true, email: true } } },
    }),
    db.auditLog.count({ where }),
    db.auditLog.findMany({ distinct: ["entityType"], select: { entityType: true }, orderBy: { entityType: "asc" } }),
  ]);

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-slate-900">Audit log</h1>
        <p className="mt-1 text-sm text-slate-500">
          A record of security- and record-sensitive actions. Entries cannot be edited or deleted.
        </p>
      </div>

      <form className="flex flex-wrap items-center gap-3">
        <input
          type="text"
          name="action"
          defaultValue={params.action ?? ""}
          placeholder="Filter by action (e.g. payment)"
          className="w-full max-w-xs rounded-md border border-slate-300 px-3 py-2 text-sm"
        />
        <select
          name="entityType"
          defaultValue={params.entityType ?? ""}
          className="rounded-md border border-slate-300 px-3 py-2 text-sm"
        >
          <option value="">All record types</option>
          {entityTypes.map((e) => (
            <option key={e.entityType} value={e.entityType}>
              {e.entityType}
            </option>
          ))}
        </select>
        <button
          type="submit"
          className="rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
        >
          Filter
        </button>
      </form>

      <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
        <table className="min-w-full divide-y divide-slate-200 text-sm">
          <thead className="bg-slate-50">
            <tr>
              <th className="px-4 py-2 text-left font-medium text-slate-500">When</th>
              <th className="px-4 py-2 text-left font-medium text-slate-500">User</th>
              <th className="px-4 py-2 text-left font-medium text-slate-500">Action</th>
              <th className="px-4 py-2 text-left font-medium text-slate-500">Record</th>
              <th className="px-4 py-2 text-left font-medium text-slate-500">IP</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {entries.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-4 py-6 text-center text-slate-400">
                  No audit entries found.
                </td>
              </tr>
            ) : (
              entries.map((entry) => (
                <tr key={entry.id} className="hover:bg-slate-50">
                  <td className="px-4 py-2 text-slate-500">{formatBSDateTime(entry.createdAt, timezone)}</td>
                  <td className="px-4 py-2 text-slate-900">{entry.user?.name ?? "System"}</td>
                  <td className="px-4 py-2 font-mono text-xs text-slate-700">{entry.action}</td>
                  <td className="px-4 py-2 text-slate-600">
                    {entry.entityType}
                    {entry.entityId ? <span className="ml-1 text-xs text-slate-400">{entry.entityId}</span> : null}
                  </td>
                  <td className="px-4 py-2 text-xs text-slate-400">{entry.ipAddress ?? "—"}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {totalPages > 1 ? (
        <div className="flex items-center justify-between text-sm text-slate-500">
          <span>
            Page {page} of {totalPages} ({total} entries)
          </span>
          <div className="flex gap-2">
            {page > 1 ? (
              <Link href={`/audit?page=${page - 1}`} className="text-slate-900 underline">
                Previous
              </Link>
            ) : null}
            {page < totalPages ? (
              <Link href={`/audit?page=${page + 1}`} className="text-slate-900 underline">
                Next
              </Link>
            ) : null}
          </div>
        </div>
      ) : null}
    </div>
  );
}
