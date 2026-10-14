/**
 * Deterministic, framework-free validation for staged ledger import rows.
 *
 * The validator decides each row's disposition from the source cells, the
 * user's mapping and confirmed options, and a snapshot of reference data,
 * grants, publication locks and existing entries. It never guesses: a value
 * that does not resolve exactly, an ambiguous date, a missing voucher or an
 * unknown amount leaves the row blocked. The database commit re-checks
 * permissions, locks, constraints and reference activeness independently.
 */
import {
  FIELD_DEFINITIONS,
  type ImportField,
  type ImportMapping,
  type LedgerType,
} from "@/lib/imports/fields";
import {
  headerImpliesScaledUnit,
  normalizeKey,
  parseNairaAmount,
  parseTransactionDate,
  type DateConvention,
} from "@/lib/imports/normalize";
import type { SourceRowMeta } from "@/lib/imports/table";

export type IssueSeverity = "blocker" | "warning" | "info";

export type RowIssue = {
  code: string;
  field?: ImportField;
  message: string;
  severity: IssueSeverity;
};

export type Disposition = "eligible" | "blocked" | "duplicate" | "excluded";

export type ImportOptions = {
  date_convention: DateConvention | null;
  /** MDA for rows without one: no MDA column mapped, or a blank MDA cell. */
  default_mda_id: string | null;
  /**
   * User-confirmed answers to "what does this value mean?" questions, keyed by
   * field then by normalizeKey(source text). A reference id resolves the value;
   * null records that the user declined, leaving matching rows blocked.
   */
  value_aliases?: Partial<Record<ImportField, Record<string, string | null>>>;
};

/** Fields whose unmatched values can be answered once for the whole batch. */
export const ALIASABLE_FIELDS = [
  "mda",
  "programme_area",
  "funding_source",
  "expenditure_category",
  "payment_method",
  "lga",
] as const satisfies readonly ImportField[];

export function aliasFor(
  options: ImportOptions,
  field: ImportField,
  text: string,
): string | null | undefined {
  return options.value_aliases?.[field]?.[normalizeKey(text)];
}

export type RefValue = {
  id: string;
  name: string;
  slug?: string | null;
  active: boolean;
};

export type MdaRef = RefValue & { code: string; abbreviation: string | null };
export type ItemRef = RefValue & { expenditure_category_id: string | null };
export type FacilityRef = RefValue & { lga_id: string; facility_type: string };
export type AopRef = {
  id: string;
  activity_code: string;
  mda_id: string;
  fiscal_year: number;
  active: boolean;
};

export type ImportReference = {
  mdas: MdaRef[];
  programmeAreas: RefValue[];
  fundingSources: RefValue[];
  expenditureCategories: RefValue[];
  expenditureItems: ItemRef[];
  paymentMethods: RefValue[];
  lgas: RefValue[];
  facilities: FacilityRef[];
  aopActivities: AopRef[];
};

export type ExistingEntry = {
  public_id: string | null;
  amount: string;
  transaction_date: string;
};

export type ValidationContext = {
  ledger: LedgerType;
  mapping: ImportMapping;
  options: ImportOptions;
  reference: ImportReference;
  /** "all" for admins; otherwise the MDAs the user holds the ledger's submit grant for. */
  permittedMdaIds: Set<string> | "all";
  /** "2026-Q1" style keys for published BIR quarters. */
  publishedPeriods: Set<string>;
  /** Keyed by entryKey(fiscalYear, mdaId, reference). */
  existingEntries: Map<string, ExistingEntry>;
  /** Today's ISO date, injected for deterministic tests. */
  today: string;
};

export type StagedRowInput = {
  id: string;
  sourceRowNumber: number;
  raw: Record<string, string>;
  overrides: Record<string, string>;
  meta: SourceRowMeta;
  userExcluded: boolean;
};

