import type { TypedSupabaseClient } from "@/lib/supabase/client";
import type { TableInsert, Tables } from "@/lib/db/types";
import type { ValidatedExpenditureEntry } from "@/lib/expenditure/validation";

type Client = TypedSupabaseClient;

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
};

const SELECT_WITH_RELATIONS =
  "*, mdas(id, name, abbreviation), programme_areas(id, name), expenditure_categories(id, name), expenditure_items(id, name), payment_methods(id, name), lgas(id, name), facilities(id, name), aop_activities(id, activity_code, description)";

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
};

export type ListExpenditureEntriesOptions = {
  mdaIds?: string[];
  status?: Tables<"expenditure_entries">["status"];
  limit?: number;
};

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
  if (options.status) {
    query = query.eq("status", options.status);
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
    aop_activity_id: values.aop_activity_id,
    is_phc: values.is_phc,
    lga_id: values.lga_id,
    facility_id: values.facility_id,
    amount: values.amount,
    voucher_ref_no: values.voucher_ref_no,
    payment_method_id: values.payment_method_id,
    remarks: values.remarks,
    entered_by: enteredBy,
    status: "pending",
  };
  const builder = client.from("expenditure_entries") as unknown as WriteBuilder;
  const { data, error } = await builder
    .insert(insertRow)
    .select(SELECT_WITH_RELATIONS)
    .single();
  if (error) throw error;
  if (!data) throw new Error("Insert returned no row.");
  return data;
}

export async function updatePendingExpenditureEntry(
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
    .eq("status", "pending")
    .select(SELECT_WITH_RELATIONS)
    .single();
  if (error) throw error;
  if (!data) throw new Error("Update returned no row.");
  return data;
}
