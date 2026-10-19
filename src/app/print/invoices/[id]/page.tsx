import { notFound } from "next/navigation";
import { requirePermission } from "@/lib/auth/current-user";
import { db } from "@/lib/db";
import { formatBSDate } from "@/lib/date";
import { formatNPR } from "@/lib/currency";
import { getClinicProfile } from "@/lib/clinic-settings";
import {
  ClinicPrintFooter,
  ClinicPrintHeader,
  PrintDocument,
  PrintToolbar,
  isThermal,
  parsePaper,
} from "@/components/print-document";

export default async function PrintInvoicePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ paper?: string | string[] }>;
}) {
  await requirePermission("billing.view");
  const { id } = await params;
  const paper = parsePaper((await searchParams).paper);

  const [invoice, clinic] = await Promise.all([
    db.invoice.findUnique({
      where: { id },
      include: {
        patient: true,
        items: true,
        // What settled this invoice, including credit applied from an earlier advance.
        allocations: {
          where: { reversedAt: null },
          include: { payment: { include: { paymentMethod: true } } },
          orderBy: { createdAt: "asc" },
        },
      },
    }),
    getClinicProfile(),
  ]);
  if (!invoice) notFound();

  const remaining = Number(invoice.totalAmount) - Number(invoice.paidAmount);
  const thermal = isThermal(paper);
  const labelClass = "text-[length:var(--doc-label)] font-semibold uppercase tracking-wide text-ink-secondary";

  return (
    <>
      <PrintToolbar paper={paper} basePath={`/print/invoices/${invoice.id}`} />
      <PrintDocument paper={paper} emphasis>
        <ClinicPrintHeader clinic={clinic} title="Invoice / Payment Receipt" showContact />

        <section
          className={`keep-together mb-4 flex border-b border-line pb-3 ${
            thermal ? "flex-col gap-2" : "items-start justify-between gap-4"
          }`}
        >
          <div className="min-w-0">
            <p className={labelClass}>Billed to</p>
            <p className="font-semibold text-ink">{invoice.patient.fullName}</p>
            <p className="text-ink-secondary">
              {invoice.patient.patientCode} · {invoice.patient.phone}
            </p>
          </div>
          <div className={thermal ? "" : "text-right"}>
            <p className={labelClass}>Invoice no.</p>
            <p className="whitespace-nowrap font-semibold text-ink">{invoice.invoiceNumber}</p>
            <p className="text-ink-secondary">{formatBSDate(invoice.createdAt)}</p>
          </div>
        </section>

        {thermal ? (
          <div className="mb-3 border-b border-field-line">
            {invoice.items.map((item) => (
              <div key={item.id} className="keep-together border-b border-line-soft py-1">
                <p className="font-medium text-ink">{item.description}</p>
                <div className="flex justify-between gap-2 text-ink-secondary">
                  <span>
                    {item.quantity} × {formatNPR(item.unitPrice)}
                    {Number(item.discount) > 0 ? ` − ${formatNPR(item.discount)}` : ""}
                  </span>
                  <span className="font-medium text-ink">{formatNPR(item.lineTotal)}</span>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <table className="mb-4 w-full">
            <thead>
              <tr className={`border-b-2 border-primary text-left ${labelClass}`}>
                <th className="py-1.5">Item</th>
                <th className="py-1.5 text-right">Qty</th>
                <th className="py-1.5 text-right">Price</th>
                <th className="py-1.5 text-right">Less</th>
                <th className="py-1.5 text-right">Total</th>
              </tr>
            </thead>
            <tbody>
              {invoice.items.map((item) => (
                <tr key={item.id} className="border-b border-line">
                  <td className="py-1.5 pr-2">{item.description}</td>
                  <td className="py-1.5 text-right">{item.quantity}</td>
                  <td className="whitespace-nowrap py-1.5 pl-2 text-right">{formatNPR(item.unitPrice)}</td>
                  <td className="whitespace-nowrap py-1.5 pl-2 text-right">{formatNPR(item.discount)}</td>
                  <td className="whitespace-nowrap py-1.5 pl-2 text-right">{formatNPR(item.lineTotal)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        <div className={`keep-together space-y-1 ${thermal ? "" : "ml-auto max-w-xs"}`}>
          <div className="flex justify-between gap-4">
            <span className="text-ink-secondary">Subtotal</span>
            <span>{formatNPR(invoice.subtotal)}</span>
          </div>
          <div className="flex justify-between gap-4">
            <span className="text-ink-secondary">Less</span>
            <span>{formatNPR(invoice.discountAmount)}</span>
          </div>
          <div className="flex justify-between gap-4 border-t border-field-line pt-1 font-semibold">
            <span>Total</span>
            <span>{formatNPR(invoice.totalAmount)}</span>
          </div>
          <div className="flex justify-between gap-4">
            <span className="text-ink-secondary">Paid</span>
            <span>{formatNPR(invoice.paidAmount)}</span>
          </div>
          <div className="flex justify-between gap-4 font-semibold">
            <span>Balance due</span>
            <span>{formatNPR(remaining)}</span>
          </div>
        </div>

        {invoice.allocations.length > 0 ? (
          <div className="keep-together mt-5">
            <p className={`mb-1 ${labelClass}`}>Payments received</p>
            <table className="w-full">
              <tbody>
                {invoice.allocations.map((a) => (
                  <tr key={a.id} className="border-b border-line">
                    <td className="py-1 pr-2">{formatBSDate(a.payment.paymentDate)}</td>
                    <td className="py-1 pr-2">
                      {a.payment.paymentMethod.name}
                      {a.payment.invoiceId !== invoice.id ? " (advance)" : ""}
                    </td>
                    <td className="whitespace-nowrap py-1 text-right">{formatNPR(a.amount)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : null}

        <ClinicPrintFooter note={clinic.receiptFooterNote} />
      </PrintDocument>
    </>
  );
}
