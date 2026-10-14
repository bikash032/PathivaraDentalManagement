import Link from "next/link";
import { requirePermission } from "@/lib/auth/current-user";
import { db } from "@/lib/db";
import { formatNPR } from "@/lib/currency";

export default async function TreatmentsPage() {
  await requirePermission("treatment.manage");
  const treatments = await db.treatment.findMany({ orderBy: { name: "asc" } });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold text-ink">Treatments &amp; services</h1>
        <Link
          href="/treatments/new"
          className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary-hover"
        >
          New treatment
        </Link>
      </div>

      <div className="overflow-x-auto rounded-lg border border-line bg-surface">
        <table className="min-w-full divide-y divide-line text-sm">
          <thead className="bg-page">
            <tr>
              <th className="px-4 py-2 text-left font-medium text-ink-muted">Code</th>
              <th className="px-4 py-2 text-left font-medium text-ink-muted">Name</th>
              <th className="px-4 py-2 text-left font-medium text-ink-muted">Default price</th>
              <th className="px-4 py-2 text-left font-medium text-ink-muted">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line-soft">
            {treatments.map((t) => (
              <tr key={t.id} className="hover:bg-page">
                <td className="px-4 py-2 text-ink-muted">{t.code}</td>
                <td className="px-4 py-2">
                  <Link href={`/treatments/${t.id}`} className="font-medium text-ink hover:underline hover:text-primary">
                    {t.name}
                  </Link>
                </td>
                <td className="px-4 py-2 text-ink-secondary">{formatNPR(t.defaultPrice)}</td>
                <td className="px-4 py-2">
                  <span
                    className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                      t.isActive ? "bg-success-soft text-success-ink" : "bg-line-soft text-ink-muted"
                    }`}
                  >
                    {t.isActive ? "Active" : "Inactive"}
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
