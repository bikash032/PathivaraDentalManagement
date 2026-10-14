import Link from "next/link";
import { requirePermission } from "@/lib/auth/current-user";
import { db } from "@/lib/db";
import { formatBSDate } from "@/lib/date";
import { formatNPR } from "@/lib/currency";
import { remainingBalance } from "@/lib/money";
import type { Prisma, InvoiceStatus } from "@/generated/prisma/client";
import { PatientNameSearch } from "./patient-name-search";

const PAGE_SIZE = 20;

const STATUS_COLORS: Record<InvoiceStatus, string> = {
  UNPAID: "bg-danger-soft text-danger-ink",
  PARTIALLY_PAID: "bg-warning-soft text-warning-ink",
  PAID: "bg-success-soft text-success-ink",
  CANCELLED: "bg-line-soft text-ink-muted",
};

export default async function BillingPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; page?: string; patientId?: string }>;
}) {
  await requirePermission("billing.view");
  const params = await searchParams;
  const page = Math.max(1, Number(params.page) || 1);

  const where: Prisma.InvoiceWhereInput = {
    ...(params.status ? { status: params.status as InvoiceStatus } : {}),
    ...(params.patientId ? { patientId: params.patientId } : {}),
  };

  const [invoices, total, selectedPatient] = await Promise.all([
    db.invoice.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      include: { patient: { select: { fullName: true, patientCode: true } } },
    }),
    db.invoice.count({ where }),
    params.patientId
      ? db.patient.findUnique({
          where: { id: params.patientId },
          select: { id: true, fullName: true, patientCode: true, phone: true },
        })
      : null,
  ]);

  // The selected patient's overall position, independent of the status filter.
  const patientSummary = selectedPatient
    ? await db.invoice.aggregate({
        where: { patientId: selectedPatient.id, status: { not: "CANCELLED" } },
        _sum: { totalAmount: true, paidAmount: true },
        _count: true,
      })
    : null;

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  // Every link keeps the filters that are currently applied.
  function buildHref(overrides: Record<string, string | undefined>) {
    const next = new URLSearchParams();
    if (params.status) next.set("status", params.status);
    if (params.patientId) next.set("patientId", params.patientId);
    for (const [k, v] of Object.entries(overrides)) {
      if (v) next.set(k, v);
      else next.delete(k);
    }
    const query = next.toString();
    return query ? `/billing?${query}` : "/billing";
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold text-ink">Billing</h1>
        <Link
          href="/billing/new"
          className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary-hover"
        >
          New invoice
        </Link>
      </div>

      <div className="flex flex-wrap items-end gap-3">
        <PatientNameSearch status={params.status} />

        <form className="flex items-center gap-2">
          {params.patientId ? <input type="hidden" name="patientId" value={params.patientId} /> : null}
          <select name="status" defaultValue={params.status ?? ""} className="rounded-md border border-field-line px-3 py-2 text-sm">
            <option value="">All statuses</option>
            <option value="UNPAID">Unpaid</option>
            <option value="PARTIALLY_PAID">Partially paid</option>
            <option value="PAID">Paid</option>
            <option value="CANCELLED">Cancelled</option>
          </select>
          <button type="submit" className="rounded-md border border-field-line bg-surface px-3 py-2 text-sm hover:bg-page hover:border-secondary hover:text-secondary">
            Filter
          </button>
        </form>
      </div>

      {selectedPatient ? (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-line bg-surface px-4 py-3">
          <div>
            <p className="text-sm font-medium text-ink">
              {selectedPatient.fullName}{" "}
              <span className="font-normal text-ink-muted">
                {selectedPatient.patientCode} · {selectedPatient.phone}
              </span>
            </p>
            {patientSummary ? (
              <p className="mt-1 text-xs text-ink-muted">
                {patientSummary._count} invoice{patientSummary._count === 1 ? "" : "s"} ·
                Billed {formatNPR(patientSummary._sum.totalAmount)} · Paid{" "}
                {formatNPR(patientSummary._sum.paidAmount)} · Outstanding{" "}
                {formatNPR(
                  remainingBalance(
                    Number(patientSummary._sum.totalAmount ?? 0),
                    Number(patientSummary._sum.paidAmount ?? 0)
                  )
                )}
              </p>
            ) : null}
          </div>
          <Link
            href={buildHref({ patientId: undefined, page: undefined })}
            className="rounded-md border border-field-line bg-surface px-3 py-2 text-sm font-medium text-ink-secondary hover:bg-page hover:border-secondary hover:text-secondary"
          >
            Clear patient
          </Link>
        </div>
      ) : null}

      <div className="overflow-x-auto rounded-lg border border-line bg-surface">
        <table className="min-w-full divide-y divide-line text-sm">
          <thead className="bg-page">
            <tr>
              <th className="px-4 py-2 text-left font-medium text-ink-muted">Invoice</th>
              <th className="px-4 py-2 text-left font-medium text-ink-muted">Patient</th>
              <th className="px-4 py-2 text-left font-medium text-ink-muted">Date</th>
              <th className="px-4 py-2 text-left font-medium text-ink-muted">Total</th>
              <th className="px-4 py-2 text-left font-medium text-ink-muted">Paid</th>
              <th className="px-4 py-2 text-left font-medium text-ink-muted">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line-soft">
            {invoices.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-6 text-center text-ink-muted">
                  No invoices found.
                </td>
              </tr>
            ) : (
              invoices.map((inv) => (
                <tr key={inv.id} className="hover:bg-page">
                  <td className="px-4 py-2">
                    <Link href={`/billing/${inv.id}`} className="font-medium text-ink hover:underline hover:text-primary">
                      {inv.invoiceNumber}
                    </Link>
                  </td>
                  <td className="px-4 py-2 text-ink-secondary">{inv.patient.fullName}</td>
                  <td className="px-4 py-2 text-ink-muted">{formatBSDate(inv.createdAt)}</td>
                  <td className="px-4 py-2 text-ink-secondary">{formatNPR(inv.totalAmount)}</td>
                  <td className="px-4 py-2 text-ink-secondary">{formatNPR(inv.paidAmount)}</td>
                  <td className="px-4 py-2">
                    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_COLORS[inv.status]}`}>
                      {inv.status.replace("_", " ")}
                    </span>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {totalPages > 1 ? (
        <div className="flex items-center justify-between text-sm text-ink-muted">
          <span>
            Page {page} of {totalPages} ({total} invoices)
          </span>
          <div className="flex gap-2">
            {page > 1 ? (
              <Link href={buildHref({ page: String(page - 1) })} className="underline text-primary hover:text-primary-hover">
                Previous
              </Link>
            ) : null}
            {page < totalPages ? (
              <Link href={buildHref({ page: String(page + 1) })} className="underline text-primary hover:text-primary-hover">
                Next
              </Link>
            ) : null}
          </div>
        </div>
      ) : null}
    </div>
  );
}
