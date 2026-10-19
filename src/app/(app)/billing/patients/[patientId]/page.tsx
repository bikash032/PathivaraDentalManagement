import Link from "next/link";
import { notFound } from "next/navigation";
import { requirePermission, hasPermission } from "@/lib/auth/current-user";
import { db } from "@/lib/db";
import { formatBSDate, toNepalDateInputValue } from "@/lib/date";
import { formatNPR } from "@/lib/currency";
import { remainingBalance, sumMoney } from "@/lib/money";
import { StatCard } from "@/components/stat-card";
import { RefundForm } from "../../ledger-forms";
import { getPatientLedger } from "../../ledger";
import { refundAction, voidPaymentAction } from "../../actions";

/**
 * One patient's money: cash received (including advances), where it was
 * applied, refunds, unallocated credit and what is still owed.
 */
export default async function PatientAccountPage({ params }: { params: Promise<{ patientId: string }> }) {
  const user = await requirePermission("billing.view");
  const { patientId } = await params;

  const patient = await db.patient.findUnique({ where: { id: patientId } });
  if (!patient) notFound();

  const [ledger, openInvoices, paymentMethods] = await Promise.all([
    getPatientLedger(patientId),
    db.invoice.findMany({
      where: { patientId, status: { in: ["UNPAID", "PARTIALLY_PAID"] } },
      orderBy: { createdAt: "asc" },
    }),
    db.paymentMethod.findMany({ where: { isActive: true }, orderBy: { name: "asc" } }),
  ]);

  const outstanding = sumMoney(
    openInvoices.map((inv) => remainingBalance(Number(inv.totalAmount), Number(inv.paidAmount)))
  );
  const canVoid = hasPermission(user, "payment.void");
  const refundable = ledger.receipts.filter((r) => r.available > 0);

  return (
    <div className="max-w-5xl space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-ink">Patient account</h1>
          <p className="mt-1 text-sm text-ink-muted">
            <Link href={`/patients/${patient.id}`} className="underline text-primary hover:text-primary-hover">
              {patient.fullName}
            </Link>{" "}
            · {patient.patientCode} · {patient.phone}
          </p>
        </div>
        <div className="flex gap-2">
          {hasPermission(user, "payment.record") ? (
            <Link
              href={`/billing/advance/new?patientId=${patient.id}`}
              className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary-hover"
            >
              Record advance
            </Link>
          ) : null}
          {hasPermission(user, "invoice.create") ? (
            <Link
              href={`/billing/new?patientId=${patient.id}`}
              className="rounded-md border border-field-line bg-surface px-4 py-2 text-sm font-medium text-ink-secondary hover:bg-page hover:border-secondary hover:text-secondary"
            >
              New invoice
            </Link>
          ) : null}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-5">
        <StatCard label="Cash received" value={formatNPR(ledger.totals.received)} />
        <StatCard label="Applied to invoices" value={formatNPR(ledger.totals.applied)} />
        <StatCard label="Refunded" value={formatNPR(ledger.totals.refunded)} />
        <StatCard label="Available credit" value={formatNPR(ledger.totals.credit)} />
        <StatCard label="Outstanding" value={formatNPR(outstanding)} />
      </div>

      <section className="rounded-lg border border-line bg-surface p-5">
        <h2 className="mb-3 text-sm font-semibold text-ink-secondary">Open invoices</h2>
        {openInvoices.length === 0 ? (
          <p className="text-sm text-ink-muted">Nothing outstanding.</p>
        ) : (
          <ul className="divide-y divide-line-soft">
            {openInvoices.map((inv) => (
              <li key={inv.id} className="flex items-center justify-between py-2 text-sm">
                <Link href={`/billing/${inv.id}`} className="font-medium text-ink hover:underline hover:text-primary">
                  {inv.invoiceNumber}
                </Link>
                <span className="text-ink-secondary">
                  {formatNPR(remainingBalance(Number(inv.totalAmount), Number(inv.paidAmount)))} due of{" "}
                  {formatNPR(inv.totalAmount)}
                </span>
              </li>
            ))}
          </ul>
        )}
        {ledger.totals.credit > 0 && openInvoices.length > 0 ? (
          <p className="mt-3 text-xs text-ink-muted">Open an invoice to apply the available credit to it.</p>
        ) : null}
      </section>

      <section className="overflow-x-auto rounded-lg border border-line bg-surface">
        <h2 className="px-5 pt-5 text-sm font-semibold text-ink-secondary">Receipts and refunds</h2>
        <p className="px-5 pb-3 text-xs text-ink-muted">
          Every row is real cash in or out on its date. Applying credit to an invoice never creates a row here.
        </p>
        {ledger.receipts.length === 0 && ledger.refunds.length === 0 ? (
          <p className="px-5 pb-5 text-sm text-ink-muted">No payments yet.</p>
        ) : (
          <table className="min-w-full divide-y divide-line-soft text-sm">
            <thead className="bg-page">
              <tr className="text-left text-xs text-ink-muted">
                <th className="px-4 py-2">Date</th>
                <th className="px-4 py-2">Type</th>
                <th className="px-4 py-2">Method</th>
                <th className="px-4 py-2 text-right">Amount</th>
                <th className="px-4 py-2">Applied to</th>
                <th className="px-4 py-2 text-right">Available</th>
                <th className="px-4 py-2" />
              </tr>
            </thead>
            <tbody className="divide-y divide-line-soft">
              {ledger.receipts.map((r) => (
                <tr key={r.id} className={`align-top ${r.voidedAt ? "text-ink-muted line-through" : ""}`}>
                  <td className="px-4 py-2">{formatBSDate(r.paymentDate)}</td>
                  <td className="px-4 py-2">
                    {r.invoice ? `Payment at ${r.invoice.invoiceNumber}` : "Advance"}
                    {r.voidedAt ? " (voided)" : ""}
                  </td>
                  <td className="px-4 py-2">{r.paymentMethod.name}</td>
                  <td className="px-4 py-2 text-right">{formatNPR(r.amount)}</td>
                  <td className="px-4 py-2 text-xs">
                    {r.allocations.length === 0 ? (
                      <span className="text-ink-muted">—</span>
                    ) : (
                      r.allocations.map((a) => (
                        <div key={a.id} className={a.reversedAt ? "text-ink-muted line-through" : ""}>
                          <Link href={`/billing/${a.invoice.id}`} className="hover:underline">
                            {a.invoice.invoiceNumber}
                          </Link>{" "}
                          {formatNPR(a.amount)}
                        </div>
                      ))
                    )}
                    {r.refunded > 0 ? <div>Refunded {formatNPR(r.refunded)}</div> : null}
                  </td>
                  <td className="px-4 py-2 text-right font-medium">{formatNPR(r.available)}</td>
                  <td className="px-4 py-2 text-right">
                    {!r.voidedAt && canVoid && r.refunded === 0 ? (
                      <form action={voidPaymentAction.bind(null, r.id)}>
                        <button type="submit" className="text-xs text-danger hover:underline">
                          Void
                        </button>
                      </form>
                    ) : null}
                  </td>
                </tr>
              ))}
              {ledger.refunds.map((r) => (
                <tr key={r.id} className={r.voidedAt ? "text-ink-muted line-through" : ""}>
                  <td className="px-4 py-2">{formatBSDate(r.paymentDate)}</td>
                  <td className="px-4 py-2">
                    Refund{r.voidedAt ? " (voided)" : ""}
                    {r.notes ? <div className="text-xs text-ink-muted">{r.notes}</div> : null}
                  </td>
                  <td className="px-4 py-2">{r.paymentMethod.name}</td>
                  <td className="px-4 py-2 text-right text-danger-ink">{formatNPR(r.amount)}</td>
                  <td className="px-4 py-2 text-xs text-ink-muted">By {r.receivedBy.name}</td>
                  <td className="px-4 py-2" />
                  <td className="px-4 py-2 text-right">
                    {!r.voidedAt && canVoid ? (
                      <form action={voidPaymentAction.bind(null, r.id)}>
                        <button type="submit" className="text-xs text-danger hover:underline">
                          Void
                        </button>
                      </form>
                    ) : null}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      {canVoid && refundable.length > 0 ? (
        <section className="max-w-xl rounded-lg border border-line bg-surface p-5">
          <h2 className="mb-1 text-sm font-semibold text-ink-secondary">Refund unapplied credit</h2>
          <p className="mb-3 text-xs text-ink-muted">
            Only money not applied to an invoice can be refunded. Unapply it from the invoice first if needed.
          </p>
          <RefundForm
            action={refundAction.bind(null, patient.id)}
            paymentMethods={paymentMethods}
            todayValue={toNepalDateInputValue(new Date())}
            receipts={refundable.map((r) => ({
              id: r.id,
              label: `${formatBSDate(r.paymentDate)} · ${r.paymentMethod.name} · ${formatNPR(r.available)} available`,
            }))}
          />
        </section>
      ) : null}
    </div>
  );
}
