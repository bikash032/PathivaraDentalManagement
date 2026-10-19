import Link from "next/link";
import { notFound } from "next/navigation";
import { requirePermission, hasPermission } from "@/lib/auth/current-user";
import { db } from "@/lib/db";
import { formatBSDate, formatBSDateTime, toNepalDateInputValue } from "@/lib/date";
import { formatNPR } from "@/lib/currency";
import { remainingBalance, sumMoney } from "@/lib/money";
import { getClinicTimezone } from "@/lib/clinic-settings";
import type { TreatmentStatus } from "@/generated/prisma/client";
import { RecordPaymentForm } from "../record-payment-form";
import { ApplyCreditForm, ItemTreatmentForm } from "../ledger-forms";
import { getActiveDoctors, getPatientLedger } from "../ledger";
import {
  applyCreditAction,
  cancelInvoiceAction,
  recordPaymentAction,
  unapplyAllocationAction,
  updateItemTreatmentAction,
  voidPaymentAction,
} from "../actions";

const TREATMENT_LABELS: Record<TreatmentStatus, string> = {
  PLANNED: "Planned",
  IN_PROGRESS: "In progress",
  COMPLETED: "Completed",
  CANCELLED: "Cancelled",
};
const TREATMENT_COLORS: Record<TreatmentStatus, string> = {
  PLANNED: "bg-line-soft text-ink-secondary",
  IN_PROGRESS: "bg-warning-soft text-warning-ink",
  COMPLETED: "bg-success-soft text-success-ink",
  CANCELLED: "bg-danger-soft text-danger-ink",
};

