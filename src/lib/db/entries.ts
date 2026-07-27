import type { TypedSupabaseClient } from "@/lib/supabase/client";
import type { EntryType, Tables } from "@/lib/db/types";

type Client = TypedSupabaseClient;

export type EntryCommentRow = Tables<"entry_comments">;
export type EntryAuditEventRow = Tables<"entry_audit_events"> & {
  actor: Pick<Tables<"profiles">, "id" | "full_name" | "role"> | null;
};
export type EntryAttachmentRow = Tables<"entry_attachments">;

function auditEntityType(entryType: EntryType): string {
  return entryType === "funding_entry" ? "funding_entries" : "expenditure_entries";
}

export async function listEntryComments(client: Client, entryType: EntryType, entryId: string) {
  const { data, error } = await client
    .from("entry_comments")
    .select("*")
    .eq("entry_type", entryType)
    .eq("entry_id", entryId)
    .order("created_at", { ascending: true });
  if (error) throw error;
  return (data ?? []) as unknown as EntryCommentRow[];
}

export async function insertEntryComment(
  client: Client,
  args: { entryType: EntryType; entryId: string; body: string; commentType?: "general" | "clarification"; authorId: string },
): Promise<void> {
  const builder = client.from("entry_comments") as unknown as {
    insert: (values: Record<string, unknown>) => Promise<{ error: { message: string } | null }>;
  };
  const { error } = await builder.insert({
    entry_type: args.entryType,
    entry_id: args.entryId,
    body: args.body,
    comment_type: args.commentType ?? "general",
    author_id: args.authorId,
  });
  if (error) throw error;
}

export async function listEntryAuditEvents(client: Client, entryType: EntryType, entryId: string) {
  const { data, error } = await client
    .from("entry_audit_events")
    .select("*, actor:profiles!entry_audit_events_actor_id_fkey(id, full_name, role)")
    .eq("entity_type", auditEntityType(entryType))
    .eq("entity_id", entryId)
    .order("created_at", { ascending: true });
  if (error) throw error;
  return (data ?? []) as unknown as EntryAuditEventRow[];
}

export async function listEntryAttachments(client: Client, entryType: EntryType, entryId: string) {
  const { data, error } = await client
    .from("entry_attachments")
    .select("*")
    .eq("entry_type", entryType)
    .eq("entry_id", entryId)
    .order("created_at", { ascending: true });
  if (error) throw error;
  return (data ?? []) as unknown as EntryAttachmentRow[];
}
