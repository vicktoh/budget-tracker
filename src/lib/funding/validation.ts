/**
 * Pure, framework-free validation for Funding Entry submissions.
 *
 * Mirrors the Postgres-side rules in
 * `supabase/migrations/202605290001_initial_schema.sql`:
 *  - amount > 0
 *  - reference_no required and unique by (fiscal_year, mda_id)
 *  - remarks required when programme area or funding source is "Other"
 *  - fiscal year + quarter are derived from transaction date
 *
 * UI calls these helpers before insert/update; the database is the final
 * authority but surfacing the same rules client-side gives the submitter
 * fast, friendly feedback.
 */
import type { Tables } from "@/lib/db/types";

export type FundingEntryDraft = {
  transaction_date: string;
  mda_id: string;
  programme_area_id: string;
  funding_source_id: string;
  amount: string;
  reference_no: string;
  remarks: string;
};

export type FundingEntryFieldErrors = Partial<
  Record<keyof FundingEntryDraft, string>
>;

export type FundingEntryValidationResult =
  | { ok: true; values: ValidatedFundingEntry }
  | { ok: false; errors: FundingEntryFieldErrors };

export type ValidatedFundingEntry = {
  transaction_date: string;
  mda_id: string;
  programme_area_id: string;
  funding_source_id: string;
  amount: number;
  reference_no: string;
  remarks: string | null;
  fiscal_year: number;
  quarter: 1 | 2 | 3 | 4;
};

type ReferenceLike = Pick<Tables<"programme_areas">, "id" | "name">;

export function emptyFundingDraft(today = new Date()): FundingEntryDraft {
  return {
    transaction_date: today.toISOString().slice(0, 10),
    mda_id: "",
    programme_area_id: "",
    funding_source_id: "",
    amount: "",
    reference_no: "",
    remarks: "",
  };
}

export function deriveFiscalPeriod(
  transactionDate: string,
): { fiscal_year: number; quarter: 1 | 2 | 3 | 4 } | null {
  if (!transactionDate) return null;
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(transactionDate);
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  if (!Number.isFinite(year) || month < 1 || month > 12) return null;
  const quarter = (Math.ceil(month / 3) as 1 | 2 | 3 | 4);
  return { fiscal_year: year, quarter };
}

function isOther(name: string | null | undefined): boolean {
  return (name ?? "").trim().toLowerCase() === "other";
}

function parseAmount(input: string): number | null {
  const cleaned = input.replace(/[\s,]/g, "");
  if (!cleaned) return null;
  const value = Number(cleaned);
  if (!Number.isFinite(value)) return null;
  return value;
}

export function validateFundingEntry(
  draft: FundingEntryDraft,
  reference: {
    programmeAreas: ReferenceLike[];
    fundingSources: ReferenceLike[];
  },
): FundingEntryValidationResult {
  const errors: FundingEntryFieldErrors = {};

  if (!draft.transaction_date) {
    errors.transaction_date = "Pick the date the funds were received.";
  }
  const period = deriveFiscalPeriod(draft.transaction_date);
  if (draft.transaction_date && !period) {
    errors.transaction_date = "Use a valid YYYY-MM-DD date.";
  }

  if (!draft.mda_id) errors.mda_id = "Select an assigned MDA.";
  if (!draft.programme_area_id) {
    errors.programme_area_id = "Pick the relevant programme area.";
  }
  if (!draft.funding_source_id) {
    errors.funding_source_id = "Pick the funding source.";
  }

  const amount = parseAmount(draft.amount);
  if (amount === null) {
    errors.amount = "Enter the funding amount in naira.";
  } else if (amount <= 0) {
    errors.amount = "Amount must be greater than zero.";
  }

  const reference_no = draft.reference_no.trim();
  if (!reference_no) {
    errors.reference_no = "Reference number is required.";
  }

  const programme = reference.programmeAreas.find(
    (item) => item.id === draft.programme_area_id,
  );
  const fundingSource = reference.fundingSources.find(
    (item) => item.id === draft.funding_source_id,
  );
  const otherSelected = isOther(programme?.name) || isOther(fundingSource?.name);
  const remarks = draft.remarks.trim();
  if (otherSelected && !remarks) {
    errors.remarks =
      "Add remarks to explain the Other selection before submitting.";
  }

  if (Object.keys(errors).length > 0) {
    return { ok: false, errors };
  }

  return {
    ok: true,
    values: {
      transaction_date: draft.transaction_date,
      mda_id: draft.mda_id,
      programme_area_id: draft.programme_area_id,
      funding_source_id: draft.funding_source_id,
      amount: amount as number,
      reference_no,
      remarks: remarks || null,
      fiscal_year: period!.fiscal_year,
      quarter: period!.quarter,
    },
  };
}

/**
 * Maps Postgres errors raised during insert/update into a friendly,
 * field-scoped message. Other errors are returned as form-level fallbacks
 * so the submitter never sees a raw constraint name.
 */
export function mapFundingEntryError(error: {
  code?: string | null;
  message?: string | null;
}): { field?: keyof FundingEntryDraft; message: string } {
  const message = error.message ?? "";
  const code = error.code ?? "";

  if (code === "23505" && /reference_no/i.test(message)) {
    return {
      field: "reference_no",
      message:
        "This reference number is already used for the selected MDA and fiscal year. Pick a different reference.",
    };
  }
  if (code === "23514" && /amount/i.test(message)) {
    return { field: "amount", message: "Amount must be greater than zero." };
  }
  if (/Remarks are required when Other is selected\./i.test(message)) {
    return {
      field: "remarks",
      message:
        "Add remarks to explain the Other selection before submitting.",
    };
  }
  if (code === "42501" || /row-level security/i.test(message)) {
    return {
      message:
        "You don't have permission to write this entry. Confirm the MDA is in your assignments.",
    };
  }
  return {
    message:
      message ||
      "We couldn't save this entry. Refresh and try again, or contact an admin if it persists.",
  };
}

/**
 * Pending-only edit gate. Mirrors the Postgres RLS policy
 * `funding_update_pending_by_submitter`. Used by the UI to hide/disable
 * edit affordances; RLS still enforces authoritatively.
 */
export type FundingEntryEditableInput = {
  status: Tables<"funding_entries">["status"];
  entered_by: Tables<"funding_entries">["entered_by"];
  mda_id: Tables<"funding_entries">["mda_id"];
};

export function canEditFundingEntry(
  entry: FundingEntryEditableInput,
  options: {
    user_id: string | null | undefined;
    submittable_mda_ids: string[];
    is_admin: boolean;
  },
): boolean {
  if (entry.status !== "pending") return false;
  if (options.is_admin) return true;
  if (!options.user_id) return false;
  if (entry.entered_by !== options.user_id) return false;
  return options.submittable_mda_ids.includes(entry.mda_id);
}
