/**
 * Admin Approved Budget and AOP Activity CRUD.
 *
 * Writes are admin-only at the RLS layer (`plans_admin_approved_budgets`
 * and `plans_admin_aop_activities` policies in the initial migration).
 * These helpers shape inserts/updates so the admin UI can dispatch a
 * single write per record without leaking the workbook-derived columns
 * into the rest of the app.
 *
 * Approved Budgets: Postgres derives nothing here — the totals must be
 * supplied and pass the arithmetic CHECK constraints. The validation
 * layer (`src/lib/planning/validation.ts`) does the same arithmetic so
 * the UI can preflight before round-tripping.
 *
 * AOP Activities: the unique key is
 * `(fiscal_year, activity_code, mda_id, source_row_number)`, so workbook
 * rows that legitimately repeat an activity code under the same MDA stay
 * distinct by carrying a `source_row_number`.
 *
 * The `Database` types in `src/lib/db/types.ts` are hand-authored and
 * still mark `id` as required on Insert for `BaseRow`-derived tables.
 * Until the typegen replaces the hand-written types, we use the same
 * permissive `from`-cast pattern as `src/lib/db/reference-management.ts`
 * so writers stay narrow without fighting the synthetic typing.
 */

import type { TypedSupabaseClient } from "@/lib/supabase/client";
import type { Tables } from "@/lib/db/types";
import type {
  ValidatedAopActivity,
  ValidatedApprovedBudget,
  ValidatedApprovedBudgetLine,
} from "@/lib/planning/validation";

type Client = TypedSupabaseClient;
type SupabaseError = { message: string; code?: string } | null;

export type ApprovedBudgetRow = Tables<"approved_budgets"> & {
  mdas: Pick<Tables<"mdas">, "id" | "name" | "abbreviation"> | null;
};

export type AopActivityRow = Tables<"aop_activities"> & {
  mdas: Pick<Tables<"mdas">, "id" | "name" | "abbreviation"> | null;
};

export type ApprovedBudgetLineRow = Tables<"approved_budget_lines"> & {
  mdas: Pick<Tables<"mdas">, "id" | "name" | "abbreviation"> | null;
};

const BUDGET_SELECT = "*, mdas(id, name, abbreviation)";
const ACTIVITY_SELECT = "*, mdas(id, name, abbreviation)";
const BUDGET_LINE_SELECT = "*, mdas(id, name, abbreviation)";

type ListResult<Row> = { data: Row[] | null; error: SupabaseError };
type SingleResult<Row> = Promise<{ data: Row | null; error: SupabaseError }>;

type ListBuilder<Row> = PromiseLike<ListResult<Row>> & {
  eq: (column: string, value: unknown) => ListBuilder<Row>;
  order: (
    column: string,
    options?: { ascending?: boolean; nullsFirst?: boolean },
  ) => ListBuilder<Row>;
};

type AnyTable = {
  select: (cols: string) => ListBuilder<unknown>;
  insert: (row: Record<string, unknown>) => {
    select: (cols: string) => { single: () => SingleResult<unknown> };
  };
  update: (row: Record<string, unknown>) => {
    eq: (
      column: string,
      value: string,
    ) => Promise<{ error: SupabaseError }> & {
      select: (cols: string) => { single: () => SingleResult<unknown> };
    };
  };
};

function table(client: Client, name: string): AnyTable {
  return (client.from as unknown as (n: string) => AnyTable)(name);
}

function throwOnError<T>(result: {
  data: T | null;
  error: SupabaseError;
}): T {
  if (result.error || !result.data) {
    throw Object.assign(
      new Error(result.error?.message ?? "Unexpected database error."),
      { code: result.error?.code },
    );
  }
  return result.data;
}

/* -------------------------------------------------------------------------- */
/* Approved Budgets                                                            */
/* -------------------------------------------------------------------------- */

export type ListApprovedBudgetsOptions = {
  fiscalYear?: number;
  mdaId?: string;
};

export async function listApprovedBudgets(
  client: Client,
  options: ListApprovedBudgetsOptions = {},
): Promise<ApprovedBudgetRow[]> {
  let query: ListBuilder<unknown> = table(client, "approved_budgets")
    .select(BUDGET_SELECT)
    .order("fiscal_year", { ascending: false })
    .order("mda_id", { ascending: true });
  if (typeof options.fiscalYear === "number") {
    query = query.eq("fiscal_year", options.fiscalYear);
  }
  if (options.mdaId) {
    query = query.eq("mda_id", options.mdaId);
  }
  const result = await query;
  if (result.error) throw new Error(result.error.message);
  return (result.data ?? []) as ApprovedBudgetRow[];
}

