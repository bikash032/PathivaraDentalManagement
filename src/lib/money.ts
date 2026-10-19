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

// ---------------------------------------------------------------------------
// Cash vs. allocation
//
// A receipt is cash received. It is applied to invoices through allocations
// and may be partly refunded; whatever is left is the patient's unallocated
// credit. Applying credit moves money between buckets — it is never a new
// collection.
// ---------------------------------------------------------------------------

/** Adds rupee amounts exactly (via paisa). */
export function sumMoney(amounts: number[]): number {
  return toRupees(amounts.reduce((sum, amount) => sum + toPaisa(amount), 0));
}

/**
 * What is left of a receipt to apply or refund. `refunded` is the positive
 * amount returned to the patient against this receipt.
 */
export function receiptAvailable(amount: number, allocated: number, refunded: number): number {
  return toRupees(toPaisa(amount) - toPaisa(allocated) - toPaisa(refunded));
}

export type CreditSource = { id: string; available: number };
export type CreditDraw = { id: string; amount: number };

/**
 * Draws `amount` from receipts in the order given (oldest first), returning
 * one draw per receipt touched. Throws if the sources cannot cover it.
 */
export function drawFromCredit(sources: CreditSource[], amount: number): CreditDraw[] {
  let remaining = toPaisa(amount);
  if (remaining <= 0) throw new Error("Amount must be greater than zero.");

  const draws: CreditDraw[] = [];
  for (const source of sources) {
    if (remaining === 0) break;
    const available = toPaisa(source.available);
    if (available <= 0) continue;
    const take = Math.min(available, remaining);
    draws.push({ id: source.id, amount: toRupees(take) });
    remaining -= take;
  }
  if (remaining > 0) throw new Error("Not enough unallocated credit.");
  return draws;
}

/** True when `amount` is more than `limit` (both in rupees), compared exactly. */
export function exceedsAmount(amount: number, limit: number): boolean {
  return toPaisa(amount) > toPaisa(limit);
}

// ---------------------------------------------------------------------------
// Item-level figures for reporting
//
// Payments are applied to invoices, not to individual items, and the overall
// invoice "Less" is not itemised. To show per-item figures without inventing
// data, both are shared across an invoice's items in proportion to their value.
// Largest-remainder rounding keeps every share in whole paisa while the shares
// add up exactly to the invoice figure.
// ---------------------------------------------------------------------------

/** Splits `total` across `weights` proportionally; the parts sum exactly to `total`. */
export function apportion(total: number, weights: number[]): number[] {
  const totalPaisa = toPaisa(total);
  if (weights.length === 0) return [];
  const weightPaisa = weights.map((w) => Math.max(0, toPaisa(w)));
  const weightSum = weightPaisa.reduce((a, b) => a + b, 0);
  // With no value to weigh by, share equally.
  const basis = weightSum > 0 ? weightPaisa : weights.map(() => 1);
  const basisSum = weightSum > 0 ? weightSum : weights.length;

  const exact = basis.map((w) => (totalPaisa * w) / basisSum);
  const floors = exact.map((x) => Math.floor(x));
  let leftover = totalPaisa - floors.reduce((a, b) => a + b, 0);
  const order = exact
    .map((x, i) => ({ i, frac: x - Math.floor(x) }))
    .sort((a, b) => b.frac - a.frac || a.i - b.i);
  for (const { i } of order) {
    if (leftover <= 0) break;
    floors[i] += 1;
    leftover -= 1;
  }
  return floors.map(toRupees);
}

export type ItemFinancials = { net: number; allocated: number; outstanding: number };

/**
 * Per-item net value (line total less its share of the invoice-level Less),
 * the share of the invoice's applied payments, and what remains outstanding.
 * Over an invoice's items these add up exactly to the invoice's total, paid
 * and remaining amounts.
 */
export function invoiceItemFinancials(
  lineTotals: number[],
  invoiceDiscount: number,
  invoicePaid: number
): ItemFinancials[] {
  const discountShares = apportion(invoiceDiscount, lineTotals);
  const nets = lineTotals.map((line, i) => toRupees(Math.max(0, toPaisa(line) - toPaisa(discountShares[i]))));
  const netTotal = nets.reduce((a, n) => a + toPaisa(n), 0);
  const paid = Math.min(toPaisa(invoicePaid), netTotal);
  const allocated = apportion(toRupees(paid), nets);
  return nets.map((net, i) => ({
    net,
    allocated: allocated[i],
    outstanding: toRupees(toPaisa(net) - toPaisa(allocated[i])),
  }));
}
