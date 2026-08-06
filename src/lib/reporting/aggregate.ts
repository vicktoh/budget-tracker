import type {
  AopActivityLite,
  ApprovedBudgetLineLite,
  ApprovedBudgetLite,
  BudgetLineRevenueLite,
  ExpenditureEntryLite,
  MonthlyTrackingLite,
  FundingEntryLite,
  ReportFilters,
  ReportScope,
} from "@/lib/reporting/types";
import {
  ECONOMIC_CLASS_LABEL,
  ECONOMIC_CLASS_ORDER,
  classifyEntry,
  type EconomicClass,
} from "@/lib/reporting/economic-class";
import {
  HEALTH_SECTOR_OBJECTIVES,
  UNCLASSIFIED_OBJECTIVE,
  programmeSegment,
  resolveObjective,
} from "@/lib/reporting/health-sector-objectives";

/* -------------------------------------------------------------------------- */
/* Filtering                                                                  */
/* -------------------------------------------------------------------------- */

function withinScope(scope: ReportScope, mdaId: string): boolean {
  if (!scope.mdaIds) return true;
  return scope.mdaIds.includes(mdaId);
}

function withinDateRange(
  date: string,
  from: string | null,
  to: string | null,
): boolean {
  if (from && date < from) return false;
  if (to && date > to) return false;
  return true;
}

export function filterFunding(
  rows: FundingEntryLite[],
  filters: ReportFilters,
  scope: ReportScope = {},
): FundingEntryLite[] {
  return rows.filter((row) => {
    if (!withinScope(scope, row.mda_id)) return false;
    if (filters.fiscalYear !== null && row.fiscal_year !== filters.fiscalYear) return false;
    if (filters.quarter !== null && row.quarter !== filters.quarter) return false;
    if (!withinDateRange(row.transaction_date, filters.dateFrom, filters.dateTo)) return false;
    if (filters.mdaId && row.mda_id !== filters.mdaId) return false;
    if (filters.programmeAreaId && row.programme_area_id !== filters.programmeAreaId) return false;
    if (filters.fundingSourceId && row.funding_source_id !== filters.fundingSourceId) return false;
    return true;
  });
}

export function filterExpenditure(
  rows: ExpenditureEntryLite[],
  filters: ReportFilters,
  scope: ReportScope = {},
): ExpenditureEntryLite[] {
  return rows.filter((row) => {
    if (!withinScope(scope, row.mda_id)) return false;
    if (filters.fiscalYear !== null && row.fiscal_year !== filters.fiscalYear) return false;
    if (filters.quarter !== null && row.quarter !== filters.quarter) return false;
    if (!withinDateRange(row.transaction_date, filters.dateFrom, filters.dateTo)) return false;
    if (filters.mdaId && row.mda_id !== filters.mdaId) return false;
    if (filters.programmeAreaId && row.programme_area_id !== filters.programmeAreaId) return false;
    if (
      filters.expenditureCategoryId &&
      row.expenditure_category_id !== filters.expenditureCategoryId
    ) {
      return false;
    }
    if (filters.phc === "yes" && !row.is_phc) return false;
    if (filters.phc === "no" && row.is_phc) return false;
    if (filters.lgaId && row.lga_id !== filters.lgaId) return false;
    if (filters.facilityId && row.facility_id !== filters.facilityId) return false;
    if (
      filters.fundingSourceId &&
      !row.funding_allocations.some(
        (allocation) => allocation.funding_source_id === filters.fundingSourceId,
      )
    ) {
      return false;
    }
    return true;
  });
}

function filterBudgets(
  rows: ApprovedBudgetLite[],
  filters: ReportFilters,
  scope: ReportScope,
): ApprovedBudgetLite[] {
  return rows.filter((row) => {
    if (!withinScope(scope, row.mda_id)) return false;
    if (filters.fiscalYear !== null && row.fiscal_year !== filters.fiscalYear) return false;
    if (filters.mdaId && row.mda_id !== filters.mdaId) return false;
    return true;
  });
}

function filterAop(
  rows: AopActivityLite[],
  filters: ReportFilters,
  scope: ReportScope,
): AopActivityLite[] {
  return rows.filter((row) => {
    if (!withinScope(scope, row.mda_id)) return false;
    if (filters.fiscalYear !== null && row.fiscal_year !== filters.fiscalYear) return false;
    if (filters.mdaId && row.mda_id !== filters.mdaId) return false;
    return row.active;
  });
}

/* -------------------------------------------------------------------------- */
/* Aggregations                                                               */
/* -------------------------------------------------------------------------- */

export type EntrySummaryReport = {
  fundingCount: number;
  expenditureCount: number;
  totalFunding: number;
  totalExpenditure: number;
};

export type MdaReportingCoverageRow = {
  mda_id: string;
  mda_name: string;
  funding_amount: number;
  funding_entry_count: number;
  expenditure_amount: number;
  expenditure_entry_count: number;
  personnel_amount: number;
  personnel_entry_count: number;
  overhead_amount: number;
  overhead_entry_count: number;
  capital_amount: number;
  capital_entry_count: number;
  latest_entry_date: string | null;
  status: "complete" | "partial" | "missing";
  gaps: Array<"Funding entries" | "Expenditure entries">;
};

/**
 * Treats the presence of both ledger types as the baseline reporting signal
 * for an MDA in the selected period. This is an operational coverage signal,
 * not an approval state: entries remain reportable immediately on submission.
 */
export function aggregateMdaReportingCoverage(
  mdas: Array<{ id: string; name: string }>,
  funding: FundingEntryLite[],
  expenditure: ExpenditureEntryLite[],
  filters: ReportFilters,
  scope: ReportScope = {},
): MdaReportingCoverageRow[] {
  const visibleMdas = mdas.filter(
    (mda) =>
      withinScope(scope, mda.id) &&
      (filters.mdaId === null || filters.mdaId === mda.id),
  );
  const filteredFunding = filterFunding(funding, filters, scope);
  const filteredExpenditure = filterExpenditure(expenditure, filters, scope);

  return visibleMdas
    .map<MdaReportingCoverageRow>((mda) => {
      const fundingRows = filteredFunding.filter((row) => row.mda_id === mda.id);
      const expenditureRows = filteredExpenditure.filter(
        (row) => row.mda_id === mda.id,
      );
      const economicClasses = expenditureRows.reduce(
        (totals, row) => {
          const economicClass = classifyEntry(row);
          if (economicClass !== "other") {
            totals[economicClass].amount += expenditureAmountForFilters(row, filters);
            totals[economicClass].count += 1;
          }
          return totals;
        },
        {
          personnel: { amount: 0, count: 0 },
          overhead: { amount: 0, count: 0 },
          capital: { amount: 0, count: 0 },
        },
      );
      const gaps: MdaReportingCoverageRow["gaps"] = [];
      if (fundingRows.length === 0) gaps.push("Funding entries");
      if (expenditureRows.length === 0) gaps.push("Expenditure entries");

      const latestEntryDate = [...fundingRows, ...expenditureRows].reduce<
        string | null
      >(
        (latest, row) =>
          latest === null || row.transaction_date > latest
            ? row.transaction_date
            : latest,
        null,
      );

      return {
        mda_id: mda.id,
        mda_name: mda.name,
        funding_amount: fundingRows.reduce((sum, row) => sum + row.amount, 0),
        funding_entry_count: fundingRows.length,
        expenditure_amount: expenditureRows.reduce(
          (sum, row) => sum + expenditureAmountForFilters(row, filters),
          0,
        ),
        expenditure_entry_count: expenditureRows.length,
        personnel_amount: economicClasses.personnel.amount,
        personnel_entry_count: economicClasses.personnel.count,
        overhead_amount: economicClasses.overhead.amount,
        overhead_entry_count: economicClasses.overhead.count,
        capital_amount: economicClasses.capital.amount,
        capital_entry_count: economicClasses.capital.count,
        latest_entry_date: latestEntryDate,
        status:
          gaps.length === 0 ? "complete" : gaps.length === 2 ? "missing" : "partial",
        gaps,
      };
    })
    .sort(
      (a, b) =>
        coverageStatusOrder(a.status) - coverageStatusOrder(b.status) ||
        a.mda_name.localeCompare(b.mda_name),
    );
}

function coverageStatusOrder(status: MdaReportingCoverageRow["status"]): number {
  if (status === "missing") return 0;
  if (status === "partial") return 1;
  return 2;
}