export async function createApprovedBudget(
  client: Client,
  values: ValidatedApprovedBudget,
): Promise<ApprovedBudgetRow> {
  const result = await table(client, "approved_budgets")
    .insert({
      fiscal_year: values.fiscal_year,
      mda_id: values.mda_id,
      personnel_amount: values.personnel_amount,
      other_recurrent_amount: values.other_recurrent_amount,
      total_recurrent_amount: values.total_recurrent_amount,
      capital_amount: values.capital_amount,
      total_budget_amount: values.total_budget_amount,
      source_label: values.source_label,
    })
    .select(BUDGET_SELECT)
    .single();
  return throwOnError(result) as ApprovedBudgetRow;
}

export async function updateApprovedBudget(
  client: Client,
  id: string,
  values: ValidatedApprovedBudget,
): Promise<ApprovedBudgetRow> {
  const result = await table(client, "approved_budgets")
    .update({
      fiscal_year: values.fiscal_year,
      mda_id: values.mda_id,
      personnel_amount: values.personnel_amount,
      other_recurrent_amount: values.other_recurrent_amount,
      total_recurrent_amount: values.total_recurrent_amount,
      capital_amount: values.capital_amount,
      total_budget_amount: values.total_budget_amount,
      source_label: values.source_label,
    })
    .eq("id", id)
    .select(BUDGET_SELECT)
    .single();
  return throwOnError(result) as ApprovedBudgetRow;
}

/* -------------------------------------------------------------------------- */
/* AOP Activities                                                              */
/* -------------------------------------------------------------------------- */

export type ListAopActivitiesOptions = {
  fiscalYear?: number;
  mdaId?: string;
  includeInactive?: boolean;
};

export async function listAdminAopActivities(
  client: Client,
  options: ListAopActivitiesOptions = {},
): Promise<AopActivityRow[]> {
  let query: ListBuilder<unknown> = table(client, "aop_activities")
    .select(ACTIVITY_SELECT)
    .order("fiscal_year", { ascending: false })
    .order("activity_code", { ascending: true })
    .order("source_row_number", { ascending: true, nullsFirst: false });
  if (typeof options.fiscalYear === "number") {
    query = query.eq("fiscal_year", options.fiscalYear);
  }
  if (options.mdaId) {
    query = query.eq("mda_id", options.mdaId);
  }
  if (!options.includeInactive) {
    query = query.eq("active", true);
  }
  const result = await query;
  if (result.error) throw new Error(result.error.message);
  return (result.data ?? []) as AopActivityRow[];
}

export async function createAopActivity(
  client: Client,
  values: ValidatedAopActivity,
): Promise<AopActivityRow> {
  const result = await table(client, "aop_activities")
    .insert({
      fiscal_year: values.fiscal_year,
      mda_id: values.mda_id,
      activity_code: values.activity_code,
      description: values.description,
      budgeted_cost: values.budgeted_cost,
      source_row_number: values.source_row_number,
    })
    .select(ACTIVITY_SELECT)
    .single();
  return throwOnError(result) as AopActivityRow;
}

export async function updateAopActivity(
  client: Client,
  id: string,
  values: ValidatedAopActivity,
): Promise<AopActivityRow> {
  const result = await table(client, "aop_activities")
    .update({
      fiscal_year: values.fiscal_year,
      mda_id: values.mda_id,
      activity_code: values.activity_code,
      description: values.description,
      budgeted_cost: values.budgeted_cost,
      source_row_number: values.source_row_number,
    })
    .eq("id", id)
    .select(ACTIVITY_SELECT)
    .single();
  return throwOnError(result) as AopActivityRow;
}

export async function setAopActivityActive(
  client: Client,
  id: string,
  active: boolean,
): Promise<void> {
  const result = await table(client, "aop_activities")
    .update({ active })
    .eq("id", id);
  if (result.error) {
    throw Object.assign(new Error(result.error.message), {
      code: result.error.code,
    });
  }
}

/* -------------------------------------------------------------------------- */
/* Approved Budget Lines                                                       */
/* -------------------------------------------------------------------------- */

export type ListApprovedBudgetLinesOptions = {
  fiscalYear?: number;
  mdaIds?: string[];
  includeInactive?: boolean;
};

export type ApprovedBudgetLineStatus = "all" | "active" | "inactive";

export type ListApprovedBudgetLinesPageOptions = {
  page: number;
  pageSize: number;
  fiscalYear?: number;
  mdaId?: string;
  budgetClass?: "personnel" | "overhead" | "capital";
  status?: ApprovedBudgetLineStatus;
  search?: string;
};

export type ApprovedBudgetLinesPage = {
  rows: ApprovedBudgetLineRow[];
  count: number;
};

/**
 * PostgREST's `.or()` accepts raw filter syntax, so keep the free-text term to
 * ordinary searchable characters before interpolating it into `ilike` filters.
 */
