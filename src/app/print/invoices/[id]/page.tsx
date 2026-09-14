import { notFound } from "next/navigation";
import { requirePermission } from "@/lib/auth/current-user";
import { db } from "@/lib/db";
import { formatBSDate } from "@/lib/date";
import { formatNPR } from "@/lib/currency";
import { PrintButton } from "@/components/print-button";

export default async function PrintInvoicePage({ params }: { params: Promise<{ id: string }> }) {
  await requirePermission("billing.view");
  const { id } = await params;

  const [invoice, clinic] = await Promise.all([
    db.invoice.findUnique({
      where: { id },
      include: {
        patient: true,
        items: true,
        payments: { where: { voidedAt: null }, include: { paymentMethod: true }, orderBy: { paymentDate: "asc" } },
      },
    }),
    db.clinicProfile.findFirst(),
  ]);
  if (!invoice) notFound();

  const remaining = Number(invoice.totalAmount) - Number(invoice.paidAmount);

  return (
    <div className="mx-auto max-w-2xl bg-white p-8 text-slate-900 print:p-0">
      <div className="mb-6 flex items-start justify-between">
        <div>
          <h1 className="text-lg font-bold">{clinic?.clinicName ?? "Pathivara Dental Clinic"}</h1>
          {clinic?.address ? <p className="text-sm text-slate-600">{clinic.address}</p> : null}
          <p className="text-sm text-slate-600">
            {[clinic?.phone, clinic?.email].filter(Boolean).join(" · ")}
          </p>
          {clinic?.panNumber ? <p className="text-sm text-slate-600">PAN: {clinic.panNumber}</p> : null}
        </div>
        <PrintButton />
      </div>

      <div className="mb-6 flex items-start justify-between border-y border-slate-200 py-3">
        <div>
          <p className="text-xs uppercase tracking-wide text-slate-500">Billed to</p>
          <p className="font-medium">{invoice.patient.fullName}</p>
          <p className="text-sm text-slate-600">
            {invoice.patient.patientCode} · {invoice.patient.phone}
          </p>
        </div>
        <div className="text-right">
          <p className="text-xs uppercase tracking-wide text-slate-500">Receipt / Invoice</p>
          <p className="font-medium">{invoice.invoiceNumber}</p>
          <p className="text-sm text-slate-600">{formatBSDate(invoice.createdAt)}</p>
        </div>
      </div>

      <table className="mb-4 w-full text-sm">
        <thead>
          <tr className="border-b border-slate-300 text-left text-xs uppercase tracking-wide text-slate-500">
            <th className="py-1">Item</th>
            <th className="py-1 text-right">Qty</th>
            <th className="py-1 text-right">Price</th>
            <th className="py-1 text-right">Discount</th>
            <th className="py-1 text-right">Total</th>
          </tr>
        </thead>
        <tbody>
          {invoice.items.map((item) => (
            <tr key={item.id} className="border-b border-slate-100">
              <td className="py-1.5">{item.description}</td>
              <td className="py-1.5 text-right">{item.quantity}</td>
              <td className="py-1.5 text-right">{formatNPR(item.unitPrice)}</td>
              <td className="py-1.5 text-right">{formatNPR(item.discount)}</td>
              <td className="py-1.5 text-right">{formatNPR(item.lineTotal)}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <div className="ml-auto max-w-xs space-y-1 text-sm">
        <div className="flex justify-between">
          <span className="text-slate-500">Subtotal</span>
          <span>{formatNPR(invoice.subtotal)}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-slate-500">Discount</span>
          <span>{formatNPR(invoice.discountAmount)}</span>
        </div>
        <div className="flex justify-between border-t border-slate-300 pt-1 font-semibold">
          <span>Total</span>
          <span>{formatNPR(invoice.totalAmount)}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-slate-500">Paid</span>
          <span>{formatNPR(invoice.paidAmount)}</span>
        </div>
        <div className="flex justify-between font-semibold">
          <span>Balance due</span>
          <span>{formatNPR(remaining)}</span>
        </div>
      </div>

      {invoice.payments.length > 0 ? (
        <div className="mt-6">
          <p className="mb-1 text-xs uppercase tracking-wide text-slate-500">Payments received</p>
          <table className="w-full text-sm">
            <tbody>
              {invoice.payments.map((p) => (
                <tr key={p.id} className="border-b border-slate-100">
                  <td className="py-1">{formatBSDate(p.paymentDate)}</td>
                  <td className="py-1">{p.paymentMethod.name}</td>
                  <td className="py-1 text-right">{formatNPR(p.amount)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}

      {clinic?.receiptFooterNote ? (
        <p className="mt-8 whitespace-pre-wrap border-t border-slate-200 pt-3 text-xs text-slate-500">
          {clinic.receiptFooterNote}
        </p>
      ) : null}
    </div>
  );
}
