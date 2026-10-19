"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requirePermission } from "@/lib/auth/current-user";
import { db } from "@/lib/db";
import { getRequestIp } from "@/lib/auth/session";
import { writeAuditLog } from "@/lib/audit";
import { nextInvoiceNumber } from "@/lib/invoice-number";
import { getDayRangeNepal } from "@/lib/date";
import {
  advancePaymentSchema,
  applyCreditSchema,
  itemTreatmentSchema,
  parseInvoiceFormData,
  parseInvoiceItems,
  recordPaymentSchema,
  refundSchema,
} from "@/lib/validation/billing";
import { flattenZodErrors } from "@/lib/validation/zod-helpers";
import {
  calculateInvoiceTotals,
  drawFromCredit,
  exceedsAmount,
  exceedsRemainingBalance,
  receiptAvailable,
  remainingBalance,
  resolveInvoiceStatus,
  sumMoney,
} from "@/lib/money";
import type { Prisma, InvoiceStatus } from "@/generated/prisma/client";

export type InvoiceFormState = { error?: string; fieldErrors?: Record<string, string> };
export type PaymentFormState = { error?: string; fieldErrors?: Record<string, string> };
export type BillingFormState = { error?: string; success?: string; fieldErrors?: Record<string, string> };

/**
 * A business-rule failure whose message is safe to show the user. Anything
 * else that throws (Prisma errors, bugs) must not have its message surfaced,
 * so it can't leak schema or internal details into the UI.
 */
class BillingRuleError extends Error {}

// ---------------------------------------------------------------------------
// Ledger helpers (always called inside a transaction)
// ---------------------------------------------------------------------------

/**
 * Serialises money operations per patient: two cashiers applying or refunding
 * the same patient's credit at once would otherwise both see it as available.
 */
async function lockPatient(tx: Prisma.TransactionClient, patientId: string) {
  await tx.$queryRaw`SELECT "id" FROM "Patient" WHERE "id" = ${patientId} FOR UPDATE`;
}

/** paidAmount = active allocations; the status follows from it. */
async function recalculateInvoicePaid(tx: Prisma.TransactionClient, invoiceId: string) {
  const invoice = await tx.invoice.findUniqueOrThrow({ where: { id: invoiceId } });
  const allocated = await tx.paymentAllocation.aggregate({
    where: { invoiceId, reversedAt: null },
    _sum: { amount: true },
  });
  const paidAmount = Number(allocated._sum.amount ?? 0);
  const status: InvoiceStatus =
    invoice.status === "CANCELLED" ? "CANCELLED" : resolveInvoiceStatus(Number(invoice.totalAmount), paidAmount);

  await tx.invoice.update({ where: { id: invoiceId }, data: { paidAmount, status } });
}

/** The patient's receipts with what is still unapplied, oldest first. */
async function receiptBalances(tx: Prisma.TransactionClient, patientId: string) {
  const receipts = await tx.payment.findMany({
    where: { patientId, kind: "RECEIPT", voidedAt: null },
    orderBy: [{ paymentDate: "asc" }, { createdAt: "asc" }],
    select: {
      id: true,
      amount: true,
      allocations: { where: { reversedAt: null }, select: { amount: true } },
      refunds: { where: { voidedAt: null }, select: { amount: true } },
    },
  });
  return receipts.map((r) => ({
    id: r.id,
    available: receiptAvailable(
      Number(r.amount),
      sumMoney(r.allocations.map((a) => Number(a.amount))),
      // refunds are stored negative
      -sumMoney(r.refunds.map((x) => Number(x.amount)))
    ),
  }));
}

async function assertDoctors(tx: Prisma.TransactionClient, doctorIds: string[]) {
  const unique = [...new Set(doctorIds.filter(Boolean))];
  if (unique.length === 0) return;
  const found = await tx.user.count({ where: { id: { in: unique }, isActive: true, role: { key: "DOCTOR" } } });
  if (found !== unique.length) throw new BillingRuleError("Choose an active doctor for each treatment.");
}

