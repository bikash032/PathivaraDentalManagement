import "server-only";
import { db } from "@/lib/db";
import { currentMonthStartNepal, getDayRangeNepal, toNepalDateInputValue } from "@/lib/date";
import { invoiceItemFinancials, sumMoney } from "@/lib/money";
import type { InvoiceStatus, Prisma, TreatmentStatus } from "@/generated/prisma/client";

/*
 * Doctor-wise treatment & financial report.
 *
 * Three different quantities are kept apart on purpose:
 *  - Treatment value: what was billed for a treatment, attributed to the doctor
 *    recorded on the invoice item (never the invoice creator or the cashier).
 *  - Clinic collection: real cash in/out (Payment rows) on their payment date.
 *    An advance counts once, when received; applying it to an invoice creates
 *    an allocation, not a payment, so it is never counted again.
 *  - Doctor payable: needs commission rules, which this system does not have,
 *    so it is reported as not configured rather than guessed.
 *
 * Treatment rows come from invoice items only; payment figures per item are
 * derived from the item's own invoice, never by joining payment rows, so a
 * treatment is never repeated or double-counted.
 */

export const TREATMENT_STATUS_LABELS: Record<TreatmentStatus, string> = {
  PLANNED: "Planned",
  IN_PROGRESS: "In progress",
  COMPLETED: "Completed",
  CANCELLED: "Cancelled",
};

export const INVOICE_STATUS_LABELS: Record<InvoiceStatus, string> = {
  UNPAID: "Unpaid",
  PARTIALLY_PAID: "Partially paid",
  PAID: "Paid",
  CANCELLED: "Cancelled",
};

const TREATMENT_STATUSES = Object.keys(TREATMENT_STATUS_LABELS) as TreatmentStatus[];
const INVOICE_STATUSES = Object.keys(INVOICE_STATUS_LABELS) as InvoiceStatus[];

/** Doctor filter values besides a user id. */
export const ALL_DOCTORS = "all";
export const DOCTOR_NOT_RECORDED = "unrecorded";
/** Treatment filter value for items not picked from the treatment catalogue. */
export const CUSTOM_TREATMENT = "custom";

export type DoctorReportFilters = {
  from: string;
  to: string;
  doctor: string;
  treatment: string;
  status: TreatmentStatus | "";
  paymentStatus: InvoiceStatus | "";
  method: string;
  patient: string;
};

type RawParams = Record<string, string | string[] | undefined>;

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const first = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? "";

export function parseDoctorReportFilters(params: RawParams): DoctorReportFilters {
  let from = first(params.from);
  let to = first(params.to);
  if (!DATE_RE.test(from)) from = currentMonthStartNepal();
  if (!DATE_RE.test(to)) to = toNepalDateInputValue(new Date());
  if (from > to) [from, to] = [to, from];

  const status = first(params.status);
  const paymentStatus = first(params.paymentStatus);
  return {
    from,
    to,
    doctor: first(params.doctor) || ALL_DOCTORS,
    treatment: first(params.treatment),
    status: TREATMENT_STATUSES.includes(status as TreatmentStatus) ? (status as TreatmentStatus) : "",
    paymentStatus: INVOICE_STATUSES.includes(paymentStatus as InvoiceStatus) ? (paymentStatus as InvoiceStatus) : "",
    method: first(params.method),
    patient: first(params.patient).trim().slice(0, 100),
  };
}

/** The same filters as a query string, for exports and the print view. */
export function doctorReportQuery(filters: DoctorReportFilters): string {
  const q = new URLSearchParams();
  for (const [key, value] of Object.entries(filters)) {
    if (value && !(key === "doctor" && value === ALL_DOCTORS)) q.set(key, value);
  }
  return q.toString();
}

function patientWhere(search: string): Prisma.PatientWhereInput | undefined {
  if (!search) return undefined;
  return {
    OR: [
      { fullName: { contains: search, mode: "insensitive" } },
      { patientCode: { contains: search, mode: "insensitive" } },
      { phone: { contains: search } },
    ],
  };
}

export type TreatmentRow = {
  id: string;
  /** Completed date if completed, otherwise the appointment, otherwise the invoice date. */
  treatmentDate: Date;
  dateBasis: "completed" | "appointment" | "invoice";
  appointmentAt: Date | null;
  patientName: string;
  patientCode: string;
  treatment: string;
  tooth: string | null;
  doctorId: string | null;
  doctorName: string | null;
  status: TreatmentStatus;
  quantity: number;
  net: number;
  allocated: number;
  outstanding: number;
  invoiceId: string;
  invoiceNumber: string;
  invoiceStatus: InvoiceStatus;
  /** Cancelled treatments and items on cancelled invoices are listed but not totalled. */
  counted: boolean;
};

