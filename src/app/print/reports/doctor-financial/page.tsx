import { requirePermission } from "@/lib/auth/current-user";
import { formatBSDate, getDayRangeNepal } from "@/lib/date";
import { formatNPR } from "@/lib/currency";
import { getClinicProfile } from "@/lib/clinic-settings";
import { ClinicPrintHeader, PrintDocument } from "@/components/print-document";
import { PrintButton } from "@/components/print-button";
import { ReportTable } from "@/components/report-table";
import {
  ALL_DOCTORS,
  CUSTOM_TREATMENT,
  DOCTOR_NOT_RECORDED,
  INVOICE_STATUS_LABELS,
  TREATMENT_STATUS_LABELS,
  getDoctorFinancialReport,
  getDoctorReportOptions,
  parseDoctorReportFilters,
} from "@/lib/reports/doctor-financial";
import { REPORT_SECTIONS, SECTION_TITLES, sectionTable } from "@/lib/reports/doctor-financial-tables";

/** Printable copy of the doctor-wise report: same filters, rows and totals as the page. */
export default async function PrintDoctorFinancialReportPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await requirePermission("report.view");
  const filters = parseDoctorReportFilters(await searchParams);
  const [report, options, clinic] = await Promise.all([
    getDoctorFinancialReport(filters),
    getDoctorReportOptions(),
    getClinicProfile(),
  ]);
  const { summary } = report;

  const doctorLabel =
    filters.doctor === ALL_DOCTORS
      ? "All doctors"
      : filters.doctor === DOCTOR_NOT_RECORDED
        ? "Doctor not recorded"
        : (options.doctors.find((d) => d.id === filters.doctor)?.name ?? "Unknown doctor");
  const treatmentLabel =
    filters.treatment === CUSTOM_TREATMENT
      ? "Custom items"
      : filters.treatment
        ? (options.treatments.find((t) => t.id === filters.treatment)?.name ?? "Unknown")
        : "All treatments";
  const applied = [
    `Period: ${formatBSDate(report.start)} — ${formatBSDate(getDayRangeNepal(filters.to).start)}`,
    `Doctor: ${doctorLabel}`,
    `Treatment: ${treatmentLabel}`,
    `Status: ${filters.status ? TREATMENT_STATUS_LABELS[filters.status] : "All"}`,
    `Payment status: ${filters.paymentStatus ? INVOICE_STATUS_LABELS[filters.paymentStatus] : "All"}`,
    `Method: ${filters.method ? (options.methods.find((m) => m.id === filters.method)?.name ?? "Unknown") : "All"}`,
    filters.patient ? `Patient: ${filters.patient}` : null,
  ].filter(Boolean);

  return (
    <>
      {/* Wide tables: landscape A4. */}
      <style>{"@media print { @page { size: A4 landscape; margin: 10mm; } }"}</style>
      <div className="no-print mx-auto flex max-w-[277mm] justify-end px-4 pt-4">
        <PrintButton />
      </div>
      <PrintDocument paper="a4">
        <div className="max-w-none">
          <ClinicPrintHeader clinic={clinic} title="Doctor-wise Treatment & Financial Report" />
          <p className="mb-3 text-[length:var(--doc-label)] text-ink">{applied.join(" · ")}</p>

          <table className="mb-4 w-full text-[length:var(--doc-label)]">
            <tbody>
              <tr className="border-y border-line">
                <td className="py-1 pr-3 font-semibold">Treatment value</td>
                <td className="py-1 pr-3">Total {formatNPR(summary.treatmentValue)}</td>
                <td className="py-1 pr-3">Completed {formatNPR(summary.completedValue)}</td>
                <td className="py-1 pr-3">Allocated {formatNPR(summary.allocated)}</td>
                <td className="py-1">Outstanding {formatNPR(summary.outstanding)}</td>
              </tr>
              <tr className="border-b border-line">
                <td className="py-1 pr-3 font-semibold">Clinic collection</td>
                <td className="py-1 pr-3">Received {formatNPR(summary.cashReceived)}</td>
                <td className="py-1 pr-3">Refunded {formatNPR(summary.refunds)}</td>
                <td className="py-1 pr-3" colSpan={2}>
                  Net {formatNPR(summary.netCollection)}
                </td>
              </tr>
              <tr className="border-b border-line">
                <td className="py-1 pr-3 font-semibold">Doctor payable</td>
                <td className="py-1" colSpan={4}>
                  Not configured — no commission rules exist; treatment value is not the amount payable.
                </td>
              </tr>
            </tbody>
          </table>

          {summary.notRecordedCount > 0 ? (
            <p className="mb-3 text-[length:var(--doc-label)] font-semibold">
              {summary.notRecordedCount} treatment(s) have no treating doctor recorded (NOT RECORDED).
            </p>
          ) : null}

          {REPORT_SECTIONS.map((section) => (
            <section key={section} className="mb-4">
              <h2 className="mb-1 text-[length:var(--doc-title)] font-bold">{SECTION_TITLES[section]}</h2>
              <ReportTable table={sectionTable(report, section)} emptyMessage="Nothing matches these filters." compact />
            </section>
          ))}
        </div>
      </PrintDocument>
    </>
  );
}