export function aggregateEntrySummary(
  funding: FundingEntryLite[],
  expenditure: ExpenditureEntryLite[],
  filters: ReportFilters,
  scope: ReportScope = {},
): EntrySummaryReport {
  const f = filterFunding(funding, filters, scope);
  const e = filterExpenditure(expenditure, filters, scope);
  return {
    fundingCount: f.length,
    expenditureCount: e.length,
    totalFunding: f.reduce((sum, row) => sum + row.amount, 0),
    totalExpenditure: e.reduce((sum, row) => sum + expenditureAmountForFilters(row, filters), 0),
  };
}

export type BudgetVsActualRow = {
  mda_id: string;
  mda_name: string;
  fiscal_year: number;
  total_budget_amount: number;
  total_funding_amount: number;
  total_expenditure_amount: number;
  budget_balance_amount: number;
  budget_used_ratio: number | null;
};

export function aggregateBudgetVsActual(
  budgets: ApprovedBudgetLite[],
  funding: FundingEntryLite[],
  expenditure: ExpenditureEntryLite[],
  filters: ReportFilters,
  scope: ReportScope = {},
): BudgetVsActualRow[] {
  const filteredBudgets = filterBudgets(budgets, filters, scope);
  const filteredFunding = filterFunding(funding, filters, scope);
  const filteredExpenditure = filterExpenditure(expenditure, filters, scope);

  const fundingByKey = new Map<string, number>();
  for (const row of filteredFunding) {
    const key = `${row.mda_id}::${row.fiscal_year}`;
    fundingByKey.set(key, (fundingByKey.get(key) ?? 0) + row.amount);
  }
  const expenditureByKey = new Map<string, number>();
  for (const row of filteredExpenditure) {
    const key = `${row.mda_id}::${row.fiscal_year}`;
    expenditureByKey.set(
      key,
      (expenditureByKey.get(key) ?? 0) + expenditureAmountForFilters(row, filters),
    );
  }

  return filteredBudgets
    .map((budget) => {
      const key = `${budget.mda_id}::${budget.fiscal_year}`;
      const fundingTotal = fundingByKey.get(key) ?? 0;
      const expenditureTotal = expenditureByKey.get(key) ?? 0;
      const ratio =
        budget.total_budget_amount === 0
          ? null
          : expenditureTotal / budget.total_budget_amount;
      return {
        mda_id: budget.mda_id,
        mda_name: budget.mda_name,
        fiscal_year: budget.fiscal_year,
        total_budget_amount: budget.total_budget_amount,
        total_funding_amount: fundingTotal,
        total_expenditure_amount: expenditureTotal,
        budget_balance_amount: budget.total_budget_amount - expenditureTotal,
        budget_used_ratio: ratio,
      };
    })
    .sort(
      (a, b) =>
        b.fiscal_year - a.fiscal_year ||
        a.mda_name.localeCompare(b.mda_name),
    );
}

export type FundingBySourceRow = {
  funding_source_id: string;
  funding_source_name: string;
  total_amount: number;
  entry_count: number;
};

export function aggregateFundingBySource(
  funding: FundingEntryLite[],
  filters: ReportFilters,
  scope: ReportScope = {},
): FundingBySourceRow[] {
  const filtered = filterFunding(funding, filters, scope);
  const groups = new Map<string, FundingBySourceRow>();
  for (const row of filtered) {
    const existing = groups.get(row.funding_source_id);
    if (existing) {
      existing.total_amount += row.amount;
      existing.entry_count += 1;
    } else {
      groups.set(row.funding_source_id, {
        funding_source_id: row.funding_source_id,
        funding_source_name: row.funding_source_name,
        total_amount: row.amount,
        entry_count: 1,
      });
    }
  }
  return Array.from(groups.values()).sort(
    (a, b) => b.total_amount - a.total_amount,
  );
}

export type ExpenditureByCategoryRow = {
  expenditure_category_id: string;
  expenditure_category_name: string;
  total_amount: number;
  entry_count: number;
};

export function aggregateExpenditureByCategory(
  expenditure: ExpenditureEntryLite[],
  filters: ReportFilters,
  scope: ReportScope = {},
): ExpenditureByCategoryRow[] {
  const filtered = filterExpenditure(expenditure, filters, scope);
  const groups = new Map<string, ExpenditureByCategoryRow>();
  for (const row of filtered) {
    const existing = groups.get(row.expenditure_category_id);
    if (existing) {
      existing.total_amount += row.amount;
      existing.entry_count += 1;
    } else {
      groups.set(row.expenditure_category_id, {
        expenditure_category_id: row.expenditure_category_id,
        expenditure_category_name: row.expenditure_category_name,
        total_amount: row.amount,
        entry_count: 1,
      });
    }
  }
  return Array.from(groups.values()).sort(
    (a, b) => b.total_amount - a.total_amount,
  );
}

export type ExpenditureByFundingSourceRow = {
  funding_source_id: string;
  funding_source_name: string;
  total_amount: number;
  entry_count: number;
};

function expenditureAmountForFilters(
  row: ExpenditureEntryLite,
  filters: ReportFilters,
): number {
  if (!filters.fundingSourceId) return row.amount;
  return row.funding_allocations
    .filter(
      (allocation) => allocation.funding_source_id === filters.fundingSourceId,
    )
    .reduce((sum, allocation) => sum + allocation.amount, 0);
}

export function aggregateExpenditureByFundingSource(
  expenditure: ExpenditureEntryLite[],
  filters: ReportFilters,
  scope: ReportScope = {},
): ExpenditureByFundingSourceRow[] {
  const filtered = filterExpenditure(expenditure, filters, scope);
  const groups = new Map<string, ExpenditureByFundingSourceRow>();
  for (const row of filtered) {
    const allocations = filters.fundingSourceId
      ? row.funding_allocations.filter(
          (allocation) => allocation.funding_source_id === filters.fundingSourceId,
        )
      : row.funding_allocations;

    for (const allocation of allocations) {
      const existing = groups.get(allocation.funding_source_id);
      if (existing) {
        existing.total_amount += allocation.amount;
      } else {
        groups.set(allocation.funding_source_id, {
          funding_source_id: allocation.funding_source_id,
          funding_source_name: allocation.funding_source_name,
          total_amount: allocation.amount,
          entry_count: 0,
        });
      }
    }

    const touchedSources = new Set(
      allocations.map((allocation) => allocation.funding_source_id),
    );
    for (const sourceId of touchedSources) {
      const group = groups.get(sourceId);
      if (group) group.entry_count += 1;
    }
  }
  return Array.from(groups.values()).sort(
    (a, b) => b.total_amount - a.total_amount,
  );
}

export type HealthSectorObjectiveRow = {
  /** Four-digit programme segment, or "unclassified". */
  code: string;
  label: string;
  description: string;
  actual_amount: number;
  entry_count: number;
  /** Share of the report's total expenditure. Null when nothing was spent. */
  share_of_total: number | null;
};

/**
 * Splits actual expenditure across the state's health sector objectives —
 * the BPR dashboard's "Expenditure by Health Sector Objectives (Programme
 * Segment Level)" view.
 *
 * The segment comes from the bound budget line's programme code, so entries
 * with no bound line land in an explicit `unclassified` bucket rather than
 * silently vanishing. Objectives with no spend are kept (with zero) so the
 * report shows which parts of the strategy attracted nothing.
 */
export function aggregateHealthSectorObjectives(
  expenditure: ExpenditureEntryLite[],
  filters: ReportFilters,
  scope: ReportScope = {},
): HealthSectorObjectiveRow[] {
  const filtered = actualExpenditure(expenditure, filters, scope);

  const totals = new Map<string, { amount: number; count: number }>();
  for (const row of filtered) {
    const objective = resolveObjective(row.programme_code) ?? UNCLASSIFIED_OBJECTIVE;
    const existing = totals.get(objective.code);
    if (existing) {
      existing.amount += row.amount;
      existing.count += 1;
    } else {
      totals.set(objective.code, { amount: row.amount, count: 1 });
    }
  }

  const grandTotal = sumAmounts(filtered);
  const toRow = (
    objective: { code: string; label: string; description: string },
  ): HealthSectorObjectiveRow => {
    const hit = totals.get(objective.code);
    const amount = hit?.amount ?? 0;
    return {
      code: objective.code,
      label: objective.label,
      description: objective.description,
      actual_amount: amount,
      entry_count: hit?.count ?? 0,
      share_of_total: grandTotal === 0 ? null : amount / grandTotal,
    };
  };

  const rows = HEALTH_SECTOR_OBJECTIVES.map(toRow);
  // Only show the unclassified bucket when it actually holds something.
  if (totals.has(UNCLASSIFIED_OBJECTIVE.code)) {
    rows.push(toRow(UNCLASSIFIED_OBJECTIVE));
  }
  return rows;
}