export function sanitizeBudgetLineSearch(value: string): string {
  return value.replace(/[,%()]/g, " ").replace(/\s+/g, " ").trim();
}

/**
 * Lists the NCOA line-item detail behind the approved budget. The expenditure
 * form loads these for the MDAs a submitter can act on, then filters client-side
 * by the entry's MDA, fiscal year, and budget class so a state-budget entry can
 * bind to a specific line.
 */
export async function listApprovedBudgetLines(
  client: Client,
  options: ListApprovedBudgetLinesOptions = {},
): Promise<ApprovedBudgetLineRow[]> {
  let query = client
    .from("approved_budget_lines")
    .select(BUDGET_LINE_SELECT)
    .order("budget_class", { ascending: true })
    .order("economic_code", { ascending: true })
    .order("source_row_number", { ascending: true, nullsFirst: false });
  if (typeof options.fiscalYear === "number") {
    query = query.eq("fiscal_year", options.fiscalYear);
  }
  if (options.mdaIds && options.mdaIds.length > 0) {
    query = query.in("mda_id", options.mdaIds);
  }
  if (!options.includeInactive) {
    query = query.eq("active", true);
  }
  const { data, error } = await query;
  if (error) throw new Error(error.message);
  return (data ?? []) as unknown as ApprovedBudgetLineRow[];
}

/** Server-paginated admin listing with a deliberately narrow search surface. */
export async function listApprovedBudgetLinesPage(
  client: Client,
  options: ListApprovedBudgetLinesPageOptions,
): Promise<ApprovedBudgetLinesPage> {
  const page = Math.max(1, Math.trunc(options.page));
  const pageSize = Math.min(100, Math.max(1, Math.trunc(options.pageSize)));
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  let query = client
    .from("approved_budget_lines")
    .select(BUDGET_LINE_SELECT, { count: "exact" });

  if (typeof options.fiscalYear === "number") {
    query = query.eq("fiscal_year", options.fiscalYear);
  }
  if (options.mdaId) query = query.eq("mda_id", options.mdaId);
  if (options.budgetClass) {
    query = query.eq("budget_class", options.budgetClass);
  }
  if (options.status === "active") query = query.eq("active", true);
  if (options.status === "inactive") query = query.eq("active", false);

  const search = sanitizeBudgetLineSearch(options.search ?? "");
  if (search) {
    const pattern = `%${search}%`;
    query = query.or(
      [
        `economic_code.ilike.${pattern}`,
        `economic_description.ilike.${pattern}`,
        `project_description.ilike.${pattern}`,
        `function_code.ilike.${pattern}`,
        `programme_code.ilike.${pattern}`,
      ].join(","),
    );
  }

  const { data, error, count } = await query
    .order("fiscal_year", { ascending: false })
    .order("budget_class", { ascending: true })
    .order("economic_code", { ascending: true })
    .order("source_row_number", { ascending: true, nullsFirst: false })
    .range(from, to);

  if (error) throw new Error(error.message);
  return {
    rows: (data ?? []) as unknown as ApprovedBudgetLineRow[],
    count: count ?? 0,
  };
}

function budgetLinePayload(values: ValidatedApprovedBudgetLine) {
  return {
    fiscal_year: values.fiscal_year,
    mda_id: values.mda_id,
    budget_class: values.budget_class,
    economic_code: values.economic_code,
    economic_description: values.economic_description,
    project_description: values.project_description,
    function_code: values.function_code,
    location_code: values.location_code,
    fund_code: values.fund_code,
    programme_code: values.programme_code,
    approved_amount: values.approved_amount,
    source_label: values.source_label,
    source_row_number: values.source_row_number,
  };
}

export async function createApprovedBudgetLine(
  client: Client,
  values: ValidatedApprovedBudgetLine,
): Promise<ApprovedBudgetLineRow> {
  const result = await table(client, "approved_budget_lines")
    .insert(budgetLinePayload(values))
    .select(BUDGET_LINE_SELECT)
    .single();
  return throwOnError(result) as ApprovedBudgetLineRow;
}

export async function updateApprovedBudgetLine(
  client: Client,
  id: string,
  values: ValidatedApprovedBudgetLine,
): Promise<ApprovedBudgetLineRow> {
  const result = await table(client, "approved_budget_lines")
    .update(budgetLinePayload(values))
    .eq("id", id)
    .select(BUDGET_LINE_SELECT)
    .single();
  return throwOnError(result) as ApprovedBudgetLineRow;
}

export async function setApprovedBudgetLineActive(
  client: Client,
  id: string,
  active: boolean,
): Promise<void> {
  const result = await table(client, "approved_budget_lines")
    .update({ active })
    .eq("id", id);
  if (result.error) {
    throw Object.assign(new Error(result.error.message), {
      code: result.error.code,
    });
  }
}
