"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requirePermission } from "@/lib/auth/current-user";
import { db } from "@/lib/db";
import { getRequestIp } from "@/lib/auth/session";
import { writeAuditLog } from "@/lib/audit";
import { nextInvoiceNumber } from "@/lib/invoice-number";
import {
  parseInvoiceFormData,
  parseInvoiceItems,
  recordPaymentSchema,
} from "@/lib/validation/billing";
import { flattenZodErrors } from "@/lib/validation/zod-helpers";
import type { Prisma, InvoiceStatus } from "@/generated/prisma/client";

export type InvoiceFormState = { error?: string; fieldErrors?: Record<string, string> };
export type PaymentFormState = { error?: string; fieldErrors?: Record<string, string> };

async function recalculateInvoiceTotals(tx: Prisma.TransactionClient, invoiceId: string) {
  const invoice = await tx.invoice.findUniqueOrThrow({ where: { id: invoiceId } });
  const paymentsSum = await tx.payment.aggregate({
    where: { invoiceId, voidedAt: null },
    _sum: { amount: true },
  });
  const paidAmount = Number(paymentsSum._sum.amount ?? 0);
  const totalAmount = Number(invoice.totalAmount);

  let status: InvoiceStatus = invoice.status;
  if (invoice.status !== "CANCELLED") {
    if (paidAmount <= 0) status = "UNPAID";
    else if (paidAmount < totalAmount) status = "PARTIALLY_PAID";
    else status = "PAID";
  }

  await tx.invoice.update({ where: { id: invoiceId }, data: { paidAmount, status } });
}

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

  const header = parsedHeader.data;
  const lineTotals = items.map((i) => Math.max(0, i.quantity * i.unitPrice - i.discount));
  const subtotal = lineTotals.reduce((a, b) => a + b, 0);
  const totalAmount = Math.max(0, subtotal - header.discountAmount);
  const invoiceNumber = await nextInvoiceNumber();

  const invoice = await db.$transaction((tx) =>
    tx.invoice.create({
      data: {
        invoiceNumber,
        patientId: header.patientId,
        visitId: header.visitId || null,
        subtotal,
        discountAmount: header.discountAmount,
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
          })),
        },
      },
    })
  );

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

  try {
    await db.$transaction(async (tx) => {
      const invoice = await tx.invoice.findUniqueOrThrow({ where: { id: invoiceId } });
      if (invoice.status === "CANCELLED") {
        throw new Error("Cannot record a payment against a cancelled invoice.");
      }
      const remaining = Number(invoice.totalAmount) - Number(invoice.paidAmount);
      if (data.amount > remaining + 0.01) {
        throw new Error(`Amount exceeds the remaining balance (रु. ${remaining.toFixed(2)}).`);
      }

      await tx.payment.create({
        data: {
          invoiceId,
          amount: data.amount,
          paymentMethodId: data.paymentMethodId,
          paymentDate: new Date(data.paymentDate),
          reference: data.reference || null,
          notes: data.notes || null,
          receivedById: user.id,
        },
      });

      await recalculateInvoiceTotals(tx, invoiceId);
    });
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Could not record payment." };
  }

  await writeAuditLog({
    userId: user.id,
    action: "payment.record",
    entityType: "Invoice",
    entityId: invoiceId,
    metadata: { amount: data.amount },
    ipAddress: await getRequestIp(),
  });

  revalidatePath(`/billing/${invoiceId}`);
  revalidatePath("/billing");
  revalidatePath("/dashboard");
  return {};
}

export async function voidPaymentAction(invoiceId: string, paymentId: string): Promise<void> {
  const user = await requirePermission("payment.void");

  await db.$transaction(async (tx) => {
    await tx.payment.update({
      where: { id: paymentId },
      data: { voidedAt: new Date(), voidReason: "Voided by staff" },
    });
    await recalculateInvoiceTotals(tx, invoiceId);
  });

  await writeAuditLog({
    userId: user.id,
    action: "payment.void",
    entityType: "Payment",
    entityId: paymentId,
    ipAddress: await getRequestIp(),
  });

  revalidatePath(`/billing/${invoiceId}`);
  revalidatePath("/billing");
  revalidatePath("/dashboard");
}

export async function cancelInvoiceAction(invoiceId: string): Promise<void> {
  const user = await requirePermission("invoice.cancel");

  const invoice = await db.invoice.findUniqueOrThrow({ where: { id: invoiceId } });
  if (Number(invoice.paidAmount) > 0) {
    throw new Error("Void payments before cancelling this invoice.");
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
