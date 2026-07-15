/**
 * Shared period resolution for the reports hub and every report preview, so
 * the hub cards and the documents they open describe exactly the same period.
 */
import type { ReportFilters, ReportQuarter } from "@/lib/reporting/types";

/** Reports always describe one fiscal year; default to the latest with data. */
export function resolveFiscalYear(
  filters: ReportFilters,
  fiscalYears: number[],
): number | null {
  return filters.fiscalYear ?? fiscalYears[0] ?? null;
}

export function resolveEffectiveFilters(
  filters: ReportFilters,
  fiscalYears: number[],
): ReportFilters {
  return { ...filters, fiscalYear: resolveFiscalYear(filters, fiscalYears) };
}

export function periodLabel(
  fiscalYear: number | null,
  quarter: ReportQuarter | null,
): string {
  if (fiscalYear === null) return "—";
  return quarter ? `FY ${fiscalYear} · Q${quarter}` : `FY ${fiscalYear} · Full year`;
}

/** Filename-safe slug for downloads, e.g. `fy2026-q1` or `fy2026-full-year`. */
export function periodSlug(
  fiscalYear: number | null,
  quarter: ReportQuarter | null,
): string {
  if (fiscalYear === null) return "all";
  return quarter ? `fy${fiscalYear}-q${quarter}` : `fy${fiscalYear}-full-year`;
}
