import Link from "next/link";
import { notFound } from "next/navigation";
import { requirePermission, hasPermission } from "@/lib/auth/current-user";
import { db } from "@/lib/db";
import { formatBSDate, toNepalDateInputValue } from "@/lib/date";
import { formatNPR } from "@/lib/currency";
import { RecordPaymentForm } from "../record-payment-form";
import { recordPaymentAction, voidPaymentAction, cancelInvoiceAction } from "../actions";

export default async function InvoiceDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requirePermission("billing.view");
  const { id } = await params;

  const invoice = await db.invoice.findUnique({
    where: { id },
    include: {
      patient: true,
      items: true,
      payments: { include: { paymentMethod: true }, orderBy: { paymentDate: "desc" } },
    },
  });
  if (!invoice) notFound();

  const paymentMethods = await db.paymentMethod.findMany({ where: { isActive: true }, orderBy: { name: "asc" } });
  const remaining = Number(invoice.totalAmount) - Number(invoice.paidAmount);
  const boundRecordPayment = recordPaymentAction.bind(null, invoice.id);
  const canRecordPayment =
    hasPermission(user, "payment.record") && invoice.status !== "CANCELLED" && invoice.status !== "PAID";

  return (
    <div className="max-w-3xl space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-xl font-semibold text-slate-900">{invoice.invoiceNumber}</h1>
          <p className="mt-1 text-sm text-slate-500">
            <Link href={`/patients/${invoice.patient.id}`} className="underline">
              {invoice.patient.fullName}
            </Link>{" "}
            · {formatBSDate(invoice.createdAt)}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Link
            href={`/print/invoices/${invoice.id}`}
            target="_blank"
            className="rounded-md border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
          >
            Print receipt
          </Link>
          <span
            className={`rounded-full px-2 py-1 text-xs font-medium ${
              invoice.status === "PAID"
                ? "bg-green-100 text-green-700"
                : invoice.status === "CANCELLED"
                  ? "bg-slate-100 text-slate-500"
                  : invoice.status === "PARTIALLY_PAID"
                    ? "bg-amber-100 text-amber-700"
                    : "bg-red-100 text-red-700"
            }`}
          >
            {invoice.status.replace("_", " ")}
          </span>
          {hasPermission(user, "invoice.cancel") && invoice.status !== "CANCELLED" && Number(invoice.paidAmount) === 0 ? (
            <form action={cancelInvoiceAction.bind(null, invoice.id)}>
              <button
                type="submit"
                className="rounded-md border border-red-200 bg-white px-3 py-1.5 text-xs font-medium text-red-600 hover:bg-red-50"
              >
                Cancel invoice
              </button>
            </form>
          ) : null}
        </div>
      </div>

      <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
        <table className="min-w-full divide-y divide-slate-100 text-sm">
          <thead className="bg-slate-50">
            <tr>
              <th className="px-4 py-2 text-left font-medium text-slate-500">Item</th>
              <th className="px-4 py-2 text-right font-medium text-slate-500">Qty</th>
              <th className="px-4 py-2 text-right font-medium text-slate-500">Unit price</th>
              <th className="px-4 py-2 text-right font-medium text-slate-500">Discount</th>
              <th className="px-4 py-2 text-right font-medium text-slate-500">Total</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {invoice.items.map((item) => (
              <tr key={item.id}>
                <td className="px-4 py-2 text-slate-900">{item.description}</td>
                <td className="px-4 py-2 text-right text-slate-600">{item.quantity}</td>
                <td className="px-4 py-2 text-right text-slate-600">{formatNPR(item.unitPrice)}</td>
                <td className="px-4 py-2 text-right text-slate-600">{formatNPR(item.discount)}</td>
                <td className="px-4 py-2 text-right text-slate-900">{formatNPR(item.lineTotal)}</td>
              </tr>
            ))}
          </tbody>
          <tfoot className="border-t border-slate-200 text-sm">
            <tr>
              <td colSpan={4} className="px-4 py-2 text-right text-slate-500">
                Subtotal
              </td>
              <td className="px-4 py-2 text-right text-slate-900">{formatNPR(invoice.subtotal)}</td>
            </tr>
            <tr>
              <td colSpan={4} className="px-4 py-2 text-right text-slate-500">
                Discount
              </td>
              <td className="px-4 py-2 text-right text-slate-900">{formatNPR(invoice.discountAmount)}</td>
            </tr>
            <tr>
              <td colSpan={4} className="px-4 py-2 text-right font-medium text-slate-700">
                Total
              </td>
              <td className="px-4 py-2 text-right font-semibold text-slate-900">{formatNPR(invoice.totalAmount)}</td>
            </tr>
            <tr>
              <td colSpan={4} className="px-4 py-2 text-right text-slate-500">
                Paid
              </td>
              <td className="px-4 py-2 text-right text-slate-900">{formatNPR(invoice.paidAmount)}</td>
            </tr>
            <tr>
              <td colSpan={4} className="px-4 py-2 text-right font-medium text-slate-700">
                Remaining
              </td>
              <td className="px-4 py-2 text-right font-semibold text-slate-900">{formatNPR(remaining)}</td>
            </tr>
          </tfoot>
        </table>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <section className="rounded-lg border border-slate-200 bg-white p-5">
          <h2 className="mb-3 text-sm font-semibold text-slate-700">Payments</h2>
          {invoice.payments.length === 0 ? (
            <p className="text-sm text-slate-400">No payments recorded yet.</p>
          ) : (
            <ul className="divide-y divide-slate-100">
              {invoice.payments.map((p) => (
                <li key={p.id} className="flex items-center justify-between py-2 text-sm">
                  <div>
                    <span className={p.voidedAt ? "text-slate-400 line-through" : "text-slate-900"}>
                      {formatNPR(p.amount)}
                    </span>{" "}
                    <span className="text-xs text-slate-400">
                      {p.paymentMethod.name} · {formatBSDate(p.paymentDate)}
                    </span>
                  </div>
                  {!p.voidedAt && hasPermission(user, "payment.void") ? (
                    <form action={voidPaymentAction.bind(null, invoice.id, p.id)}>
                      <button type="submit" className="text-xs text-red-600 hover:underline">
                        Void
                      </button>
                    </form>
                  ) : null}
                </li>
              ))}
            </ul>
          )}
        </section>

        {canRecordPayment ? (
          <section className="rounded-lg border border-slate-200 bg-white p-5">
            <h2 className="mb-3 text-sm font-semibold text-slate-700">Record payment</h2>
            <RecordPaymentForm
              action={boundRecordPayment}
              paymentMethods={paymentMethods}
              todayValue={toNepalDateInputValue(new Date())}
            />
          </section>
        ) : null}
      </div>
    </div>
  );
}
