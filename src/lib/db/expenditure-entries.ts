import type { TypedSupabaseClient } from "@/lib/supabase/client";
import type { TableInsert, Tables } from "@/lib/db/types";
import {
  allocationsToRpcPayload,
  type ExpenditureFundingAllocationRow,
} from "@/lib/expenditure/funding-allocations";
import type { ValidatedExpenditureEntry } from "@/lib/expenditure/validation";

type Client = TypedSupabaseClient;

type RpcCallable = (
  fn: string,
  args: Record<string, unknown>,
) => Promise<{ error: { message: string; code?: string } | null }>;

function asRpc(client: Client): RpcCallable {
  // Bind: SupabaseClient.rpc dereferences `this.rest`, so a detached method
  // throws "Cannot read properties of undefined (reading 'rest')".
  return (client.rpc.bind(client) as unknown) as RpcCallable;
}

export type ExpenditureEntryRow = Tables<"expenditure_entries"> & {
  mdas: Pick<Tables<"mdas">, "id" | "name" | "abbreviation"> | null;
  programme_areas: Pick<Tables<"programme_areas">, "id" | "name"> | null;
  expenditure_categories: Pick<
    Tables<"expenditure_categories">,
    "id" | "name"
  > | null;
  expenditure_items: Pick<Tables<"expenditure_items">, "id" | "name"> | null;
  payment_methods: Pick<Tables<"payment_methods">, "id" | "name"> | null;
  lgas: Pick<Tables<"lgas">, "id" | "name"> | null;
  facilities: Pick<Tables<"facilities">, "id" | "name"> | null;
  aop_activities:
    | Pick<Tables<"aop_activities">, "id" | "activity_code" | "description">
    | null;
  approved_budget_lines:
    | Pick<
        Tables<"approved_budget_lines">,
        | "id"
        | "budget_class"
        | "economic_code"
        | "economic_description"
        | "project_description"
        | "approved_amount"
      >
    | null;
  expenditure_funding_allocations: ExpenditureFundingAllocationRow[] | null;
};

const ALLOCATION_SELECT =
  "expenditure_funding_allocations(id, funding_source_id, amount, funding_sources(id, name))";

const SELECT_WITH_RELATIONS = `*, mdas(id, name, abbreviation), programme_areas(id, name), expenditure_categories(id, name), expenditure_items(id, name), payment_methods(id, name), lgas(id, name), facilities(id, name), aop_activities(id, activity_code, description), approved_budget_lines(id, budget_class, economic_code, economic_description, project_description, approved_amount), ${ALLOCATION_SELECT}`;

type SelectChain = {
  select: (cols: string) => {
    single: () => Promise<{
      data: ExpenditureEntryRow | null;
      error: { message: string; code?: string } | null;
    }>;
  };
};

type WriteBuilder = {
  insert: (values: TableInsert<"expenditure_entries">) => SelectChain;
  update: (values: Partial<TableInsert<"expenditure_entries">>) => {
    eq: (
      column: string,
      value: string | number | boolean,
    ) => ReturnType<WriteBuilder["update"]>;
  } & SelectChain;
  delete: () => {
    eq: (
      column: string,
      value: string,
    ) => Promise<{ error: { message: string; code?: string } | null }>;
  };
};

export type ListExpenditureEntriesOptions = {
  mdaIds?: string[];
  fiscalYear?: number;
  quarter?: number;
  dateFrom?: string;
  dateTo?: string;
  limit?: number;
};

export async function replaceExpenditureFundingAllocations(
  client: Client,
  expenditureEntryId: string,
  values: ValidatedExpenditureEntry,
): Promise<void> {
  const { error } = await asRpc(client)("replace_expenditure_funding_allocations", {
    p_expenditure_entry_id: expenditureEntryId,
    p_allocations: allocationsToRpcPayload(values.funding_allocations),
  });
  if (error) throw error;
}

export async function listExpenditureEntries(
  client: Client,
  options: ListExpenditureEntriesOptions = {},
): Promise<ExpenditureEntryRow[]> {
  let query = client
    .from("expenditure_entries")
    .select(SELECT_WITH_RELATIONS)
    .order("created_at", { ascending: false });

  if (options.mdaIds && options.mdaIds.length > 0) {
    query = query.in("mda_id", options.mdaIds);
  }
  if (options.fiscalYear) {
    query = query.eq("fiscal_year", options.fiscalYear);
  }
  if (options.quarter) {
    query = query.eq("quarter", options.quarter);
  }
  if (options.dateFrom) {
    query = query.gte("transaction_date", options.dateFrom);
  }
  if (options.dateTo) {
    query = query.lte("transaction_date", options.dateTo);
  }
  if (options.limit) {
    query = query.limit(options.limit);
  }

  const { data, error } = await query;
  if (error) throw error;
  return (data ?? []) as unknown as ExpenditureEntryRow[];
}

export async function getExpenditureEntry(
  client: Client,
  id: string,
): Promise<ExpenditureEntryRow | null> {
  const { data, error } = await client
    .from("expenditure_entries")
    .select(SELECT_WITH_RELATIONS)
    .eq("id", id)
    .maybeSingle();
  if (error) throw error;
  return (data ?? null) as unknown as ExpenditureEntryRow | null;
}

