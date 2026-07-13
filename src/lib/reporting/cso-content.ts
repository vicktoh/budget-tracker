/**
 * Content derivation for the CSO Accountability Brief: year-over-year figures
 * and auto-drafted narrative text. Auto-drafts are templated from the computed
 * findings and are meant to be edited per period by an admin — the saved
 * override, when present, always wins over these.
 */
import { aggregateYoyComparison } from "@/lib/reporting/aggregate";
import { multipleLabel, type Finding } from "@/lib/reporting/signals";
import { formatCompactNaira } from "@/lib/format";
import type { PublisherVoice } from "@/lib/db/report-publishers";
import type { ReportFilters, ReportingDataset } from "@/lib/reporting/types";

export type YoyFigureRow = {
  key: string;
  label: string;
  prior: number;
  current: number;
  changeLabel: string | null;
};

export type CsoYoy = {
  priorFiscalYear: number | null;
  rows: YoyFigureRow[];
  hasPrior: boolean;
};

export function buildCsoYoy(
  dataset: ReportingDataset,
  filters: ReportFilters,
): CsoYoy {
  const yoy = aggregateYoyComparison(dataset.budgets, dataset.expenditure, filters);
  const rows: YoyFigureRow[] = [
    {
      key: "budget",
      label: "Health approved budget",
      prior: yoy.prior_budget_amount,
      current: yoy.current_budget_amount,
      changeLabel: multipleLabel(yoy.budget_multiple),
    },
    {
      key: "actual",
      label: "Health actual spending",
      prior: yoy.prior_actual_amount,
      current: yoy.current_actual_amount,
      changeLabel: multipleLabel(yoy.actual_multiple),
    },
  ];
  return {
    priorFiscalYear: yoy.prior_fiscal_year,
    rows,
    hasPrior: yoy.prior_budget_amount > 0 || yoy.prior_actual_amount > 0,
  };
}

/* -------------------------------------------------------------------------- */
/* Auto-drafted narrative                                                     */
/* -------------------------------------------------------------------------- */

export const RECOMMENDATIONS_KEY = "recommendations";
export const WATCHLIST_KEY = "watchlist";

export function findingSectionKey(findingKey: string): string {
  return `finding:${findingKey}`;
}

function draftForFinding(finding: Finding): string {
  const head = `${finding.headline} ${finding.context}`;
  switch (finding.level) {
    case "critical":
      return `${head} — this needs attention. Government should publish a clear release schedule and criteria before the next quarter.`;
    case "investigate":
      return `${head}. Worth watching: confirm whether this reflects release timing or a structural gap.`;
    case "on_track":
      return `${head} — broadly on pace against the pro-rata benchmark.`;
    case "strong":
      return `${head} — performing ahead of the benchmark. Sustain the pace.`;
    default:
      return head;
  }
}

const RECOMMENDATIONS_HEADING: Record<PublisherVoice, string> = {
  watchdog: "Asks before next quarter",
  commitments: "Commitments before next quarter",
  neutral: "Recommendations",
};

export function recommendationsHeading(voice: PublisherVoice): string {
  return RECOMMENDATIONS_HEADING[voice];
}

function draftRecommendations(findings: Finding[], voice: PublisherVoice): string {
  const critical = findings.filter((f) => f.level === "critical");
  if (critical.length === 0) {
    return "No critical gaps this period. Maintain the current release cadence and reporting discipline.";
  }
  const verb = voice === "commitments" ? "Commit to address" : "Address";
  const items = critical.map((f) => `${f.title.toLowerCase()} (${f.headline})`).join("; ");
  return `${verb}: ${items}. Publish the release schedule and criteria so these can be tracked next quarter.`;
}

function draftWatchlist(findings: Finding[]): string {
  const watch = findings.filter((f) => f.level !== "strong");
  if (watch.length === 0) {
    return "All tracked indicators are performing to benchmark. Watch for sustained delivery next quarter.";
  }
  const items = watch.map((f) => f.title.toLowerCase()).join(", ");
  return `Indicators to watch next quarter: ${items}.`;
}

/** All auto-draft bodies keyed by section. Saved overrides replace these. */
export function buildCsoAutoDrafts(
  findings: Finding[],
  voice: PublisherVoice,
): Record<string, string> {
  const drafts: Record<string, string> = {};
  for (const finding of findings) {
    drafts[findingSectionKey(finding.key)] = draftForFinding(finding);
  }
  drafts[RECOMMENDATIONS_KEY] = draftRecommendations(findings, voice);
  drafts[WATCHLIST_KEY] = draftWatchlist(findings);
  return drafts;
}

/** Human labels for the verified-figures amounts. */
export function yoyAmount(amount: number): string {
  return amount === 0 ? "–" : formatCompactNaira(amount);
}
