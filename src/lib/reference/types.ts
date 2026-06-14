/**
 * Registry of the controlled Reference Data types managed by Admins.
 *
 * Each kind maps to a Postgres table whose rows are exposed to Entry forms
 * via `src/lib/db/reference-data.ts`. Admin management uses the same rows,
 * but adds create/update and deactivate/reactivate behavior in
 * `src/lib/db/reference-management.ts`.
 *
 * The registry intentionally mirrors the `reference_value_requests.reference_type`
 * check constraint in `supabase/migrations/202605290001_initial_schema.sql`,
 * so a kind here is exactly one of the kinds an MDA user can request.
 */

export type ReferenceKind =
  | "mda_type"
  | "mda"
  | "programme_area"
  | "funding_source"
  | "expenditure_category"
  | "expenditure_item"
  | "payment_method"
  | "lga"
  | "facility";

export type ReferenceFieldKind =
  | "name"
  | "slug"
  | "code"
  | "abbreviation"
  | "facility_type"
  | "description"
  | "mda_type"
  | "expenditure_category"
  | "lga";

export type ReferenceMeta = {
  kind: ReferenceKind;
  table:
    | "mda_types"
    | "mdas"
    | "programme_areas"
    | "funding_sources"
    | "expenditure_categories"
    | "expenditure_items"
    | "payment_methods"
    | "lgas"
    | "facilities";
  singular: string;
  plural: string;
  description: string;
  /** Fields the admin form collects when creating or editing this kind. */
  fields: ReferenceFieldKind[];
  /** Reference types we generate `slug` automatically from the name. */
  autoSlug: boolean;
};

export const REFERENCE_REGISTRY: Record<ReferenceKind, ReferenceMeta> = {
  mda_type: {
    kind: "mda_type",
    table: "mda_types",
    singular: "MDA type",
    plural: "MDA types",
    description: "Groups MDAs (ministry, board, agency, fund, etc.) for filtering.",
    fields: ["name"],
    autoSlug: true,
  },
  mda: {
    kind: "mda",
    table: "mdas",
    singular: "MDA",
    plural: "MDAs",
    description: "Ministries, boards, agencies, schools, hospitals, and funds.",
    fields: ["name", "code", "abbreviation", "mda_type"],
    autoSlug: false,
  },
  programme_area: {
    kind: "programme_area",
    table: "programme_areas",
    singular: "programme area",
    plural: "programme areas",
    description: "Funding and expenditure classification.",
    fields: ["name"],
    autoSlug: true,
  },
  funding_source: {
    kind: "funding_source",
    table: "funding_sources",
    singular: "funding source",
    plural: "funding sources",
    description: "Origin categories for funding inflows.",
    fields: ["name"],
    autoSlug: true,
  },
  expenditure_category: {
    kind: "expenditure_category",
    table: "expenditure_categories",
    singular: "expenditure category",
    plural: "expenditure categories",
    description: "Top-level expenditure classification.",
    fields: ["name"],
    autoSlug: true,
  },
  expenditure_item: {
    kind: "expenditure_item",
    table: "expenditure_items",
    singular: "expenditure item",
    plural: "expenditure items",
    description: "Optional item-level detail under an expenditure category.",
    fields: ["name", "expenditure_category"],
    autoSlug: true,
  },
  payment_method: {
    kind: "payment_method",
    table: "payment_methods",
    singular: "payment method",
    plural: "payment methods",
    description: "Finance channels (treasury voucher, bank transfer, cash, …).",
    fields: ["name"],
    autoSlug: true,
  },
  lga: {
    kind: "lga",
    table: "lgas",
    singular: "LGA",
    plural: "LGAs",
    description: "Local Government Areas for PHC geography.",
    fields: ["name"],
    autoSlug: false,
  },
  facility: {
    kind: "facility",
    table: "facilities",
    singular: "PHC facility",
    plural: "PHC facilities",
    description: "PHC facilities, grouped by LGA and typed.",
    fields: ["name", "facility_type", "lga"],
    autoSlug: false,
  },
};

export const REFERENCE_KIND_ORDER: ReferenceKind[] = [
  "mda_type",
  "mda",
  "programme_area",
  "funding_source",
  "expenditure_category",
  "expenditure_item",
  "payment_method",
  "lga",
  "facility",
];

/**
 * Best-effort slug for kinds whose Postgres row carries one. Matches the
 * `app_private.slugify` SQL function shape so a value generated client-side
 * lines up with what the database would have produced.
 */
export function slugify(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function getReferenceMeta(kind: ReferenceKind): ReferenceMeta {
  return REFERENCE_REGISTRY[kind];
}