export type PhcProgrammeClassificationRow = {
  row_id: string;
  code: string | null;
  programme_name: string;
  budget_amount: number;
  quarter_actual: number;
  ytd_actual: number;
  performance_rate: number | null;
  balance_amount: number;
};

type ProgrammeAmounts = {
  budget: number;
  quarter: number;
  ytd: number;
};

const emptyProgrammeAmounts = (): ProgrammeAmounts => ({
  budget: 0,
  quarter: 0,
  ytd: 0,
});

function addProgrammeAmounts(
  target: ProgrammeAmounts,
  source: ProgrammeAmounts,
): ProgrammeAmounts {
  target.budget += source.budget;
  target.quarter += source.quarter;
  target.ytd += source.ytd;
  return target;
}

function phcProgrammeName(code: string): string {
  if (code === "unclassified") return "Unclassified programme";
  return resolveObjective(code)?.description ?? `Programme ${code}`;
}

function toPhcProgrammeRow(
  rowId: string,
  code: string | null,
  programmeName: string,
  amounts: ProgrammeAmounts,
): PhcProgrammeClassificationRow {
  return {
    row_id: rowId,
    code,
    programme_name: programmeName,
    budget_amount: amounts.budget,
    quarter_actual: amounts.quarter,
    ytd_actual: amounts.ytd,
    performance_rate: amounts.budget === 0 ? null : amounts.ytd / amounts.budget,
    balance_amount: amounts.budget - amounts.ytd,
  };
}

/**
 * Reproduces BIR Table 22 from the official NCOA programme dimension.
 *
 * Section 3 is the PHCMB non-personnel envelope, not the full PHCMB MDA and
 * not facility-level `is_phc` spend. Linked actuals inherit the first four
 * digits of their approved line's programme code. When an aggregate actual is
 * unlinked, it may be assigned only when the eligible budget has exactly one
 * programme segment; otherwise it remains visibly unclassified.
 */
export function aggregatePhcProgrammeClassification(
  budgetLines: ApprovedBudgetLineLite[],
  expenditure: ExpenditureEntryLite[],
  filters: ReportFilters,
  phcmbMdaId: string,
): PhcProgrammeClassificationRow[] {
  const fiscalYear = filters.fiscalYear;
  if (fiscalYear === null) return [];

  const eligibleLines = budgetLines.filter(
    (line) =>
      line.fiscal_year === fiscalYear &&
      line.mda_id === phcmbMdaId &&
      line.budget_class !== "personnel",
  );
  const programmeSegments = new Set(
    eligibleLines
      .map((line) => programmeSegment(line.programme_code))
      .filter((code): code is string => code !== null),
  );
  const soleProgrammeSegment =
    programmeSegments.size === 1 ? Array.from(programmeSegments)[0] : null;

  const byProgramme = new Map<string, ProgrammeAmounts>();
  const getBucket = (code: string): ProgrammeAmounts => {
    const existing = byProgramme.get(code);
    if (existing) return existing;
    const created = emptyProgrammeAmounts();
    byProgramme.set(code, created);
    return created;
  };

  for (const line of eligibleLines) {
    const code = programmeSegment(line.programme_code) ?? "unclassified";
    getBucket(code).budget += line.approved_amount;
  }

  const selectedQuarter = filters.quarter;
  const eligibleActuals = expenditure.filter(
    (row) =>
      row.fiscal_year === fiscalYear &&
      row.mda_id === phcmbMdaId &&
      classifyEntry(row) !== "personnel",
  );

  for (const row of eligibleActuals) {
    const code =
      programmeSegment(row.programme_code) ??
      soleProgrammeSegment ??
      "unclassified";
    const bucket = getBucket(code);
    if (selectedQuarter === null || row.quarter === selectedQuarter) {
      bucket.quarter += row.amount;
    }
    if (selectedQuarter === null || row.quarter <= selectedQuarter) {
      bucket.ytd += row.amount;
    }
  }

  const detailRows = Array.from(byProgramme.entries())
    .filter(([, amounts]) => amounts.budget !== 0 || amounts.quarter !== 0 || amounts.ytd !== 0)
    .sort(([left], [right]) => {
      if (left === "unclassified") return 1;
      if (right === "unclassified") return -1;
      return left.localeCompare(right);
    });

  const total = detailRows.reduce(
    (sum, [, amounts]) => addProgrammeAmounts(sum, amounts),
    emptyProgrammeAmounts(),
  );
  const health = detailRows
    .filter(([code]) => code.startsWith("04"))
    .reduce(
      (sum, [, amounts]) => addProgrammeAmounts(sum, amounts),
      emptyProgrammeAmounts(),
    );

  return [
    toPhcProgrammeRow("total", null, "Total expenditure", total),
    toPhcProgrammeRow("sector-04", "04", "Health", health),
    ...detailRows.map(([code, amounts]) =>
      toPhcProgrammeRow(`programme-${code}`, code, phcProgrammeName(code), amounts),
    ),
  ];
}

/* -------------------------------------------------------------------------- */
/* MDA scorecards (official BPR + monthly tracking reconciliation)            */
/* -------------------------------------------------------------------------- */

/**
 * How a component's monthly tracking squares with the official BPR figure.
 * The published BPR stays authoritative; verdicts exist to make disagreement
 * visible, not to pick a winner. Comparison is H1-total vs H1-total on
 * purpose — the sources routinely agree on the total while disagreeing about
 * which quarter it belongs to.
 */
export type TrackingVerdict =
  | "matches" // tracked total agrees with the official figure (±1% or ±₦1m)
  | "differs" // both sources have figures and they disagree
  | "untracked_spend" // official spend exists, tracking sheet shows (almost) none
  | "tracking_only" // tracking has figures the official BPR doesn't
  | "no_data"; // neither source has anything

export type MonthCell = {
  month: number;
  /** null = nothing submitted for the month; 0 = explicitly reported zero. */
  amount: number | null;
};

export type MdaComponentScore = {
  budget_class: EconomicClass;
  label: string;
  approved_amount: number;
  official_amount: number;
  official_q1: number;
  official_q2: number;
  tracked_amount: number;
  /** One cell per month from January to the dataset's horizon. */
  months: MonthCell[];
  verdict: TrackingVerdict;
  /** Official / approved. Null when nothing was approved. */
  burn_rate: number | null;
  /** Official Q1 > 0 but Q2 = 0 — active then silent, worth chasing. */
  q2_silent: boolean;
};

export type MdaScorecard = {
  mda_id: string;
  mda_name: string;
  approved_total: number;
  official_total: number;
  tracked_total: number;
  burn_rate: number | null;
  components: MdaComponentScore[];
  /** Months (1-12) where this MDA submitted at least one tracking figure. */
  months_reported: number[];
};

const COMPONENT_ORDER: EconomicClass[] = ["personnel", "overhead", "capital", "other"];

function verdictFor(official: number, tracked: number): TrackingVerdict {
  const NEAR_ZERO = 1_000_000;
  const officialLive = Math.abs(official) > NEAR_ZERO;
  const trackedLive = Math.abs(tracked) > NEAR_ZERO;
  if (!officialLive && !trackedLive) return "no_data";
  if (officialLive && !trackedLive) return "untracked_spend";
  if (!officialLive && trackedLive) return "tracking_only";
  const delta = Math.abs(official - tracked);
  if (delta <= NEAR_ZERO || delta / Math.max(Math.abs(official), 1) <= 0.01) {
    return "matches";
  }
  return "differs";
}

/**
 * Builds one card per MDA: approved budget, official BPR actuals (split
 * Q1/Q2), monthly tracking cells, and a per-component reconciliation verdict.
 * Sorted by burn rate descending, so callers slice the top and bottom of the
 * list directly for best/worst views.
 *
 * The quarter filter is intentionally NOT applied to the official/tracked
 * totals — the card's story is the year so far; quarter granularity is
 * presented inside the card instead.
 */
