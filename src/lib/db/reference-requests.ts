/**
 * Reference Value Request workflow.
 *
 * MDA users insert a request describing a value they need (e.g. a missing
 * facility or payment method). Admins resolve it by either:
 *  - approving with `resolved_reference_id` set (either an existing row or a
 *    freshly created one from `requested_label`), or
 *  - rejecting with a `review_comment` (enforced by a Postgres CHECK).
 *
 * RLS scopes:
 *  - reference_requests_select_own_or_admin (submitters see their rows; admins see all)
 *  - reference_requests_insert_own
 *  - reference_requests_admin_update
 */

import type { TypedSupabaseClient } from "@/lib/supabase/client";
import type { Tables } from "@/lib/db/types";
import type { ReferenceKind } from "@/lib/reference/types";
import {
  createReferenceValue,
} from "@/lib/db/reference-management";
import type { ValidatedReferenceRequest } from "@/lib/reference/requests";

type Client = TypedSupabaseClient;

export type ReferenceRequestRow = Tables<"reference_value_requests"> & {
  requester: Pick<Tables<"profiles">, "id" | "full_name" | "role"> | null;
  reviewer: Pick<Tables<"profiles">, "id" | "full_name" | "role"> | null;
  related_mda?: Pick<Tables<"mdas">, "id" | "name" | "abbreviation"> | null;
  related_lga?: Pick<Tables<"lgas">, "id" | "name"> | null;
  related_category?: Pick<
    Tables<"expenditure_categories">,
    "id" | "name"
  > | null;
};

const REQUEST_SELECT = `
  *,
  requester:profiles!reference_value_requests_requested_by_fkey(id, full_name, role),
  reviewer:profiles!reference_value_requests_reviewed_by_fkey(id, full_name, role),
  related_mda:mdas!reference_value_requests_related_mda_id_fkey(id, name, abbreviation),
  related_lga:lgas!reference_value_requests_related_lga_id_fkey(id, name),
  related_category:expenditure_categories!reference_value_requests_related_category_id_fkey(id, name)
`;

export type ListReferenceRequestsOptions = {
  status?: "all" | "pending" | "approved" | "rejected";
  mineOnly?: boolean;
  userId?: string;
};

export async function listReferenceRequests(
  client: Client,
  options: ListReferenceRequestsOptions = {},
): Promise<ReferenceRequestRow[]> {
  let query = client
    .from("reference_value_requests")
    .select(REQUEST_SELECT)
    .order("created_at", { ascending: false });
  if (options.status && options.status !== "all") {
    query = query.eq("status", options.status);
  }
  if (options.mineOnly && options.userId) {
    query = query.eq("requested_by", options.userId);
  }
  const { data, error } = await query;
  if (error) throw error;
  return (data ?? []) as unknown as ReferenceRequestRow[];
}

export async function insertReferenceRequest(
  client: Client,
  args: {
    requestedBy: string;
    values: ValidatedReferenceRequest;
  },
): Promise<string> {
  const insertRow = {
    reference_type: args.values.reference_type,
    requested_label: args.values.requested_label,
    description: args.values.description,
    related_mda_id: args.values.related_mda_id,
    related_lga_id: args.values.related_lga_id,
    related_category_id: args.values.related_category_id,
    requested_by: args.requestedBy,
  };

  // The schema's `Insert` type is wide; the `requested_by` column is required
  // but TypeScript struggles to refine the union, so cast through unknown.
  const builder = client.from("reference_value_requests") as unknown as {
    insert: (row: typeof insertRow) => {
      select: (cols: string) => {
        single: () => Promise<{
          data: { id: string } | null;
          error: { message: string } | null;
        }>;
      };
    };
  };

  const { data, error } = await builder
    .insert(insertRow)
    .select("id")
    .single();
  if (error || !data) {
    throw new Error(error?.message ?? "Failed to submit request.");
  }
  return data.id;
}

export type ApproveReferenceRequestArgs =
  | {
      kind: "use_existing";
      reviewerId: string;
      resolvedReferenceId: string;
      reviewComment?: string;
    }
  | {
      kind: "create_new";
      reviewerId: string;
      referenceKind: ReferenceKind;
      label: string;
      relatedCategoryId?: string | null;
      relatedLgaId?: string | null;
      reviewComment?: string;
    };

export async function approveReferenceRequest(
  client: Client,
  requestId: string,
  args: ApproveReferenceRequestArgs,
): Promise<{ resolvedReferenceId: string }> {
  let resolvedReferenceId: string;

  if (args.kind === "use_existing") {
    resolvedReferenceId = args.resolvedReferenceId;
  } else {
    // Create the new reference value first; the request only flips to
    // `approved` once the underlying row exists. RLS lets admins write to
    // reference tables and to `reference_value_requests`, so both writes
    // happen client-side.
    const created = await createReferenceValue(client, args.referenceKind, {
      name: args.label,
      slug: args.label
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, ""),
      expenditure_category_id: args.relatedCategoryId ?? null,
      lga_id: args.relatedLgaId ?? null,
      facility_type:
        args.referenceKind === "facility" ? "primary_health_centre" : undefined,
      code: args.referenceKind === "mda" ? args.label.toUpperCase().slice(0, 12) : undefined,
    });
    resolvedReferenceId = created.id;
  }

  const update = {
    status: "approved" as const,
    resolved_reference_id: resolvedReferenceId,
    reviewed_by: args.reviewerId,
    reviewed_at: new Date().toISOString(),
    review_comment: args.reviewComment ?? null,
  };

  const builder = client.from("reference_value_requests") as unknown as {
    update: (row: typeof update) => {
      eq: (
        column: string,
        value: string,
      ) => Promise<{ error: { message: string } | null }>;
    };
  };

  const { error } = await builder.update(update).eq("id", requestId);
  if (error) throw new Error(error.message);

  return { resolvedReferenceId };
}

export async function rejectReferenceRequest(
  client: Client,
  requestId: string,
  args: { reviewerId: string; reviewComment: string },
): Promise<void> {
  const update = {
    status: "rejected" as const,
    reviewed_by: args.reviewerId,
    reviewed_at: new Date().toISOString(),
    review_comment: args.reviewComment,
  };

  const builder = client.from("reference_value_requests") as unknown as {
    update: (row: typeof update) => {
      eq: (
        column: string,
        value: string,
      ) => Promise<{ error: { message: string } | null }>;
    };
  };

  const { error } = await builder.update(update).eq("id", requestId);
  if (error) throw new Error(error.message);
}