export type DoctorTotal = {
  doctorId: string | null;
  doctorName: string;
  treatments: number;
  completedValue: number;
  pendingValue: number;
  totalValue: number;
  allocated: number;
  outstanding: number;
};

export type PaymentRow = {
  id: string;
  day: string;
  paymentDate: Date;
  patientName: string;
  patientCode: string;
  type: string;
  kind: "RECEIPT" | "REFUND";
  method: string;
  amount: number;
  appliedTo: string;
  reference: string | null;
  receivedBy: string;
};

export type DailyRow = { day: string; method: string; receipts: number; refunds: number; net: number };

export async function getDoctorFinancialReport(filters: DoctorReportFilters) {
  const start = getDayRangeNepal(filters.from).start;
  const end = getDayRangeNepal(filters.to).end;
  const range = { gte: start, lt: end };

  // ---- Treatments -------------------------------------------------------
  const itemWhere: Prisma.InvoiceItemWhereInput = {
    AND: [
      {
        OR: [
          { completedAt: range },
          { completedAt: null, appointment: { scheduledAt: range } },
          { completedAt: null, appointmentId: null, invoice: { createdAt: range } },
        ],
      },
      filters.doctor === DOCTOR_NOT_RECORDED
        ? { doctorId: null }
        : filters.doctor !== ALL_DOCTORS
          ? { doctorId: filters.doctor }
          : {},
      filters.treatment === CUSTOM_TREATMENT
        ? { treatmentId: null }
        : filters.treatment
          ? { treatmentId: filters.treatment }
          : {},
      filters.status ? { treatmentStatus: filters.status } : {},
      {
        invoice: {
          ...(filters.paymentStatus ? { status: filters.paymentStatus } : {}),
          ...(filters.patient ? { patient: patientWhere(filters.patient) } : {}),
        },
      },
    ],
  };

  const items = await db.invoiceItem.findMany({
    where: itemWhere,
    include: {
      invoice: {
        select: {
          id: true,
          invoiceNumber: true,
          status: true,
          createdAt: true,
          discountAmount: true,
          paidAmount: true,
          patient: { select: { fullName: true, patientCode: true } },
        },
      },
      treatment: { select: { name: true } },
      doctor: { select: { id: true, name: true } },
      appointment: { select: { scheduledAt: true } },
    },
  });

  // Per-item money is computed over each whole invoice (all its items), so the
  // shares match the invoice even when only some items pass the filters.
  const invoiceIds = [...new Set(items.map((i) => i.invoiceId))];
  const siblings = invoiceIds.length
    ? await db.invoiceItem.findMany({
        where: { invoiceId: { in: invoiceIds } },
        select: { id: true, invoiceId: true, lineTotal: true },
        orderBy: { id: "asc" },
      })
    : [];
  const financials = new Map<string, { net: number; allocated: number; outstanding: number }>();
  for (const invoiceId of invoiceIds) {
    const own = siblings.filter((s) => s.invoiceId === invoiceId);
    const invoice = items.find((i) => i.invoiceId === invoiceId)!.invoice;
    const figures = invoiceItemFinancials(
      own.map((s) => Number(s.lineTotal)),
      Number(invoice.discountAmount),
      invoice.status === "CANCELLED" ? 0 : Number(invoice.paidAmount)
    );
    own.forEach((s, idx) => financials.set(s.id, figures[idx]));
  }

  const treatments: TreatmentRow[] = items
    .map((item) => {
      const money = financials.get(item.id)!;
      const dateBasis: TreatmentRow["dateBasis"] = item.completedAt
        ? "completed"
        : item.appointment
          ? "appointment"
          : "invoice";
      const name = item.treatment?.name ?? item.description;
      return {
        id: item.id,
        treatmentDate: item.completedAt ?? item.appointment?.scheduledAt ?? item.invoice.createdAt,
        dateBasis,
        appointmentAt: item.appointment?.scheduledAt ?? null,
        patientName: item.invoice.patient.fullName,
        patientCode: item.invoice.patient.patientCode,
        treatment: item.treatment && item.description !== name ? `${name} — ${item.description}` : name,
        tooth: item.tooth,
        doctorId: item.doctor?.id ?? null,
        doctorName: item.doctor?.name ?? null,
        status: item.treatmentStatus,
        quantity: item.quantity,
        net: money.net,
        allocated: money.allocated,
        outstanding: money.outstanding,
        invoiceId: item.invoice.id,
        invoiceNumber: item.invoice.invoiceNumber,
        invoiceStatus: item.invoice.status,
        counted: item.treatmentStatus !== "CANCELLED" && item.invoice.status !== "CANCELLED",
      };
    })
    .sort(
      (a, b) =>
        a.treatmentDate.getTime() - b.treatmentDate.getTime() ||
        a.invoiceNumber.localeCompare(b.invoiceNumber) ||
        a.id.localeCompare(b.id)
    );

  const counted = treatments.filter((t) => t.counted);
  const byDoctor = new Map<string, DoctorTotal>();
  for (const t of counted) {
    const key = t.doctorId ?? DOCTOR_NOT_RECORDED;
    const row =
      byDoctor.get(key) ??
      ({
        doctorId: t.doctorId,
        doctorName: t.doctorName ?? "Doctor not recorded",
        treatments: 0,
        completedValue: 0,
        pendingValue: 0,
        totalValue: 0,
        allocated: 0,
        outstanding: 0,
      } satisfies DoctorTotal);
    row.treatments += 1;
    if (t.status === "COMPLETED") row.completedValue = sumMoney([row.completedValue, t.net]);
    else row.pendingValue = sumMoney([row.pendingValue, t.net]);
    row.totalValue = sumMoney([row.totalValue, t.net]);
    row.allocated = sumMoney([row.allocated, t.allocated]);
    row.outstanding = sumMoney([row.outstanding, t.outstanding]);
    byDoctor.set(key, row);
  }
  const doctorTotals = [...byDoctor.values()].sort((a, b) =>
    a.doctorId === null ? 1 : b.doctorId === null ? -1 : a.doctorName.localeCompare(b.doctorName)
  );

  // ---- Cash: receipts and refunds on their own dates ------------------
  const payments = await db.payment.findMany({
    where: {
      paymentDate: range,
      voidedAt: null,
      ...(filters.method ? { paymentMethodId: filters.method } : {}),
      ...(filters.patient ? { patient: patientWhere(filters.patient) } : {}),
    },
    orderBy: [{ paymentDate: "asc" }, { createdAt: "asc" }],
    include: {
      patient: { select: { fullName: true, patientCode: true } },
      paymentMethod: { select: { name: true } },
      invoice: { select: { invoiceNumber: true } },
      receivedBy: { select: { name: true } },
      allocations: { where: { reversedAt: null }, include: { invoice: { select: { invoiceNumber: true } } } },
    },
  });

  const paymentRows: PaymentRow[] = payments.map((p) => ({
    id: p.id,
    day: toNepalDateInputValue(p.paymentDate),
    paymentDate: p.paymentDate,
    patientName: p.patient.fullName,
    patientCode: p.patient.patientCode,
    kind: p.kind,
    type: p.kind === "REFUND" ? "Refund" : p.invoice ? `Payment at ${p.invoice.invoiceNumber}` : "Advance",
    method: p.paymentMethod.name,
    amount: Number(p.amount),
    appliedTo:
      p.kind === "REFUND"
        ? "—"
        : p.allocations.length
          ? p.allocations.map((a) => `${a.invoice.invoiceNumber} (${Number(a.amount).toFixed(2)})`).join(", ")
          : "Unapplied credit",
    reference: p.reference,
    receivedBy: p.receivedBy.name,
  }));

  const dailyMap = new Map<string, DailyRow>();
  for (const p of paymentRows) {
    const key = `${p.day}|${p.method}`;
    const row = dailyMap.get(key) ?? { day: p.day, method: p.method, receipts: 0, refunds: 0, net: 0 };
    if (p.kind === "REFUND") row.refunds = sumMoney([row.refunds, -p.amount]);
    else row.receipts = sumMoney([row.receipts, p.amount]);
    row.net = sumMoney([row.net, p.amount]);
    dailyMap.set(key, row);
  }
  const daily = [...dailyMap.values()].sort((a, b) => a.day.localeCompare(b.day) || a.method.localeCompare(b.method));

  const summary = {
    treatmentValue: sumMoney(counted.map((t) => t.net)),
    completedValue: sumMoney(counted.filter((t) => t.status === "COMPLETED").map((t) => t.net)),
    allocated: sumMoney(counted.map((t) => t.allocated)),
    outstanding: sumMoney(counted.map((t) => t.outstanding)),
    treatmentCount: counted.length,
    notRecordedCount: counted.filter((t) => !t.doctorId).length,
    cashReceived: sumMoney(daily.map((d) => d.receipts)),
    refunds: sumMoney(daily.map((d) => d.refunds)),
    netCollection: sumMoney(daily.map((d) => d.net)),
  };

  return { filters, start, end, treatments, doctorTotals, payments: paymentRows, daily, summary };
}

export type DoctorFinancialReport = Awaited<ReturnType<typeof getDoctorFinancialReport>>;

/** Options for the filter form. */
export async function getDoctorReportOptions() {
  const [doctors, treatments, methods] = await Promise.all([
    db.user.findMany({ where: { role: { key: "DOCTOR" } }, select: { id: true, name: true, isActive: true }, orderBy: { name: "asc" } }),
    db.treatment.findMany({ select: { id: true, name: true }, orderBy: { name: "asc" } }),
    db.paymentMethod.findMany({ select: { id: true, name: true }, orderBy: { name: "asc" } }),
  ]);
  return { doctors, treatments, methods };
}