export function aggregateMdaScorecards(
  budgets: ApprovedBudgetLite[],
  expenditure: ExpenditureEntryLite[],
  monthly: MonthlyTrackingLite[],
  filters: ReportFilters,
  scope: ReportScope = {},
): MdaScorecard[] {
  const yearFilters: ReportFilters = { ...filters, quarter: null };
  const filteredBudgets = filterBudgets(budgets, yearFilters, scope);
  const filteredExpenditure = filterExpenditure(expenditure, yearFilters, scope);
  const filteredMonthly = monthly.filter((row) => {
    if (!withinScope(scope, row.mda_id)) return false;
    if (yearFilters.fiscalYear !== null && row.fiscal_year !== yearFilters.fiscalYear) return false;
    if (yearFilters.mdaId && row.mda_id !== yearFilters.mdaId) return false;
    return true;
  });

  // The tracker renders January up to the latest month any MDA reported, so
  // the display grows on its own when July data lands.
  const monthHorizon = Math.max(6, ...filteredMonthly.map((row) => row.month));

  type Bucket = {
    official: number;
    officialQ1: number;
    officialQ2: number;
    tracked: number;
    // month -> summed amount; presence means "submitted", even at zero.
    monthAmounts: Map<number, number>;
  };
  const emptyBucket = (): Bucket => ({
    official: 0,
    officialQ1: 0,
    officialQ2: 0,
    tracked: 0,
    monthAmounts: new Map(),
  });

  const byMda = new Map<string, { name: string; classes: Map<EconomicClass, Bucket> }>();
  const ensure = (mdaId: string, name: string, cls: EconomicClass): Bucket => {
    let mda = byMda.get(mdaId);
    if (!mda) {
      mda = { name, classes: new Map() };
      byMda.set(mdaId, mda);
    }
    if (name && !mda.name) mda.name = name;
    let bucket = mda.classes.get(cls);
    if (!bucket) {
      bucket = emptyBucket();
      mda.classes.set(cls, bucket);
    }
    return bucket;
  };

  for (const row of filteredExpenditure) {
    const bucket = ensure(row.mda_id, row.mda_name, classifyEntry(row));
    bucket.official += row.amount;
    if (row.quarter === 1) bucket.officialQ1 += row.amount;
    if (row.quarter === 2) bucket.officialQ2 += row.amount;
  }
  for (const row of filteredMonthly) {
    const bucket = ensure(row.mda_id, row.mda_name, row.budget_class);
    bucket.tracked += row.amount;
    bucket.monthAmounts.set(row.month, (bucket.monthAmounts.get(row.month) ?? 0) + row.amount);
  }

  const approvedByMda = new Map(filteredBudgets.map((budget) => [budget.mda_id, budget]));
  // Budgets can exist for MDAs with no activity at all; include them so the
  // "least performing" view can show untouched budgets.
  for (const budget of filteredBudgets) {
    if (!byMda.has(budget.mda_id)) {
      byMda.set(budget.mda_id, { name: budget.mda_name, classes: new Map() });
    }
  }

  const approvedForClass = (
    budget: ApprovedBudgetLite | undefined,
    cls: EconomicClass,
  ): number => {
    if (!budget) return 0;
    if (cls === "personnel") return budget.personnel_amount;
    if (cls === "overhead") return budget.other_recurrent_amount;
    if (cls === "capital") return budget.capital_amount;
    return 0;
  };

  const cards: MdaScorecard[] = [];
  for (const [mdaId, mda] of byMda) {
    const budget = approvedByMda.get(mdaId);
    const components: MdaComponentScore[] = [];
    for (const cls of COMPONENT_ORDER) {
      const bucket = mda.classes.get(cls);
      const approved = approvedForClass(budget, cls);
      if (!bucket && approved === 0) continue;
      const official = bucket?.official ?? 0;
      const tracked = bucket?.tracked ?? 0;
      const months: MonthCell[] = [];
      for (let month = 1; month <= monthHorizon; month += 1) {
        const amount = bucket?.monthAmounts.get(month);
        months.push({ month, amount: amount === undefined ? null : amount });
      }
      components.push({
        budget_class: cls,
        label: ECONOMIC_CLASS_LABEL[cls],
        approved_amount: approved,
        official_amount: official,
        official_q1: bucket?.officialQ1 ?? 0,
        official_q2: bucket?.officialQ2 ?? 0,
        tracked_amount: tracked,
        months,
        verdict: verdictFor(official, tracked),
        burn_rate: approved === 0 ? null : official / approved,
        q2_silent: (bucket?.officialQ1 ?? 0) > 0 && (bucket?.officialQ2 ?? 0) === 0,
      });
    }
    if (components.length === 0) continue;

    const approvedTotal = components.reduce((sum, c) => sum + c.approved_amount, 0);
    const officialTotal = components.reduce((sum, c) => sum + c.official_amount, 0);
    const trackedTotal = components.reduce((sum, c) => sum + c.tracked_amount, 0);
    const monthsReported = new Set<number>();
    for (const component of components) {
      for (const cell of component.months) {
        if (cell.amount !== null) monthsReported.add(cell.month);
      }
    }
    cards.push({
      mda_id: mdaId,
      mda_name: mda.name,
      approved_total: approvedTotal,
      official_total: officialTotal,
      tracked_total: trackedTotal,
      burn_rate: approvedTotal === 0 ? null : officialTotal / approvedTotal,
      components,
      months_reported: Array.from(monthsReported).sort((a, b) => a - b),
    });
  }

  return cards.sort(
    (a, b) =>
      (b.burn_rate ?? -1) - (a.burn_rate ?? -1) ||
      b.approved_total - a.approved_total,
  );
}

/* -------------------------------------------------------------------------- */
/* Revenue (budget_line_revenues — the money side the ledger doesn't model)   */
/* -------------------------------------------------------------------------- */

function filterRevenues(
  rows: BudgetLineRevenueLite[],
  filters: ReportFilters,
  scope: ReportScope,
): BudgetLineRevenueLite[] {
  return rows.filter((row) => {
    if (!withinScope(scope, row.mda_id)) return false;
    if (filters.fiscalYear !== null && row.fiscal_year !== filters.fiscalYear) return false;
    if (filters.mdaId && row.mda_id !== filters.mdaId) return false;
    return true;
  });
}

/**
 * Collections on a revenue line for the selected period. A null quarter means
 * year-to-date (every quarter recorded so far), matching how the BPR reports.
 */
function collectedAmount(
  row: BudgetLineRevenueLite,
  quarter: number | null,
): number {
  let total = 0;
  for (const actual of row.actuals) {
    if (quarter !== null && actual.quarter !== quarter) continue;
    total += actual.amount;
  }
  return total;
}

export type RevenueStream = "recurrent" | "capital_receipt";

export const REVENUE_STREAM_LABEL: Record<RevenueStream, string> = {
  recurrent: "Recurrent revenue",
  capital_receipt: "Capital receipts",
};

export type RevenuePerformanceRow = {
  stream: RevenueStream | "total";
  label: string;
  budget_amount: number;
  actual_amount: number;
  /** Collected minus budgeted. Negative means a shortfall. */
  variance_amount: number;
  /** Collected / budgeted. Null when nothing was budgeted. */
  performance_rate: number | null;
};

/** Revenue collected against the approved revenue budget, split by stream. */
export function aggregateRevenuePerformance(
  revenues: BudgetLineRevenueLite[],
  filters: ReportFilters,
  scope: ReportScope = {},
): RevenuePerformanceRow[] {
  const filtered = filterRevenues(revenues, filters, scope);
  const streams: RevenueStream[] = ["recurrent", "capital_receipt"];

  const rows = streams.map<RevenuePerformanceRow>((stream) => {
    const inStream = filtered.filter((row) => row.stream === stream);
    const budget = inStream.reduce((sum, row) => sum + row.approved_amount, 0);
    const actual = inStream.reduce(
      (sum, row) => sum + collectedAmount(row, filters.quarter),
      0,
    );
    return {
      stream,
      label: REVENUE_STREAM_LABEL[stream],
      budget_amount: budget,
      actual_amount: actual,
      variance_amount: actual - budget,
      performance_rate: budget === 0 ? null : actual / budget,
    };
  });

  const budgetTotal = rows.reduce((sum, row) => sum + row.budget_amount, 0);
  const actualTotal = rows.reduce((sum, row) => sum + row.actual_amount, 0);
  rows.push({
    stream: "total",
    label: "Total revenue",
    budget_amount: budgetTotal,
    actual_amount: actualTotal,
    variance_amount: actualTotal - budgetTotal,
    performance_rate: budgetTotal === 0 ? null : actualTotal / budgetTotal,
  });
  return rows;
}

export type RevenueCompositionRow = {
  economic_code: string;
  economic_description: string;
  stream: RevenueStream;
  actual_amount: number;
  share_of_total: number | null;
};