/** A Nepal calendar day as a stored instant (noon NPT keeps it inside that day). */
function nepalDayToInstant(day: string): Date {
  return new Date(getDayRangeNepal(day).start.getTime() + 12 * 60 * 60 * 1000);
}

function revalidateBilling(paths: string[]) {
  revalidatePath("/billing");
  revalidatePath("/dashboard");
  for (const p of paths) revalidatePath(p);
}

function ruleErrorState(e: unknown, context: string): BillingFormState {
  if (e instanceof BillingRuleError) return { error: e.message };
  console.error(`${context} failed`, e);
  return { error: "Could not save this change. Please try again." };
}

// ---------------------------------------------------------------------------
// Invoices
// ---------------------------------------------------------------------------

export async function createInvoiceAction(
  _prevState: InvoiceFormState,
  formData: FormData
): Promise<InvoiceFormState> {
  const user = await requirePermission("invoice.create");
  const parsedHeader = parseInvoiceFormData(formData);

  if (!parsedHeader.success) {
    return { error: "Please fix the errors below.", fieldErrors: flattenZodErrors(parsedHeader.error) };
  }

  const items = parseInvoiceItems(formData);
  if (items.length === 0) {
    return { error: "Add at least one invoice item." };
  }
  if (items.some((item) => item.treatmentStatus === "COMPLETED" && !item.doctorId)) {
    return { error: "Choose the treating doctor for every completed treatment." };
  }

  const header = parsedHeader.data;
  const { lineTotals, subtotal, discountAmount, totalAmount } = calculateInvoiceTotals(
    items,
    header.discountAmount
  );
  const invoiceNumber = await nextInvoiceNumber();
  const now = new Date();

  let invoice;
  try {
    invoice = await db.$transaction(async (tx) => {
      await assertDoctors(
        tx,
        items.map((i) => i.doctorId ?? "")
      );
      // An invoice raised from a visit defaults its items to that visit's doctor and appointment.
      const visit = header.visitId
        ? await tx.visit.findFirst({ where: { id: header.visitId, patientId: header.patientId } })
        : null;

      return tx.invoice.create({
        data: {
          invoiceNumber,
          patientId: header.patientId,
          visitId: visit?.id ?? null,
          subtotal,
          discountAmount,
          totalAmount,
          notes: header.notes || null,
          createdById: user.id,
          items: {
            create: items.map((item, idx) => ({
              treatmentId: item.treatmentId || null,
              description: item.description,
              quantity: item.quantity,
              unitPrice: item.unitPrice,
              discount: item.discount,
              lineTotal: lineTotals[idx],
              doctorId: item.doctorId || visit?.doctorId || null,
              appointmentId: visit?.appointmentId ?? null,
              treatmentStatus: item.treatmentStatus,
              completedAt: item.treatmentStatus === "COMPLETED" ? now : null,
              tooth: item.tooth || null,
            })),
          },
        },
      });
    });
  } catch (e) {
    if (e instanceof BillingRuleError) return { error: e.message };
    throw e;
  }

  await writeAuditLog({
    userId: user.id,
    action: "invoice.create",
    entityType: "Invoice",
    entityId: invoice.id,
    metadata: { invoiceNumber: invoice.invoiceNumber, totalAmount },
    ipAddress: await getRequestIp(),
  });

  revalidatePath("/billing");
  revalidatePath(`/patients/${header.patientId}`);
  redirect(`/billing/${invoice.id}`);
}

export async function cancelInvoiceAction(invoiceId: string): Promise<void> {
  const user = await requirePermission("invoice.cancel");

  const applied = await db.paymentAllocation.aggregate({
    where: { invoiceId, reversedAt: null },
    _sum: { amount: true },
  });
  if (Number(applied._sum.amount ?? 0) > 0) {
    throw new BillingRuleError("Unapply or void payments before cancelling this invoice.");
  }

  await db.invoice.update({
    where: { id: invoiceId },
    data: { status: "CANCELLED", cancelledAt: new Date(), cancelReason: "Cancelled by staff" },
  });

  await writeAuditLog({
    userId: user.id,
    action: "invoice.cancel",
    entityType: "Invoice",
    entityId: invoiceId,
    ipAddress: await getRequestIp(),
  });

  revalidatePath(`/billing/${invoiceId}`);
  revalidatePath("/billing");
}

