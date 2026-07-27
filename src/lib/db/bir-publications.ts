import type { TypedSupabaseClient } from "@/lib/supabase/client";
import type {
  BirAmendment,
  BirPublication,
  EntryType,
  FiscalPeriod,
  FiscalQuarter,
} from "@/lib/db/types";
import type { ValidatedFundingEntry } from "@/lib/funding/validation";
import type { ValidatedExpenditureEntry } from "@/lib/expenditure/validation";
import { allocationsToRpcPayload } from "@/lib/expenditure/funding-allocations";

type Client = TypedSupabaseClient;
type DbError = { message: string; code?: string; hint?: string };
type RpcResult<T> = { data: T | null; error: DbError | null };
type Rpc = <T>(name: string, args: Record<string, unknown>) => Promise<RpcResult<T>>;

function rpc(client: Client): Rpc {
  return client.rpc.bind(client) as unknown as Rpc;
}

export type BirPublicationWithPublisher = BirPublication & {
  publisher: { id: string; full_name: string } | null;
};

export async function listBirPublications(
  client: Client,
  fiscalYear?: number,
): Promise<BirPublicationWithPublisher[]> {
  let query = client
    .from("budget_implementation_report_publications")
    .select("*, publisher:profiles!budget_implementation_report_publications_published_by_fkey(id, full_name)")
    .order("fiscal_year", { ascending: false })
    .order("quarter", { ascending: false })
    .order("version", { ascending: false });
  if (fiscalYear) query = query.eq("fiscal_year", fiscalYear);
  const { data, error } = await query;
  if (error) throw error;
  return (data ?? []) as unknown as BirPublicationWithPublisher[];
}

export async function getLatestBirPublication(
  client: Client,
  period: FiscalPeriod,
): Promise<BirPublicationWithPublisher | null> {
  const { data, error } = await client
    .from("budget_implementation_report_publications")
    .select("*, publisher:profiles!budget_implementation_report_publications_published_by_fkey(id, full_name)")
    .eq("fiscal_year", period.fiscalYear)
    .eq("quarter", period.quarter)
    .order("version", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return (data ?? null) as unknown as BirPublicationWithPublisher | null;
}

export async function publishBirQuarter(
  client: Client,
  fiscalYear: number,
  quarter: FiscalQuarter,
): Promise<BirPublication> {
  const { data, error } = await rpc(client)<BirPublication>(
    "publish_budget_implementation_report",
    { p_fiscal_year: fiscalYear, p_quarter: quarter },
  );
  if (error) throw error;
  if (!data) throw new Error("Publication returned no metadata.");
  return data;
}

export async function listBirAmendments(
  client: Client,
  entryType: EntryType,
  entryId: string,
): Promise<BirAmendment[]> {
  const { data, error } = await client
    .from("budget_implementation_report_amendments")
    .select("*")
    .eq("entry_type", entryType)
    .eq("entry_id", entryId)
    .order("amended_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as unknown as BirAmendment[];
}

function fundingArgs(entryId: string, reason: string, values: ValidatedFundingEntry) {
  return {
    p_id: entryId,
    p_reason: reason,
    p_transaction_date: values.transaction_date,
    p_mda_id: values.mda_id,
    p_programme_area_id: values.programme_area_id,
    p_funding_source_id: values.funding_source_id,
    p_amount: values.amount,
    p_reference_no: values.reference_no,
    p_remarks: values.remarks,
  };
}

function expenditureArgs(entryId: string, reason: string, values: ValidatedExpenditureEntry) {
  return {
    p_id: entryId,
    p_reason: reason,
    p_transaction_date: values.transaction_date,
    p_mda_id: values.mda_id,
    p_programme_area_id: values.programme_area_id,
    p_expenditure_category_id: values.expenditure_category_id,
    p_expenditure_item_id: values.expenditure_item_id,
    p_aop_activity_id: values.aop_activity_id,
    p_is_phc: values.is_phc,
    p_lga_id: values.lga_id,
    p_facility_id: values.facility_id,
    p_amount: values.amount,
    p_voucher_ref_no: values.voucher_ref_no,
    p_payment_method_id: values.payment_method_id,
    p_remarks: values.remarks,
    p_allocations: allocationsToRpcPayload(values.funding_allocations),
  };
}

export async function correctUnpublishedFundingEntry(
  client: Client,
  entryId: string,
  reason: string,
  values: ValidatedFundingEntry,
): Promise<void> {
  const { error } = await rpc(client)<void>(
    "correct_unpublished_funding_entry",
    fundingArgs(entryId, reason, values),
  );
  if (error) throw error;
}

export async function correctUnpublishedExpenditureEntry(
  client: Client,
  entryId: string,
  reason: string,
  values: ValidatedExpenditureEntry,
): Promise<void> {
  const { error } = await rpc(client)<void>(
    "correct_unpublished_expenditure_entry",
    expenditureArgs(entryId, reason, values),
  );
  if (error) throw error;
}

export async function amendPublishedFundingEntry(
  client: Client,
  entryId: string,
  reason: string,
  values: ValidatedFundingEntry,
): Promise<BirPublication> {
  const { data, error } = await rpc(client)<BirPublication>(
    "amend_published_funding_entry",
    fundingArgs(entryId, reason, values),
  );
  if (error) throw error;
  if (!data) throw new Error("Amendment returned no publication metadata.");
  return data;
}

export async function amendPublishedExpenditureEntry(
  client: Client,
  entryId: string,
  reason: string,
  values: ValidatedExpenditureEntry,
): Promise<BirPublication> {
  const { data, error } = await rpc(client)<BirPublication>(
    "amend_published_expenditure_entry",
    expenditureArgs(entryId, reason, values),
  );
  if (error) throw error;
  if (!data) throw new Error("Amendment returned no publication metadata.");
  return data;
}

export function transactionPeriod(transactionDate: string): FiscalPeriod {
  const date = new Date(`${transactionDate}T00:00:00Z`);
  return {
    fiscalYear: date.getUTCFullYear(),
    quarter: (Math.floor(date.getUTCMonth() / 3) + 1) as FiscalQuarter,
  };
}

export function isPublishedPeriod(
  publications: readonly BirPublication[],
  transactionDate: string,
): boolean {
  const period = transactionPeriod(transactionDate);
  return publications.some(
    (publication) =>
      publication.fiscal_year === period.fiscalYear &&
      publication.quarter === period.quarter,
  );
}

/**
 * Safely reads fiscal periods from persisted browser data. Older offline cache
 * snapshots predate BIR publication metadata and therefore omit this field.
 */
export function normaliseFiscalPeriods(value: unknown): FiscalPeriod[] {
  if (!Array.isArray(value)) return [];
  return value.filter(
    (period): period is FiscalPeriod =>
      typeof period === "object" &&
      period !== null &&
      Number.isInteger((period as FiscalPeriod).fiscalYear) &&
      [1, 2, 3, 4].includes((period as FiscalPeriod).quarter),
  );
}
