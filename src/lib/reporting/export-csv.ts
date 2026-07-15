/**
 * Minimal CSV builder + browser download. Hand-rolled to avoid a dependency;
 * used for the audit report's per-register machine-readable exports.
 */
export type CsvColumn<T> = {
  header: string;
  value: (row: T) => string | number;
};

function escapeCell(value: string | number): string {
  const text = String(value);
  if (/[",\n\r]/.test(text)) {
    return `"${text.replace(/"/g, '""')}"`;
  }
  return text;
}

export function toCsv<T>(columns: CsvColumn<T>[], rows: T[]): string {
  const header = columns.map((column) => escapeCell(column.header)).join(",");
  const body = rows.map((row) =>
    columns.map((column) => escapeCell(column.value(row))).join(","),
  );
  // Prepend a UTF-8 BOM so Excel renders the naira sign and accents correctly.
  return `﻿${[header, ...body].join("\r\n")}`;
}

/** Triggers a client-side download of CSV text. No-op outside the browser. */
export function downloadCsv(filename: string, csv: string): void {
  if (typeof document === "undefined") return;
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}
