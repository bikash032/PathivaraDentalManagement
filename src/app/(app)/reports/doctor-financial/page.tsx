import Link from "next/link";
import { requirePermission } from "@/lib/auth/current-user";
import { formatBSDate, getDayRangeNepal } from "@/lib/date";
import { formatNPR } from "@/lib/currency";
import { StatCard } from "@/components/stat-card";
import { BSDatePicker } from "@/components/bs-date-picker";
import { ReportTable } from "@/components/report-table";
import {
  ALL_DOCTORS,
  CUSTOM_TREATMENT,
  DOCTOR_NOT_RECORDED,
  INVOICE_STATUS_LABELS,
  TREATMENT_STATUS_LABELS,
  doctorReportQuery,
  getDoctorFinancialReport,
  getDoctorReportOptions,
  parseDoctorReportFilters,
} from "@/lib/reports/doctor-financial";
import { REPORT_SECTIONS, SECTION_TITLES, sectionTable, type ReportSection } from "@/lib/reports/doctor-financial-tables";

const selectClass = "w-full rounded-md border border-field-line px-3 py-2 text-sm";
const labelClass = "block text-xs font-medium text-ink-muted";

const SECTION_NOTES: Record<ReportSection, string> = {
  treatments:
    "One row per billed treatment. Treatment date is the completed date, otherwise the appointment, otherwise the invoice date. Allocated payment is the invoice's applied payments shared across its items by value.",
  doctors:
    "Treatment value by the doctor recorded on each treatment. Cancelled treatments are excluded. This is treatment value, not cash and not a payout.",
  payments:
    "Actual cash received and refunded, on the payment date. An advance appears here once, when received; applying it to invoices later does not add a row. Doctor, treatment and status filters do not apply: cash is not attributed to doctors.",
  daily: "Cash collection grouped by the actual payment date and payment method. Refunds reduce the day's collection.",
};