export default async function InvoiceDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requirePermission("billing.view");
  const { id } = await params;

  const invoice = await db.invoice.findUnique({
    where: { id },
    include: {
      patient: true,
      items: {
        orderBy: { id: "asc" },
        include: {
          doctor: { select: { id: true, name: true } },
          appointment: { select: { id: true, scheduledAt: true } },
        },
      },
      payments: { include: { paymentMethod: true }, orderBy: { paymentDate: "desc" } },
      allocations: {
        orderBy: { createdAt: "asc" },
        include: {
          payment: { include: { paymentMethod: true } },
          createdBy: { select: { name: true } },
          reversedBy: { select: { name: true } },
        },
      },
    },
  });
  if (!invoice) notFound();

  const canEditTreatment = hasPermission(user, "invoice.update") && invoice.status !== "CANCELLED";
  const [paymentMethods, ledger, timezone, doctors, appointments] = await Promise.all([
    db.paymentMethod.findMany({ where: { isActive: true }, orderBy: { name: "asc" } }),
    getPatientLedger(invoice.patientId),
    getClinicTimezone(),
    canEditTreatment ? getActiveDoctors() : Promise.resolve([]),
    canEditTreatment
      ? db.appointment.findMany({
          where: { patientId: invoice.patientId },
          orderBy: { scheduledAt: "desc" },
          take: 30,
          include: { doctor: { select: { name: true } } },
        })
      : Promise.resolve([]),
  ]);

  const remaining = remainingBalance(Number(invoice.totalAmount), Number(invoice.paidAmount));
  const isOpen = invoice.status !== "CANCELLED" && invoice.status !== "PAID";
  const canRecordPayment = hasPermission(user, "payment.record") && isOpen;
  const credit = ledger.totals.credit;
  const canApplyCredit = canRecordPayment && credit > 0 && remaining > 0;
  const canVoid = hasPermission(user, "payment.void");
  const todayValue = toNepalDateInputValue(new Date());

  // Doctor-wise treatment value on this invoice (line totals; not cash, not payout).
  const byDoctor = new Map<string, { name: string; completed: number; pending: number }>();
  for (const item of invoice.items) {
    if (item.treatmentStatus === "CANCELLED") continue;
    const key = item.doctor?.id ?? "";
    const row = byDoctor.get(key) ?? { name: item.doctor?.name ?? "Doctor not set", completed: 0, pending: 0 };
    if (item.treatmentStatus === "COMPLETED") row.completed = sumMoney([row.completed, Number(item.lineTotal)]);
    else row.pending = sumMoney([row.pending, Number(item.lineTotal)]);
    byDoctor.set(key, row);
  }

  // Doctors who have left still show on items they performed.
  const doctorOptions = [...doctors];
  for (const item of invoice.items) {
    if (item.doctor && !doctorOptions.some((d) => d.id === item.doctor!.id)) doctorOptions.push(item.doctor);
  }
  const appointmentOptions = appointments.map((a) => ({
    id: a.id,
    label: `${formatBSDateTime(a.scheduledAt, timezone)} · ${a.doctor.name}`,
  }));

  return (
    <div className="max-w-5xl space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-ink">{invoice.invoiceNumber}</h1>
          <p className="mt-1 text-sm text-ink-muted">
            <Link href={`/patients/${invoice.patient.id}`} className="underline text-primary hover:text-primary-hover">
              {invoice.patient.fullName}
            </Link>{" "}
            · {formatBSDate(invoice.createdAt)} ·{" "}
            <Link
              href={`/billing/patients/${invoice.patient.id}`}
              className="underline text-primary hover:text-primary-hover"
            >
              Patient account
            </Link>
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
              <th className="px-4 py-2 text-left font-medium text-ink-muted">Doctor / appointment</th>
              <th className="px-4 py-2 text-left font-medium text-ink-muted">Treatment</th>
              <th className="px-4 py-2 text-right font-medium text-ink-muted">Qty</th>
              <th className="px-4 py-2 text-right font-medium text-ink-muted">Unit price</th>
              <th className="px-4 py-2 text-right font-medium text-ink-muted">Less</th>
              <th className="px-4 py-2 text-right font-medium text-ink-muted">Total</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line-soft">
            {invoice.items.map((item) => (
              <tr key={item.id} className="align-top">
                <td className="px-4 py-2 text-ink">
                  {item.description}
                  {item.tooth ? <span className="ml-1 text-xs text-ink-muted">· Tooth {item.tooth}</span> : null}
                  {canEditTreatment ? (
                    <details className="mt-2">
                      <summary className="cursor-pointer text-xs text-primary hover:underline">Edit treatment</summary>
                      <div className="mt-2 w-[min(32rem,80vw)] rounded-md border border-line bg-page p-3">
                        <ItemTreatmentForm
                          action={updateItemTreatmentAction.bind(null, item.id)}
                          itemId={item.id}
                          doctors={doctorOptions}
                          appointments={appointmentOptions}
                          todayValue={todayValue}
                          initial={{
                            doctorId: item.doctorId ?? "",
                            appointmentId: item.appointmentId ?? "",
                            treatmentStatus: item.treatmentStatus,
                            completedDate: item.completedAt ? toNepalDateInputValue(item.completedAt) : "",
                            tooth: item.tooth ?? "",
                          }}
                        />
                      </div>
                    </details>
                  ) : null}
                </td>
                <td className="px-4 py-2 text-ink-secondary">
                  {item.doctor?.name ?? <span className="text-ink-muted">Not set</span>}
                  {item.appointment ? (
                    <div className="text-xs text-ink-muted">
                      <Link href={`/appointments/${item.appointment.id}`} className="hover:underline">
                        {formatBSDateTime(item.appointment.scheduledAt, timezone)}
                      </Link>
                    </div>
                  ) : null}
                </td>
                <td className="px-4 py-2">
                  <span className={`rounded px-1.5 py-0.5 text-xs font-medium ${TREATMENT_COLORS[item.treatmentStatus]}`}>
                    {TREATMENT_LABELS[item.treatmentStatus]}
                  </span>
                  {item.completedAt ? (
                    <div className="mt-0.5 text-xs text-ink-muted">{formatBSDate(item.completedAt)}</div>
                  ) : null}
                </td>
                <td className="px-4 py-2 text-right text-ink-secondary">{item.quantity}</td>
                <td className="px-4 py-2 text-right text-ink-secondary">{formatNPR(item.unitPrice)}</td>
                <td className="px-4 py-2 text-right text-ink-secondary">{formatNPR(item.discount)}</td>
                <td className="px-4 py-2 text-right text-ink">{formatNPR(item.lineTotal)}</td>
              </tr>
            ))}
          </tbody>
          <tfoot className="border-t border-line text-sm">
            {[
              ["Subtotal", invoice.subtotal, false],
              ["Less", invoice.discountAmount, false],
              ["Total", invoice.totalAmount, true],
              ["Paid", invoice.paidAmount, false],
              ["Remaining", remaining, true],
            ].map(([label, value, strong]) => (
              <tr key={String(label)}>
                <td colSpan={6} className={`px-4 py-2 text-right ${strong ? "font-medium text-ink-secondary" : "text-ink-muted"}`}>
                  {String(label)}
                </td>
                <td className={`px-4 py-2 text-right text-ink ${strong ? "font-semibold" : ""}`}>
                  {formatNPR(value as number)}
                </td>
              </tr>
            ))}
          </tfoot>
        </table>
      </div>

      {byDoctor.size > 0 ? (
        <section className="rounded-lg border border-line bg-surface p-5">
          <h2 className="text-sm font-semibold text-ink-secondary">Treatment value by doctor</h2>
          <p className="mb-3 text-xs text-ink-muted">
            Item line totals by treating doctor. This is treatment value, not cash collected and not a payout.
          </p>
          <table className="min-w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-ink-muted">
                <th className="py-1 pr-4">Doctor</th>
                <th className="py-1 pr-4 text-right">Completed</th>
                <th className="py-1 text-right">Not yet completed</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line-soft">
              {[...byDoctor.values()].map((d) => (
                <tr key={d.name}>
                  <td className="py-1.5 pr-4 text-ink">{d.name}</td>
                  <td className="py-1.5 pr-4 text-right text-ink">{formatNPR(d.completed)}</td>
                  <td className="py-1.5 text-right text-ink-secondary">{formatNPR(d.pending)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      ) : null}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <section className="rounded-lg border border-line bg-surface p-5">
          <h2 className="mb-1 text-sm font-semibold text-ink-secondary">Payments applied</h2>
          <p className="mb-3 text-xs text-ink-muted">Money settling this invoice, and the receipt it came from.</p>
          {invoice.allocations.length === 0 ? (
            <p className="text-sm text-ink-muted">No payments applied yet.</p>
          ) : (
            <ul className="divide-y divide-line-soft">
              {invoice.allocations.map((a) => {
                const fromAdvance = a.payment.invoiceId !== invoice.id;
                return (
                  <li key={a.id} className="flex items-center justify-between gap-3 py-2 text-sm">
                    <div>
                      <span className={a.reversedAt ? "text-ink-muted line-through" : "text-ink"}>
                        {formatNPR(a.amount)}
                      </span>{" "}
                      <span className="text-xs text-ink-muted">
                        {a.payment.paymentMethod.name} received {formatBSDate(a.payment.paymentDate)}
                        {fromAdvance ? " · from advance/credit" : ""} · applied by {a.createdBy.name}
                      </span>
                      {a.reversedAt ? (
                        <div className="text-xs text-ink-muted">
                          Unapplied {formatBSDate(a.reversedAt)}
                          {a.reversedBy ? ` by ${a.reversedBy.name}` : ""} ({a.reverseReason})
                        </div>
                      ) : null}
                    </div>
                    {!a.reversedAt && canVoid ? (
                      <form action={unapplyAllocationAction.bind(null, a.id)}>
                        <button type="submit" className="text-xs text-danger hover:underline">
                          Unapply
                        </button>
                      </form>
                    ) : null}
                  </li>
                );
              })}
            </ul>
          )}

          {invoice.payments.length > 0 ? (
            <>
              <h3 className="mb-1 mt-5 text-xs font-semibold uppercase tracking-wide text-ink-muted">
                Cash received at this invoice
              </h3>
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
                    {!p.voidedAt && canVoid ? (
                      <form action={voidPaymentAction.bind(null, p.id)}>
                        <button type="submit" className="text-xs text-danger hover:underline">
                          Void
                        </button>
                      </form>
                    ) : null}
                  </li>
                ))}
              </ul>
            </>
          ) : null}
        </section>

        <div className="space-y-6">
          {canApplyCredit ? (
            <section className="rounded-lg border border-success-line bg-success-soft p-5">
              <h2 className="mb-1 text-sm font-semibold text-success-ink">Apply patient credit</h2>
              <p className="mb-3 text-xs text-success-ink">
                {formatNPR(credit)} available from advances. Applying it settles this invoice without counting as new
                collection.
              </p>
              <ApplyCreditForm
                action={applyCreditAction.bind(null, invoice.id)}
                defaultAmount={Math.min(credit, remaining).toFixed(2)}
              />
            </section>
          ) : null}

          {canRecordPayment ? (
            <section className="rounded-lg border border-line bg-surface p-5">
              <h2 className="mb-3 text-sm font-semibold text-ink-secondary">Record payment</h2>
              <RecordPaymentForm
                action={recordPaymentAction.bind(null, invoice.id)}
                paymentMethods={paymentMethods}
                todayValue={todayValue}
              />
            </section>
          ) : null}
        </div>
      </div>
    </div>
  );
}
