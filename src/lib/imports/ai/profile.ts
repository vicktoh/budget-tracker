/**
 * Compact, deterministic sheet profiles: the only workbook content an AI
 * call ever sees. Each profile carries the sheet's header, a handful of
 * truncated sample rows and simple facts, never the whole sheet.
 */
import { normalizeKey } from "@/lib/imports/normalize";
import { buildTable, type SourceGridRow } from "@/lib/imports/table";
import type { SheetKind } from "@/lib/imports/ai/kinds";

export const SAMPLE_ROWS = 8;
export const MAX_HEADERS = 40;
export const MAX_CELL_CHARS = 60;
export const MAX_SHEETS = 30;

export type SheetProfile = {
  name: string;
  state: "visible" | "hidden" | "veryHidden";
  headerRowNumber: number | null;
  headers: string[];
  sampleRows: string[][];
  dataRows: number;
  hiddenRows: number;
  formulaRows: number;
  missingCacheRows: number;
  totalLikeRows: number;
  monthColumns: number;
};

const MONTHS = ["january", "february", "march", "april", "may", "june", "july", "august", "september", "october", "november", "december", "jan", "feb", "mar", "apr", "jun", "jul", "aug", "sep", "sept", "oct", "nov", "dec", "febuary"];
const TOTAL_ROW = /^(grand\s+|sub[\s-]?)?totals?\b/i;

function truncate(value: string): string {
  const text = value.replace(/\s+/g, " ").trim();
  return text.length > MAX_CELL_CHARS ? `${text.slice(0, MAX_CELL_CHARS - 1)}…` : text;
}

export function buildSheetProfile(
  name: string,
  state: SheetProfile["state"],
  grid: SourceGridRow[],
): SheetProfile {
  const table = buildTable(grid);
  if (!table) {
    return {
      name, state, headerRowNumber: null, headers: [], sampleRows: [], dataRows: 0,
      hiddenRows: 0, formulaRows: 0, missingCacheRows: 0, totalLikeRows: 0, monthColumns: 0,
    };
  }
  const headers = table.headers.slice(0, MAX_HEADERS);
  return {
    name,
    state,
    headerRowNumber: table.headerRowNumber,
    headers: headers.map(truncate),
    sampleRows: table.rows.slice(0, SAMPLE_ROWS).map((row) => headers.map((h) => truncate(row.raw[h] ?? ""))),
    dataRows: table.rows.length,
    hiddenRows: table.hiddenRows,
    formulaRows: table.rows.filter((r) => r.meta.formula_headers?.length).length,
    missingCacheRows: table.rows.filter((r) => r.meta.missing_cache_headers?.length).length,
    totalLikeRows: table.rows.filter((r) => Object.values(r.raw).some((v) => TOTAL_ROW.test(v.trim()))).length,
    monthColumns: table.headers.filter((h) => normalizeKey(h).split(" ").some((word) => MONTHS.includes(word))).length,
  };
}

export type HeuristicClassification = { kind: SheetKind; reason: string };

/**
 * Header-keyword classification. It runs before (and without) AI so the user
 * always gets a first reading, and it is the fallback when AI is unavailable.
 */
export function classifyByHeuristics(profile: SheetProfile): HeuristicClassification {
  const name = normalizeKey(profile.name);
  const headers = profile.headers.map(normalizeKey);
  const has = (...words: string[]) => headers.some((h) => words.some((w) => h.includes(w)));

  if (!profile.headers.length || profile.dataRows === 0) {
    return { kind: "other", reason: "No table with a header row was found." };
  }
  if (/dashboard|summary|analysis|overview|chart/.test(name)) {
    return { kind: "summary_dashboard", reason: `Sheet name "${profile.name}" suggests a summary.` };
  }
  if (/lookup|list|reference|codes?$/.test(name)) {
    return { kind: "reference_lookup", reason: `Sheet name "${profile.name}" suggests a lookup list.` };
  }
  if (has("voucher", "payment method", "pv no", "pv number", "paid via")) {
    return { kind: "expenditure_ledger", reason: "Has voucher / payment-method columns." };
  }
  if (has("reference no", "reference number", "ref no", "receipt") && has("funding source", "source of fund", "source")) {
    return { kind: "funding_ledger", reason: "Has reference-number and funding-source columns." };
  }
  if ((has("activity code") && has("budgeted cost", "cost", "budget")) || has("cost of aop", "aop cost", "operational activities")) {
    return { kind: "aop_plan", reason: "Has AOP activity and cost columns." };
  }
  if (profile.monthColumns >= 3) {
    return { kind: "monthly_return", reason: `${profile.monthColumns} month columns (e.g. January…June) per budget line.` };
  }
  if (has("balance") && has("actual expenditure", "used", "funding received")) {
    return { kind: "summary_dashboard", reason: "Budget, received, spent and balance per category: a summary, not transactions." };
  }
  if (has("approved budget", "appropriation") && has("economic code", "economic description")) {
    return { kind: "annual_budget", reason: "Has approved-budget and economic-code columns per budget line." };
  }
  const quarterWord = headers.some((h) => /\bq[1-4]\b|\bquarter\b|year to date/.test(h));
  if (quarterWord || has("performance")) {
    return { kind: "quarterly_aggregate", reason: "Has quarter / performance columns rather than individual transactions." };
  }
  if (has("approved budget", "appropriation", "economic code") || /budget/.test(name)) {
    return { kind: "annual_budget", reason: "Has approved-budget / economic-code columns." };
  }
  return { kind: "other", reason: "Headers don't match a known layout." };
}