/**
 * Revenue actually collected, by economic code — the composition pie on the
 * BPR dashboard. Lines that collected nothing are dropped; a composition chart
 * of zeroes is noise.
 */
export function aggregateRevenueComposition(
  revenues: BudgetLineRevenueLite[],
  filters: ReportFilters,
  scope: ReportScope = {},
): RevenueCompositionRow[] {
  const filtered = filterRevenues(revenues, filters, scope);
  const groups = new Map<string, RevenueCompositionRow>();
  let grandTotal = 0;

  for (const row of filtered) {
    const amount = collectedAmount(row, filters.quarter);
    if (amount === 0) continue;
    grandTotal += amount;
    const existing = groups.get(row.economic_code);
    if (existing) {
      existing.actual_amount += amount;
    } else {
      groups.set(row.economic_code, {
        economic_code: row.economic_code,
        economic_description: row.economic_description,
        stream: row.stream,
        actual_amount: amount,
        share_of_total: null,
      });
    }
  }

  return Array.from(groups.values())
    .map((row) => ({
      ...row,
      share_of_total: grandTotal === 0 ? null : row.actual_amount / grandTotal,
    }))
    .sort((a, b) => b.actual_amount - a.actual_amount);
}

export type ProgrammeAreaSummaryRow = {
  programme_area_id: string;
  programme_area_name: string;
  total_funding_amount: number;
  total_expenditure_amount: number;
  /** Funding minus expenditure. Negative means overspend vs received funding. */
  gap_amount: number;
};

export function aggregateProgrammeAreaSummary(
  funding: FundingEntryLite[],
  expenditure: ExpenditureEntryLite[],
  filters: ReportFilters,
  scope: ReportScope = {},
): ProgrammeAreaSummaryRow[] {
  const filteredFunding = filterFunding(funding, filters, scope);
  const filteredExpenditure = filterExpenditure(expenditure, filters, scope);

  const groups = new Map<
    string,
    { programme_area_id: string; programme_area_name: string; funding: number; expenditure: number }
  >();
  for (const row of filteredFunding) {
    const existing = groups.get(row.programme_area_id);
    if (existing) {
      existing.funding += row.amount;
    } else {
      groups.set(row.programme_area_id, {
        programme_area_id: row.programme_area_id,
        programme_area_name: row.programme_area_name,
        funding: row.amount,
        expenditure: 0,
      });
    }
  }
  for (const row of filteredExpenditure) {
    const existing = groups.get(row.programme_area_id);
    if (existing) {
      existing.expenditure += row.amount;
    } else {
      groups.set(row.programme_area_id, {
        programme_area_id: row.programme_area_id,
        programme_area_name: row.programme_area_name,
        funding: 0,
        expenditure: row.amount,
      });
    }
  }
  return Array.from(groups.values())
    .map((row) => ({
      programme_area_id: row.programme_area_id,
      programme_area_name: row.programme_area_name,
      total_funding_amount: row.funding,
      total_expenditure_amount: row.expenditure,
      gap_amount: row.funding - row.expenditure,
    }))
    .sort((a, b) => b.total_expenditure_amount - a.total_expenditure_amount);
}

export type PhcLgaSummaryRow = {
  lga_id: string;
  lga_name: string;
  total_expenditure_amount: number;
  entry_count: number;
};

export function aggregatePhcLgaSummary(
  expenditure: ExpenditureEntryLite[],
  filters: ReportFilters,
  scope: ReportScope = {},
): PhcLgaSummaryRow[] {
  const phcFilters: ReportFilters = { ...filters, phc: "yes" };
  const filtered = filterExpenditure(expenditure, phcFilters, scope);
  const groups = new Map<string, PhcLgaSummaryRow>();
  for (const row of filtered) {
    if (!row.lga_id || !row.lga_name) continue;
    const existing = groups.get(row.lga_id);
    if (existing) {
      existing.total_expenditure_amount += row.amount;
      existing.entry_count += 1;
    } else {
      groups.set(row.lga_id, {
        lga_id: row.lga_id,
        lga_name: row.lga_name,
        total_expenditure_amount: row.amount,
        entry_count: 1,
      });
    }
  }
  return Array.from(groups.values()).sort(
    (a, b) => b.total_expenditure_amount - a.total_expenditure_amount,
  );
}

export type PhcFacilitySummaryRow = {
  lga_id: string;
  lga_name: string;
  facility_id: string;
  facility_name: string;
  total_expenditure_amount: number;
  entry_count: number;
};

export function aggregatePhcFacilitySummary(
  expenditure: ExpenditureEntryLite[],
  filters: ReportFilters,
  scope: ReportScope = {},
): PhcFacilitySummaryRow[] {
  const phcFilters: ReportFilters = { ...filters, phc: "yes" };
  const filtered = filterExpenditure(expenditure, phcFilters, scope);
  const groups = new Map<string, PhcFacilitySummaryRow>();
  for (const row of filtered) {
    if (!row.lga_id || !row.lga_name || !row.facility_id || !row.facility_name) continue;
    const existing = groups.get(row.facility_id);
    if (existing) {
      existing.total_expenditure_amount += row.amount;
      existing.entry_count += 1;
    } else {
      groups.set(row.facility_id, {
        lga_id: row.lga_id,
        lga_name: row.lga_name,
        facility_id: row.facility_id,
        facility_name: row.facility_name,
        total_expenditure_amount: row.amount,
        entry_count: 1,
      });
    }
  }
  return Array.from(groups.values()).sort(
    (a, b) => b.total_expenditure_amount - a.total_expenditure_amount,
  );
}

export type AopPlannedVsActualRow = {
  aop_activity_id: string;
  activity_code: string;
  description: string;
  mda_id: string;
  mda_name: string;
  fiscal_year: number;
  budgeted_cost: number;
  linked_expenditure_amount: number;
  remaining_amount: number;
};

export function aggregateAopPlannedVsActual(
  aopActivities: AopActivityLite[],
  expenditure: ExpenditureEntryLite[],
  filters: ReportFilters,
  scope: ReportScope = {},
): AopPlannedVsActualRow[] {
  const filteredAop = filterAop(aopActivities, filters, scope);
  const filteredExpenditure = actualExpenditure(expenditure, filters, scope);

  const linkedByActivity = new Map<string, number>();
  for (const row of filteredExpenditure) {
    if (!row.aop_activity_id) continue;
    linkedByActivity.set(
      row.aop_activity_id,
      (linkedByActivity.get(row.aop_activity_id) ?? 0) + row.amount,
    );
  }

  return filteredAop
    .map((activity) => {
      const linked = linkedByActivity.get(activity.id) ?? 0;
      return {
        aop_activity_id: activity.id,
        activity_code: activity.activity_code,
        description: activity.description,
        mda_id: activity.mda_id,
        mda_name: activity.mda_name,
        fiscal_year: activity.fiscal_year,
        budgeted_cost: activity.budgeted_cost,
        linked_expenditure_amount: linked,
        remaining_amount: activity.budgeted_cost - linked,
      };
    })
    .sort(
      (a, b) =>
        b.fiscal_year - a.fiscal_year ||
        a.mda_name.localeCompare(b.mda_name) ||
        a.activity_code.localeCompare(b.activity_code),
    );
}

/* -------------------------------------------------------------------------- */
/* Infographic report aggregations                                            */
/*                                                                            */
/* These power the Admin Reports page. "Actual" amounts follow the same       */
/* Every active ledger entry is immediately reportable.                      */
/* -------------------------------------------------------------------------- */

function actualFunding(
  rows: FundingEntryLite[],
  filters: ReportFilters,
  scope: ReportScope,
): FundingEntryLite[] {
  return filterFunding(rows, filters, scope);
}

function actualExpenditure(
  rows: ExpenditureEntryLite[],
  filters: ReportFilters,
  scope: ReportScope,
): ExpenditureEntryLite[] {
  return filterExpenditure(rows, filters, scope);
}

function sumAmounts(rows: Array<{ amount: number }>): number {
  let total = 0;
  for (const row of rows) total += row.amount;
  return total;
}

export type HeadlineKpis = {
  /** Sum of approved budgets in scope — the state health envelope. */
  total_budget_amount: number;
  total_funding_amount: number;
  total_expenditure_amount: number;
  /** Expenditure / budget. Null when there is no budget. */
  budget_execution_rate: number | null;
  /** Expenditure / funding. Null when no funding has been recorded. */
  funding_utilisation_rate: number | null;
  /** Funding minus expenditure. Negative means spending exceeds receipts. */
  funding_gap_amount: number;
};