/**
 * Sets who performed one billed treatment, at which appointment, and its
 * clinical status. Independent of payment: a fully paid item can still be
 * planned, and a completed one can still be unpaid.
 */
export async function updateItemTreatmentAction(
  itemId: string,
  _prevState: BillingFormState,
  formData: FormData
): Promise<BillingFormState> {
  const user = await requirePermission("invoice.update");

  const parsed = itemTreatmentSchema.safeParse({
    doctorId: formData.get("doctorId") || undefined,
    appointmentId: formData.get("appointmentId") || undefined,
    treatmentStatus: formData.get("treatmentStatus"),
    completedDate: formData.get("completedDate") || undefined,
    tooth: formData.get("tooth") || undefined,
  });
  if (!parsed.success) {
    return { error: "Please fix the errors below.", fieldErrors: flattenZodErrors(parsed.error) };
  }
  const data = parsed.data;

  let audit: Record<string, unknown> = {};
  let invoiceId = "";
  try {
    await db.$transaction(async (tx) => {
      const item = await tx.invoiceItem.findUniqueOrThrow({ where: { id: itemId }, include: { invoice: true } });
      invoiceId = item.invoiceId;
      if (item.invoice.status === "CANCELLED") {
        throw new BillingRuleError("This invoice is cancelled.");
      }

      let doctorId = data.doctorId ?? null;
      const appointmentId = data.appointmentId ?? null;
      if (appointmentId) {
        const appointment = await tx.appointment.findFirst({
          where: { id: appointmentId, patientId: item.invoice.patientId },
        });
        if (!appointment) throw new BillingRuleError("That appointment does not belong to this patient.");
        doctorId ??= appointment.doctorId;
      }
      // A doctor already on the item stays valid even if they have since left.
      if (doctorId && doctorId !== item.doctorId) await assertDoctors(tx, [doctorId]);
      if (data.treatmentStatus === "COMPLETED" && !doctorId) {
        throw new BillingRuleError("Choose the doctor who performed this treatment.");
      }

      const completedAt =
        data.treatmentStatus !== "COMPLETED"
          ? null
          : data.completedDate
            ? nepalDayToInstant(data.completedDate)
            : (item.completedAt ?? new Date());
      if (completedAt && completedAt.getTime() > Date.now() + 24 * 60 * 60 * 1000) {
        throw new BillingRuleError("A completed treatment cannot be dated in the future.");
      }

      await tx.invoiceItem.update({
        where: { id: itemId },
        data: { doctorId, appointmentId, treatmentStatus: data.treatmentStatus, completedAt, tooth: data.tooth || null },
      });
      audit = {
        invoiceId: item.invoiceId,
        before: { doctorId: item.doctorId, appointmentId: item.appointmentId, status: item.treatmentStatus, tooth: item.tooth },
        after: { doctorId, appointmentId, status: data.treatmentStatus, tooth: data.tooth || null },
      };
    });
  } catch (e) {
    return ruleErrorState(e, "updateItemTreatmentAction");
  }

  await writeAuditLog({
    userId: user.id,
    action: "invoice.item.treatment",
    entityType: "InvoiceItem",
    entityId: itemId,
    metadata: audit,
    ipAddress: await getRequestIp(),
  });

  revalidateBilling([`/billing/${invoiceId}`]);
  return { success: "Saved." };
}

// ---------------------------------------------------------------------------
// Cash in: payment at an invoice, or an advance
// ---------------------------------------------------------------------------

