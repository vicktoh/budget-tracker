/**
 * Pure validation for Reference Value Requests.
 *
 * The MDA-user submission and the admin review (approve/reject) both flow
 * through these helpers so the UI never offers a state the database will
 * refuse. The Postgres-side guard is the `check (status <> 'rejected' or
 * review_comment not null)` constraint on `public.reference_value_requests`.
 */

import type { ReferenceKind } from "@/lib/reference/types";

export type ReferenceRequestDraft = {
  reference_type: ReferenceKind | "";
  requested_label: string;
  description?: string;
  related_mda_id?: string | null;
  related_lga_id?: string | null;
  related_category_id?: string | null;
};

export type ReferenceRequestFieldErrors = Partial<
  Record<keyof ReferenceRequestDraft, string>
>;

export type ReferenceRequestValidationResult =
  | { ok: true; values: ValidatedReferenceRequest }
  | { ok: false; errors: ReferenceRequestFieldErrors };

export type ValidatedReferenceRequest = {
  reference_type: ReferenceKind;
  requested_label: string;
  description: string | null;
  related_mda_id: string | null;
  related_lga_id: string | null;
  related_category_id: string | null;
};

const REQUIRES_CATEGORY: ReferenceKind[] = ["expenditure_item"];
const REQUIRES_LGA: ReferenceKind[] = ["facility"];

export function validateReferenceRequestDraft(
  draft: ReferenceRequestDraft,
): ReferenceRequestValidationResult {
  const errors: ReferenceRequestFieldErrors = {};
  if (!draft.reference_type) errors.reference_type = "Pick what you want added.";
  const label = (draft.requested_label ?? "").trim();
  if (!label) errors.requested_label = "Describe the value you need.";
  if (label.length > 200) {
    errors.requested_label = "Keep the label under 200 characters.";
  }

  const kind = draft.reference_type as ReferenceKind;
  if (draft.reference_type && REQUIRES_CATEGORY.includes(kind) && !draft.related_category_id) {
    errors.related_category_id =
      "Pick the expenditure category this item belongs to.";
  }
  if (draft.reference_type && REQUIRES_LGA.includes(kind) && !draft.related_lga_id) {
    errors.related_lga_id = "Pick the LGA this facility belongs to.";
  }

  if (Object.keys(errors).length > 0) return { ok: false, errors };

  return {
    ok: true,
    values: {
      reference_type: kind,
      requested_label: label,
      description: (draft.description ?? "").trim() || null,
      related_mda_id: draft.related_mda_id ?? null,
      related_lga_id: draft.related_lga_id ?? null,
      related_category_id: draft.related_category_id ?? null,
    },
  };
}

export type ReferenceRequestDecision =
  | {
      action: "approve";
      /**
       * The reference row this request resolves to. Either an existing row
       * the admin picked, or — when `create_new` is set — the row just
       * created from `requested_label`.
       */
      resolved_reference_id: string;
    }
  | {
      action: "reject";
      /** Required by the Postgres check constraint. */
      review_comment: string;
    };

export function validateReferenceRequestDecision(
  input:
    | {
        action: "approve";
        resolved_reference_id: string | null;
      }
    | { action: "reject"; review_comment: string },
):
  | { ok: true; decision: ReferenceRequestDecision }
  | { ok: false; error: string } {
  if (input.action === "approve") {
    if (!input.resolved_reference_id) {
      return {
        ok: false,
        error: "Pick an existing value or create a new one before approving.",
      };
    }
    return {
      ok: true,
      decision: {
        action: "approve",
        resolved_reference_id: input.resolved_reference_id,
      },
    };
  }

  const comment = (input.review_comment ?? "").trim();
  if (!comment) {
    return {
      ok: false,
      error: "Rejection needs a short comment explaining why.",
    };
  }
  return {
    ok: true,
    decision: { action: "reject", review_comment: comment },
  };
}
