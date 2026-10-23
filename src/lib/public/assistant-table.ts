import { z } from "zod";
import { formatNairaShort } from "@/lib/public/model";

/**
 * Tables in Ask AI answers. The model calls `renderTable` with figures it read
 * from its other tools; the chat draws them as a sortable table card instead
 * of a markdown table.
 */

const cellSchema = z.union([z.string(), z.number(), z.null()]);

export const tableInputSchema = z.object({
  title: z.string().max(90).describe("Short table headline, e.g. 'Health MDAs, Jan–Jun 2026'"),
  description: z
    .string()
    .max(160)
    .optional()
    .describe("One line on scope and source in plain text, e.g. 'Year to date. Source: 2026 Q2 BIR, Table 4, p. 18'. No links."),
  columns: z
    .array(
      z.object({
        key: z.string().describe("Key in each row holding this column's value"),
        label: z.string().max(40).describe("Column heading, e.g. 'Budget', 'Spent', '% spent'"),
        format: z
          .enum(["text", "naira", "number", "percent", "spent"])
          .default("text")
          .describe(
            "text = names; naira = amounts in plain naira (not millions); number = counts; " +
              "percent = a share such as 12.5 for 12.5%; spent = % of budget spent (e.g. 42.1), drawn as a pill",
          ),
      }),
    )
    .min(2)
    .max(6)
    .describe("First column is the name column (MDA, programme, year…). Keep to the few columns that answer the question."),
  rows: z
    .array(z.record(z.string(), cellSchema))
    .min(1)
    .max(40)
    .describe("One object per row, keyed by column key. Values come from tool results; never invent or estimate."),
  total: z
    .record(z.string(), cellSchema)
    .optional()
    .describe("Optional totals row, only with figures a tool returned (e.g. the health sector total)."),
  flagLowSpending: z
    .boolean()
    .default(false)
    .describe("true only when the 'spent' figures are year to date at Q2 or later: rows below 25% are marked, as elsewhere on the site."),
});

export type AssistantTableInput = z.infer<typeof tableInputSchema>;
export type TableColumn = AssistantTableInput["columns"][number];
export type TableRow = AssistantTableInput["rows"][number];
export type SortState = { key: string; dir: "asc" | "desc" } | null;

export const LOW_SPEND_PERCENT = 25;

export function isNumericColumn(column: TableColumn): boolean {
  return column.format !== "text";
}

/** A cell as a number, accepting numeric strings like "42.1%" or "₦1,200". */
export function cellNumber(value: TableRow[string] | undefined): number | null {
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  if (typeof value !== "string") return null;
  const cleaned = value.replace(/[₦,%\s]/g, "");
  if (!cleaned || !/^-?\d*\.?\d+$/.test(cleaned)) return null;
  return Number(cleaned);
}

export function formatCell(column: TableColumn, value: TableRow[string] | undefined): string {
  if (value === null || value === undefined || value === "" || value === "\u2014" || value === "-") return "n/a";
  if (column.format === "text") return String(value);
  const n = cellNumber(value);
  if (n === null) return String(value);
  switch (column.format) {
    case "naira":
      return formatNairaShort(n);
    case "number":
      return n.toLocaleString("en-NG");
    default:
      return `${n.toLocaleString("en-NG", { maximumFractionDigits: 1 })}%`;
  }
}

export function isLowSpending(table: Pick<AssistantTableInput, "flagLowSpending">, column: TableColumn, value: TableRow[string] | undefined) {
  if (!table.flagLowSpending || column.format !== "spent") return false;
  const n = cellNumber(value);
  return n !== null && n < LOW_SPEND_PERCENT;
}

/** Sort rows by one column; blanks always go last. Returns a new array. */
export function sortRows(rows: TableRow[], columns: TableColumn[], sort: SortState): TableRow[] {
  if (!sort) return rows;
  const column = columns.find((c) => c.key === sort.key);
  if (!column) return rows;
  const sign = sort.dir === "asc" ? 1 : -1;
  const numeric = isNumericColumn(column);
  return [...rows].sort((a, b) => {
    const av = numeric ? cellNumber(a[column.key]) : (a[column.key] ?? null);
    const bv = numeric ? cellNumber(b[column.key]) : (b[column.key] ?? null);
    if (av === null || av === "") return bv === null || bv === "" ? 0 : 1;
    if (bv === null || bv === "") return -1;
    if (typeof av === "number" && typeof bv === "number") return (av - bv) * sign;
    return String(av).localeCompare(String(bv), "en", { numeric: true }) * sign;
  });
}

/** Header click cycles: numbers high→low→off, names A→Z→off. */
export function nextSort(current: SortState, column: TableColumn): SortState {
  const first = isNumericColumn(column) ? "desc" : "asc";
  if (current?.key !== column.key) return { key: column.key, dir: first };
  if (current.dir === first) return { key: column.key, dir: first === "desc" ? "asc" : "desc" };
  return null;
}

function csvField(value: TableRow[string] | undefined): string {
  if (value === null || value === undefined) return "";
  const text = String(value);
  return /[",\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

/** CSV of the table as shown (full values, not the rounded display). */
export function tableToCsv(table: Pick<AssistantTableInput, "columns" | "rows" | "total">, rows = table.rows): string {
  const lines = [table.columns.map((c) => csvField(c.label)).join(",")];
  for (const row of [...rows, ...(table.total ? [table.total] : [])]) {
    lines.push(table.columns.map((c) => csvField(row[c.key])).join(","));
  }
  return `${lines.join("\r\n")}\r\n`;
}

export function csvFileName(title: string): string {
  const slug = title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
  return `${slug || "table"}.csv`;
}
