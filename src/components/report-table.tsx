import Link from "next/link";
import { formatNPR } from "@/lib/currency";
import type { SectionTable } from "@/lib/reports/doctor-financial-tables";

/**
 * Renders a report section exactly as exported: same columns, rows and totals.
 * Numbers are money; "NOT RECORDED" marks a treatment whose doctor is unknown.
 */
export function ReportTable({
  table,
  emptyMessage,
  hrefFor,
  compact = false,
}: {
  table: SectionTable;
  emptyMessage: string;
  hrefFor?: (rowIndex: number, columnIndex: number) => string | undefined;
  compact?: boolean;
}) {
  const pad = compact ? "px-1.5 py-1" : "px-3 py-2";
  const render = (value: unknown) =>
    typeof value === "number" ? formatNPR(value) : value === null || value === undefined ? "" : String(value);

  return (
    <div className="overflow-x-auto rounded-lg border border-line bg-surface">
      <table className={`report-table min-w-full divide-y divide-line ${compact ? "text-[7.5pt] leading-tight" : "text-sm"}`}>
        <thead className="bg-page">
          <tr>
            {table.headers.map((h) => (
              <th key={h} className={`${pad} text-left font-medium text-ink-muted`}>
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-line-soft">
          {table.rows.length === 0 ? (
            <tr>
              <td colSpan={table.headers.length} className="px-4 py-6 text-center text-ink-muted">
                {emptyMessage}
              </td>
            </tr>
          ) : (
            table.rows.map((row, i) => (
              <tr key={i} className="hover:bg-page">
                {row.map((value, j) => {
                  const href = hrefFor?.(i, j);
                  const text = render(value);
                  const flagged = value === "NOT RECORDED";
                  return (
                    <td
                      key={j}
                      className={`${pad} ${typeof value === "number" ? "whitespace-nowrap text-right" : ""} ${
                        flagged ? "font-semibold text-warning-ink" : "text-ink-secondary"
                      }`}
                    >
                      {href ? (
                        <Link href={href} className="text-primary hover:underline">
                          {text}
                        </Link>
                      ) : (
                        text
                      )}
                    </td>
                  );
                })}
              </tr>
            ))
          )}
        </tbody>
        {table.totals && table.rows.length > 0 ? (
          <tfoot className="border-t-2 border-line bg-page">
            <tr>
              {table.totals.map((value, j) => (
                <td
                  key={j}
                  className={`${pad} font-semibold text-ink ${typeof value === "number" ? "whitespace-nowrap text-right" : ""}`}
                >
                  {render(value)}
                </td>
              ))}
            </tr>
          </tfoot>
        ) : null}
      </table>
    </div>
  );
}
