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
} from "@/lib/planning/validation";

type Client = TypedSupabaseClient;
type SupabaseError = { message: string; code?: string } | null;

export type ApprovedBudgetRow = Tables<"approved_budgets"> & {
  mdas: Pick<Tables<"mdas">, "id" | "name" | "abbreviation"> | null;
};

export type AopActivityRow = Tables<"aop_activities"> & {
  mdas: Pick<Tables<"mdas">, "id" | "name" | "abbreviation"> | null;
};

const BUDGET_SELECT = "*, mdas(id, name, abbreviation)";
const ACTIVITY_SELECT = "*, mdas(id, name, abbreviation)";

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
