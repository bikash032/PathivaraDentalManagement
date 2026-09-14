/**
 * Money math for invoices, kept as pure functions so it can be unit tested
 * independently of the database and the UI.
 *
 * Amounts are handled in paisa (integer) internally to avoid binary floating
 * point drift (e.g. 0.1 + 0.2), then converted back to a 2-decimal rupee
 * value at the boundary. The database stores Decimal(12,2).
 */

export type LineInput = {
  quantity: number;
  unitPrice: number;
  discount: number;
};

export type InvoiceTotals = {
  lineTotals: number[];
  subtotal: number;
  discountAmount: number;
  totalAmount: number;
};

function toPaisa(rupees: number): number {
  return Math.round(rupees * 100);
}

function toRupees(paisa: number): number {
  return paisa / 100;
}

export function calculateLineTotal(line: LineInput): number {
  const gross = toPaisa(line.unitPrice) * Math.trunc(line.quantity);
  const net = gross - toPaisa(line.discount);
  return toRupees(Math.max(0, net));
}

export function calculateInvoiceTotals(lines: LineInput[], invoiceDiscount: number): InvoiceTotals {
  const lineTotals = lines.map(calculateLineTotal);
  const subtotalPaisa = lineTotals.reduce((sum, amount) => sum + toPaisa(amount), 0);
  const discountPaisa = Math.min(toPaisa(invoiceDiscount), subtotalPaisa);
  const totalPaisa = Math.max(0, subtotalPaisa - discountPaisa);

  return {
    lineTotals,
    subtotal: toRupees(subtotalPaisa),
    discountAmount: toRupees(discountPaisa),
    totalAmount: toRupees(totalPaisa),
  };
}

export type InvoicePaymentStatus = "UNPAID" | "PARTIALLY_PAID" | "PAID";

export function resolveInvoiceStatus(totalAmount: number, paidAmount: number): InvoicePaymentStatus {
  const total = toPaisa(totalAmount);
  const paid = toPaisa(paidAmount);
  if (paid <= 0) return "UNPAID";
  if (paid < total) return "PARTIALLY_PAID";
  return "PAID";
}

export function remainingBalance(totalAmount: number, paidAmount: number): number {
  return toRupees(Math.max(0, toPaisa(totalAmount) - toPaisa(paidAmount)));
}

export function exceedsRemainingBalance(amount: number, totalAmount: number, paidAmount: number): boolean {
  return toPaisa(amount) > toPaisa(totalAmount) - toPaisa(paidAmount);
}
