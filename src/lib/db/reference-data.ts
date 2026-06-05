import type { TypedSupabaseClient } from "@/lib/supabase/client";
import type { Tables } from "@/lib/db/types";

type Client = TypedSupabaseClient;

type ActiveReferenceOptions = {
  /**
   * Include inactive rows. Off by default — entry forms should only see active
   * Reference Data, but admin management screens often need to show inactive
   * entries so they can be re-activated.
   */
  includeInactive?: boolean;
};

type WithMdaType = Tables<"mdas"> & {
  mda_types: Pick<Tables<"mda_types">, "id" | "name" | "slug"> | null;
};

type WithCategory = Tables<"expenditure_items"> & {
  expenditure_categories: Pick<
    Tables<"expenditure_categories">,
    "id" | "name" | "slug"
  > | null;
};

type WithLga = Tables<"facilities"> & {
  lgas: Pick<Tables<"lgas">, "id" | "name"> | null;
};

function unwrap<Row>(result: {
  data: Row[] | null;
  error: { message: string } | null;
}): Row[] {
  if (result.error) throw new Error(result.error.message);
  return result.data ?? [];
}

export async function listMdas(
  client: Client,
  options: ActiveReferenceOptions = {},
): Promise<WithMdaType[]> {
  let query = client
    .from("mdas")
    .select("*, mda_types(id, name, slug)")
    .order("name", { ascending: true });
  if (!options.includeInactive) query = query.eq("active", true);
  return unwrap<WithMdaType>(await query);
}

export async function listProgrammeAreas(
  client: Client,
  options: ActiveReferenceOptions = {},
) {
  let query = client
    .from("programme_areas")
    .select("*")
    .order("name", { ascending: true });
  if (!options.includeInactive) query = query.eq("active", true);
  return unwrap<Tables<"programme_areas">>(await query);
}

export async function listFundingSources(
  client: Client,
  options: ActiveReferenceOptions = {},
) {
  let query = client
    .from("funding_sources")
    .select("*")
    .order("name", { ascending: true });
  if (!options.includeInactive) query = query.eq("active", true);
  return unwrap<Tables<"funding_sources">>(await query);
}

export async function listExpenditureCategories(
  client: Client,
  options: ActiveReferenceOptions = {},
) {
  let query = client
    .from("expenditure_categories")
    .select("*")
    .order("name", { ascending: true });
  if (!options.includeInactive) query = query.eq("active", true);
  return unwrap<Tables<"expenditure_categories">>(await query);
}

export async function listExpenditureItems(
  client: Client,
  options: ActiveReferenceOptions & { categoryId?: string } = {},
): Promise<WithCategory[]> {
  let query = client
    .from("expenditure_items")
    .select("*, expenditure_categories(id, name, slug)")
    .order("name", { ascending: true });
  if (!options.includeInactive) query = query.eq("active", true);
  if (options.categoryId) query = query.eq("expenditure_category_id", options.categoryId);
  return unwrap<WithCategory>(await query);
}

export async function listPaymentMethods(
  client: Client,
  options: ActiveReferenceOptions = {},
) {
  let query = client
    .from("payment_methods")
    .select("*")
    .order("name", { ascending: true });
  if (!options.includeInactive) query = query.eq("active", true);
  return unwrap<Tables<"payment_methods">>(await query);
}

export async function listEntryStatuses(client: Client) {
  return unwrap<Tables<"entry_statuses">>(
    await client.from("entry_statuses").select("*").eq("active", true),
  );
}

export async function listLgas(
  client: Client,
  options: ActiveReferenceOptions = {},
) {
  let query = client
    .from("lgas")
    .select("*")
    .order("name", { ascending: true });
  if (!options.includeInactive) query = query.eq("active", true);
  return unwrap<Tables<"lgas">>(await query);
}

export async function listFacilities(
  client: Client,
  options: ActiveReferenceOptions & { lgaId?: string } = {},
): Promise<WithLga[]> {
  let query = client
    .from("facilities")
    .select("*, lgas(id, name)")
    .order("name", { ascending: true });
  if (!options.includeInactive) query = query.eq("active", true);
  if (options.lgaId) query = query.eq("lga_id", options.lgaId);
  return unwrap<WithLga>(await query);
}

/**
 * AOP activities are filtered by MDA and fiscal year. Expenditure entries are
 * only allowed to reference activities matching the entry's MDA/fiscal year.
 */
export async function listAopActivities(
  client: Client,
  filters: { mdaId: string; fiscalYear: number; includeInactive?: boolean },
) {
  let query = client
    .from("aop_activities")
    .select("*")
    .eq("mda_id", filters.mdaId)
    .eq("fiscal_year", filters.fiscalYear)
    .order("activity_code", { ascending: true });
  if (!filters.includeInactive) query = query.eq("active", true);
  return unwrap<Tables<"aop_activities">>(await query);
}

/** Snapshot of every active dropdown set, useful for the initial form load. */
export async function loadEntryFormReferenceData(client: Client) {
  const [
    mdas,
    programmeAreas,
    fundingSources,
    expenditureCategories,
    expenditureItems,
    paymentMethods,
    lgas,
    facilities,
  ] = await Promise.all([
    listMdas(client),
    listProgrammeAreas(client),
    listFundingSources(client),
    listExpenditureCategories(client),
    listExpenditureItems(client),
    listPaymentMethods(client),
    listLgas(client),
    listFacilities(client),
  ]);

  return {
    mdas,
    programmeAreas,
    fundingSources,
    expenditureCategories,
    expenditureItems,
    paymentMethods,
    lgas,
    facilities,
  };
}

export type EntryFormReferenceData = Awaited<
  ReturnType<typeof loadEntryFormReferenceData>
>;