export function aggregateHeadlineKpis(
  budgets: ApprovedBudgetLite[],
  funding: FundingEntryLite[],
  expenditure: ExpenditureEntryLite[],
  filters: ReportFilters,
  scope: ReportScope = {},
): HeadlineKpis {
  const totalBudget = sumAmounts(
    filterBudgets(budgets, filters, scope).map((row) => ({
      amount: row.total_budget_amount,
    })),
  );
  const totalFunding = sumAmounts(actualFunding(funding, filters, scope));
  const totalExpenditure = sumAmounts(actualExpenditure(expenditure, filters, scope));
  return {
    total_budget_amount: totalBudget,
    total_funding_amount: totalFunding,
    total_expenditure_amount: totalExpenditure,
    budget_execution_rate: totalBudget === 0 ? null : totalExpenditure / totalBudget,
    funding_utilisation_rate:
      totalFunding === 0 ? null : totalExpenditure / totalFunding,
    funding_gap_amount: totalFunding - totalExpenditure,
  };
}

export type PhcShareReport = {
  phc_amount: number;
  non_phc_amount: number;
  total_amount: number;
  /** PHC expenditure as a share of all expenditure. Null when nothing was spent. */
  phc_share: number | null;
};

/**
 * PHC vs non-PHC split of actual expenditure. The PHC filter itself is
 * ignored so the share is always computed against the full spending base.
 */
export function aggregatePhcShare(
  expenditure: ExpenditureEntryLite[],
  filters: ReportFilters,
  scope: ReportScope = {},
): PhcShareReport {
  const rows = actualExpenditure(expenditure, { ...filters, phc: "any" }, scope);
  let phc = 0;
  let nonPhc = 0;
  for (const row of rows) {
    if (row.is_phc) phc += row.amount;
    else nonPhc += row.amount;
  }
  const total = phc + nonPhc;
  return {
    phc_amount: phc,
    non_phc_amount: nonPhc,
    total_amount: total,
    phc_share: total === 0 ? null : phc / total,
  };
}

export type QuarterlyTrendRow = {
  quarter: 1 | 2 | 3 | 4;
  total_funding_amount: number;
  total_expenditure_amount: number;
};

/**
 * Actual funding and expenditure per calendar quarter. The quarter filter is
 * intentionally ignored so the full-year shape stays visible while a single
 * quarter is selected elsewhere on the page.
 */
export function aggregateQuarterlyTrend(
  funding: FundingEntryLite[],
  expenditure: ExpenditureEntryLite[],
  filters: ReportFilters,
  scope: ReportScope = {},
): QuarterlyTrendRow[] {
  const trendFilters: ReportFilters = { ...filters, quarter: null };
  const rows: QuarterlyTrendRow[] = [1, 2, 3, 4].map((quarter) => ({
    quarter: quarter as QuarterlyTrendRow["quarter"],
    total_funding_amount: 0,
    total_expenditure_amount: 0,
  }));
  for (const row of actualFunding(funding, trendFilters, scope)) {
    const bucket = rows[row.quarter - 1];
    if (bucket) bucket.total_funding_amount += row.amount;
  }
  for (const row of actualExpenditure(expenditure, trendFilters, scope)) {
    const bucket = rows[row.quarter - 1];
    if (bucket) bucket.total_expenditure_amount += row.amount;
  }
  return rows;
}

export type CategoryShareRow = {
  expenditure_category_id: string;
  expenditure_category_name: string;
  total_amount: number;
  entry_count: number;
  /** Share of all actual expenditure in the current filters. Null when total is 0. */
  share: number | null;
};

export function aggregateCategoryShare(
  expenditure: ExpenditureEntryLite[],
  filters: ReportFilters,
  scope: ReportScope = {},
): CategoryShareRow[] {
  const rows = actualExpenditure(expenditure, filters, scope);
  const groups = new Map<
    string,
    { id: string; name: string; total: number; count: number }
  >();
  let grandTotal = 0;
  for (const row of rows) {
    grandTotal += row.amount;
    const existing = groups.get(row.expenditure_category_id);
    if (existing) {
      existing.total += row.amount;
      existing.count += 1;
    } else {
      groups.set(row.expenditure_category_id, {
        id: row.expenditure_category_id,
        name: row.expenditure_category_name,
        total: row.amount,
        count: 1,
      });
    }
  }
  return Array.from(groups.values())
    .map((group) => ({
      expenditure_category_id: group.id,
      expenditure_category_name: group.name,
      total_amount: group.total,
      entry_count: group.count,
      share: grandTotal === 0 ? null : group.total / grandTotal,
    }))
    .sort((a, b) => b.total_amount - a.total_amount);
}

export type BudgetComposition = {
  personnel_amount: number;
  other_recurrent_amount: number;
  capital_amount: number;
  total_budget_amount: number;
};

/** Personnel / other recurrent / capital split of approved budgets in scope. */
export function aggregateBudgetComposition(
  budgets: ApprovedBudgetLite[],
  filters: ReportFilters,
  scope: ReportScope = {},
): BudgetComposition {
  const rows = filterBudgets(budgets, filters, scope);
  const composition: BudgetComposition = {
    personnel_amount: 0,
    other_recurrent_amount: 0,
    capital_amount: 0,
    total_budget_amount: 0,
  };
  for (const row of rows) {
    composition.personnel_amount += row.personnel_amount;
    composition.other_recurrent_amount += row.other_recurrent_amount;
    composition.capital_amount += row.capital_amount;
    composition.total_budget_amount += row.total_budget_amount;
  }
  return composition;
}

export type MdaExecutionRow = {
  mda_id: string;
  mda_name: string;
  total_budget_amount: number;
  total_expenditure_amount: number;
  /** Actual expenditure / approved budget. */
  execution_rate: number;
};

/**
 * MDAs ranked by budget execution rate (actual expenditure / approved budget).
 * MDAs without an approved budget are excluded — a rate is meaningless there.
 */
export function aggregateMdaExecutionLeaderboard(
  budgets: ApprovedBudgetLite[],
  expenditure: ExpenditureEntryLite[],
  filters: ReportFilters,
  scope: ReportScope = {},
): MdaExecutionRow[] {
  const filteredBudgets = filterBudgets(budgets, filters, scope);
  const spend = new Map<string, number>();
  for (const row of actualExpenditure(expenditure, filters, scope)) {
    spend.set(row.mda_id, (spend.get(row.mda_id) ?? 0) + row.amount);
  }
  const budgetByMda = new Map<string, { name: string; budget: number }>();
  for (const row of filteredBudgets) {
    const existing = budgetByMda.get(row.mda_id);
    if (existing) {
      existing.budget += row.total_budget_amount;
    } else {
      budgetByMda.set(row.mda_id, {
        name: row.mda_name,
        budget: row.total_budget_amount,
      });
    }
  }
  return Array.from(budgetByMda.entries())
    .filter(([, value]) => value.budget > 0)
    .map(([mdaId, value]) => {
      const expenditureTotal = spend.get(mdaId) ?? 0;
      return {
        mda_id: mdaId,
        mda_name: value.name,
        total_budget_amount: value.budget,
        total_expenditure_amount: expenditureTotal,
        execution_rate: expenditureTotal / value.budget,
      };
    })
    .sort((a, b) => b.execution_rate - a.execution_rate);
}

export type LgaPhcShareRow = {
  lga_id: string;
  lga_name: string;
  total_expenditure_amount: number;
  facility_count: number;
  entry_count: number;
  /** Share of all actual PHC spending in the current filters. Null when total is 0. */
  share: number | null;
};

/**
 * Actual PHC spending per LGA. The PHC filter is forced to "yes" so the
 * breakdown always describes PHC money, but every other filter (quarter,
 * category, selected LGA, ...) still applies.
 */
export function aggregateLgaPhcShare(
  expenditure: ExpenditureEntryLite[],
  filters: ReportFilters,
  scope: ReportScope = {},
): LgaPhcShareRow[] {
  const rows = actualExpenditure(expenditure, { ...filters, phc: "yes" }, scope);
  const groups = new Map<
    string,
    { id: string; name: string; total: number; count: number; facilities: Set<string> }
  >();
  let grandTotal = 0;
  for (const row of rows) {
    if (!row.lga_id || !row.lga_name) continue;
    grandTotal += row.amount;
    const existing = groups.get(row.lga_id);
    if (existing) {
      existing.total += row.amount;
      existing.count += 1;
      if (row.facility_id) existing.facilities.add(row.facility_id);
    } else {
      groups.set(row.lga_id, {
        id: row.lga_id,
        name: row.lga_name,
        total: row.amount,
        count: 1,
        facilities: new Set(row.facility_id ? [row.facility_id] : []),
      });
    }
  }
  return Array.from(groups.values())
    .map((group) => ({
      lga_id: group.id,
      lga_name: group.name,
      total_expenditure_amount: group.total,
      facility_count: group.facilities.size,
      entry_count: group.count,
      share: grandTotal === 0 ? null : group.total / grandTotal,
    }))
    .sort((a, b) => b.total_expenditure_amount - a.total_expenditure_amount);
}

