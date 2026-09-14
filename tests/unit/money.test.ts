import { describe, it, expect } from "vitest";
import {
  calculateLineTotal,
  calculateInvoiceTotals,
  resolveInvoiceStatus,
  remainingBalance,
  exceedsRemainingBalance,
} from "@/lib/money";

describe("calculateLineTotal", () => {
  it("multiplies quantity by unit price", () => {
    expect(calculateLineTotal({ quantity: 3, unitPrice: 1500, discount: 0 })).toBe(4500);
  });

  it("subtracts the line discount", () => {
    expect(calculateLineTotal({ quantity: 2, unitPrice: 1000, discount: 250 })).toBe(1750);
  });

  it("never returns a negative line total when the discount exceeds the line", () => {
    expect(calculateLineTotal({ quantity: 1, unitPrice: 500, discount: 900 })).toBe(0);
  });

  it("handles paisa precision without floating point drift", () => {
    // 0.1 + 0.2 style drift would produce 3.0000000000000004 with naive math
    expect(calculateLineTotal({ quantity: 3, unitPrice: 0.1, discount: 0 })).toBe(0.3);
    expect(calculateLineTotal({ quantity: 1, unitPrice: 1234.56, discount: 0.07 })).toBe(1234.49);
  });
});

describe("calculateInvoiceTotals", () => {
  it("sums line totals into the subtotal and applies the invoice discount", () => {
    const totals = calculateInvoiceTotals(
      [
        { quantity: 1, unitPrice: 500, discount: 0 },
        { quantity: 2, unitPrice: 1500, discount: 100 },
      ],
      400
    );

    expect(totals.lineTotals).toEqual([500, 2900]);
    expect(totals.subtotal).toBe(3400);
    expect(totals.discountAmount).toBe(400);
    expect(totals.totalAmount).toBe(3000);
  });

  it("caps the invoice discount at the subtotal so the total never goes negative", () => {
    const totals = calculateInvoiceTotals([{ quantity: 1, unitPrice: 1000, discount: 0 }], 5000);
    expect(totals.discountAmount).toBe(1000);
    expect(totals.totalAmount).toBe(0);
  });

  it("returns zeroes for an empty invoice", () => {
    const totals = calculateInvoiceTotals([], 0);
    expect(totals.subtotal).toBe(0);
    expect(totals.totalAmount).toBe(0);
  });

  it("accumulates many small amounts exactly", () => {
    const lines = Array.from({ length: 10 }, () => ({ quantity: 1, unitPrice: 0.1, discount: 0 }));
    expect(calculateInvoiceTotals(lines, 0).subtotal).toBe(1);
  });
});

describe("resolveInvoiceStatus", () => {
  it("is UNPAID when nothing has been paid", () => {
    expect(resolveInvoiceStatus(1000, 0)).toBe("UNPAID");
  });

  it("is PARTIALLY_PAID when some but not all has been paid", () => {
    expect(resolveInvoiceStatus(1000, 400)).toBe("PARTIALLY_PAID");
  });

  it("is PAID when the full amount has been paid", () => {
    expect(resolveInvoiceStatus(1000, 1000)).toBe("PAID");
  });

  it("is PAID when payment meets the total to the paisa", () => {
    expect(resolveInvoiceStatus(1234.56, 1234.56)).toBe("PAID");
  });

  it("treats a zero-total invoice with no payment as PAID only once paid", () => {
    expect(resolveInvoiceStatus(0, 0)).toBe("UNPAID");
  });
});

describe("remainingBalance", () => {
  it("returns the outstanding amount", () => {
    expect(remainingBalance(1000, 400)).toBe(600);
  });

  it("never returns a negative balance", () => {
    expect(remainingBalance(1000, 1200)).toBe(0);
  });
});

describe("exceedsRemainingBalance", () => {
  it("rejects a payment larger than the outstanding balance", () => {
    expect(exceedsRemainingBalance(700, 1000, 400)).toBe(true);
  });

  it("accepts a payment that exactly settles the balance", () => {
    expect(exceedsRemainingBalance(600, 1000, 400)).toBe(false);
  });

  it("accepts an exact paisa-level settlement without floating point false positives", () => {
    expect(exceedsRemainingBalance(0.1, 0.3, 0.2)).toBe(false);
  });
});
