import { describe, expect, it } from "vitest";
import { drawFromCredit, exceedsAmount, receiptAvailable, sumMoney } from "@/lib/money";

describe("receiptAvailable", () => {
  it("is what is left after applications and refunds", () => {
    expect(receiptAvailable(15000, 5000, 0)).toBe(10000);
    expect(receiptAvailable(15000, 5000, 2500)).toBe(7500);
    expect(receiptAvailable(15000, 15000, 0)).toBe(0);
  });

  it("is exact with paisa", () => {
    expect(receiptAvailable(0.3, 0.1, 0.2)).toBe(0);
    expect(receiptAvailable(1000.1, 0.05, 0.05)).toBe(1000);
  });
});

describe("drawFromCredit", () => {
  it("draws from the oldest receipt first and spans receipts", () => {
    const sources = [
      { id: "old", available: 3000 },
      { id: "new", available: 5000 },
    ];
    expect(drawFromCredit(sources, 2000)).toEqual([{ id: "old", amount: 2000 }]);
    expect(drawFromCredit(sources, 4500)).toEqual([
      { id: "old", amount: 3000 },
      { id: "new", amount: 1500 },
    ]);
  });

  it("skips fully used receipts", () => {
    expect(
      drawFromCredit(
        [
          { id: "used", available: 0 },
          { id: "open", available: 100 },
        ],
        100
      )
    ).toEqual([{ id: "open", amount: 100 }]);
  });

  it("refuses to draw more than the available credit", () => {
    expect(() => drawFromCredit([{ id: "a", available: 100 }], 100.01)).toThrow(/Not enough/);
    expect(() => drawFromCredit([], 1)).toThrow(/Not enough/);
  });

  it("refuses zero or negative amounts", () => {
    expect(() => drawFromCredit([{ id: "a", available: 100 }], 0)).toThrow();
    expect(() => drawFromCredit([{ id: "a", available: 100 }], -5)).toThrow();
  });

  it("never draws fractions of a paisa", () => {
    const draws = drawFromCredit(
      [
        { id: "a", available: 0.1 },
        { id: "b", available: 0.2 },
      ],
      0.3
    );
    expect(sumMoney(draws.map((d) => d.amount))).toBe(0.3);
  });
});

describe("exceedsAmount", () => {
  it("compares exactly in paisa", () => {
    expect(exceedsAmount(0.1 + 0.2, 0.3)).toBe(false);
    expect(exceedsAmount(100.01, 100)).toBe(true);
  });
});

/**
 * The clinic's example: NPR 15,000 advance today; later an RCT (Dr. A, 5,000)
 * and a crown (Dr. B, 10,000) are performed and billed. Collection is the cash
 * that came in (15,000, once); attribution is per treatment; applying the
 * advance moves money between buckets and adds no collection.
 */
describe("advance, attribution and collection stay separate", () => {
  it("counts the advance once and attributes treatments per doctor", () => {
    const cashMovements = [{ kind: "RECEIPT", amount: 15000 }]; // the only Payment row
    const items = [
      { doctor: "Dr. A", description: "RCT", lineTotal: 5000, status: "COMPLETED" },
      { doctor: "Dr. B", description: "Crown", lineTotal: 10000, status: "COMPLETED" },
    ];

    // Applying the advance to the invoice: allocations, not payments.
    const allocations = drawFromCredit([{ id: "advance", available: 15000 }], 15000);
    expect(allocations).toEqual([{ id: "advance", amount: 15000 }]);

    const collection = sumMoney(cashMovements.map((m) => m.amount));
    expect(collection).toBe(15000); // not 30,000

    const byDoctor = new Map<string, number>();
    for (const item of items.filter((i) => i.status === "COMPLETED")) {
      byDoctor.set(item.doctor, sumMoney([byDoctor.get(item.doctor) ?? 0, item.lineTotal]));
    }
    expect(Object.fromEntries(byDoctor)).toEqual({ "Dr. A": 5000, "Dr. B": 10000 });

    const invoicePaid = sumMoney(allocations.map((a) => a.amount));
    expect(invoicePaid).toBe(15000);
    expect(receiptAvailable(15000, invoicePaid, 0)).toBe(0); // no credit left over
  });

  it("a refund is negative cash that reduces collection on its date", () => {
    const movements = [15000, -2000]; // receipt, then refund of unapplied credit
    expect(sumMoney(movements)).toBe(13000);
    expect(receiptAvailable(15000, 10000, 2000)).toBe(3000);
  });
});