export type FundingProposal = {
  transaction_date: string;
  mda_id: string;
  programme_area_id: string;
  funding_source_id: string;
  amount: string;
  reference_no: string;
  remarks: string | null;
};

export type ExpenditureProposal = {
  transaction_date: string;
  mda_id: string;
  programme_area_id: string;
  expenditure_category_id: string;
  expenditure_item_id: string | null;
  aop_activity_id: string | null;
  is_phc: boolean;
  lga_id: string | null;
  facility_id: string | null;
  amount: string;
  voucher_ref_no: string;
  payment_method_id: string;
  remarks: string | null;
  funding_allocations: Array<{ funding_source_id: string; amount: string }>;
};

export type Proposal = FundingProposal | ExpenditureProposal;

export type RowResult = {
  id: string;
  sourceRowNumber: number;
  disposition: Disposition;
  proposed: Proposal | null;
  issues: RowIssue[];
  /** Present when the amount parsed; used for totals of any disposition. */
  amountKobo: bigint | null;
};

export function entryKey(fiscalYear: number, mdaId: string, reference: string): string {
  return `${fiscalYear}|${mdaId}|${reference}`;
}

export function periodKey(isoDate: string): { fiscalYear: number; quarter: number; key: string } {
  const year = Number(isoDate.slice(0, 4));
  const quarter = Math.ceil(Number(isoDate.slice(5, 7)) / 3);
  return { fiscalYear: year, quarter, key: `${year}-Q${quarter}` };
}

const TOTAL_ROW = /^(grand\s+|sub[\s-]?)?totals?\b/i;

type Resolved<T> = { ok: true; value: T } | { ok: false; issue: RowIssue };

function resolveByKeys<T extends { id: string; name: string; active: boolean }>(
  field: ImportField,
  label: string,
  text: string,
  values: T[],
  keysFor: (value: T) => string[],
): Resolved<T> {
  const target = normalizeKey(text);
  const matches = values.filter((value) => keysFor(value).some((key) => key && key === target));
  const active = matches.filter((value) => value.active);
  if (active.length === 1) return { ok: true, value: active[0] };
  if (active.length > 1) {
    return {
      ok: false,
      issue: {
        code: "reference_ambiguous",
        field,
        severity: "blocker",
        message: `"${text}" matches more than one ${label}: ${active.map((v) => v.name).join(", ")}. Use the exact name.`,
      },
    };
  }
  if (matches.length > 0) {
    return {
      ok: false,
      issue: {
        code: "reference_inactive",
        field,
        severity: "blocker",
        message: `${label} "${matches[0].name}" is inactive and can't be used for new entries.`,
      },
    };
  }
  return {
    ok: false,
    issue: {
      code: "reference_unknown",
      field,
      severity: "blocker",
      message: `No ${label} matches "${text}". Use a value from the dropdown list, or request a new value.`,
    },
  };
}

function simpleKeys(value: RefValue): string[] {
  return [normalizeKey(value.name), value.slug ? normalizeKey(value.slug) : ""];
}

function resolveMda(text: string, mdas: MdaRef[]): Resolved<MdaRef> {
  const trimmed = text.trim();
  // Administrative codes are compared exactly, as text, so leading zeros matter.
  const byCode = mdas.filter((mda) => mda.code === trimmed);
  if (byCode.length === 1) {
    const [mda] = byCode;
    if (mda.active) return { ok: true, value: mda };
    return {
      ok: false,
      issue: { code: "reference_inactive", field: "mda", severity: "blocker", message: `MDA "${mda.name}" is inactive.` },
    };
  }
  const resolved = resolveByKeys("mda", "MDA", trimmed, mdas, (mda) => [
    normalizeKey(mda.name),
    mda.abbreviation ? normalizeKey(mda.abbreviation) : "",
  ]);
  if (!resolved.ok && resolved.issue.code === "reference_unknown" && /^\d+$/.test(trimmed)) {
    const zeroLost = mdas.find((mda) => mda.code.replace(/^0+/, "") === trimmed.replace(/^0+/, ""));
    if (zeroLost) {
      resolved.issue.message = `No MDA has code "${trimmed}". ${zeroLost.name} has code ${zeroLost.code}; the spreadsheet may have dropped a leading zero. Store codes as text and re-upload, or fix this cell.`;
    }
  }
  return resolved;
}

