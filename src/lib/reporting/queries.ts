import type { TypedSupabaseClient } from "@/lib/supabase/client";
import type {
  AopActivityLite,
  ApprovedBudgetLite,
  BudgetLineRevenueLite,
  ExpenditureEntryLite,
  FundingEntryLite,
  ReportingDataset,
  ReportScope,
} from "@/lib/reporting/types";

type Client = TypedSupabaseClient;

const FUNDING_SELECT = `
  id, public_id, reference_no, mda_id, fiscal_year, quarter, amount, transaction_date,
  programme_area_id, funding_source_id,
  mdas!inner(id, name),
  programme_areas!inner(id, name),
  funding_sources!inner(id, name)
`;

const EXPENDITURE_SELECT = `
  id, public_id, voucher_ref_no, mda_id, fiscal_year, quarter, amount, transaction_date,
  programme_area_id, expenditure_category_id, aop_activity_id, is_phc, lga_id, facility_id,
  mdas!inner(id, name),
  programme_areas!inner(id, name),
  expenditure_categories!inner(id, name),
  approved_budget_lines(budget_class, programme_code),
  lgas(id, name),
  facilities(id, name),
  expenditure_funding_allocations(
    funding_source_id,
    amount,
    funding_sources!inner(id, name)
  )
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

const REVENUE_SELECT = `
  id, fiscal_year, mda_id, stream, economic_code, economic_description, approved_amount,
  mdas!inner(id, name),
  budget_line_revenue_actuals(quarter, amount)
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
  public_id: string | null;
  reference_no: string;
  mda_id: string;
  fiscal_year: number;
  quarter: number;
  amount: number;
  transaction_date: string;
  programme_area_id: string;
  funding_source_id: string;
  mdas: RelatedNamed;
  programme_areas: RelatedNamed;
  funding_sources: RelatedNamed;
};

type RawExpenditure = {
  id: string;
  public_id: string | null;
  voucher_ref_no: string;
  mda_id: string;
  fiscal_year: number;
  quarter: number;
  amount: number;
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
  approved_budget_lines:
    | { budget_class: string; programme_code: string | null }
    | Array<{ budget_class: string; programme_code: string | null }>
    | null;
  lgas: RelatedNamed;
  facilities: RelatedNamed;
  expenditure_funding_allocations:
    | Array<{
        funding_source_id: string;
        amount: number;
        funding_sources: RelatedNamed;
      }>
    | null;
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
    public_id: row.public_id ?? "",
    reference_no: row.reference_no,
    mda_id: row.mda_id,
    mda_name: pickRelatedName(row.mdas),
    programme_area_id: row.programme_area_id,
    programme_area_name: pickRelatedName(row.programme_areas),
    funding_source_id: row.funding_source_id,
    funding_source_name: pickRelatedName(row.funding_sources),
    fiscal_year: row.fiscal_year,
    quarter: row.quarter,
    amount: Number(row.amount),
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
    const budgetLine = Array.isArray(row.approved_budget_lines)
      ? row.approved_budget_lines[0] ?? null
      : row.approved_budget_lines;
    return {
      id: row.id,
      public_id: row.public_id ?? "",
      voucher_ref_no: row.voucher_ref_no,
      mda_id: row.mda_id,
      mda_name: pickRelatedName(row.mdas),
      programme_area_id: row.programme_area_id,
      programme_area_name: pickRelatedName(row.programme_areas),
      expenditure_category_id: row.expenditure_category_id,
      expenditure_category_name: pickRelatedName(row.expenditure_categories),
      budget_class: budgetLine?.budget_class ?? null,
      programme_code: budgetLine?.programme_code ?? null,
      aop_activity_id: row.aop_activity_id,
      is_phc: row.is_phc,
      lga_id: row.lga_id,
      lga_name: lga?.name ?? null,
      facility_id: row.facility_id,
      facility_name: facility?.name ?? null,
      fiscal_year: row.fiscal_year,
      quarter: row.quarter,
      amount: Number(row.amount),
      transaction_date: row.transaction_date,
      funding_allocations: (row.expenditure_funding_allocations ?? []).map(
        (allocation) => ({
          funding_source_id: allocation.funding_source_id,
          funding_source_name: pickRelatedName(allocation.funding_sources),
          amount: Number(allocation.amount),
        }),
      ),
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

type RawRevenue = {
  id: string;
  fiscal_year: number;
  mda_id: string;
  stream: string;
  economic_code: string;
  economic_description: string;
  approved_amount: number;
  mdas: RelatedNamed;
  budget_line_revenue_actuals:
    | Array<{ quarter: number; amount: number }>
    | null;
};

async function loadRevenues(
  client: Client,
  scope: ReportScope,
): Promise<BudgetLineRevenueLite[]> {
  let query = client.from("budget_line_revenues").select(REVENUE_SELECT);
  if (scope.mdaIds && scope.mdaIds.length > 0) {
    query = query.in("mda_id", scope.mdaIds);
  }
  const { data, error } = await query;
  if (error) throw error;
  const rows = (data ?? []) as unknown as RawRevenue[];
  return rows.map((row) => ({
    id: row.id,
    fiscal_year: row.fiscal_year,
    mda_id: row.mda_id,
    mda_name: pickRelatedName(row.mdas),
    stream: row.stream === "capital_receipt" ? "capital_receipt" : "recurrent",
    economic_code: row.economic_code,
    economic_description: row.economic_description,
    approved_amount: Number(row.approved_amount),
    actuals: (row.budget_line_revenue_actuals ?? []).map((actual) => ({
      quarter: Number(actual.quarter),
      amount: Number(actual.amount),
    })),
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
 * aggregation are applied client-side so chart filters (FY, MDA, period, etc.)
 * compose without re-fetching. RLS still bounds the dataset on the server.
 */
export async function loadReportingDataset(
  client: Client,
  scope: ReportScope = {},
): Promise<ReportingDataset> {
  const [funding, expenditure, budgets, revenues, aopActivities, publicationResult] = await Promise.all([
    loadFunding(client, scope),
    loadExpenditure(client, scope),
    loadBudgets(client, scope),
    loadRevenues(client, scope),
    loadAopActivities(client, scope),
    client.from("budget_implementation_report_publications")
      .select("id, fiscal_year, quarter, version, published_at")
      .order("version", { ascending: false }),
  ]);
  if (publicationResult.error) throw publicationResult.error;
  return {
    funding,
    expenditure,
    budgets,
    revenues,
    aopActivities,
    publications: (publicationResult.data ?? []) as unknown as ReportingDataset["publications"],
  };
}
