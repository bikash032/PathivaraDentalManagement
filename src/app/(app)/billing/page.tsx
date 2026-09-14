import Link from "next/link";
import { requirePermission } from "@/lib/auth/current-user";
import { db } from "@/lib/db";
import { formatDateNepal } from "@/lib/date";
import { formatNPR } from "@/lib/currency";
import type { Prisma, InvoiceStatus } from "@/generated/prisma/client";

const PAGE_SIZE = 20;

const STATUS_COLORS: Record<InvoiceStatus, string> = {
  UNPAID: "bg-red-100 text-red-700",
  PARTIALLY_PAID: "bg-amber-100 text-amber-700",
  PAID: "bg-green-100 text-green-700",
  CANCELLED: "bg-slate-100 text-slate-500",
};

export default async function BillingPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; page?: string }>;
}) {
  await requirePermission("billing.view");
  const params = await searchParams;
  const page = Math.max(1, Number(params.page) || 1);

  const where: Prisma.InvoiceWhereInput = params.status ? { status: params.status as InvoiceStatus } : {};

  const [invoices, total] = await Promise.all([
    db.invoice.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      include: { patient: { select: { fullName: true, patientCode: true } } },
    }),
    db.invoice.count({ where }),
  ]);

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold text-slate-900">Billing</h1>
        <Link
          href="/billing/new"
          className="rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800"
        >
          New invoice
        </Link>
      </div>

      <form className="flex items-center gap-2">
        <select name="status" defaultValue={params.status ?? ""} className="rounded-md border border-slate-300 px-3 py-2 text-sm">
          <option value="">All statuses</option>
          <option value="UNPAID">Unpaid</option>
          <option value="PARTIALLY_PAID">Partially paid</option>
          <option value="PAID">Paid</option>
          <option value="CANCELLED">Cancelled</option>
        </select>
        <button type="submit" className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm hover:bg-slate-50">
          Filter
        </button>
      </form>

      <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
        <table className="min-w-full divide-y divide-slate-200 text-sm">
          <thead className="bg-slate-50">
            <tr>
              <th className="px-4 py-2 text-left font-medium text-slate-500">Invoice</th>
              <th className="px-4 py-2 text-left font-medium text-slate-500">Patient</th>
              <th className="px-4 py-2 text-left font-medium text-slate-500">Date</th>
              <th className="px-4 py-2 text-left font-medium text-slate-500">Total</th>
              <th className="px-4 py-2 text-left font-medium text-slate-500">Paid</th>
              <th className="px-4 py-2 text-left font-medium text-slate-500">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {invoices.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-6 text-center text-slate-400">
                  No invoices found.
                </td>
              </tr>
            ) : (
              invoices.map((inv) => (
                <tr key={inv.id} className="hover:bg-slate-50">
                  <td className="px-4 py-2">
                    <Link href={`/billing/${inv.id}`} className="font-medium text-slate-900 hover:underline">
                      {inv.invoiceNumber}
                    </Link>
                  </td>
                  <td className="px-4 py-2 text-slate-600">{inv.patient.fullName}</td>
                  <td className="px-4 py-2 text-slate-500">{formatDateNepal(inv.createdAt)}</td>
                  <td className="px-4 py-2 text-slate-600">{formatNPR(inv.totalAmount)}</td>
                  <td className="px-4 py-2 text-slate-600">{formatNPR(inv.paidAmount)}</td>
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
        <div className="flex items-center justify-between text-sm text-slate-500">
          <span>
            Page {page} of {totalPages} ({total} invoices)
          </span>
          <div className="flex gap-2">
            {page > 1 ? (
              <Link href={`/billing?page=${page - 1}`} className="text-slate-900 underline">
                Previous
              </Link>
            ) : null}
            {page < totalPages ? (
              <Link href={`/billing?page=${page + 1}`} className="text-slate-900 underline">
                Next
              </Link>
            ) : null}
          </div>
        </div>
      ) : null}
    </div>
  );
}
