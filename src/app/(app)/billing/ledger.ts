import "server-only";
import { db } from "@/lib/db";
import { receiptAvailable, sumMoney } from "@/lib/money";

/**
 * A patient's cash position: every receipt with how much of it is applied to
 * invoices, refunded, and still available as credit. Read-only; the actions
 * recompute the same figures inside their transactions.
 */
export async function getPatientLedger(patientId: string) {
  const payments = await db.payment.findMany({
    where: { patientId },
    orderBy: [{ paymentDate: "asc" }, { createdAt: "asc" }],
    include: {
      paymentMethod: { select: { name: true } },
      invoice: { select: { id: true, invoiceNumber: true } },
      receivedBy: { select: { name: true } },
      allocations: {
        orderBy: { createdAt: "asc" },
        include: { invoice: { select: { id: true, invoiceNumber: true } } },
      },
      refunds: { where: { voidedAt: null }, select: { amount: true } },
    },
  });

  const receipts = payments
    .filter((p) => p.kind === "RECEIPT")
    .map((p) => {
      const applied = sumMoney(p.allocations.filter((a) => !a.reversedAt).map((a) => Number(a.amount)));
      const refunded = -sumMoney(p.refunds.map((r) => Number(r.amount)));
      return {
        ...p,
        applied,
        refunded,
        available: p.voidedAt ? 0 : receiptAvailable(Number(p.amount), applied, refunded),
      };
    });
  const refunds = payments.filter((p) => p.kind === "REFUND");
  const active = <T extends { voidedAt: Date | null }>(rows: T[]) => rows.filter((r) => !r.voidedAt);

  return {
    receipts,
    refunds,
    totals: {
      received: sumMoney(active(receipts).map((r) => Number(r.amount))),
      applied: sumMoney(active(receipts).map((r) => r.applied)),
      refunded: -sumMoney(active(refunds).map((r) => Number(r.amount))),
      credit: sumMoney(receipts.map((r) => r.available)),
    },
  };
}

export async function getActiveDoctors() {
  return db.user.findMany({
    where: { isActive: true, role: { key: "DOCTOR" } },
    select: { id: true, name: true },
    orderBy: { name: "asc" },
  });
}
