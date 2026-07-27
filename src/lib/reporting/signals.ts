/**
 * Signal engine for the reports hub. Threshold rules turn the current period's
 * aggregates into four-level signals used by both the hub cards and the
 * in-document finding badges. Pure and dependency-light so it can be unit
 * tested against fixtures.
 *
 * Levels map onto the platform's semantic status palette in the UI:
 *   strong → Health Green · on_track → Processed Teal
 *   investigate → Review Amber · critical → Rejection Red
 */
import {
  aggregateBudgetComposition,
  aggregateBudgetVsActual,
  aggregateCategoryShare,
  aggregateExceptions,
  aggregateHeadlineKpis,
  filterExpenditure,
} from "@/lib/reporting/aggregate";
import { formatCompactNaira, formatPercent } from "@/lib/format";
import type { ReportFilters, ReportScope, ReportingDataset } from "@/lib/reporting/types";
import type { ReportTemplateId } from "@/lib/reporting/report-templates";

export type SignalLevel = "strong" | "on_track" | "investigate" | "critical";

export type ReportSignal = {
  level: SignalLevel;
  label: string;
};

export const SIGNAL_ORDER: SignalLevel[] = [
  "critical",
  "investigate",
  "on_track",
  "strong",
];

/* -------------------------------------------------------------------------- */
/* Rule helpers                                                               */
/* -------------------------------------------------------------------------- */

/** Expected share of the annual budget that should be spent by end of a quarter. */
export function proRataTarget(quarter: number | null): number {
  if (quarter === null) return 1;
  return Math.min(1, Math.max(0, quarter) * 0.25);
}

/**
 * Grades an execution rate against its pro-rata target. `null`/zero targets or
 * rates resolve to `investigate` rather than throwing.
 */
export function proRataBand(
  executionRate: number | null,
  quarter: number | null,
): SignalLevel {
  const target = proRataTarget(quarter);
  if (executionRate === null || target === 0) return "investigate";
  const ratio = executionRate / target;
  if (ratio >= 0.8) return "strong";
  if (ratio >= 0.6) return "on_track";
  if (ratio >= 0.3) return "investigate";
  return "critical";
}

/** Zero spend against a non-zero budget is always critical. */
export function zeroReleaseLevel(actual: number, budget: number): SignalLevel | null {
  if (budget > 0 && actual === 0) return "critical";
  return null;
}

/** Ratio helper used for year-over-year context (e.g. "29× the 2025 budget"). */
export function multipleLabel(multiple: number | null): string | null {
  if (multiple === null) return null;
  if (multiple >= 2) return `${multiple.toFixed(multiple >= 10 ? 0 : 1)}×`;
  return `${(multiple * 100 - 100).toFixed(0)}%`;
}

/* -------------------------------------------------------------------------- */
/* Category matching (economic class isn't a dimension on the ledger rows,    */
/* so match by the seeded category names — see 001_reference_data.sql)        */
/* -------------------------------------------------------------------------- */

function categoryActual(
  dataset: ReportingDataset,
  filters: ReportFilters,
  scope: ReportScope,
  needle: string,
): number {
  return aggregateCategoryShare(dataset.expenditure, filters, scope)
    .filter((row) => row.expenditure_category_name.toLowerCase().includes(needle))
    .reduce((sum, row) => sum + row.total_amount, 0);
}

/** Share of actual expenditure that is linked to an AOP activity. */
function aopLinkedShare(
  dataset: ReportingDataset,
  filters: ReportFilters,
  scope: ReportScope,
): number | null {
  const actual = filterExpenditure(
    dataset.expenditure,
    filters,
    scope,
  );
  let total = 0;
  let linked = 0;
  for (const row of actual) {
    total += row.amount;
    if (row.aop_activity_id !== null) linked += row.amount;
  }
  return total === 0 ? null : linked / total;
}

/* -------------------------------------------------------------------------- */
/* Findings — the shared building block                                       */
/* -------------------------------------------------------------------------- */

export type Finding = ReportSignal & {
  key: string;
  /** Short document title for the finding. */
  title: string;
  /** Big-number headline, e.g. "₦0" or "9.5%". */
  headline: string;
  /** Supporting context, e.g. "of ₦18.3bn budgeted". */
  context: string;
};

/**
 * The core health findings for a period. Used directly by the CSO template and
 * summarised into count chips on the hub card. `label` is kept for the chip
 * summary; `title`/`headline`/`context` drive the document cards.
 */
