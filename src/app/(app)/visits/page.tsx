import Link from "next/link";
import { requirePermission } from "@/lib/auth/current-user";
import { db } from "@/lib/db";
import { formatDateNepal } from "@/lib/date";

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
        <h1 className="text-xl font-semibold text-slate-900">Visits</h1>
        <Link
          href="/visits/new"
          className="rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800"
        >
          New visit
        </Link>
      </div>

      <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
        <table className="min-w-full divide-y divide-slate-200 text-sm">
          <thead className="bg-slate-50">
            <tr>
              <th className="px-4 py-2 text-left font-medium text-slate-500">Date</th>
              <th className="px-4 py-2 text-left font-medium text-slate-500">Patient</th>
              <th className="px-4 py-2 text-left font-medium text-slate-500">Doctor</th>
              <th className="px-4 py-2 text-left font-medium text-slate-500">Chief complaint</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {visits.length === 0 ? (
              <tr>
                <td colSpan={4} className="px-4 py-6 text-center text-slate-400">
                  No visit records yet.
                </td>
              </tr>
            ) : (
              visits.map((v) => (
                <tr key={v.id} className="hover:bg-slate-50">
                  <td className="px-4 py-2 text-slate-500">{formatDateNepal(v.visitDate)}</td>
                  <td className="px-4 py-2">
                    <Link href={`/visits/${v.id}`} className="font-medium text-slate-900 hover:underline">
                      {v.patient.fullName}
                    </Link>
                    <div className="text-xs text-slate-400">{v.patient.patientCode}</div>
                  </td>
                  <td className="px-4 py-2 text-slate-600">{v.doctor.name}</td>
                  <td className="px-4 py-2 text-slate-600">{v.chiefComplaint}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {totalPages > 1 ? (
        <div className="flex items-center justify-between text-sm text-slate-500">
          <span>
            Page {page} of {totalPages} ({total} visits)
          </span>
          <div className="flex gap-2">
            {page > 1 ? (
              <Link href={`/visits?page=${page - 1}`} className="text-slate-900 underline">
                Previous
              </Link>
            ) : null}
            {page < totalPages ? (
              <Link href={`/visits?page=${page + 1}`} className="text-slate-900 underline">
                Next
              </Link>
            ) : null}
          </div>
        </div>
      ) : null}
    </div>
  );
}
