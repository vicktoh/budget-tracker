import { decimalToKobo, koboToDecimal } from "@/lib/imports/normalize";
import { periodKey, type Disposition, type RowIssue } from "@/lib/imports/validate";

/** Stored on import_batches.summary. Money is exact decimal text. */
export type ImportSummary = {
  counts: Record<Disposition, number> & { total: number };
  eligible_total: string;
  eligible_with_warnings: number;
  warning_count: number;
  by_mda: Array<{ mda_id: string; count: number; total: string }>;
  by_period: Array<{ period: string; count: number; total: string }>;
  blocker_codes: Record<string, number>;
};

export type SummaryRow = {
  disposition: Disposition;
  issues: RowIssue[];
  proposed: { mda_id: string; transaction_date: string; amount: string } | null;
};

/** Counts and totals recomputed from the staged rows themselves. */
export function summarizeRows(rows: SummaryRow[]): ImportSummary {
  const counts = { total: rows.length, eligible: 0, blocked: 0, duplicate: 0, excluded: 0 };
  let eligibleTotal = BigInt(0);
  let eligibleWithWarnings = 0;
  let warningCount = 0;
  const byMda = new Map<string, { count: number; total: bigint }>();
  const byPeriod = new Map<string, { count: number; total: bigint }>();
  const blockerCodes: Record<string, number> = {};

  for (const row of rows) {
    counts[row.disposition]++;
    for (const issue of row.issues) {
      if (issue.severity === "blocker") blockerCodes[issue.code] = (blockerCodes[issue.code] ?? 0) + 1;
    }
    if (row.disposition !== "eligible" || !row.proposed) continue;
    const warnings = row.issues.filter((issue) => issue.severity === "warning").length;
    if (warnings) eligibleWithWarnings++;
    warningCount += warnings;
    const kobo = decimalToKobo(row.proposed.amount);
    eligibleTotal += kobo;
    const mda = byMda.get(row.proposed.mda_id) ?? { count: 0, total: BigInt(0) };
    mda.count++;
    mda.total += kobo;
    byMda.set(row.proposed.mda_id, mda);
    const period = periodKey(row.proposed.transaction_date).key;
    const p = byPeriod.get(period) ?? { count: 0, total: BigInt(0) };
    p.count++;
    p.total += kobo;
    byPeriod.set(period, p);
  }

  return {
    counts,
    eligible_total: koboToDecimal(eligibleTotal),
    eligible_with_warnings: eligibleWithWarnings,
    warning_count: warningCount,
    by_mda: [...byMda].map(([mda_id, v]) => ({ mda_id, count: v.count, total: koboToDecimal(v.total) })),
    by_period: [...byPeriod]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([period, v]) => ({ period, count: v.count, total: koboToDecimal(v.total) })),
    blocker_codes: blockerCodes,
  };
}

/**
 * Neutralise spreadsheet formula injection: a cell starting with = + - @ or a
 * control character is prefixed with an apostrophe so Excel shows it as text.
 */
export function safeSpreadsheetCell(value: string): string {
  return /^[=+\-@\t\r]/.test(value) ? `'${value}` : value;
}

function csvCell(value: string): string {
  const safe = safeSpreadsheetCell(value);
  return /[",\n\r]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
}

export type IssueReportRow = {
  sourceRowNumber: number;
  disposition: Disposition;
  issues: RowIssue[];
  raw: Record<string, string>;
  /** Cells the user corrected in the app, keyed by source header. */
  overrides?: Record<string, string>;
  committedPublicId?: string | null;
};

/** Every staged row with its disposition, issues, original cells and corrections. */
export function buildIssueReportCsv(headers: string[], rows: IssueReportRow[]): string {
  const head = ["Source row", "Disposition", "Entry ID", "Severity", "Issue code", "Issue", "Corrections", ...headers];
  const lines = [head.map(csvCell).join(",")];
  for (const row of rows) {
    const issues = row.issues.length ? row.issues : [null];
    const corrections = Object.entries(row.overrides ?? {})
      .map(([header, value]) => `${header}: "${row.raw[header] ?? ""}" → "${value}"`)
      .join("; ");
    for (const issue of issues) {
      lines.push(
        [
          String(row.sourceRowNumber),
          row.disposition,
          row.committedPublicId ?? "",
          issue?.severity ?? "",
          issue?.code ?? "",
          issue?.message ?? "",
          corrections,
          ...headers.map((h) => row.raw[h] ?? ""),
        ]
          .map(csvCell)
          .join(","),
      );
    }
  }
  return `﻿${lines.join("\r\n")}`;
}
