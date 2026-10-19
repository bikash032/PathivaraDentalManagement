/**
 * Minimal CSV writer for report exports.
 *
 * Text cells that start with = + - @ (or a tab/CR) are prefixed with an
 * apostrophe so a spreadsheet never runs them as a formula; numbers are written
 * as plain numbers so they stay usable in calculations.
 */
export type CsvCell = string | number | null | undefined;

function cell(value: CsvCell): string {
  if (value === null || value === undefined) return "";
  if (typeof value === "number") return value.toFixed(2);
  let text = value;
  if (/^[=+\-@\t\r]/.test(text)) text = `'${text}`;
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

/** CSV text with a UTF-8 byte-order mark so Excel shows Nepali correctly. */
export function toCsv(headers: string[], rows: CsvCell[][]): string {
  const lines = [headers, ...rows].map((row) => row.map(cell).join(","));
  return "﻿" + lines.join("\r\n") + "\r\n";
}
