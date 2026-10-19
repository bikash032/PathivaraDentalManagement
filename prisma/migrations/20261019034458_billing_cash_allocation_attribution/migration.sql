-- Billing: separate cash collection (Payment), application of cash to invoices
-- (PaymentAllocation) and doctor-wise treatment attribution (InvoiceItem).
-- Additive and data-preserving: every existing invoice keeps its paidAmount.
-- CreateEnum
CREATE TYPE "TreatmentStatus" AS ENUM ('PLANNED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "PaymentKind" AS ENUM ('RECEIPT', 'REFUND');

-- AlterTable
ALTER TABLE "InvoiceItem" ADD COLUMN     "appointmentId" TEXT,
ADD COLUMN     "completedAt" TIMESTAMP(3),
ADD COLUMN     "doctorId" TEXT,
ADD COLUMN     "treatmentStatus" "TreatmentStatus" NOT NULL DEFAULT 'PLANNED';

-- AlterTable
ALTER TABLE "Payment" ADD COLUMN     "kind" "PaymentKind" NOT NULL DEFAULT 'RECEIPT',
ADD COLUMN     "patientId" TEXT,
ADD COLUMN     "refundOfPaymentId" TEXT,
ALTER COLUMN "invoiceId" DROP NOT NULL;

-- Backfill: every existing payment belongs to its invoice's patient.
UPDATE "Payment" p SET "patientId" = i."patientId" FROM "Invoice" i WHERE i.id = p."invoiceId";
ALTER TABLE "Payment" ALTER COLUMN "patientId" SET NOT NULL;

-- CreateTable
CREATE TABLE "PaymentAllocation" (
    "id" TEXT NOT NULL,
    "paymentId" TEXT NOT NULL,
    "invoiceId" TEXT NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reversedAt" TIMESTAMP(3),
    "reversedById" TEXT,
    "reverseReason" TEXT,

    CONSTRAINT "PaymentAllocation_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PaymentAllocation_paymentId_idx" ON "PaymentAllocation"("paymentId");

-- CreateIndex
CREATE INDEX "PaymentAllocation_invoiceId_idx" ON "PaymentAllocation"("invoiceId");

-- CreateIndex
CREATE INDEX "InvoiceItem_doctorId_completedAt_idx" ON "InvoiceItem"("doctorId", "completedAt");

-- CreateIndex
CREATE INDEX "InvoiceItem_appointmentId_idx" ON "InvoiceItem"("appointmentId");

-- CreateIndex
CREATE INDEX "Payment_patientId_idx" ON "Payment"("patientId");

-- CreateIndex
CREATE INDEX "Payment_paymentDate_idx" ON "Payment"("paymentDate");

-- CreateIndex
CREATE INDEX "Payment_refundOfPaymentId_idx" ON "Payment"("refundOfPaymentId");

-- AddForeignKey
ALTER TABLE "InvoiceItem" ADD CONSTRAINT "InvoiceItem_doctorId_fkey" FOREIGN KEY ("doctorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InvoiceItem" ADD CONSTRAINT "InvoiceItem_appointmentId_fkey" FOREIGN KEY ("appointmentId") REFERENCES "Appointment"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "Patient"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_refundOfPaymentId_fkey" FOREIGN KEY ("refundOfPaymentId") REFERENCES "Payment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PaymentAllocation" ADD CONSTRAINT "PaymentAllocation_paymentId_fkey" FOREIGN KEY ("paymentId") REFERENCES "Payment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PaymentAllocation" ADD CONSTRAINT "PaymentAllocation_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "Invoice"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PaymentAllocation" ADD CONSTRAINT "PaymentAllocation_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PaymentAllocation" ADD CONSTRAINT "PaymentAllocation_reversedById_fkey" FOREIGN KEY ("reversedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Backfill: each existing non-voided payment was applied in full to its own
-- invoice, so invoice.paidAmount (= active allocations) is unchanged.
INSERT INTO "PaymentAllocation" ("id", "paymentId", "invoiceId", "amount", "createdById", "createdAt")
SELECT 'alloc_' || p."id", p."id", p."invoiceId", p."amount", p."receivedById", p."createdAt"
FROM "Payment" p
WHERE p."voidedAt" IS NULL AND p."invoiceId" IS NOT NULL;

-- Backfill: treating doctor and appointment from the invoice's visit, when linked.
UPDATE "InvoiceItem" ii
SET "doctorId" = v."doctorId", "appointmentId" = v."appointmentId"
FROM "Invoice" i JOIN "Visit" v ON v."id" = i."visitId"
WHERE ii."invoiceId" = i."id";

-- Backfill: items billed before this change are treated as performed when
-- invoiced; items on cancelled invoices are cancelled.
UPDATE "InvoiceItem" ii
SET "treatmentStatus" = CASE WHEN i."status" = 'CANCELLED' THEN 'CANCELLED'::"TreatmentStatus" ELSE 'COMPLETED'::"TreatmentStatus" END,
    "completedAt"     = CASE WHEN i."status" = 'CANCELLED' THEN NULL ELSE i."createdAt" END
FROM "Invoice" i
WHERE ii."invoiceId" = i."id";

-- Money integrity guards.
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_kind_amount_check" CHECK (
  ("kind" = 'RECEIPT' AND "amount" > 0 AND "refundOfPaymentId" IS NULL)
  OR ("kind" = 'REFUND' AND "amount" < 0 AND "refundOfPaymentId" IS NOT NULL AND "invoiceId" IS NULL)
);
ALTER TABLE "PaymentAllocation" ADD CONSTRAINT "PaymentAllocation_amount_check" CHECK ("amount" > 0);
