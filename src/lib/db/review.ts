import type { TypedSupabaseClient } from "@/lib/supabase/client";
import type { EntryType, Tables } from "@/lib/db/types";
import type { ReviewAction } from "@/lib/review/transitions";
import type { ValidatedFundingEntry } from "@/lib/funding/validation";
import type { ValidatedExpenditureEntry } from "@/lib/expenditure/validation";

type Client = TypedSupabaseClient;

// supabase-js v2's generic `rpc<FnName, Args = never>` defaults Args to `never`
// and TypeScript struggles to infer it from a passed object literal, so the
// untyped second arg surfaces as "not assignable to undefined". Our function
// wrappers below already validate the parameter shape, so we cast `rpc` to a
// relaxed signature here. Behavior is unchanged; the RPC name and payload
// are still strongly typed at every call site that imports a wrapper.
type RpcArgs = Record<string, unknown>;
type RpcResult = { error: { message: string; code?: string } | null };
type RpcCallable = (fn: string, args: RpcArgs) => Promise<RpcResult>;
function asRpc(client: Client): RpcCallable {
  return (client.rpc as unknown) as RpcCallable;
}

export type EntryCommentRow = Tables<"entry_comments"> & {
  author: Pick<Tables<"profiles">, "id" | "full_name" | "role"> | null;
};

export type EntryAuditEventRow = Tables<"entry_audit_events"> & {
  actor: Pick<Tables<"profiles">, "id" | "full_name" | "role"> | null;
};

export type EntryAttachmentRow = Tables<"entry_attachments">;

/** entity_type used by the audit table for funding/expenditure rows. */
function auditEntityType(entryType: EntryType): string {
  return entryType === "funding_entry"
    ? "funding_entries"
    : "expenditure_entries";
}

export async function listEntryComments(
  client: Client,
  entryType: EntryType,
  entryId: string,
): Promise<EntryCommentRow[]> {
  const { data, error } = await client
    .from("entry_comments")
    .select("*, author:profiles!entry_comments_author_id_fkey(id, full_name, role)")
    .eq("entry_type", entryType)
    .eq("entry_id", entryId)
    .order("created_at", { ascending: true });
  if (error) throw error;
  return (data ?? []) as unknown as EntryCommentRow[];
}

export async function insertEntryComment(
  client: Client,
  args: {
    entryType: EntryType;
    entryId: string;
    body: string;
    commentType?: Tables<"entry_comments">["comment_type"];
    authorId: string;
  },
): Promise<void> {
  const builder = client.from("entry_comments") as unknown as {
    insert: (
      values: Tables<"entry_comments"> extends infer R
        ? Partial<R> & { body: string }
        : never,
    ) => Promise<{ error: { message: string } | null }>;
  };
  const { error } = await builder.insert({
    entry_type: args.entryType,
    entry_id: args.entryId,
    body: args.body,
    comment_type: args.commentType ?? "general",
    author_id: args.authorId,
  } as never);
  if (error) throw error;
}

export async function listEntryAuditEvents(
  client: Client,
  entryType: EntryType,
  entryId: string,
): Promise<EntryAuditEventRow[]> {
  const { data, error } = await client
    .from("entry_audit_events")
    .select("*, actor:profiles!entry_audit_events_actor_id_fkey(id, full_name, role)")
    .eq("entity_type", auditEntityType(entryType))
    .eq("entity_id", entryId)
    .order("created_at", { ascending: true });
  if (error) throw error;
  return (data ?? []) as unknown as EntryAuditEventRow[];
}

export async function listEntryAttachments(
  client: Client,
  entryType: EntryType,
  entryId: string,
): Promise<EntryAttachmentRow[]> {
  const { data, error } = await client
    .from("entry_attachments")
    .select("*")
    .eq("entry_type", entryType)
    .eq("entry_id", entryId)
    .order("created_at", { ascending: true });
  if (error) throw error;
  return (data ?? []) as unknown as EntryAttachmentRow[];
}

export async function reviewEntry(
  client: Client,
  args: {
    entryType: EntryType;
    entryId: string;
    action: ReviewAction;
    reason?: string | null;
    comment?: string | null;
  },
): Promise<void> {
  const { error } = await asRpc(client)("review_entry", {
    p_entry_type: args.entryType,
    p_entry_id: args.entryId,
    p_action: args.action,
    p_reason: args.reason ?? null,
    p_comment: args.comment ?? null,
  });
  if (error) throw error;
}

export async function resubmitEntry(
  client: Client,
  args: { entryType: EntryType; entryId: string },
): Promise<void> {
  const { error } = await asRpc(client)("resubmit_entry", {
    p_entry_type: args.entryType,
    p_entry_id: args.entryId,
  });
  if (error) throw error;
}

export async function updateReviewedFundingEntry(
  client: Client,
  args: {
    entryId: string;
    reason: string;
    values: ValidatedFundingEntry;
  },
): Promise<void> {
  const { error } = await asRpc(client)("update_reviewed_funding_entry", {
    p_id: args.entryId,
    p_reason: args.reason,
    p_transaction_date: args.values.transaction_date,
    p_mda_id: args.values.mda_id,
    p_programme_area_id: args.values.programme_area_id,
    p_funding_source_id: args.values.funding_source_id,
    p_amount: args.values.amount,
    p_reference_no: args.values.reference_no,
    p_remarks: args.values.remarks,
  });
  if (error) throw error;
}

export async function updateReviewedExpenditureEntry(
  client: Client,
  args: {
    entryId: string;
    reason: string;
    values: ValidatedExpenditureEntry;
  },
): Promise<void> {
  const { error } = await asRpc(client)("update_reviewed_expenditure_entry", {
    p_id: args.entryId,
    p_reason: args.reason,
    p_transaction_date: args.values.transaction_date,
    p_mda_id: args.values.mda_id,
    p_programme_area_id: args.values.programme_area_id,
    p_expenditure_category_id: args.values.expenditure_category_id,
    p_expenditure_item_id: args.values.expenditure_item_id,
    p_aop_activity_id: args.values.aop_activity_id,
    p_is_phc: args.values.is_phc,
    p_lga_id: args.values.lga_id,
    p_facility_id: args.values.facility_id,
    p_amount: args.values.amount,
    p_voucher_ref_no: args.values.voucher_ref_no,
    p_payment_method_id: args.values.payment_method_id,
    p_remarks: args.values.remarks,
  });
  if (error) throw error;
}