function isOther(name: string | undefined): boolean {
  return (name ?? "").trim().toLowerCase() === "other";
}

// Proposals are always built by this module in a fixed key order, so plain
// JSON is a stable comparison key.
function canonical(proposal: Proposal): string {
  return JSON.stringify(proposal);
}

/** Validate every staged row, then resolve in-file and existing duplicates. */
export function validateBatch(rows: StagedRowInput[], ctx: ValidationContext): RowResult[] {
  const results = rows.map((row) => validateRow(row, ctx));

  // Exact repeats and conflicting references inside the file.
  const groups = new Map<string, RowResult[]>();
  for (const result of results) {
    if (result.disposition !== "eligible" || !result.proposed) continue;
    const key = proposalKey(result.proposed);
    groups.set(key, [...(groups.get(key) ?? []), result]);
  }
  for (const group of groups.values()) {
    if (group.length < 2) continue;
    const first = group[0];
    const allSame = group.every((r) => canonical(r.proposed!) === canonical(first.proposed!));
    if (allSame) {
      for (const repeat of group.slice(1)) {
        repeat.disposition = "duplicate";
        repeat.proposed = null;
        repeat.issues.push({
          code: "duplicate_in_file",
          severity: "info",
          message: `Exact repeat of source row ${first.sourceRowNumber}. Only that row will be inserted.`,
        });
      }
    } else {
      const rowsList = group.map((r) => r.sourceRowNumber).join(", ");
      for (const conflict of group) {
        conflict.disposition = "blocked";
        conflict.proposed = null;
        conflict.issues.push({
          code: "reference_conflict_in_file",
          field: ctx.ledger === "funding" ? "reference_no" : "voucher_ref_no",
          severity: "blocker",
          message: `Rows ${rowsList} use the same reference for this MDA and year but with different values. Correct or exclude all but one.`,
        });
      }
    }
  }

  // Rows already in the ledger.
  for (const result of results) {
    if (result.disposition !== "eligible" || !result.proposed) continue;
    const existing = ctx.existingEntries.get(proposalKey(result.proposed));
    if (!existing) continue;
    const label = existing.public_id ?? "an existing entry";
    if (existing.amount === result.proposed.amount && existing.transaction_date === result.proposed.transaction_date) {
      result.disposition = "duplicate";
      result.proposed = null;
      result.issues.push({
        code: "already_recorded",
        severity: "info",
        message: `Already recorded as ${label} with the same date and amount. It will be skipped.`,
      });
    } else {
      result.disposition = "blocked";
      result.proposed = null;
      result.issues.push({
        code: "reference_conflict_existing",
        field: ctx.ledger === "funding" ? "reference_no" : "voucher_ref_no",
        severity: "blocker",
        message: `This reference is already used by ${label} (${existing.transaction_date}, NGN ${existing.amount}) with different values. Imports never overwrite entries; correct ${label} through the register or exclude this row.`,
      });
    }
  }

  return results;
}

function proposalKey(proposal: Proposal): string {
  const { fiscalYear } = periodKey(proposal.transaction_date);
  const reference = "reference_no" in proposal ? proposal.reference_no : proposal.voucher_ref_no;
  return entryKey(fiscalYear, proposal.mda_id, reference);
}

