import type { TypedSupabaseClient } from "@/lib/supabase/client";
import type {
  AopActivityLite,
  ApprovedBudgetLite,
  ExpenditureEntryLite,
  FundingEntryLite,
  ReportingDataset,
  ReportScope,
} from "@/lib/reporting/types";

type Client = TypedSupabaseClient;

const FUNDING_SELECT = `
  id, mda_id, fiscal_year, quarter, amount, status, transaction_date,
  programme_area_id, funding_source_id,
  mdas!inner(id, name),
  programme_areas!inner(id, name),
  funding_sources!inner(id, name)
`;

const EXPENDITURE_SELECT = `
  id, mda_id, fiscal_year, quarter, amount, status, transaction_date,
  programme_area_id, expenditure_category_id, aop_activity_id, is_phc, lga_id, facility_id,
  mdas!inner(id, name),
  programme_areas!inner(id, name),
  expenditure_categories!inner(id, name),
  lgas(id, name),
  facilities(id, name)
`;

const BUDGET_SELECT = `
  fiscal_year, mda_id,
  personnel_amount, other_recurrent_amount, total_recurrent_amount,
  capital_amount, total_budget_amount,
  mdas!inner(id, name)
`;

const AOP_SELECT = `
  id, fiscal_year, mda_id, activity_code, description, budgeted_cost, active,
  mdas!inner(id, name)
`;

type RelatedNamed = { id: string; name: string } | { id: string; name: string }[] | null;

function pickRelatedName(value: RelatedNamed): string {
  if (!value) return "";
  if (Array.isArray(value)) return value[0]?.name ?? "";
  return value.name ?? "";
}

function pickRelated(value: RelatedNamed): { id: string; name: string } | null {
  if (!value) return null;
  if (Array.isArray(value)) return value[0] ?? null;
  return value;
}

type RawFunding = {
  id: string;
  mda_id: string;
  fiscal_year: number;
  quarter: number;
  amount: number;
  status: FundingEntryLite["status"];
  transaction_date: string;
  programme_area_id: string;
  funding_source_id: string;
  mdas: RelatedNamed;
  programme_areas: RelatedNamed;
  funding_sources: RelatedNamed;
};

type RawExpenditure = {
  id: string;
  mda_id: string;
  fiscal_year: number;
  quarter: number;
  amount: number;
  status: ExpenditureEntryLite["status"];
  transaction_date: string;
  programme_area_id: string;
  expenditure_category_id: string;
  aop_activity_id: string | null;
  is_phc: boolean;
  lga_id: string | null;
  facility_id: string | null;
  mdas: RelatedNamed;
  programme_areas: RelatedNamed;
  expenditure_categories: RelatedNamed;
  lgas: RelatedNamed;
  facilities: RelatedNamed;
};

type RawBudget = {
  fiscal_year: number;
  mda_id: string;
  personnel_amount: number;
  other_recurrent_amount: number;
  total_recurrent_amount: number;
  capital_amount: number;
  total_budget_amount: number;
  mdas: RelatedNamed;
};

type RawAop = {
  id: string;
  fiscal_year: number;
  mda_id: string;
  activity_code: string;
  description: string;
  budgeted_cost: number;
  active: boolean;
  mdas: RelatedNamed;
};

async function loadFunding(
  client: Client,
  scope: ReportScope,
): Promise<FundingEntryLite[]> {
  let query = client.from("funding_entries").select(FUNDING_SELECT);
  if (scope.mdaIds && scope.mdaIds.length > 0) {
    query = query.in("mda_id", scope.mdaIds);
  }
  const { data, error } = await query;
  if (error) throw error;
  const rows = (data ?? []) as unknown as RawFunding[];
  return rows.map((row) => ({
    id: row.id,
    mda_id: row.mda_id,
    mda_name: pickRelatedName(row.mdas),
    programme_area_id: row.programme_area_id,
    programme_area_name: pickRelatedName(row.programme_areas),
    funding_source_id: row.funding_source_id,
    funding_source_name: pickRelatedName(row.funding_sources),
    fiscal_year: row.fiscal_year,
    quarter: row.quarter,
    amount: Number(row.amount),
    status: row.status,
    transaction_date: row.transaction_date,
  }));
}