/** Cash received at an invoice: one receipt, applied in full to that invoice. */
export async function recordPaymentAction(
  invoiceId: string,
  _prevState: PaymentFormState,
  formData: FormData
): Promise<PaymentFormState> {
  const user = await requirePermission("payment.record");

  const parsed = recordPaymentSchema.safeParse({
    amount: formData.get("amount"),
    paymentMethodId: formData.get("paymentMethodId"),
    paymentDate: formData.get("paymentDate"),
    reference: formData.get("reference") || undefined,
    notes: formData.get("notes") || undefined,
  });

  if (!parsed.success) {
    return { error: "Please fix the errors below.", fieldErrors: flattenZodErrors(parsed.error) };
  }

  const data = parsed.data;
  let paymentId = "";
  let patientId = "";

  try {
    await db.$transaction(async (tx) => {
      const invoice = await tx.invoice.findUniqueOrThrow({ where: { id: invoiceId } });
      patientId = invoice.patientId;
      await lockPatient(tx, invoice.patientId);
      if (invoice.status === "CANCELLED") {
        throw new BillingRuleError("Cannot record a payment against a cancelled invoice.");
      }
      const total = Number(invoice.totalAmount);
      const paid = Number(invoice.paidAmount);
      if (exceedsRemainingBalance(data.amount, total, paid)) {
        throw new BillingRuleError(
          `Amount exceeds the remaining balance (रु. ${remainingBalance(total, paid).toFixed(2)}). ` +
            "Record any extra as an advance from the patient's account."
        );
      }

      const payment = await tx.payment.create({
        data: {
          patientId: invoice.patientId,
          kind: "RECEIPT",
          invoiceId,
          amount: data.amount,
          paymentMethodId: data.paymentMethodId,
          paymentDate: new Date(data.paymentDate),
          reference: data.reference || null,
          notes: data.notes || null,
          receivedById: user.id,
          allocations: { create: { invoiceId, amount: data.amount, createdById: user.id } },
        },
      });
      paymentId = payment.id;

      await recalculateInvoicePaid(tx, invoiceId);
    });
  } catch (e) {
    if (e instanceof BillingRuleError) return { error: e.message };
    console.error("recordPaymentAction failed", e);
    return { error: "Could not record this payment. Please try again." };
  }

  await writeAuditLog({
    userId: user.id,
    action: "payment.record",
    entityType: "Invoice",
    entityId: invoiceId,
    metadata: { amount: data.amount, paymentId },
    ipAddress: await getRequestIp(),
  });

  revalidateBilling([`/billing/${invoiceId}`, `/billing/patients/${patientId}`]);
  return {};
}

/**
 * Cash received before it is billed. Counted as collection today; it sits as
 * the patient's unallocated credit until applied to invoices.
 */
export async function recordAdvanceAction(
  _prevState: BillingFormState,
  formData: FormData
): Promise<BillingFormState> {
  const user = await requirePermission("payment.record");

  const parsed = advancePaymentSchema.safeParse({
    patientId: formData.get("patientId"),
    amount: formData.get("amount"),
    paymentMethodId: formData.get("paymentMethodId"),
    paymentDate: formData.get("paymentDate"),
    reference: formData.get("reference") || undefined,
    notes: formData.get("notes") || undefined,
  });
  if (!parsed.success) {
    return { error: "Please fix the errors below.", fieldErrors: flattenZodErrors(parsed.error) };
  }
  const data = parsed.data;

  let paymentId = "";
  try {
    await db.$transaction(async (tx) => {
      const patient = await tx.patient.findUnique({ where: { id: data.patientId } });
      if (!patient) throw new BillingRuleError("Select a patient.");
      const method = await tx.paymentMethod.findFirst({ where: { id: data.paymentMethodId, isActive: true } });
      if (!method) throw new BillingRuleError("Select a payment method.");
      await lockPatient(tx, patient.id);

      const payment = await tx.payment.create({
        data: {
          patientId: patient.id,
          kind: "RECEIPT",
          invoiceId: null,
          amount: data.amount,
          paymentMethodId: data.paymentMethodId,
          paymentDate: new Date(data.paymentDate),
          reference: data.reference || null,
          notes: data.notes || null,
          receivedById: user.id,
        },
      });
      paymentId = payment.id;
    });
  } catch (e) {
    return ruleErrorState(e, "recordAdvanceAction");
  }

  await writeAuditLog({
    userId: user.id,
    action: "payment.advance",
    entityType: "Payment",
    entityId: paymentId,
    metadata: { patientId: data.patientId, amount: data.amount },
    ipAddress: await getRequestIp(),
  });

  revalidateBilling([`/billing/patients/${data.patientId}`]);
  redirect(`/billing/patients/${data.patientId}`);
}