function validateRow(row: StagedRowInput, ctx: ValidationContext): RowResult {
  const issues: RowIssue[] = [];
  const result = (disposition: Disposition, proposed: Proposal | null, amountKobo: bigint | null): RowResult => ({
    id: row.id,
    sourceRowNumber: row.sourceRowNumber,
    disposition,
    proposed,
    issues,
    amountKobo,
  });

  const header = (field: ImportField) => ctx.mapping[field];
  const cell = (field: ImportField): string => {
    const h = header(field);
    if (!h) return "";
    return (row.overrides[h] ?? row.raw[h] ?? "").trim();
  };
  const block = (code: string, message: string, field?: ImportField) =>
    issues.push({ code, field, message, severity: "blocker" });
  const warn = (code: string, message: string, field?: ImportField) =>
    issues.push({ code, field, message, severity: "warning" });

  if (row.userExcluded) {
    issues.push({ code: "user_excluded", severity: "info", message: "Excluded by you. It will not be inserted." });
    return result("excluded", null, null);
  }

  const referenceField: ImportField = ctx.ledger === "funding" ? "reference_no" : "voucher_ref_no";
  const totalCell = Object.values(row.raw).find((value) => TOTAL_ROW.test(value.trim()));
  if (totalCell && !cell(referenceField)) {
    issues.push({
      code: "total_row",
      severity: "info",
      message: `Looks like a total row ("${totalCell.trim()}"), not a transaction. Totals are not imported as entries.`,
    });
    return result("excluded", null, null);
  }

  // Required fields that are unmapped or empty.
  for (const def of FIELD_DEFINITIONS[ctx.ledger]) {
    if (!def.required) continue;
    // The default MDA stands in for an unmapped MDA column or a blank MDA cell.
    if (def.field === "mda" && ctx.options.default_mda_id) continue;
    if (!header(def.field)) {
      block("field_unmapped", `${def.label} is required but no column is mapped to it.`, def.field);
    } else if (!cell(def.field)) {
      block("field_missing", `${def.label} is empty.`, def.field);
    }
  }

  // Formula cells whose cached result is missing have unknown values.
  const missing = row.meta.missing_cache_headers ?? [];
  for (const def of FIELD_DEFINITIONS[ctx.ledger]) {
    const h = header(def.field);
    if (h && missing.includes(h) && row.overrides[h] === undefined) {
      block(
        "formula_without_cached_value",
        `${def.label} is a formula with no saved result. Open the file in Excel, let it recalculate, save, and upload again.`,
        def.field,
      );
    }
  }
  if (row.meta.hidden) {
    warn("hidden_row", "This row is hidden in the workbook. Confirm it belongs in the import.");
  }

  // Date.
  let transactionDate: string | null = null;
  if (cell("transaction_date")) {
    const parsed = parseTransactionDate(cell("transaction_date"), ctx.options.date_convention);
    if (parsed.ok) {
      transactionDate = parsed.value;
      if (parsed.value > ctx.today) {
        warn("date_in_future", `The transaction date ${parsed.value} is in the future.`, "transaction_date");
      }
    } else {
      block(parsed.code, parsed.message, "transaction_date");
    }
  }

  // Amount.
  let amount: string | null = null;
  let amountKobo: bigint | null = null;
  const amountHeader = header("amount");
  if (amountHeader && headerImpliesScaledUnit(amountHeader)) {
    block(
      "amount_unit_ambiguous",
      `The amount column "${amountHeader}" suggests thousands or millions. Convert the column to naira and upload again.`,
      "amount",
    );
  }
  if (cell("amount")) {
    const parsed = parseNairaAmount(cell("amount"));
    if (parsed.ok) {
      amount = parsed.value;
      amountKobo = parsed.kobo;
    } else {
      block(parsed.code, parsed.message, "amount");
    }
    if (amountHeader && row.meta.formula_headers?.includes(amountHeader) && row.overrides[amountHeader] === undefined) {
      warn("amount_from_formula", "The amount comes from a spreadsheet formula's saved result. Check it against the source document.", "amount");
    }
  }

  // MDA and scope.
  // A value that didn't match exactly can still resolve through the user's
  // confirmed answer for that exact text. Declined or stale answers keep the
  // original blocker.
  function viaAlias<T extends RefValue>(field: ImportField, label: string, values: T[], unresolved: RowIssue): T | null {
    const text = cell(field);
    const answer = aliasFor(ctx.options, field, text);
    const target = answer ? values.find((v) => v.id === answer) : undefined;
    if (target && target.active) {
      issues.push({
        code: "matched_by_answer",
        field,
        severity: "info",
        message: `"${text}" matched to ${label} ${target.name} by your answer.`,
      });
      return target;
    }
    if (target && !target.active) {
      issues.push({ code: "reference_inactive", field, severity: "blocker", message: `${label} "${target.name}" (your answer for "${text}") is inactive.` });
      return null;
    }
    if (answer === null) unresolved.message += " You chose to leave these rows blocked.";
    issues.push(unresolved);
    return null;
  }

  // An MDA named in the row always wins, so a mixed file can't be booked to
  // the default; rows naming an MDA outside the user's grants stay blocked.
  let mda: MdaRef | null = null;
  if (cell("mda")) {
    const resolved = resolveMda(cell("mda"), ctx.reference.mdas);
    if (resolved.ok) mda = resolved.value;
    else mda = viaAlias("mda", "MDA", ctx.reference.mdas, resolved.issue) as MdaRef | null;
  } else if (ctx.options.default_mda_id) {
    mda = ctx.reference.mdas.find((m) => m.id === ctx.options.default_mda_id && m.active) ?? null;
    if (!mda) block("reference_unknown", "The default MDA is not an active MDA.", "mda");
  }
  if (mda && ctx.permittedMdaIds !== "all" && !ctx.permittedMdaIds.has(mda.id)) {
    block(
      "mda_not_permitted",
      `You don't have a ${ctx.ledger} submit grant for ${mda.name}. Exclude this row or ask an Admin to import it.`,
      "mda",
    );
  }

  const resolveSimple = (field: ImportField, label: string, values: RefValue[]): RefValue | null => {
    const text = cell(field);
    if (!text) return null;
    const resolved = resolveByKeys(field, label, text, values, simpleKeys);
    if (resolved.ok) return resolved.value;
    return viaAlias(field, label, values, resolved.issue);
  };

  const programme = resolveSimple("programme_area", "programme area", ctx.reference.programmeAreas);
  const fundingSource = resolveSimple("funding_source", "funding source", ctx.reference.fundingSources);
  const remarks = cell("remarks") || null;
  const reference = cell(referenceField);

  if (transactionDate) {
    const period = periodKey(transactionDate);
    if (ctx.publishedPeriods.has(period.key)) {
      block(
        "quarter_published",
        `Q${period.quarter} FY${period.fiscalYear} has been published in the Budget Implementation Report and is locked to new entries.`,
        "transaction_date",
      );
    }
  }

  if (ctx.ledger === "funding") {
    if ((isOther(programme?.name) || isOther(fundingSource?.name)) && !remarks) {
      block("remarks_required", "Remarks are required when Other is selected.", "remarks");
    }
    const blocked = issues.some((issue) => issue.severity === "blocker");
    if (blocked || !transactionDate || !mda || !programme || !fundingSource || !amount || !reference) {
      return result("blocked", null, amountKobo);
    }
    return result(
      "eligible",
      {
        transaction_date: transactionDate,
        mda_id: mda.id,
        programme_area_id: programme.id,
        funding_source_id: fundingSource.id,
        amount,
        reference_no: reference,
        remarks,
      },
      amountKobo,
    );
  }

  const category = resolveSimple("expenditure_category", "expenditure category", ctx.reference.expenditureCategories);
  const paymentMethod = resolveSimple("payment_method", "payment method", ctx.reference.paymentMethods);

  let itemId: string | null = null;
  if (cell("expenditure_item") && category) {
    const items = ctx.reference.expenditureItems.filter(
      (item) => item.expenditure_category_id === null || item.expenditure_category_id === category.id,
    );
    const resolved = resolveByKeys("expenditure_item", `expenditure item under ${category.name}`, cell("expenditure_item"), items, simpleKeys);
    if (resolved.ok) itemId = resolved.value.id;
    else issues.push(resolved.issue);
  }

  let aopId: string | null = null;
  if (cell("aop_activity_code") && mda && transactionDate) {
    const code = cell("aop_activity_code").toLowerCase();
    const fiscalYear = periodKey(transactionDate).fiscalYear;
    const candidates = ctx.reference.aopActivities.filter(
      (a) => a.mda_id === mda!.id && a.fiscal_year === fiscalYear && a.activity_code.trim().toLowerCase() === code,
    );
    const active = candidates.filter((a) => a.active);
    if (active.length === 1) aopId = active[0].id;
    else if (active.length > 1) {
      block(
        "aop_ambiguous",
        `AOP code "${cell("aop_activity_code")}" identifies ${active.length} separate activities for ${mda.name} in ${fiscalYear}. Leave it blank here and link the activity in the register.`,
        "aop_activity_code",
      );
    } else if (candidates.length) {
      block("reference_inactive", `AOP activity "${cell("aop_activity_code")}" is inactive.`, "aop_activity_code");
    } else {
      block(
        "reference_unknown",
        `No ${fiscalYear} AOP activity for ${mda.name} has code "${cell("aop_activity_code")}".`,
        "aop_activity_code",
      );
    }
  }

  // PHC: an LGA or facility makes this a PHC expenditure, which needs both.
  let isPhc = false;
  let lgaId: string | null = null;
  let facilityId: string | null = null;
  if (cell("lga") || cell("facility")) {
    isPhc = true;
    const lga = cell("lga") ? resolveSimple("lga", "LGA", ctx.reference.lgas) : null;
    if (!cell("lga")) block("phc_lga_missing", "A PHC facility is given but the LGA is empty.", "lga");
    if (!cell("facility")) {
      block(
        "phc_facility_missing",
        "An LGA is given but the facility is empty. If the exact facility is unknown, use that LGA's Unspecified PHC Facility.",
        "facility",
      );
    }
    if (lga && cell("facility")) {
      lgaId = lga.id;
      const inLga = ctx.reference.facilities.filter((f) => f.lga_id === lga.id);
      const resolved = resolveByKeys("facility", `facility in ${lga.name}`, cell("facility"), inLga, simpleKeys);
      if (resolved.ok) {
        if (resolved.value.facility_type.toLowerCase() !== "phc") {
          block("phc_facility_type", `${resolved.value.name} is not a PHC facility.`, "facility");
        } else {
          facilityId = resolved.value.id;
        }
      } else {
        issues.push(resolved.issue);
      }
    }
  }

  if ((isOther(programme?.name) || isOther(category?.name) || isOther(paymentMethod?.name)) && !remarks) {
    block("remarks_required", "Remarks are required when Other is selected.", "remarks");
  }

  const blocked = issues.some((issue) => issue.severity === "blocker");
  if (
    blocked || !transactionDate || !mda || !programme || !fundingSource || !amount || !reference ||
    !category || !paymentMethod
  ) {
    return result("blocked", null, amountKobo);
  }
  return result(
    "eligible",
    {
      transaction_date: transactionDate,
      mda_id: mda.id,
      programme_area_id: programme.id,
      expenditure_category_id: category.id,
      expenditure_item_id: itemId,
      aop_activity_id: aopId,
      is_phc: isPhc,
      lga_id: lgaId,
      facility_id: facilityId,
      amount,
      voucher_ref_no: reference,
      payment_method_id: paymentMethod.id,
      remarks,
      funding_allocations: [{ funding_source_id: fundingSource.id, amount }],
    },
    amountKobo,
  );
}