async function loadExpenditure(
  client: Client,
  scope: ReportScope,
): Promise<ExpenditureEntryLite[]> {
  let query = client.from("expenditure_entries").select(EXPENDITURE_SELECT);
  if (scope.mdaIds && scope.mdaIds.length > 0) {
    query = query.in("mda_id", scope.mdaIds);
  }
  const { data, error } = await query;
  if (error) throw error;
  const rows = (data ?? []) as unknown as RawExpenditure[];
  return rows.map((row) => {
    const lga = pickRelated(row.lgas);
    const facility = pickRelated(row.facilities);
    return {
      id: row.id,
      mda_id: row.mda_id,
      mda_name: pickRelatedName(row.mdas),
      programme_area_id: row.programme_area_id,
      programme_area_name: pickRelatedName(row.programme_areas),
      expenditure_category_id: row.expenditure_category_id,
      expenditure_category_name: pickRelatedName(row.expenditure_categories),
      aop_activity_id: row.aop_activity_id,
      is_phc: row.is_phc,
      lga_id: row.lga_id,
      lga_name: lga?.name ?? null,
      facility_id: row.facility_id,
      facility_name: facility?.name ?? null,
      fiscal_year: row.fiscal_year,
      quarter: row.quarter,
      amount: Number(row.amount),
      status: row.status,
      transaction_date: row.transaction_date,
    };
  });
}

async function loadBudgets(
  client: Client,
  scope: ReportScope,
): Promise<ApprovedBudgetLite[]> {
  let query = client.from("approved_budgets").select(BUDGET_SELECT);
  if (scope.mdaIds && scope.mdaIds.length > 0) {
    query = query.in("mda_id", scope.mdaIds);
  }
  const { data, error } = await query;
  if (error) throw error;
  const rows = (data ?? []) as unknown as RawBudget[];
  return rows.map((row) => ({
    mda_id: row.mda_id,
    mda_name: pickRelatedName(row.mdas),
    fiscal_year: row.fiscal_year,
    personnel_amount: Number(row.personnel_amount),
    other_recurrent_amount: Number(row.other_recurrent_amount),
    total_recurrent_amount: Number(row.total_recurrent_amount),
    capital_amount: Number(row.capital_amount),
    total_budget_amount: Number(row.total_budget_amount),
  }));
}

async function loadAopActivities(
  client: Client,
  scope: ReportScope,
): Promise<AopActivityLite[]> {
  let query = client.from("aop_activities").select(AOP_SELECT);
  if (scope.mdaIds && scope.mdaIds.length > 0) {
    query = query.in("mda_id", scope.mdaIds);
  }
  const { data, error } = await query;
  if (error) throw error;
  const rows = (data ?? []) as unknown as RawAop[];
  return rows.map((row) => ({
    id: row.id,
    mda_id: row.mda_id,
    mda_name: pickRelatedName(row.mdas),
    fiscal_year: row.fiscal_year,
    activity_code: row.activity_code,
    description: row.description,
    budgeted_cost: Number(row.budgeted_cost),
    active: row.active,
  }));
}

/**
 * Loads every row the reporting layer needs in one round-trip. Filtering and
 * aggregation are applied client-side so chart filters (status, FY, MDA, etc.)
 * compose without re-fetching. RLS still bounds the dataset on the server.
 */
export async function loadReportingDataset(
  client: Client,
  scope: ReportScope = {},
): Promise<ReportingDataset> {
  const [funding, expenditure, budgets, aopActivities] = await Promise.all([
    loadFunding(client, scope),
    loadExpenditure(client, scope),
    loadBudgets(client, scope),
    loadAopActivities(client, scope),
  ]);
  return { funding, expenditure, budgets, aopActivities };
}
