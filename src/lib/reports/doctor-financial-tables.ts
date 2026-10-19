import { formatBSDate, getDayRangeNepal } from "@/lib/date";
import { sumMoney } from "@/lib/money";
import type { CsvCell } from "@/lib/reports/csv";
import type { DoctorFinancialReport } from "@/lib/reports/doctor-financial";
import { INVOICE_STATUS_LABELS, TREATMENT_STATUS_LABELS } from "@/lib/reports/doctor-financial";

/*
 * Column definitions shared by the CSV exports and the print view, so both
 * show exactly the same rows, columns and totals as the screen.
 */

export const REPORT_SECTIONS = ["treatments", "doctors", "payments", "daily"] as const;
export type ReportSection = (typeof REPORT_SECTIONS)[number];

export const SECTION_TITLES: Record<ReportSection, string> = {
  treatments: "Treatments (date-wise)",
  doctors: "Doctor-wise totals",
  payments: "Payment transactions",
  daily: "Daily collection",
};

const DATE_BASIS: Record<string, string> = {
  completed: "completed",
  appointment: "appointment",
  invoice: "invoiced",
};

/** Noon (Nepal Time) of a Nepal calendar day, for BS formatting. */
const nepalNoon = (day: string) => new Date(getDayRangeNepal(day).start.getTime() + 12 * 60 * 60 * 1000);

export type SectionTable = { headers: string[]; rows: CsvCell[][]; totals?: CsvCell[] };

export function sectionTable(report: DoctorFinancialReport, section: ReportSection): SectionTable {
  const { summary } = report;
  switch (section) {
    case "treatments":
      return {
        headers: [
          "Treatment date (BS)",
          "Date basis",
          "Appointment (BS)",
          "Patient",
          "Patient ID",
          "Treatment",
          "Tooth",
          "Treating doctor",
          "Status",
          "Net treatment value",
          "Allocated payment",
          "Outstanding",
          "Invoice",
          "Invoice payment status",
          "Included in totals",
        ],
        rows: report.treatments.map((t) => [
          formatBSDate(t.treatmentDate),
          DATE_BASIS[t.dateBasis],
          t.appointmentAt ? formatBSDate(t.appointmentAt) : "",
          t.patientName,
          t.patientCode,
          t.treatment,
          t.tooth ?? "",
          t.doctorName ?? "NOT RECORDED",
          TREATMENT_STATUS_LABELS[t.status],
          t.net,
          t.allocated,
          t.outstanding,
          t.invoiceNumber,
          INVOICE_STATUS_LABELS[t.invoiceStatus],
          t.counted ? "Yes" : "No (cancelled)",
        ]),
        totals: [
          "TOTAL",
          "",
          "",
          "",
          "",
          `${summary.treatmentCount} treatments`,
          "",
          "",
          "",
          summary.treatmentValue,
          summary.allocated,
          summary.outstanding,
          "",
          "",
          "",
        ],
      };
    case "doctors":
      return {
        headers: [
          "Treating doctor",
          "Treatments",
          "Completed value",
          "Not yet completed value",
          "Total treatment value",
          "Allocated payment",
          "Outstanding",
          "Doctor payable",
        ],
        rows: report.doctorTotals.map((d) => [
          d.doctorId ? d.doctorName : "NOT RECORDED",
          String(d.treatments),
          d.completedValue,
          d.pendingValue,
          d.totalValue,
          d.allocated,
          d.outstanding,
          "Not configured",
        ]),
        totals: [
          "TOTAL",
          String(summary.treatmentCount),
          summary.completedValue,
          sumMoney(report.doctorTotals.map((d) => d.pendingValue)),
          summary.treatmentValue,
          summary.allocated,
          summary.outstanding,
          "Not configured",
        ],
      };
    case "payments":
      return {
        headers: [
          "Payment date (BS)",
          "Payment date (AD)",
          "Patient",
          "Patient ID",
          "Type",
          "Method",
          "Amount",
          "Applied to",
          "Reference",
          "Received by (cashier)",
        ],
        rows: report.payments.map((p) => [
          formatBSDate(p.paymentDate),
          p.day,
          p.patientName,
          p.patientCode,
          p.type,
          p.method,
          p.amount,
          p.appliedTo,
          p.reference ?? "",
          p.receivedBy,
        ]),
        totals: ["TOTAL (net collection)", "", "", "", "", "", summary.netCollection, "", "", ""],
      };
    case "daily":
      return {
        headers: ["Date (BS)", "Date (AD)", "Method", "Received", "Refunded", "Net collection"],
        rows: report.daily.map((d) => [
          formatBSDate(nepalNoon(d.day)),
          d.day,
          d.method,
          d.receipts,
          d.refunds,
          d.net,
        ]),
        totals: ["TOTAL", "", "", summary.cashReceived, summary.refunds, summary.netCollection],
      };
  }
}

