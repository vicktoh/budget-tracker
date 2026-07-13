import type {
  AopActivityLite,
  ApprovedBudgetLite,
  ExpenditureEntryLite,
  FundingEntryLite,
  ReportFilters,
  ReportScope,
} from "@/lib/reporting/types";
import type { EntryStatusSlug } from "@/lib/db/types";
import {
  ECONOMIC_CLASS_LABEL,
  ECONOMIC_CLASS_ORDER,
  classifyCategory,
  type EconomicClass,
} from "@/lib/reporting/economic-class";

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
    if (filters.status !== "all" && row.status !== filters.status) return false;
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
    if (filters.status !== "all" && row.status !== filters.status) return false;
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

export type StatusCounts = Record<EntryStatusSlug, number>;

export type StatusCountsReport = {
  funding: StatusCounts;
  expenditure: StatusCounts;
  totalFunding: number;
  totalExpenditure: number;
};

const ZERO_COUNTS = (): StatusCounts => ({
  pending: 0,
  approved: 0,
  processed: 0,
  rejected: 0,
});

/**
 * Counts and totals by status for both ledgers. Status filter is intentionally
 * ignored here because the cards drive the status filter.
 */
export function aggregateStatusCounts(
  funding: FundingEntryLite[],
  expenditure: ExpenditureEntryLite[],
  filters: ReportFilters,
  scope: ReportScope = {},
): StatusCountsReport {
  const filtersForCounts: ReportFilters = { ...filters, status: "all" };
  const f = filterFunding(funding, filtersForCounts, scope);
  const e = filterExpenditure(expenditure, filtersForCounts, scope);
  const fundingCounts = ZERO_COUNTS();
  const expenditureCounts = ZERO_COUNTS();
  let totalFunding = 0;
  let totalExpenditure = 0;
  for (const row of f) {
    fundingCounts[row.status] += 1;
    if (row.status === "approved" || row.status === "processed") {
      totalFunding += row.amount;
    }
  }
  for (const row of e) {
    expenditureCounts[row.status] += 1;
    if (row.status === "approved" || row.status === "processed") {
      totalExpenditure += expenditureAmountForFilters(row, filters);
    }
  }
  return {
    funding: fundingCounts,
    expenditure: expenditureCounts,
    totalFunding,
    totalExpenditure,
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
  // Planning performance is an official actual: pending and rejected entries
  // must not inflate linked spend when the report status filter is "all".
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
/* convention as `aggregateStatusCounts`: only approved + processed entries   */
/* count toward official totals, regardless of the status filter.            */
/* -------------------------------------------------------------------------- */

function isActualStatus(status: EntryStatusSlug): boolean {
  return status === "approved" || status === "processed";
}

/** Applies filters (ignoring status) and keeps only approved/processed rows. */
function actualFunding(
  rows: FundingEntryLite[],
  filters: ReportFilters,
  scope: ReportScope,
): FundingEntryLite[] {
  return filterFunding(rows, { ...filters, status: "all" }, scope).filter((row) =>
    isActualStatus(row.status),
  );
}

function actualExpenditure(
  rows: ExpenditureEntryLite[],
  filters: ReportFilters,
  scope: ReportScope,
): ExpenditureEntryLite[] {
  return filterExpenditure(rows, { ...filters, status: "all" }, scope).filter((row) =>
    isActualStatus(row.status),
  );
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
  | "allocation_mismatch"
  | "rejected";

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
  /** Integrity exceptions that indicate a real data problem (mismatch + rejected). */
  integrity_count: number;
};

/** Tolerance (naira) for comparing an entry amount to its allocation sum. */
const ALLOCATION_TOLERANCE = 0.01;

/**
 * Ledger integrity findings for the audit report and hub signal chips:
 *  - `allocation_mismatch`: funding allocations don't sum to the entry amount
 *  - `rejected`: entry was rejected in review
 *  - `unlinked_aop`: actual expenditure not linked to an AOP activity
 * The status filter is ignored so rejected entries always surface.
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
    rejected: 0,
  };

  const all = filterExpenditure(expenditure, { ...filters, status: "all" }, scope);
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

    if (entry.status === "rejected") {
      counts.rejected += 1;
      rows.push({ ...base, kind: "rejected", detail: "Entry rejected in review" });
      continue; // a rejected entry's other checks are moot
    }

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

    if (isActualStatus(entry.status) && entry.aop_activity_id === null) {
      counts.unlinked_aop += 1;
      rows.push({ ...base, kind: "unlinked_aop", detail: "No AOP activity linked" });
    }
  }

  rows.sort((a, b) => b.amount - a.amount);
  return {
    rows,
    counts,
    integrity_count: counts.allocation_mismatch + counts.rejected,
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
 * Per MDA × funding source: funding received (approved/processed) vs the amount
 * allocated to expenditure (approved/processed). Mirrors the server-side
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
    totals[classifyCategory(row.expenditure_category_name)] += row.amount;
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
    existing[classifyCategory(row.expenditure_category_name)] += row.amount;
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
