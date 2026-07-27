import type { TypedSupabaseClient } from "@/lib/supabase/client";
import type { Tables } from "@/lib/db/types";
import type { FundingOverAllocationWarning } from "@/lib/expenditure/funding-allocations";
import { allocationsToRpcPayload } from "@/lib/expenditure/funding-allocations";
import type { ValidatedExpenditureEntry } from "@/lib/expenditure/validation";

type Client = TypedSupabaseClient;

type RpcCallable = (
  fn: string,
  args: Record<string, unknown>,
) => Promise<{
  data: unknown;
  error: { message: string; code?: string } | null;
}>;

function asRpc(client: Client): RpcCallable {
  // Bind: SupabaseClient.rpc dereferences `this.rest`, so a detached method
  // throws "Cannot read properties of undefined (reading 'rest')".
  return (client.rpc.bind(client) as unknown) as RpcCallable;
}

export type EntryDataQualityWarningRow =
  Tables<"entry_data_quality_warnings">;

export async function listEntryDataQualityWarnings(
  client: Client,
  entryType: Tables<"entry_data_quality_warnings">["entry_type"],
  entryId: string,
): Promise<EntryDataQualityWarningRow[]> {
  const { data, error } = await client
    .from("entry_data_quality_warnings")
    .select("*")
    .eq("entry_type", entryType)
    .eq("entry_id", entryId)
    // Temporarily disabled: keep this warning out of entry detail and review
    // surfaces even before every environment has run the cleanup migration.
    .neq("warning_code", "funding_source_over_allocated")
    .is("resolved_at", null)
    .order("created_at", { ascending: true });
  if (error) throw error;
  return (data ?? []) as EntryDataQualityWarningRow[];
}

export async function evaluateExpenditureFundingWarnings(
  client: Client,
  args: {
    values: Pick<
      ValidatedExpenditureEntry,
      | "mda_id"
      | "fiscal_year"
      | "programme_area_id"
      | "funding_allocations"
    >;
    excludeExpenditureEntryId?: string | null;
  },
): Promise<FundingOverAllocationWarning[]> {
  const { data, error } = await asRpc(client)(
    "evaluate_expenditure_funding_warnings",
    {
      p_mda_id: args.values.mda_id,
      p_fiscal_year: args.values.fiscal_year,
      p_programme_area_id: args.values.programme_area_id,
      p_allocations: allocationsToRpcPayload(args.values.funding_allocations),
      p_exclude_expenditure_entry_id: args.excludeExpenditureEntryId ?? null,
    },
  );
  if (error) throw error;
  return (data ?? []) as FundingOverAllocationWarning[];
}
