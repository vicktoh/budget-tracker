import type { EntryStatusSlug } from "@/lib/db/types";

/**
 * Normalised filter state for every report on the MDA Dashboard and
 * Admin Insights. Reports are computed by loading raw rows from the
 * base tables (status-aware) and aggregating in `aggregate.ts`, so the
 * same filter shape can drive every report and the URL serializer.
 */
/** Calendar quarter derived from `transaction_date` (1–4). */
export type ReportQuarter = 1 | 2 | 3 | 4;

export type ReportFilters = {
  /** "all" = every status (default). Specific status filters constrain reports. */
  status: EntryStatusSlug | "all";
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
  status: "all",
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
 * a fixed set of MDAs (used for MDA users and Reviewers). `undefined`
 * means no constraint — admins see statewide data.
 */
export type ReportScope = {
  mdaIds?: string[];
};

/** Lightweight shape of a funding entry the reporting layer cares about. */
export type FundingEntryLite = {
  id: string;
  mda_id: string;
  mda_name: string;
  programme_area_id: string;
  programme_area_name: string;
  funding_source_id: string;
  funding_source_name: string;
  fiscal_year: number;
  quarter: number;
  amount: number;
  status: EntryStatusSlug;
  transaction_date: string;
};

export type ExpenditureEntryLite = {
  id: string;
  mda_id: string;
  mda_name: string;
  programme_area_id: string;
  programme_area_name: string;
  expenditure_category_id: string;
  expenditure_category_name: string;
  aop_activity_id: string | null;
  is_phc: boolean;
  lga_id: string | null;
  lga_name: string | null;
  facility_id: string | null;
  facility_name: string | null;
  fiscal_year: number;
  quarter: number;
  amount: number;
  status: EntryStatusSlug;
  transaction_date: string;
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
  aopActivities: AopActivityLite[];
};
