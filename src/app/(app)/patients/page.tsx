import Link from "next/link";
import { requirePermission } from "@/lib/auth/current-user";
import { db } from "@/lib/db";
import type { Prisma } from "@/generated/prisma/client";

const PAGE_SIZE = 20;

export default async function PatientsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; status?: string; page?: string }>;
}) {
  await requirePermission("patient.view");
  const params = await searchParams;
  const q = params.q?.trim() ?? "";
  const status = params.status === "ARCHIVED" || params.status === "ALL" ? params.status : "ACTIVE";
  const page = Math.max(1, Number(params.page) || 1);

  const where: Prisma.PatientWhereInput = {
    ...(status === "ALL" ? {} : { status }),
    ...(q
      ? {
          OR: [
            { fullName: { contains: q, mode: "insensitive" } },
            { phone: { contains: q } },
            { patientCode: { contains: q, mode: "insensitive" } },
          ],
        }
      : {}),
  };

  const [patients, total] = await Promise.all([
    db.patient.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
    }),
    db.patient.count({ where }),
  ]);

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  function buildHref(overrides: Record<string, string>) {
    const next = new URLSearchParams();
    if (q) next.set("q", q);
    if (status !== "ACTIVE") next.set("status", status);
    if (page !== 1) next.set("page", String(page));
    for (const [k, v] of Object.entries(overrides)) {
      if (v) next.set(k, v);
      else next.delete(k);
    }
    const qs = next.toString();
    return qs ? `/patients?${qs}` : "/patients";
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold text-slate-900">Patients</h1>
        <Link
          href="/patients/new"
          className="rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800"
        >
          New patient
        </Link>
      </div>

      <form className="flex flex-wrap items-center gap-3" action="/patients">
        <input
          type="text"
          name="q"
          defaultValue={q}
          placeholder="Search by name, phone, or patient ID"
          className="w-full max-w-sm rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-slate-500 focus:outline-none focus:ring-1 focus:ring-slate-500"
        />
        <select
          name="status"
          defaultValue={status}
          className="rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-slate-500 focus:outline-none focus:ring-1 focus:ring-slate-500"
        >
          <option value="ACTIVE">Active</option>
          <option value="ARCHIVED">Archived</option>
          <option value="ALL">All</option>
        </select>
        <button
          type="submit"
          className="rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
        >
          Search
        </button>
      </form>

      <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
        <table className="min-w-full divide-y divide-slate-200 text-sm">
          <thead className="bg-slate-50">
            <tr>
              <th className="px-4 py-2 text-left font-medium text-slate-500">Patient ID</th>
              <th className="px-4 py-2 text-left font-medium text-slate-500">Name</th>
              <th className="px-4 py-2 text-left font-medium text-slate-500">Phone</th>
              <th className="px-4 py-2 text-left font-medium text-slate-500">Gender</th>
              <th className="px-4 py-2 text-left font-medium text-slate-500">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {patients.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-4 py-6 text-center text-slate-400">
                  No patients found.
                </td>
              </tr>
            ) : (
              patients.map((p) => (
                <tr key={p.id} className="hover:bg-slate-50">
                  <td className="px-4 py-2 text-slate-500">{p.patientCode}</td>
                  <td className="px-4 py-2">
                    <Link href={`/patients/${p.id}`} className="font-medium text-slate-900 hover:underline">
                      {p.fullName}
                    </Link>
                  </td>
                  <td className="px-4 py-2 text-slate-600">{p.phone}</td>
                  <td className="px-4 py-2 text-slate-600">{p.gender}</td>
                  <td className="px-4 py-2">
                    <span
                      className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                        p.status === "ACTIVE" ? "bg-green-100 text-green-700" : "bg-slate-100 text-slate-500"
                      }`}
                    >
                      {p.status}
                    </span>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {totalPages > 1 ? (
        <div className="flex items-center justify-between text-sm text-slate-500">
          <span>
            Page {page} of {totalPages} ({total} patients)
          </span>
          <div className="flex gap-2">
            {page > 1 ? (
              <Link href={buildHref({ page: String(page - 1) })} className="text-slate-900 underline">
                Previous
              </Link>
            ) : null}
            {page < totalPages ? (
              <Link href={buildHref({ page: String(page + 1) })} className="text-slate-900 underline">
                Next
              </Link>
            ) : null}
          </div>
        </div>
      ) : null}
    </div>
  );
}