export type PhcFacilityLeaderboardRow = {
  facility_id: string;
  facility_name: string;
  lga_id: string;
  lga_name: string;
  total_expenditure_amount: number;
  entry_count: number;
  /** Share of all actual PHC spending in the current filters. Null when total is 0. */
  share: number | null;
};

/** Facilities ranked by actual PHC spending, respecting every other filter. */
export function aggregatePhcFacilityLeaderboard(
  expenditure: ExpenditureEntryLite[],
  filters: ReportFilters,
  scope: ReportScope = {},
): PhcFacilityLeaderboardRow[] {
  const rows = actualExpenditure(expenditure, { ...filters, phc: "yes" }, scope);
  const groups = new Map<
    string,
    {
      facilityId: string;
      facilityName: string;
      lgaId: string;
      lgaName: string;
      total: number;
      count: number;
    }
  >();
  let grandTotal = 0;
  for (const row of rows) {
    if (!row.facility_id || !row.facility_name || !row.lga_id || !row.lga_name) {
      continue;
    }
    grandTotal += row.amount;
    const existing = groups.get(row.facility_id);
    if (existing) {
      existing.total += row.amount;
      existing.count += 1;
    } else {
      groups.set(row.facility_id, {
        facilityId: row.facility_id,
        facilityName: row.facility_name,
        lgaId: row.lga_id,
        lgaName: row.lga_name,
        total: row.amount,
        count: 1,
      });
    }
  }
  return Array.from(groups.values())
    .map((group) => ({
      facility_id: group.facilityId,
      facility_name: group.facilityName,
      lga_id: group.lgaId,
      lga_name: group.lgaName,
      total_expenditure_amount: group.total,
      entry_count: group.count,
      share: grandTotal === 0 ? null : group.total / grandTotal,
    }))
    .sort((a, b) => b.total_expenditure_amount - a.total_expenditure_amount);
}

export type PhcCoverageKpis = {
  total_phc_amount: number;
  lga_count: number;
  facility_count: number;
  /** Average actual PHC spending per reporting facility. Null when no facility reported. */
  average_per_facility: number | null;
};

/** Reach of PHC spending: how many LGAs and facilities the money touched. */
export function aggregatePhcCoverage(
  expenditure: ExpenditureEntryLite[],
  filters: ReportFilters,
  scope: ReportScope = {},
): PhcCoverageKpis {
  const rows = actualExpenditure(expenditure, { ...filters, phc: "yes" }, scope);
  const lgas = new Set<string>();
  const facilities = new Set<string>();
  let total = 0;
  for (const row of rows) {
    total += row.amount;
    if (row.lga_id) lgas.add(row.lga_id);
    if (row.facility_id) facilities.add(row.facility_id);
  }
  return {
    total_phc_amount: total,
    lga_count: lgas.size,
    facility_count: facilities.size,
    average_per_facility: facilities.size === 0 ? null : total / facilities.size,
  };
}

export type UnlinkedExpenditureRow = {
  mda_id: string;
  mda_name: string;
  programme_area_id: string;
  programme_area_name: string;
  expenditure_category_id: string;
  expenditure_category_name: string;
  total_amount: number;
  entry_count: number;
};

export function aggregateUnlinkedExpenditure(
  expenditure: ExpenditureEntryLite[],
  filters: ReportFilters,
  scope: ReportScope = {},
): UnlinkedExpenditureRow[] {
  const filtered = filterExpenditure(expenditure, filters, scope).filter(
    (row) => row.aop_activity_id === null,
  );
  const groups = new Map<string, UnlinkedExpenditureRow>();
  for (const row of filtered) {
    const key = `${row.mda_id}::${row.programme_area_id}::${row.expenditure_category_id}`;
    const existing = groups.get(key);
    if (existing) {
      existing.total_amount += row.amount;
      existing.entry_count += 1;
    } else {
      groups.set(key, {
        mda_id: row.mda_id,
        mda_name: row.mda_name,
        programme_area_id: row.programme_area_id,
        programme_area_name: row.programme_area_name,
        expenditure_category_id: row.expenditure_category_id,
        expenditure_category_name: row.expenditure_category_name,
        total_amount: row.amount,
        entry_count: 1,
      });
    }
  }
  return Array.from(groups.values()).sort(
    (a, b) => b.total_amount - a.total_amount,
  );
}

/* -------------------------------------------------------------------------- */
/* Year-over-year comparison (needs a prior fiscal year in the dataset)       */
/* -------------------------------------------------------------------------- */

export type YoyComparisonReport = {
  current_fiscal_year: number | null;
  prior_fiscal_year: number | null;
  current_budget_amount: number;
  prior_budget_amount: number;
  current_actual_amount: number;
  prior_actual_amount: number;
  /** current budget / prior budget. Null when no prior budget. */
  budget_multiple: number | null;
  /** current actual / prior actual. Null when no prior actual. */
  actual_multiple: number | null;
};

/**
 * Compares the current filters' fiscal year against the immediately prior
 * year, holding every other dimension of the filter constant. Returns zeros
 * when a year has no data (e.g. before the FY2025 baseline is seeded).
 */
export function aggregateYoyComparison(
  budgets: ApprovedBudgetLite[],
  expenditure: ExpenditureEntryLite[],
  filters: ReportFilters,
  scope: ReportScope = {},
): YoyComparisonReport {
  const current = filters.fiscalYear;
  const prior = current === null ? null : current - 1;

  const budgetFor = (year: number | null) =>
    year === null
      ? 0
      : sumAmounts(
          filterBudgets(budgets, { ...filters, fiscalYear: year }, scope).map(
            (row) => ({ amount: row.total_budget_amount }),
          ),
        );
  const actualFor = (year: number | null) =>
    year === null
      ? 0
      : sumAmounts(
          actualExpenditure(expenditure, { ...filters, fiscalYear: year }, scope),
        );

  const currentBudget = budgetFor(current);
  const priorBudget = budgetFor(prior);
  const currentActual = actualFor(current);
  const priorActual = actualFor(prior);

  return {
    current_fiscal_year: current,
    prior_fiscal_year: prior,
    current_budget_amount: currentBudget,
    prior_budget_amount: priorBudget,
    current_actual_amount: currentActual,
    prior_actual_amount: priorActual,
    budget_multiple: priorBudget === 0 ? null : currentBudget / priorBudget,
    actual_multiple: priorActual === 0 ? null : currentActual / priorActual,
  };
}

/* -------------------------------------------------------------------------- */
/* Exceptions (audit integrity checks derived from the ledger)                */
/* -------------------------------------------------------------------------- */

export type ExceptionKind =
  | "unlinked_aop"
  | "allocation_mismatch";

export type ExceptionRow = {
  entry_id: string;
  public_id: string;
  voucher_ref_no: string;
  mda_id: string;
  mda_name: string;
  programme_area_name: string;
  expenditure_category_name: string;
  amount: number;
  kind: ExceptionKind;
  detail: string;
};

export type ExceptionsReport = {
  rows: ExceptionRow[];
  counts: Record<ExceptionKind, number>;
  /** Integrity exceptions that indicate a real data problem. */
  integrity_count: number;
};

/** Tolerance (naira) for comparing an entry amount to its allocation sum. */
const ALLOCATION_TOLERANCE = 0.01;

/**
 * Ledger integrity findings for the audit report and hub signal chips:
 *  - `allocation_mismatch`: funding allocations don't sum to the entry amount
 *  - `unlinked_aop`: actual expenditure not linked to an AOP activity
 */
