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
          <h1 className="text-xl font-semibold text-ink">{invoice.invoiceNumber}</h1>
          <p className="mt-1 text-sm text-ink-muted">
            <Link href={`/patients/${invoice.patient.id}`} className="underline text-primary hover:text-primary-hover">
              {invoice.patient.fullName}
            </Link>{" "}
            · {formatBSDate(invoice.createdAt)}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Link
            href={`/print/invoices/${invoice.id}`}
            target="_blank"
            className="rounded-md border border-field-line bg-surface px-3 py-1.5 text-xs font-medium text-ink-secondary hover:bg-page hover:border-secondary hover:text-secondary"
          >
            Print receipt
          </Link>
          <span
            className={`rounded-full px-2 py-1 text-xs font-medium ${
              invoice.status === "PAID"
                ? "bg-success-soft text-success-ink"
                : invoice.status === "CANCELLED"
                  ? "bg-line-soft text-ink-muted"
                  : invoice.status === "PARTIALLY_PAID"
                    ? "bg-warning-soft text-warning-ink"
                    : "bg-danger-soft text-danger-ink"
            }`}
          >
            {invoice.status.replace("_", " ")}
          </span>
          {hasPermission(user, "invoice.cancel") && invoice.status !== "CANCELLED" && Number(invoice.paidAmount) === 0 ? (
            <form action={cancelInvoiceAction.bind(null, invoice.id)}>
              <button
                type="submit"
                className="rounded-md border border-danger-line bg-surface px-3 py-1.5 text-xs font-medium text-danger hover:bg-danger-soft"
              >
                Cancel invoice
              </button>
            </form>
          ) : null}
        </div>
      </div>

      <div className="overflow-x-auto rounded-lg border border-line bg-surface">
        <table className="min-w-full divide-y divide-line-soft text-sm">
          <thead className="bg-page">
            <tr>
              <th className="px-4 py-2 text-left font-medium text-ink-muted">Item</th>
              <th className="px-4 py-2 text-right font-medium text-ink-muted">Qty</th>
              <th className="px-4 py-2 text-right font-medium text-ink-muted">Unit price</th>
              <th className="px-4 py-2 text-right font-medium text-ink-muted">Discount</th>
              <th className="px-4 py-2 text-right font-medium text-ink-muted">Total</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line-soft">
            {invoice.items.map((item) => (
              <tr key={item.id}>
                <td className="px-4 py-2 text-ink">{item.description}</td>
                <td className="px-4 py-2 text-right text-ink-secondary">{item.quantity}</td>
                <td className="px-4 py-2 text-right text-ink-secondary">{formatNPR(item.unitPrice)}</td>
                <td className="px-4 py-2 text-right text-ink-secondary">{formatNPR(item.discount)}</td>
                <td className="px-4 py-2 text-right text-ink">{formatNPR(item.lineTotal)}</td>
              </tr>
            ))}
          </tbody>
          <tfoot className="border-t border-line text-sm">
            <tr>
              <td colSpan={4} className="px-4 py-2 text-right text-ink-muted">
                Subtotal
              </td>
              <td className="px-4 py-2 text-right text-ink">{formatNPR(invoice.subtotal)}</td>
            </tr>
            <tr>
              <td colSpan={4} className="px-4 py-2 text-right text-ink-muted">
                Discount
              </td>
              <td className="px-4 py-2 text-right text-ink">{formatNPR(invoice.discountAmount)}</td>
            </tr>
            <tr>
              <td colSpan={4} className="px-4 py-2 text-right font-medium text-ink-secondary">
                Total
              </td>
              <td className="px-4 py-2 text-right font-semibold text-ink">{formatNPR(invoice.totalAmount)}</td>
            </tr>
            <tr>
              <td colSpan={4} className="px-4 py-2 text-right text-ink-muted">
                Paid
              </td>
              <td className="px-4 py-2 text-right text-ink">{formatNPR(invoice.paidAmount)}</td>
            </tr>
            <tr>
              <td colSpan={4} className="px-4 py-2 text-right font-medium text-ink-secondary">
                Remaining
              </td>
              <td className="px-4 py-2 text-right font-semibold text-ink">{formatNPR(remaining)}</td>
            </tr>
          </tfoot>
        </table>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <section className="rounded-lg border border-line bg-surface p-5">
          <h2 className="mb-3 text-sm font-semibold text-ink-secondary">Payments</h2>
          {invoice.payments.length === 0 ? (
            <p className="text-sm text-ink-muted">No payments recorded yet.</p>
          ) : (
            <ul className="divide-y divide-line-soft">
              {invoice.payments.map((p) => (
                <li key={p.id} className="flex items-center justify-between py-2 text-sm">
                  <div>
                    <span className={p.voidedAt ? "text-ink-muted line-through" : "text-ink"}>
                      {formatNPR(p.amount)}
                    </span>{" "}
                    <span className="text-xs text-ink-muted">
                      {p.paymentMethod.name} · {formatBSDate(p.paymentDate)}
                    </span>
                  </div>
                  {!p.voidedAt && hasPermission(user, "payment.void") ? (
                    <form action={voidPaymentAction.bind(null, invoice.id, p.id)}>
                      <button type="submit" className="text-xs text-danger hover:underline">
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
          <section className="rounded-lg border border-line bg-surface p-5">
            <h2 className="mb-3 text-sm font-semibold text-ink-secondary">Record payment</h2>
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
