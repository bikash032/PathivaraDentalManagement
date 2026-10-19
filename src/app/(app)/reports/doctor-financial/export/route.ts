import { requirePermission } from "@/lib/auth/current-user";
import { toCsv } from "@/lib/reports/csv";
import { getDoctorFinancialReport, parseDoctorReportFilters } from "@/lib/reports/doctor-financial";
import { REPORT_SECTIONS, sectionTable, type ReportSection } from "@/lib/reports/doctor-financial-tables";

/** CSV of one report section, built from the same data and filters as the page. */
export async function GET(request: Request) {
  await requirePermission("report.view");

  const params = Object.fromEntries(new URL(request.url).searchParams);
  const section = params.section as ReportSection;
  if (!REPORT_SECTIONS.includes(section)) {
    return new Response("Unknown report section.", { status: 400 });
  }

  const filters = parseDoctorReportFilters(params);
  const report = await getDoctorFinancialReport(filters);
  const table = sectionTable(report, section);
  const rows = table.totals && table.rows.length > 0 ? [...table.rows, table.totals] : table.rows;

  return new Response(toCsv(table.headers, rows), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="doctor-report-${section}-${filters.from}-to-${filters.to}.csv"`,
      "Cache-Control": "no-store",
    },
  });
}