// ---------------------------------------------------------------------------
// Applying credit (not a collection)
// ---------------------------------------------------------------------------

/** Applies the patient's unallocated credit to an invoice, oldest receipts first. */
export async function applyCreditAction(
  invoiceId: string,
  _prevState: BillingFormState,
  formData: FormData
): Promise<BillingFormState> {
  const user = await requirePermission("payment.record");

  const parsed = applyCreditSchema.safeParse({ amount: formData.get("amount") });
  if (!parsed.success) {
    return { error: "Please fix the errors below.", fieldErrors: flattenZodErrors(parsed.error) };
  }
  const amount = parsed.data.amount;

  let draws: { id: string; amount: number }[] = [];
  let patientId = "";
  try {
    await db.$transaction(async (tx) => {
      const invoice = await tx.invoice.findUniqueOrThrow({ where: { id: invoiceId } });
      patientId = invoice.patientId;
      await lockPatient(tx, invoice.patientId);
      if (invoice.status === "CANCELLED") throw new BillingRuleError("This invoice is cancelled.");

      const due = remainingBalance(Number(invoice.totalAmount), Number(invoice.paidAmount));
      if (exceedsAmount(amount, due)) {
        throw new BillingRuleError(`Amount exceeds the remaining balance (रु. ${due.toFixed(2)}).`);
      }
      const balances = await receiptBalances(tx, invoice.patientId);
      const credit = sumMoney(balances.map((b) => b.available));
      if (exceedsAmount(amount, credit)) {
        throw new BillingRuleError(`Amount exceeds the patient's available credit (रु. ${credit.toFixed(2)}).`);
      }

      draws = drawFromCredit(balances, amount);
      await tx.paymentAllocation.createMany({
        data: draws.map((d) => ({ paymentId: d.id, invoiceId, amount: d.amount, createdById: user.id })),
      });
      await recalculateInvoicePaid(tx, invoiceId);
    });
  } catch (e) {
    return ruleErrorState(e, "applyCreditAction");
  }

  await writeAuditLog({
    userId: user.id,
    action: "payment.allocate",
    entityType: "Invoice",
    entityId: invoiceId,
    metadata: { amount, fromReceipts: draws },
    ipAddress: await getRequestIp(),
  });

  revalidateBilling([`/billing/${invoiceId}`, `/billing/patients/${patientId}`]);
  return { success: "Credit applied." };
}

/** Takes an applied amount back off an invoice; it returns to the patient's credit. */
export async function unapplyAllocationAction(allocationId: string): Promise<void> {
  const user = await requirePermission("payment.void");

  const allocation = await db.$transaction(async (tx) => {
    const current = await tx.paymentAllocation.findUniqueOrThrow({
      where: { id: allocationId },
      include: { invoice: { select: { patientId: true } } },
    });
    await lockPatient(tx, current.invoice.patientId);
    if (current.reversedAt) return current;

    const reversed = await tx.paymentAllocation.update({
      where: { id: allocationId },
      data: { reversedAt: new Date(), reversedById: user.id, reverseReason: "Unapplied by staff" },
      include: { invoice: { select: { patientId: true } } },
    });
    await recalculateInvoicePaid(tx, current.invoiceId);
    return reversed;
  });

  await writeAuditLog({
    userId: user.id,
    action: "payment.unallocate",
    entityType: "PaymentAllocation",
    entityId: allocationId,
    metadata: { invoiceId: allocation.invoiceId, paymentId: allocation.paymentId, amount: Number(allocation.amount) },
    ipAddress: await getRequestIp(),
  });

  revalidateBilling([`/billing/${allocation.invoiceId}`, `/billing/patients/${allocation.invoice.patientId}`]);
}

// ---------------------------------------------------------------------------
// Cash out and corrections
// ---------------------------------------------------------------------------

