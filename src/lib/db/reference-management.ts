/**
 * Admin Reference Data CRUD with deactivate/reactivate semantics.
 *
 * The Postgres tables use `on delete restrict` for downstream foreign keys,
 * so destructive deletes would fail the moment a value is referenced. The
 * UI never offers delete; admins toggle `active` instead, which keeps
 * historical Funding/Expenditure entries intact while removing the value
 * from new-entry dropdowns.
 *
 * RLS enforces admin-only writes (`reference_admin_*` policies in
 * `supabase/migrations/202605290001_initial_schema.sql`). These helpers
 * surface the same shape regardless of which table is being mutated so the
 * `reference-data-manager` UI can dispatch by `ReferenceKind`.
 */

import type { TypedSupabaseClient } from "@/lib/supabase/client";
import type { ReferenceKind, ReferenceMeta } from "@/lib/reference/types";
import { getReferenceMeta } from "@/lib/reference/types";
import type { ValidatedReferenceValues } from "@/lib/reference/validation";

type Client = TypedSupabaseClient;

type WriteResult = {
  id: string;
};

type SupabaseError = { message: string; code?: string } | null;

function pickInsertValues(
  meta: ReferenceMeta,
  values: ValidatedReferenceValues,
): Record<string, unknown> {
  switch (meta.kind) {
    case "mda":
      return {
        name: values.name,
        code: values.code,
        abbreviation: values.abbreviation ?? null,
        mda_type_id: values.mda_type_id ?? null,
      };
    case "expenditure_item":
      return {
        name: values.name,
        slug: values.slug,
        expenditure_category_id: values.expenditure_category_id ?? null,
      };
    case "facility":
      return {
        name: values.name,
        lga_id: values.lga_id,
        facility_type: values.facility_type,
      };
    case "lga":
      return { name: values.name };
    default:
      return { name: values.name, slug: values.slug };
  }
}

function pickUpdateValues(
  meta: ReferenceMeta,
  values: ValidatedReferenceValues,
): Record<string, unknown> {
  // For updates we don't change slugs/codes silently; only the fields the
  // admin can actually edit in the form.
  switch (meta.kind) {
    case "mda":
      return {
        name: values.name,
        code: values.code,
        abbreviation: values.abbreviation ?? null,
        mda_type_id: values.mda_type_id ?? null,
      };
    case "expenditure_item":
      return {
        name: values.name,
        expenditure_category_id: values.expenditure_category_id ?? null,
      };
    case "facility":
      return {
        name: values.name,
        lga_id: values.lga_id,
        facility_type: values.facility_type,
      };
    default:
      return { name: values.name };
  }
}

type AnyTable = {
  insert: (
    row: Record<string, unknown>,
  ) => {
    select: (cols: string) => {
      single: () => Promise<{ data: { id: string } | null; error: SupabaseError }>;
    };
  };
  update: (
    row: Record<string, unknown>,
  ) => {
    eq: (
      column: string,
      value: string,
    ) => Promise<{ error: SupabaseError }>;
  };
};

function table(client: Client, name: string): AnyTable {
  return (client.from as unknown as (n: string) => AnyTable)(name);
}

export async function createReferenceValue(
  client: Client,
  kind: ReferenceKind,
  values: ValidatedReferenceValues,
): Promise<WriteResult> {
  const meta = getReferenceMeta(kind);
  const row = pickInsertValues(meta, values);
  const { data, error } = await table(client, meta.table)
    .insert(row)
    .select("id")
    .single();
  if (error || !data) {
    throw Object.assign(new Error(error?.message ?? "Failed to create value."), {
      code: error?.code,
    });
  }
  return { id: data.id };
}

export async function updateReferenceValue(
  client: Client,
  kind: ReferenceKind,
  id: string,
  values: ValidatedReferenceValues,
): Promise<void> {
  const meta = getReferenceMeta(kind);
  const row = pickUpdateValues(meta, values);
  const { error } = await table(client, meta.table).update(row).eq("id", id);
  if (error) {
    throw Object.assign(new Error(error.message), { code: error.code });
  }
}

export async function setReferenceActive(
  client: Client,
  kind: ReferenceKind,
  id: string,
  active: boolean,
): Promise<void> {
  const meta = getReferenceMeta(kind);
  const { error } = await table(client, meta.table)
    .update({ active })
    .eq("id", id);
  if (error) {
    throw Object.assign(new Error(error.message), { code: error.code });
  }
}