export default async function DoctorFinancialReportPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await requirePermission("report.view");
  const filters = parseDoctorReportFilters(await searchParams);
  const [report, options] = await Promise.all([getDoctorFinancialReport(filters), getDoctorReportOptions()]);
  const query = doctorReportQuery(filters);
  const { summary } = report;

  const tables = Object.fromEntries(REPORT_SECTIONS.map((s) => [s, sectionTable(report, s)])) as Record<
    ReportSection,
    ReturnType<typeof sectionTable>
  >;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <Link href="/reports" className="text-xs text-primary hover:underline">
            ← Reports
          </Link>
          <h1 className="text-xl font-semibold text-ink">Doctor-wise treatment &amp; financial report</h1>
          <p className="text-sm text-ink-muted">
            {formatBSDate(report.start)} — {formatBSDate(getDayRangeNepal(filters.to).start)}
          </p>
        </div>
        <Link
          href={`/print/reports/doctor-financial?${query}`}
          target="_blank"
          className="rounded-md border border-field-line bg-surface px-4 py-2 text-sm font-medium text-ink-secondary hover:bg-page hover:border-secondary hover:text-secondary"
        >
          Print report
        </Link>
      </div>

      <form className="grid grid-cols-2 gap-3 rounded-lg border border-line bg-surface p-4 md:grid-cols-4 xl:grid-cols-8">
        <div className="space-y-1">
          <label htmlFor="from" className={labelClass}>
            From (वि.सं.)
          </label>
          <BSDatePicker id="from" name="from" defaultValue={filters.from} />
        </div>
        <div className="space-y-1">
          <label htmlFor="to" className={labelClass}>
            To (वि.सं.)
          </label>
          <BSDatePicker id="to" name="to" defaultValue={filters.to} />
        </div>
        <div className="space-y-1">
          <label htmlFor="doctor" className={labelClass}>
            Doctor
          </label>
          <select id="doctor" name="doctor" defaultValue={filters.doctor} className={selectClass}>
            <option value={ALL_DOCTORS}>All doctors</option>
            {options.doctors.map((d) => (
              <option key={d.id} value={d.id}>
                {d.name}
                {d.isActive ? "" : " (inactive)"}
              </option>
            ))}
            <option value={DOCTOR_NOT_RECORDED}>Doctor not recorded</option>
          </select>
        </div>
        <div className="space-y-1">
          <label htmlFor="treatment" className={labelClass}>
            Treatment
          </label>
          <select id="treatment" name="treatment" defaultValue={filters.treatment} className={selectClass}>
            <option value="">All treatments</option>
            {options.treatments.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
            <option value={CUSTOM_TREATMENT}>Custom items</option>
          </select>
        </div>
        <div className="space-y-1">
          <label htmlFor="status" className={labelClass}>
            Treatment status
          </label>
          <select id="status" name="status" defaultValue={filters.status} className={selectClass}>
            <option value="">All statuses</option>
            {Object.entries(TREATMENT_STATUS_LABELS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-1">
          <label htmlFor="paymentStatus" className={labelClass}>
            Payment status
          </label>
          <select id="paymentStatus" name="paymentStatus" defaultValue={filters.paymentStatus} className={selectClass}>
            <option value="">All</option>
            {Object.entries(INVOICE_STATUS_LABELS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-1">
          <label htmlFor="method" className={labelClass}>
            Payment method
          </label>
          <select id="method" name="method" defaultValue={filters.method} className={selectClass}>
            <option value="">All methods</option>
            {options.methods.map((m) => (
              <option key={m.id} value={m.id}>
                {m.name}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-1">
          <label htmlFor="patient" className={labelClass}>
            Patient
          </label>
          <input
            id="patient"
            name="patient"
            defaultValue={filters.patient}
            placeholder="Name, ID or phone"
            className={selectClass}
          />
        </div>
        <div className="col-span-full flex gap-2">
          <button
            type="submit"
            className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary-hover"
          >
            Apply filters
          </button>
          <Link
            href="/reports/doctor-financial"
            className="rounded-md border border-field-line bg-surface px-4 py-2 text-sm font-medium text-ink-secondary hover:bg-page"
          >
            Reset
          </Link>
        </div>
      </form>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <section className="space-y-2">
          <h2 className="text-xs font-semibold uppercase tracking-wide text-ink-muted">Treatment value</h2>
          <div className="grid grid-cols-2 gap-3">
            <StatCard label="Treatment value" value={formatNPR(summary.treatmentValue)} />
            <StatCard label="Completed value" value={formatNPR(summary.completedValue)} />
            <StatCard label="Allocated payment" value={formatNPR(summary.allocated)} />
            <StatCard label="Outstanding" value={formatNPR(summary.outstanding)} />
          </div>
        </section>
        <section className="space-y-2">
          <h2 className="text-xs font-semibold uppercase tracking-wide text-ink-muted">Clinic collection (cash)</h2>
          <div className="grid grid-cols-2 gap-3">
            <StatCard label="Cash received" value={formatNPR(summary.cashReceived)} />
            <StatCard label="Refunded" value={formatNPR(summary.refunds)} />
            <StatCard label="Net collection" value={formatNPR(summary.netCollection)} />
          </div>
        </section>
        <section className="space-y-2">
          <h2 className="text-xs font-semibold uppercase tracking-wide text-ink-muted">Doctor payable</h2>
          <div className="rounded-lg border border-line bg-surface p-4 text-sm text-ink-secondary">
            <p className="font-semibold text-ink">Not configured</p>
            <p className="mt-1 text-xs">
              No commission or payout rules exist in the system, so doctor payable is not calculated. Treatment value
              is not the amount payable to a doctor.
            </p>
          </div>
        </section>
      </div>

      {summary.notRecordedCount > 0 ? (
        <div className="rounded-lg border border-warning-line bg-warning-soft px-4 py-3 text-sm text-warning-ink">
          <strong>{summary.notRecordedCount}</strong> treatment{summary.notRecordedCount === 1 ? "" : "s"} in this
          view {summary.notRecordedCount === 1 ? "has" : "have"} no treating doctor recorded (marked NOT RECORDED).
          They are not guessed from who created the invoice or collected payment. Set the doctor with “Edit treatment”
          on the invoice.
        </div>
      ) : null}

      {REPORT_SECTIONS.map((section) => (
        <section key={section} className="space-y-2" aria-labelledby={`section-${section}`}>
          <div className="flex flex-wrap items-end justify-between gap-2">
            <div>
              <h2 id={`section-${section}`} className="text-sm font-semibold text-ink">
                {SECTION_TITLES[section]}
              </h2>
              <p className="max-w-3xl text-xs text-ink-muted">{SECTION_NOTES[section]}</p>
            </div>
            <a
              href={`/reports/doctor-financial/export?section=${section}${query ? `&${query}` : ""}`}
              className="rounded-md border border-field-line bg-surface px-3 py-1.5 text-xs font-medium text-ink-secondary hover:bg-page hover:border-secondary hover:text-secondary"
            >
              Export CSV
            </a>
          </div>
          <ReportTable
            table={tables[section]}
            emptyMessage="Nothing matches these filters."
            hrefFor={
              section === "treatments"
                ? (row, col) => (col === 12 ? `/billing/${report.treatments[row].invoiceId}` : undefined)
                : undefined
            }
          />
        </section>
      ))}
    </div>
  );
}