export function computeFindings(
  dataset: ReportingDataset,
  filters: ReportFilters,
  scope: ReportScope = {},
): Finding[] {
  const kpis = aggregateHeadlineKpis(
    dataset.budgets,
    dataset.funding,
    dataset.expenditure,
    filters,
    scope,
  );
  const composition = aggregateBudgetComposition(dataset.budgets, filters, scope);
  const quarter = filters.quarter;
  const targetPct = formatPercent(proRataTarget(quarter));
  const findings: Finding[] = [];

  // 1 — Overhead released (the signature zero-release finding)
  const overheadActual = categoryActual(dataset, filters, scope, "overhead");
  const overheadBudget = composition?.other_recurrent_amount ?? 0;
  const overheadZero = zeroReleaseLevel(overheadActual, overheadBudget);
  findings.push({
    key: "overhead",
    label: "Overhead released",
    title: "Health overhead released",
    headline: formatCompactNaira(overheadActual),
    context: `of ${formatCompactNaira(overheadBudget)} budgeted`,
    level:
      overheadZero ??
      proRataBand(overheadBudget === 0 ? null : overheadActual / overheadBudget, quarter),
  });

  // 2 — Overall budget execution vs pro-rata
  findings.push({
    key: "execution",
    label: "Budget execution",
    title: "Budget execution",
    headline: formatPercent(kpis.budget_execution_rate),
    context: `vs ${targetPct} pro-rata target`,
    level: proRataBand(kpis.budget_execution_rate, quarter),
  });

  // 3 — Capital execution vs pro-rata
  const capitalActual = categoryActual(dataset, filters, scope, "capital");
  const capitalBudget = composition?.capital_amount ?? 0;
  const capitalRate = capitalBudget === 0 ? null : capitalActual / capitalBudget;
  findings.push({
    key: "capital",
    label: "Capital execution",
    title: "Capital execution",
    headline: formatPercent(capitalRate),
    context: `${formatCompactNaira(capitalActual)} of ${formatCompactNaira(capitalBudget)}`,
    level: proRataBand(capitalRate, quarter),
  });

  // 4 — AOP linkage (planning discipline)
  const linked = aopLinkedShare(dataset, filters, scope);
  findings.push({
    key: "aop",
    label: "AOP linkage",
    title: "AOP linkage",
    headline: formatPercent(linked),
    context: "of actual spend linked to an AOP activity",
    level:
      linked === null
        ? "investigate"
        : linked >= 0.5
          ? "strong"
          : linked >= 0.1
            ? "investigate"
            : "critical",
  });

  return findings;
}

/** Rolls a list of signals into one count chip per level that is present. */
export function summariseByLevel(signals: ReportSignal[]): ReportSignal[] {
  const counts = new Map<SignalLevel, number>();
  for (const signal of signals) {
    counts.set(signal.level, (counts.get(signal.level) ?? 0) + 1);
  }
  const LABELS: Record<SignalLevel, string> = {
    critical: "Critical",
    investigate: "Investigate",
    on_track: "On track",
    strong: "Strong",
  };
  return SIGNAL_ORDER.filter((level) => counts.has(level)).map((level) => ({
    level,
    label: `${counts.get(level)} ${LABELS[level]}`,
  }));
}

/* -------------------------------------------------------------------------- */
/* Hub signal chips per template                                              */
/* -------------------------------------------------------------------------- */

function pct(rate: number | null): string {
  return rate === null ? "—" : `${(rate * 100).toFixed(1)}%`;
}

export function computeHubSignals(
  templateId: ReportTemplateId,
  dataset: ReportingDataset,
  filters: ReportFilters,
  scope: ReportScope = {},
): ReportSignal[] {
  switch (templateId) {
    case "cso":
      return summariseByLevel(computeFindings(dataset, filters, scope));

    case "bir": {
      const kpis = aggregateHeadlineKpis(
        dataset.budgets,
        dataset.funding,
        dataset.expenditure,
        filters,
        scope,
      );
      const target = proRataTarget(filters.quarter);
      return [
        {
          level: proRataBand(kpis.budget_execution_rate, filters.quarter),
          label: `${pct(kpis.budget_execution_rate)} executed vs ${(target * 100).toFixed(0)}% pro-rata`,
        },
      ];
    }

    case "audit": {
      const exceptions = aggregateExceptions(dataset.expenditure, filters, scope);
      const signals: ReportSignal[] = [];
      signals.push(
        exceptions.integrity_count > 0
          ? { level: "critical", label: `${exceptions.integrity_count} exceptions` }
          : { level: "on_track", label: "No integrity exceptions" },
      );
      if (exceptions.counts.unlinked_aop > 0) {
        signals.push({
          level: "investigate",
          label: `${exceptions.counts.unlinked_aop} unlinked to AOP`,
        });
      }
      return signals;
    }

    case "mbp": {
      const rows = aggregateBudgetVsActual(
        dataset.budgets,
        dataset.funding,
        dataset.expenditure,
        filters,
        scope,
      );
      const target = proRataTarget(filters.quarter);
      const offPace = rows.filter(
        (row) =>
          row.total_budget_amount > 0 &&
          row.budget_used_ratio !== null &&
          row.budget_used_ratio / target < 0.3,
      ).length;
      const composition = aggregateBudgetComposition(dataset.budgets, filters, scope);
      const overheadActual = categoryActual(dataset, filters, scope, "overhead");
      const signals: ReportSignal[] = [];
      if (offPace > 0) {
        signals.push({ level: "investigate", label: `${offPace} MDAs off pace` });
      }
      if ((composition?.other_recurrent_amount ?? 0) > 0 && overheadActual === 0) {
        signals.push({ level: "critical", label: "Overhead: ₦0 released" });
      }
      if (signals.length === 0) {
        signals.push({ level: "on_track", label: "On pace vs pro-rata" });
      }
      return signals;
    }

    default:
      return [];
  }
}
