import Link from "next/link";
import { requirePermission } from "@/lib/auth/current-user";
import { db } from "@/lib/db";
import { formatBSDate } from "@/lib/date";

const PAGE_SIZE = 20;

export default async function VisitsPage({ searchParams }: { searchParams: Promise<{ page?: string }> }) {
  await requirePermission("visit.view");
  const params = await searchParams;
  const page = Math.max(1, Number(params.page) || 1);

  const [visits, total] = await Promise.all([
    db.visit.findMany({
      orderBy: { visitDate: "desc" },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      include: { patient: { select: { fullName: true, patientCode: true } }, doctor: { select: { name: true } } },
    }),
    db.visit.count(),
  ]);

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold text-ink">Visits</h1>
        <Link
          href="/visits/new"
          className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary-hover"
        >
          New visit
        </Link>
      </div>

      <div className="overflow-x-auto rounded-lg border border-line bg-surface">
        <table className="min-w-full divide-y divide-line text-sm">
          <thead className="bg-page">
            <tr>
              <th className="px-4 py-2 text-left font-medium text-ink-muted">Date</th>
              <th className="px-4 py-2 text-left font-medium text-ink-muted">Patient</th>
              <th className="px-4 py-2 text-left font-medium text-ink-muted">Doctor</th>
              <th className="px-4 py-2 text-left font-medium text-ink-muted">Chief complaint</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line-soft">
            {visits.length === 0 ? (
              <tr>
                <td colSpan={4} className="px-4 py-6 text-center text-ink-muted">
                  No visit records yet.
                </td>
              </tr>
            ) : (
              visits.map((v) => (
                <tr key={v.id} className="hover:bg-page">
                  <td className="px-4 py-2 text-ink-muted">{formatBSDate(v.visitDate)}</td>
                  <td className="px-4 py-2">
                    <Link href={`/visits/${v.id}`} className="font-medium text-ink hover:underline hover:text-primary">
                      {v.patient.fullName}
                    </Link>
                    <div className="text-xs text-ink-muted">{v.patient.patientCode}</div>
                  </td>
                  <td className="px-4 py-2 text-ink-secondary">{v.doctor.name}</td>
                  <td className="px-4 py-2 text-ink-secondary">{v.chiefComplaint}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {totalPages > 1 ? (
        <div className="flex items-center justify-between text-sm text-ink-muted">
          <span>
            Page {page} of {totalPages} ({total} visits)
          </span>
          <div className="flex gap-2">
            {page > 1 ? (
              <Link href={`/visits?page=${page - 1}`} className="underline text-primary hover:text-primary-hover">
                Previous
              </Link>
            ) : null}
            {page < totalPages ? (
              <Link href={`/visits?page=${page + 1}`} className="underline text-primary hover:text-primary-hover">
                Next
              </Link>
            ) : null}
          </div>
        </div>
      ) : null}
    </div>
  );
}
