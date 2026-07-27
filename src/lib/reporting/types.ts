/**
 * Normalised filter state for every report on the MDA Dashboard and
 * Admin Insights. Reports are computed by loading raw rows from the
 * base tables and aggregating in `aggregate.ts`, so the
 * same filter shape can drive every report and the URL serializer.
 */
/** Calendar quarter derived from `transaction_date` (1–4). */
export type ReportQuarter = 1 | 2 | 3 | 4;

export type ReportFilters = {
  fiscalYear: number | null;
  /** null = all quarters (default). Constrains funding/expenditure entries. */
  quarter: ReportQuarter | null;
  dateFrom: string | null;
  dateTo: string | null;
  mdaId: string | null;
  programmeAreaId: string | null;
  fundingSourceId: string | null;
  expenditureCategoryId: string | null;
  lgaId: string | null;
  facilityId: string | null;
  /** "any" = no constraint, "yes" = only PHC, "no" = only non-PHC. Applies to expenditure-side reports. */
  phc: "any" | "yes" | "no";
};

export const emptyReportFilters = (): ReportFilters => ({
  fiscalYear: null,
  quarter: null,
  dateFrom: null,
  dateTo: null,
  mdaId: null,
  programmeAreaId: null,
  fundingSourceId: null,
  expenditureCategoryId: null,
  lgaId: null,
  facilityId: null,
  phc: "any",
});

/**
 * Role scope for reporting queries. `mdaIds` constrains the dataset to
 * a fixed set of MDAs (used for MDA users). `undefined` means no constraint —
 * admins and statewide Viewers see all reporting data.
 */
export type ReportScope = {
  mdaIds?: string[];
};

/** Lightweight shape of a funding entry the reporting layer cares about. */
export type FundingEntryLite = {
  id: string;
  public_id: string;
  reference_no: string;
  mda_id: string;
  mda_name: string;
  programme_area_id: string;
  programme_area_name: string;
  funding_source_id: string;
  funding_source_name: string;
  fiscal_year: number;
  quarter: number;
  amount: number;
  transaction_date: string;
};

export type ExpenditureFundingAllocationLite = {
  funding_source_id: string;
  funding_source_name: string;
  amount: number;
};

export type ExpenditureEntryLite = {
  id: string;
  public_id: string;
  voucher_ref_no: string;
  mda_id: string;
  mda_name: string;
  programme_area_id: string;
  programme_area_name: string;
  expenditure_category_id: string;
  expenditure_category_name: string;
  /**
   * NCOA class of the bound approved budget line, or null when the entry isn't
   * bound to one. Authoritative for economic classification — see
   * `classifyEntry` in `@/lib/reporting/economic-class`.
   */
  budget_class: string | null;
  /**
   * NCOA programme code of the bound budget line, or null when unbound. Its
   * first four digits are the health sector objective — see
   * `@/lib/reporting/health-sector-objectives`.
   */
  programme_code: string | null;
  aop_activity_id: string | null;
  is_phc: boolean;
  lga_id: string | null;
  lga_name: string | null;
  facility_id: string | null;
  facility_name: string | null;
  fiscal_year: number;
  quarter: number;
  amount: number;
  transaction_date: string;
  funding_allocations: ExpenditureFundingAllocationLite[];
};

export type ApprovedBudgetLite = {
  mda_id: string;
  mda_name: string;
  fiscal_year: number;
  personnel_amount: number;
  other_recurrent_amount: number;
  total_recurrent_amount: number;
  capital_amount: number;
  total_budget_amount: number;
};

/** One quarter's collection against a revenue line. */
export type BudgetLineRevenueActualLite = {
  quarter: number;
  amount: number;
};

/**
 * A coded revenue line — the money side the ledger never modelled. `stream`
 * separates recurrent revenue (IGR, fees, licences) from capital receipts
 * (grants, loans, aid), matching the BPR's own split.
 */
export type BudgetLineRevenueLite = {
  id: string;
  fiscal_year: number;
  mda_id: string;
  mda_name: string;
  stream: "recurrent" | "capital_receipt";
  economic_code: string;
  economic_description: string;
  approved_amount: number;
  actuals: BudgetLineRevenueActualLite[];
};

/**
 * One month's tracked figure for a budget line, from the IBP monthly tracking
 * workbook. A row with amount 0 is an explicit zero submission; a month with
 * no row at all means the MDA submitted nothing — the UI renders those
 * differently, so absence must stay observable.
 */
export type MonthlyTrackingLite = {
  id: string;
  mda_id: string;
  mda_name: string;
  fiscal_year: number;
  budget_class: "personnel" | "overhead" | "capital";
  economic_code: string;
  description: string | null;
  approved_budget_line_id: string | null;
  month: number;
  amount: number;
};

export type AopActivityLite = {
  id: string;
  mda_id: string;
  mda_name: string;
  fiscal_year: number;
  activity_code: string;
  description: string;
  budgeted_cost: number;
  active: boolean;
};

export type ReportingDataset = {
  funding: FundingEntryLite[];
  expenditure: ExpenditureEntryLite[];
  budgets: ApprovedBudgetLite[];
  revenues: BudgetLineRevenueLite[];
  monthly: MonthlyTrackingLite[];
  aopActivities: AopActivityLite[];
  publications: Array<{
    id: string;
    fiscal_year: number;
    quarter: ReportQuarter;
    version: number;
    published_at: string;
  }>;
};
