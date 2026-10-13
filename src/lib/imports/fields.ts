import { normalizeKey } from "@/lib/imports/normalize";

export type LedgerType = "funding" | "expenditure";

export type ImportField =
  | "transaction_date"
  | "mda"
  | "programme_area"
  | "amount"
  | "remarks"
  | "funding_source"
  | "reference_no"
  | "expenditure_category"
  | "expenditure_item"
  | "payment_method"
  | "voucher_ref_no"
  | "aop_activity_code"
  | "lga"
  | "facility";

export type FieldDefinition = {
  field: ImportField;
  label: string;
  required: boolean;
  description?: string;
  aliases: string[];
};

/** Field → chosen source header. Unmapped fields are omitted. */
export type ImportMapping = Partial<Record<ImportField, string>>;

const COMMON: FieldDefinition[] = [
  {
    field: "transaction_date",
    label: "Transaction date",
    required: true,
    aliases: ["date", "transaction date", "payment date", "date received", "value date", "date paid", "txn date"],
  },
  {
    field: "mda",
    label: "MDA",
    required: true,
    description: "Name, abbreviation or MDA code. Map it, or confirm one MDA for every row.",
    aliases: ["mda", "mda name", "mda code", "ministry", "agency", "organisation", "organization", "admin code", "administrative code"],
  },
  {
    field: "programme_area",
    label: "Programme area",
    required: true,
    aliases: ["programme area", "program area", "programme", "program"],
  },
  {
    field: "amount",
    label: "Amount (NGN)",
    required: true,
    aliases: ["amount", "amount ngn", "amount n", "value", "amount naira", "naira"],
  },
];

const REMARKS: FieldDefinition = {
  field: "remarks",
  label: "Remarks",
  required: false,
  aliases: ["remarks", "remark", "narration", "description", "notes", "comment", "comments", "details"],
};

export const FIELD_DEFINITIONS: Record<LedgerType, FieldDefinition[]> = {
  funding: [
    ...COMMON,
    {
      field: "funding_source",
      label: "Funding source",
      required: true,
      aliases: ["funding source", "source", "source of funds", "source of funding", "fund source"],
    },
    {
      field: "reference_no",
      label: "Reference number",
      required: true,
      aliases: ["reference", "reference no", "reference number", "ref", "ref no", "receipt no", "receipt number", "release reference"],
    },
    REMARKS,
  ],
  expenditure: [
    ...COMMON,
    {
      field: "expenditure_category",
      label: "Expenditure category",
      required: true,
      aliases: ["expenditure category", "category", "expense category", "spending category"],
    },
    {
      field: "expenditure_item",
      label: "Expenditure item",
      required: false,
      aliases: ["expenditure item", "item", "sub category", "subcategory", "sub-category"],
    },
    {
      field: "payment_method",
      label: "Payment method",
      required: true,
      aliases: ["payment method", "method", "mode of payment", "payment mode", "payment type"],
    },
    {
      field: "voucher_ref_no",
      label: "Voucher reference",
      required: true,
      aliases: ["voucher", "voucher no", "voucher ref", "voucher reference", "voucher number", "pv no", "pv number", "payment voucher", "voucher ref no"],
    },
    {
      field: "funding_source",
      label: "Funding source",
      required: true,
      description: "One source per row; the whole amount is allocated to it.",
      aliases: ["funding source", "source", "source of funds", "source of funding", "fund source"],
    },
    {
      field: "aop_activity_code",
      label: "AOP activity code",
      required: false,
      aliases: ["aop activity code", "aop code", "activity code", "aop activity"],
    },
    {
      field: "lga",
      label: "LGA (PHC only)",
      required: false,
      aliases: ["lga", "local government", "local government area"],
    },
    {
      field: "facility",
      label: "PHC facility",
      required: false,
      aliases: ["facility", "facility name", "phc facility", "health facility", "phc"],
    },
    REMARKS,
  ],
};

export function fieldDefinition(ledger: LedgerType, field: ImportField): FieldDefinition | undefined {
  return FIELD_DEFINITIONS[ledger].find((def) => def.field === field);
}

/**
 * Suggest a mapping from exact (normalised) header aliases. Each header is
 * used at most once; anything not matched exactly is left for the user to map.
 */
export function suggestMapping(ledger: LedgerType, headers: string[]): ImportMapping {
  const mapping: ImportMapping = {};
  const used = new Set<string>();
  const normalised = headers.map((header) => ({
    header,
    key: normalizeKey(header.replace(/\(.*?\)/g, " ")),
    full: normalizeKey(header),
  }));
  for (const def of FIELD_DEFINITIONS[ledger]) {
    const aliasKeys = new Set(def.aliases.map(normalizeKey));
    const match = normalised.find(
      (h) => !used.has(h.header) && (aliasKeys.has(h.full) || aliasKeys.has(h.key)),
    );
    if (match) {
      mapping[def.field] = match.header;
      used.add(match.header);
    }
  }
  return mapping;
}