export async function insertExpenditureEntry(
  client: Client,
  values: ValidatedExpenditureEntry,
  enteredBy: string,
): Promise<ExpenditureEntryRow> {
  const insertRow: TableInsert<"expenditure_entries"> = {
    transaction_date: values.transaction_date,
    mda_id: values.mda_id,
    programme_area_id: values.programme_area_id,
    expenditure_category_id: values.expenditure_category_id,
    expenditure_item_id: values.expenditure_item_id,
    approved_budget_line_id: values.approved_budget_line_id,
    aop_activity_id: values.aop_activity_id,
    is_phc: values.is_phc,
    lga_id: values.lga_id,
    facility_id: values.facility_id,
    amount: values.amount,
    voucher_ref_no: values.voucher_ref_no,
    payment_method_id: values.payment_method_id,
    remarks: values.remarks,
    entered_by: enteredBy,
  };
  const builder = client.from("expenditure_entries") as unknown as WriteBuilder;
  const { data, error } = await builder
    .insert(insertRow)
    .select(SELECT_WITH_RELATIONS)
    .single();
  if (error) throw error;
  if (!data) throw new Error("Insert returned no row.");

  try {
    await replaceExpenditureFundingAllocations(client, data.id, values);
  } catch (allocationError) {
    await builder.delete().eq("id", data.id);
    throw allocationError;
  }

  const saved = await getExpenditureEntry(client, data.id);
  if (!saved) throw new Error("Insert returned no row.");
  return saved;
}

export async function updateExpenditureEntry(
  client: Client,
  id: string,
  values: ValidatedExpenditureEntry,
): Promise<ExpenditureEntryRow> {
  const updateRow = {
    transaction_date: values.transaction_date,
    mda_id: values.mda_id,
    programme_area_id: values.programme_area_id,
    expenditure_category_id: values.expenditure_category_id,
    expenditure_item_id: values.expenditure_item_id,
    approved_budget_line_id: values.approved_budget_line_id,
    aop_activity_id: values.aop_activity_id,
    is_phc: values.is_phc,
    lga_id: values.lga_id,
    facility_id: values.facility_id,
    amount: values.amount,
    voucher_ref_no: values.voucher_ref_no,
    payment_method_id: values.payment_method_id,
    remarks: values.remarks,
  };
  const builder = client.from("expenditure_entries") as unknown as WriteBuilder;
  const { data, error } = await builder
    .update(updateRow)
    .eq("id", id)
    .select(SELECT_WITH_RELATIONS)
    .single();
  if (error) throw error;
  if (!data) throw new Error("Update returned no row.");

  await replaceExpenditureFundingAllocations(client, id, values);

  const saved = await getExpenditureEntry(client, id);
  if (!saved) throw new Error("Update returned no row.");
  return saved;
}

/**
 * Committed spend against an approved budget line, for the form's soft
 * remaining-balance warning. Counts every active entry bound to the line
 * (optionally excluding the entry being edited) and returns it alongside the
 * line's approved amount.
 */
export async function getApprovedBudgetLineBalance(
  client: Client,
  lineId: string,
  excludeEntryId?: string | null,
): Promise<{ approved_amount: number; spent_amount: number }> {
  const linePromise = client
    .from("approved_budget_lines")
    .select("approved_amount")
    .eq("id", lineId)
    .maybeSingle();

  let entriesQuery = client
    .from("expenditure_entries")
    .select("amount")
    .eq("approved_budget_line_id", lineId);
  if (excludeEntryId) {
    entriesQuery = entriesQuery.neq("id", excludeEntryId);
  }

  const [lineResult, entriesResult] = await Promise.all([
    linePromise,
    entriesQuery,
  ]);
  if (lineResult.error) throw lineResult.error;
  if (entriesResult.error) throw entriesResult.error;

  const approved = Number(
    (lineResult.data as { approved_amount: number } | null)?.approved_amount ??
      0,
  );
  const spent = ((entriesResult.data ?? []) as Array<{ amount: number }>).reduce(
    (sum, row) => sum + Number(row.amount),
    0,
  );
  return { approved_amount: approved, spent_amount: spent };
}

export async function listExpenditureAllocationBalances(
  client: Client,
  mdaIds?: string[],
): Promise<
  Array<{
    expenditure_entry_id: string;
    funding_source_id: string;
    amount: number;
    mda_id: string;
    fiscal_year: number;
    programme_area_id: string;
  }>
> {
  let query = client
    .from("expenditure_funding_allocations")
    .select(
      "funding_source_id, amount, expenditure_entries!inner(id, mda_id, fiscal_year, programme_area_id)",
    );

  if (mdaIds && mdaIds.length > 0) {
    query = query.in("expenditure_entries.mda_id", mdaIds);
  }

  const { data, error } = await query;
  if (error) throw error;

  type RawAllocationRow = {
    funding_source_id: string;
    amount: number;
    expenditure_entries: {
      id: string;
      mda_id: string;
      fiscal_year: number;
      programme_area_id: string;
    };
  };

  return ((data ?? []) as unknown as RawAllocationRow[]).map((row) => ({
    expenditure_entry_id: row.expenditure_entries.id,
    funding_source_id: row.funding_source_id,
    amount: Number(row.amount),
    mda_id: row.expenditure_entries.mda_id,
    fiscal_year: row.expenditure_entries.fiscal_year,
    programme_area_id: row.expenditure_entries.programme_area_id,
  }));
}