export function aggregateExceptions(
  expenditure: ExpenditureEntryLite[],
  filters: ReportFilters,
  scope: ReportScope = {},
): ExceptionsReport {
  const rows: ExceptionRow[] = [];
  const counts: Record<ExceptionKind, number> = {
    unlinked_aop: 0,
    allocation_mismatch: 0,
  };

  const all = filterExpenditure(expenditure, filters, scope);
  for (const entry of all) {
    const base = {
      entry_id: entry.id,
      public_id: entry.public_id,
      voucher_ref_no: entry.voucher_ref_no,
      mda_id: entry.mda_id,
      mda_name: entry.mda_name,
      programme_area_name: entry.programme_area_name,
      expenditure_category_name: entry.expenditure_category_name,
      amount: entry.amount,
    };

    const allocated = entry.funding_allocations.reduce(
      (sum, allocation) => sum + allocation.amount,
      0,
    );
    if (Math.abs(allocated - entry.amount) > ALLOCATION_TOLERANCE) {
      counts.allocation_mismatch += 1;
      rows.push({
        ...base,
        kind: "allocation_mismatch",
        detail: `Allocations sum to ${allocated.toFixed(2)}, entry amount is ${entry.amount.toFixed(2)}`,
      });
    }

    if (entry.aop_activity_id === null) {
      counts.unlinked_aop += 1;
      rows.push({ ...base, kind: "unlinked_aop", detail: "No AOP activity linked" });
    }
  }

  rows.sort((a, b) => b.amount - a.amount);
  return {
    rows,
    counts,
    integrity_count: counts.allocation_mismatch,
  };
}

/* -------------------------------------------------------------------------- */
/* Funding reconciliation (audit report)                                      */
/* -------------------------------------------------------------------------- */

export type ReconciliationRow = {
  mda_id: string;
  mda_name: string;
  funding_source_id: string;
  funding_source_name: string;
  received_amount: number;
  allocated_amount: number;
  /** received − allocated. Negative = allocated beyond recorded funding. */
  variance_amount: number;
};

/**
 * Per MDA × funding source: recorded funding received vs the amount
 * allocated to recorded expenditure. Mirrors the server-side
 * funding-pool balance and surfaces over-allocation for the audit report.
 */
export function aggregateReconciliation(
  funding: FundingEntryLite[],
  expenditure: ExpenditureEntryLite[],
  filters: ReportFilters,
  scope: ReportScope = {},
): ReconciliationRow[] {
  type Bucket = {
    mda_id: string;
    mda_name: string;
    funding_source_id: string;
    funding_source_name: string;
    received: number;
    allocated: number;
  };
  const groups = new Map<string, Bucket>();
  const keyFor = (mdaId: string, sourceId: string) => `${mdaId}::${sourceId}`;

  for (const row of actualFunding(funding, filters, scope)) {
    const key = keyFor(row.mda_id, row.funding_source_id);
    const bucket = groups.get(key);
    if (bucket) {
      bucket.received += row.amount;
    } else {
      groups.set(key, {
        mda_id: row.mda_id,
        mda_name: row.mda_name,
        funding_source_id: row.funding_source_id,
        funding_source_name: row.funding_source_name,
        received: row.amount,
        allocated: 0,
      });
    }
  }

  for (const row of actualExpenditure(expenditure, filters, scope)) {
    for (const allocation of row.funding_allocations) {
      const key = keyFor(row.mda_id, allocation.funding_source_id);
      const bucket = groups.get(key);
      if (bucket) {
        bucket.allocated += allocation.amount;
      } else {
        groups.set(key, {
          mda_id: row.mda_id,
          mda_name: row.mda_name,
          funding_source_id: allocation.funding_source_id,
          funding_source_name: allocation.funding_source_name,
          received: 0,
          allocated: allocation.amount,
        });
      }
    }
  }

  return Array.from(groups.values())
    .map((bucket) => ({
      mda_id: bucket.mda_id,
      mda_name: bucket.mda_name,
      funding_source_id: bucket.funding_source_id,
      funding_source_name: bucket.funding_source_name,
      received_amount: bucket.received,
      allocated_amount: bucket.allocated,
      variance_amount: bucket.received - bucket.allocated,
    }))
    .sort(
      (a, b) =>
        a.mda_name.localeCompare(b.mda_name) ||
        b.allocated_amount - a.allocated_amount,
    );
}

/* -------------------------------------------------------------------------- */
/* Economic & administrative classification (official BIR tables)             */
/* -------------------------------------------------------------------------- */

type EconomicActuals = Record<EconomicClass, number>;

function zeroEconomic(): EconomicActuals {
  return { personnel: 0, overhead: 0, capital: 0, other: 0 };
}

/** Splits actual expenditure into economic classes for a set of rows. */
function economicActuals(rows: ExpenditureEntryLite[]): EconomicActuals {
  const totals = zeroEconomic();
  for (const row of rows) {
    totals[classifyEntry(row)] += row.amount;
  }
  return totals;
}

export type EconomicSummaryRow = {
  economic_class: EconomicClass | "total";
  label: string;
  budget_amount: number;
  actual_amount: number;
  performance_rate: number | null;
  balance_amount: number;
};

/**
 * Sector-level budget vs actual by economic classification — Table 1 of the
 * BIR. Budget uses the clean approved-budget split; actual is classified from
 * expenditure categories. The `other` class has no budget line (budgets only
 * carry personnel / other-recurrent / capital), so its budget is 0.
 */
export function aggregateEconomicSummary(
  budgets: ApprovedBudgetLite[],
  expenditure: ExpenditureEntryLite[],
  filters: ReportFilters,
  scope: ReportScope = {},
): EconomicSummaryRow[] {
  const filteredBudgets = filterBudgets(budgets, filters, scope);
  const budget = {
    personnel: 0,
    overhead: 0,
    capital: 0,
    other: 0,
  };
  for (const row of filteredBudgets) {
    budget.personnel += row.personnel_amount;
    budget.overhead += row.other_recurrent_amount;
    budget.capital += row.capital_amount;
  }
  const actual = economicActuals(actualExpenditure(expenditure, filters, scope));

  const rows: EconomicSummaryRow[] = ECONOMIC_CLASS_ORDER.map((economicClass) => {
    const b = budget[economicClass];
    const a = actual[economicClass];
    return {
      economic_class: economicClass,
      label: ECONOMIC_CLASS_LABEL[economicClass],
      budget_amount: b,
      actual_amount: a,
      performance_rate: b === 0 ? null : a / b,
      balance_amount: b - a,
    };
  });

  const totalBudget = budget.personnel + budget.overhead + budget.capital;
  const totalActual = actual.personnel + actual.overhead + actual.capital + actual.other;
  rows.push({
    economic_class: "total",
    label: "Total",
    budget_amount: totalBudget,
    actual_amount: totalActual,
    performance_rate: totalBudget === 0 ? null : totalActual / totalBudget,
    balance_amount: totalBudget - totalActual,
  });
  return rows;
}

export type AdminClassificationRow = {
  mda_id: string;
  mda_name: string;
  budget_amount: number;
  personnel_amount: number;
  overhead_amount: number;
  capital_amount: number;
  other_amount: number;
  actual_total: number;
  performance_rate: number | null;
  balance_amount: number;
};

/**
 * Per-MDA total expenditure by administrative classification, with the
 * economic split per MDA — the per-MDA table of the BIR. Every MDA with an
 * approved budget in scope appears, even at zero actual.
 */
export function aggregateAdminClassification(
  budgets: ApprovedBudgetLite[],
  expenditure: ExpenditureEntryLite[],
  filters: ReportFilters,
  scope: ReportScope = {},
): AdminClassificationRow[] {
  const filteredBudgets = filterBudgets(budgets, filters, scope);
  const actualByMda = new Map<string, EconomicActuals>();
  for (const row of actualExpenditure(expenditure, filters, scope)) {
    const existing = actualByMda.get(row.mda_id) ?? zeroEconomic();
    existing[classifyEntry(row)] += row.amount;
    actualByMda.set(row.mda_id, existing);
  }

  return filteredBudgets
    .map((budget) => {
      const actual = actualByMda.get(budget.mda_id) ?? zeroEconomic();
      const actualTotal =
        actual.personnel + actual.overhead + actual.capital + actual.other;
      return {
        mda_id: budget.mda_id,
        mda_name: budget.mda_name,
        budget_amount: budget.total_budget_amount,
        personnel_amount: actual.personnel,
        overhead_amount: actual.overhead,
        capital_amount: actual.capital,
        other_amount: actual.other,
        actual_total: actualTotal,
        performance_rate:
          budget.total_budget_amount === 0
            ? null
            : actualTotal / budget.total_budget_amount,
        balance_amount: budget.total_budget_amount - actualTotal,
      };
    })
    .sort(
      (a, b) => b.actual_total - a.actual_total || a.mda_name.localeCompare(b.mda_name),
    );
}
