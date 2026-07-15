/**
 * Pure validation for Admin Reference Data create/update drafts.
 *
 * Mirrors the Postgres-side rules baked into
 * `supabase/migrations/202605290001_initial_schema.sql`:
 *  - name is required and unique per table
 *  - mdas require unique `code` and a name
 *  - expenditure_items require an expenditure_category_id
 *  - facilities require an lga_id, name, and facility_type
 *  - deactivate/reactivate sets `active` rather than deleting referenced rows
 *
 * The UI calls these helpers before writing; the database is the final
 * authority and surfaces unique-violations through `mapReferenceWriteError`.
 */

import type { ReferenceKind } from "@/lib/reference/types";
import { slugify } from "@/lib/reference/types";

export type ReferenceDraft = {
  name: string;
  code?: string;
  abbreviation?: string;
  mda_type_id?: string | null;
  expenditure_category_id?: string | null;
  lga_id?: string | null;
  facility_type?: string;
};

export type ReferenceFieldErrors = Partial<Record<keyof ReferenceDraft, string>>;

export type ReferenceValidationResult =
  | { ok: true; values: ValidatedReferenceValues }
  | { ok: false; errors: ReferenceFieldErrors };

export type ValidatedReferenceValues = {
  /** Always present. Trimmed. */
  name: string;
  slug?: string;
  code?: string;
  abbreviation?: string | null;
  mda_type_id?: string | null;
  expenditure_category_id?: string | null;
  lga_id?: string | null;
  facility_type?: string;
};

function trim(value: string | undefined | null): string {
  return (value ?? "").trim();
}

export function validateReferenceDraft(
  kind: ReferenceKind,
  draft: ReferenceDraft,
): ReferenceValidationResult {
  const errors: ReferenceFieldErrors = {};
  const name = trim(draft.name);
  if (!name) errors.name = "Name is required.";
  if (name.length > 200) errors.name = "Name must be 200 characters or fewer.";

  const values: ValidatedReferenceValues = { name };

  switch (kind) {
    case "mda": {
      const code = trim(draft.code);
      if (!code) errors.code = "Code is required.";
      values.code = code;
      const abbr = trim(draft.abbreviation);
      values.abbreviation = abbr ? abbr : null;
      values.mda_type_id = draft.mda_type_id ?? null;
      break;
    }
    case "expenditure_item": {
      if (!draft.expenditure_category_id) {
        errors.expenditure_category_id =
          "Pick the expenditure category this item belongs to.";
      }
      values.expenditure_category_id = draft.expenditure_category_id ?? null;
      values.slug = slugify(name);
      break;
    }
    case "facility": {
      if (!draft.lga_id) errors.lga_id = "LGA is required.";
      const facilityType = trim(draft.facility_type);
      if (!facilityType) errors.facility_type = "Facility type is required.";
      values.lga_id = draft.lga_id ?? null;
      values.facility_type = facilityType;
      break;
    }
    case "lga":
      // no slug column
      break;
    default:
      // simple slug+name tables
      values.slug = slugify(name);
      break;
  }

  if (Object.keys(errors).length > 0) return { ok: false, errors };
  return { ok: true, values };
}

/**
 * Translates a Postgres error into a field-scoped message the admin form
 * can surface. Today this only handles `23505` unique violations; everything
 * else falls through to a generic message so we never silently swallow an
 * unexpected failure.
 */
export function mapReferenceWriteError(
  kind: ReferenceKind,
  error: { code?: string; message?: string } | null,
): { field?: keyof ReferenceDraft; message: string } | null {
  if (!error) return null;
  const message = error.message ?? "Unable to save this value.";

  if (error.code === "23505") {
    // Heuristic: most reference tables make `name` unique and `mdas` also
    // makes `code` unique. Inspect the message text to pick which field to
    // attach the error to so the user sees the right field highlighted.
    const lower = message.toLowerCase();
    if (lower.includes("code")) {
      return {
        field: "code",
        message: `A ${kind.replace(/_/g, " ")} with this code already exists.`,
      };
    }
    return {
      field: "name",
      message: `A ${kind.replace(/_/g, " ")} with this name already exists.`,
    };
  }

  return { message };
}