/** Returns unapplied money from one receipt. Reduces collection on the refund date. */
export async function refundAction(
  patientId: string,
  _prevState: BillingFormState,
  formData: FormData
): Promise<BillingFormState> {
  const user = await requirePermission("payment.void");

  const parsed = refundSchema.safeParse({
    paymentId: formData.get("paymentId"),
    amount: formData.get("amount"),
    paymentMethodId: formData.get("paymentMethodId"),
    paymentDate: formData.get("paymentDate"),
    reason: formData.get("reason"),
  });
  if (!parsed.success) {
    return { error: "Please fix the errors below.", fieldErrors: flattenZodErrors(parsed.error) };
  }
  const data = parsed.data;

  let refundId = "";
  try {
    await db.$transaction(async (tx) => {
      await lockPatient(tx, patientId);
      const receipt = await tx.payment.findFirst({
        where: { id: data.paymentId, patientId, kind: "RECEIPT", voidedAt: null },
      });
      if (!receipt) throw new BillingRuleError("That receipt cannot be refunded.");

      const available = (await receiptBalances(tx, patientId)).find((b) => b.id === receipt.id)?.available ?? 0;
      if (exceedsAmount(data.amount, available)) {
        throw new BillingRuleError(
          `Only रु. ${available.toFixed(2)} of this receipt is unapplied. Unapply it from invoices first to refund more.`
        );
      }

      const refund = await tx.payment.create({
        data: {
          patientId,
          kind: "REFUND",
          invoiceId: null,
          refundOfPaymentId: receipt.id,
          amount: -data.amount,
          paymentMethodId: data.paymentMethodId,
          paymentDate: new Date(data.paymentDate),
          notes: data.reason,
          receivedById: user.id,
        },
      });
      refundId = refund.id;
    });
  } catch (e) {
    return ruleErrorState(e, "refundAction");
  }

  await writeAuditLog({
    userId: user.id,
    action: "payment.refund",
    entityType: "Payment",
    entityId: refundId,
    metadata: { patientId, refundOf: data.paymentId, amount: data.amount, reason: data.reason },
    ipAddress: await getRequestIp(),
  });

  revalidateBilling([`/billing/patients/${patientId}`]);
  return { success: "Refund recorded." };
}

/**
 * Voids a receipt or refund recorded in error. Voiding a receipt also takes
 * back everything it was applied to; a receipt with active refunds must have
 * those voided first.
 */
export async function voidPaymentAction(paymentId: string): Promise<void> {
  const user = await requirePermission("payment.void");

  const result = await db.$transaction(async (tx) => {
    const payment = await tx.payment.findUniqueOrThrow({ where: { id: paymentId } });
    await lockPatient(tx, payment.patientId);
    if (payment.voidedAt) return { payment, invoiceIds: [] as string[] };

    const invoiceIds: string[] = [];
    if (payment.kind === "RECEIPT") {
      const activeRefunds = await tx.payment.count({ where: { refundOfPaymentId: paymentId, voidedAt: null } });
      if (activeRefunds > 0) throw new BillingRuleError("Void this receipt's refunds first.");

      const allocations = await tx.paymentAllocation.findMany({ where: { paymentId, reversedAt: null } });
      await tx.paymentAllocation.updateMany({
        where: { paymentId, reversedAt: null },
        data: { reversedAt: new Date(), reversedById: user.id, reverseReason: "Payment voided" },
      });
      invoiceIds.push(...new Set(allocations.map((a) => a.invoiceId)));
    }

    await tx.payment.update({
      where: { id: paymentId },
      data: { voidedAt: new Date(), voidReason: "Voided by staff" },
    });
    for (const id of invoiceIds) await recalculateInvoicePaid(tx, id);
    return { payment, invoiceIds };
  });

  await writeAuditLog({
    userId: user.id,
    action: "payment.void",
    entityType: "Payment",
    entityId: paymentId,
    metadata: { kind: result.payment.kind, amount: Number(result.payment.amount), invoices: result.invoiceIds },
    ipAddress: await getRequestIp(),
  });

  revalidateBilling([
    `/billing/patients/${result.payment.patientId}`,
    ...result.invoiceIds.map((id) => `/billing/${id}`),
  ]);
}
