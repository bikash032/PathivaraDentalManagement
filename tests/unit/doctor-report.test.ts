import { describe, expect, it } from "vitest";
import { apportion, invoiceItemFinancials, sumMoney } from "@/lib/money";
import { toCsv } from "@/lib/reports/csv";

describe("apportion", () => {
  it("splits proportionally and the parts always add up exactly", () => {
    expect(apportion(1500, [5000, 10000])).toEqual([500, 1000]);
    const parts = apportion(100, [1, 1, 1]);
    expect(sumMoney(parts)).toBe(100);
    expect(parts).toEqual([33.34, 33.33, 33.33]);
  });

  it("never produces fractions of a paisa", () => {
    for (const part of apportion(0.1, [1, 1, 1])) {
      expect(Math.round(part * 100)).toBeCloseTo(part * 100, 9);
    }
    expect(sumMoney(apportion(0.1, [1, 1, 1]))).toBe(0.1);
  });

  it("splits equally when nothing has value, and returns zeros for a zero total", () => {
    expect(apportion(10, [0, 0])).toEqual([5, 5]);
    expect(apportion(0, [100, 200])).toEqual([0, 0]);
    expect(apportion(50, [])).toEqual([]);
  });
});

describe("invoiceItemFinancials", () => {
  it("matches the clinic example: RCT 5,000 and crown 10,000 fully paid by an advance", () => {
    const [rct, crown] = invoiceItemFinancials([5000, 10000], 0, 15000);
    expect(rct).toEqual({ net: 5000, allocated: 5000, outstanding: 0 });
    expect(crown).toEqual({ net: 10000, allocated: 10000, outstanding: 0 });
  });

  it("shares the invoice-level Less and a partial payment by value", () => {
    // 6,000 + 4,000 = 10,000, overall Less 1,000 → total 9,000; 4,500 paid.
    const items = invoiceItemFinancials([6000, 4000], 1000, 4500);
    expect(items.map((i) => i.net)).toEqual([5400, 3600]);
    expect(items.map((i) => i.allocated)).toEqual([2700, 1800]);
    expect(items.map((i) => i.outstanding)).toEqual([2700, 1800]);
    // Item figures reconcile exactly with the invoice.
    expect(sumMoney(items.map((i) => i.net))).toBe(9000);
    expect(sumMoney(items.map((i) => i.allocated))).toBe(4500);
    expect(sumMoney(items.map((i) => i.outstanding))).toBe(4500);
  });

  it("reconciles to the paisa on awkward amounts", () => {
    const lines = [333.33, 333.33, 333.34];
    const items = invoiceItemFinancials(lines, 10, 500.01);
    expect(sumMoney(items.map((i) => i.net))).toBe(990);
    expect(sumMoney(items.map((i) => i.allocated))).toBe(500.01);
    expect(sumMoney(items.map((i) => i.outstanding))).toBe(489.99);
  });

  it("never allocates more than the items are worth", () => {
    const items = invoiceItemFinancials([1000], 0, 5000);
    expect(items[0]).toEqual({ net: 1000, allocated: 1000, outstanding: 0 });
  });
});

describe("toCsv", () => {
  it("writes a BOM, escapes quotes/commas/newlines and keeps numbers numeric", () => {
    const csv = toCsv(["Patient", "Amount"], [
      ['Ram "Raju", Thapa', 1500],
      ["पाथिभरा\nनोट", -200.5],
    ]);
    expect(csv.startsWith("﻿")).toBe(true);
    expect(csv).toContain('"Ram ""Raju"", Thapa",1500.00');
    expect(csv).toContain('"पाथिभरा\nनोट",-200.50');
  });

  it("neutralises text that a spreadsheet would run as a formula", () => {
    const csv = toCsv(["Name"], [["=HYPERLINK(\"x\")"], ["+1"], ["@SUM(A1)"], ["-cmd"]]);
    expect(csv).toContain(`"'=HYPERLINK(""x"")"`);
    expect(csv).toContain("'+1");
    expect(csv).toContain("'@SUM(A1)");
    expect(csv).toContain("'-cmd");
  });
});
