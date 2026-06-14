import type { TypedSupabaseClient } from "@/lib/supabase/client";
import type { TableInsert, Tables } from "@/lib/db/types";
import type { ValidatedFundingEntry } from "@/lib/funding/validation";

type Client = TypedSupabaseClient;

export type FundingEntryRow = Tables<"funding_entries"> & {
  mdas: Pick<Tables<"mdas">, "id" | "name" | "abbreviation"> | null;
  programme_areas: Pick<Tables<"programme_areas">, "id" | "name"> | null;
  funding_sources: Pick<Tables<"funding_sources">, "id" | "name"> | null;
};

const SELECT_WITH_RELATIONS =
  "*, mdas(id, name, abbreviation), programme_areas(id, name), funding_sources(id, name)";

type SelectChain = {
  select: (cols: string) => {
    single: () => Promise<{
      data: FundingEntryRow | null;
      error: { message: string; code?: string } | null;
    }>;
  };
};

type WriteBuilder = {
  insert: (values: TableInsert<"funding_entries">) => SelectChain;
  update: (values: Partial<TableInsert<"funding_entries">>) => {
    eq: (
      column: string,
      value: string | number | boolean,
    ) => ReturnType<WriteBuilder["update"]>;
  } & SelectChain;
};

export type ListFundingEntriesOptions = {
  mdaIds?: string[];
  status?: Tables<"funding_entries">["status"];
  fiscalYear?: number;
  dateFrom?: string;
  dateTo?: string;
  limit?: number;
};

export async function listFundingEntries(
  client: Client,
  options: ListFundingEntriesOptions = {},
): Promise<FundingEntryRow[]> {
  let query = client
    .from("funding_entries")
    .select(SELECT_WITH_RELATIONS)
    .order("created_at", { ascending: false });

  if (options.mdaIds && options.mdaIds.length > 0) {
    query = query.in("mda_id", options.mdaIds);
  }
  if (options.status) {
    query = query.eq("status", options.status);
  }
  if (options.fiscalYear) {
    query = query.eq("fiscal_year", options.fiscalYear);
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
  return (data ?? []) as unknown as FundingEntryRow[];
}

export async function getFundingEntry(
  client: Client,
  id: string,
): Promise<FundingEntryRow | null> {
  const { data, error } = await client
    .from("funding_entries")
    .select(SELECT_WITH_RELATIONS)
    .eq("id", id)
    .maybeSingle();
  if (error) throw error;
  return (data ?? null) as unknown as FundingEntryRow | null;
}

export async function insertFundingEntry(
  client: Client,
  values: ValidatedFundingEntry,
  enteredBy: string,
): Promise<FundingEntryRow> {
  const insertRow: TableInsert<"funding_entries"> = {
    transaction_date: values.transaction_date,
    mda_id: values.mda_id,
    programme_area_id: values.programme_area_id,
    funding_source_id: values.funding_source_id,
    amount: values.amount,
    reference_no: values.reference_no,
    remarks: values.remarks,
    entered_by: enteredBy,
    status: "pending",
  };
  // The hand-authored Database types don't yet describe the table
  // `Relationships`, which causes supabase-js v2 to infer Insert as `never`
  // for write paths. Cast to a typed builder here; runtime behavior and the
  // parsed `data` shape are still strongly typed by `FundingEntryRow`.
  const builder = client.from("funding_entries") as unknown as WriteBuilder;
  const { data, error } = await builder
    .insert(insertRow)
    .select(SELECT_WITH_RELATIONS)
    .single();
  if (error) throw error;
  if (!data) throw new Error("Insert returned no row.");
  return data;
}

export async function updatePendingFundingEntry(
  client: Client,
  id: string,
  values: ValidatedFundingEntry,
): Promise<FundingEntryRow> {
  const updateRow = {
    transaction_date: values.transaction_date,
    mda_id: values.mda_id,
    programme_area_id: values.programme_area_id,
    funding_source_id: values.funding_source_id,
    amount: values.amount,
    reference_no: values.reference_no,
    remarks: values.remarks,
  };
  const builder = client.from("funding_entries") as unknown as WriteBuilder;
  const { data, error } = await builder
    .update(updateRow)
    .eq("id", id)
    .eq("status", "pending")
    .select(SELECT_WITH_RELATIONS)
    .single();
  if (error) throw error;
  if (!data) throw new Error("Update returned no row.");
  return data;
}
