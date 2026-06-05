/**
 * Pure, framework-free validation for Expenditure Entry submissions.
 *
 * Mirrors the Postgres-side rules in
 * `supabase/migrations/202605290001_initial_schema.sql`:
 *  - amount > 0
 *  - voucher_ref_no required and unique by (fiscal_year, mda_id)
 *  - PHC entries require LGA + Facility; non-PHC entries clear them
 *  - Facility must belong to the selected LGA; PHC must use a PHC facility
 *  - AOP activity must match expenditure MDA + fiscal year (derived)
 *  - Expenditure Item must match the selected Expenditure Category
 *  - Remarks required when programme area, expenditure category, or
 *    payment method is "Other"
 *  - Fiscal year + quarter are derived from transaction date
 *
 * UI calls these helpers before insert/update; the database is the final
 * authority but surfacing the same rules client-side gives the submitter
 * fast, friendly feedback.
 */
import type { Tables } from "@/lib/db/types";

export type ExpenditureEntryDraft = {
  transaction_date: string;
  mda_id: string;
  programme_area_id: string;
  expenditure_category_id: string;
  expenditure_item_id: string;
  aop_activity_id: string;
  is_phc: boolean;
  lga_id: string;
  facility_id: string;
  amount: string;
  voucher_ref_no: string;
  payment_method_id: string;
  remarks: string;
};

export type ExpenditureEntryFieldErrors = Partial<
  Record<keyof ExpenditureEntryDraft, string>
>;

export type ValidatedExpenditureEntry = {
  transaction_date: string;
  mda_id: string;
  programme_area_id: string;
  expenditure_category_id: string;
  expenditure_item_id: string | null;
  aop_activity_id: string | null;
  is_phc: boolean;
  lga_id: string | null;
  facility_id: string | null;
  amount: number;
  voucher_ref_no: string;
  payment_method_id: string;
  remarks: string | null;
  fiscal_year: number;
  quarter: 1 | 2 | 3 | 4;
};

export type ExpenditureEntryValidationResult =
  | { ok: true; values: ValidatedExpenditureEntry }
  | { ok: false; errors: ExpenditureEntryFieldErrors };

type ReferenceLike = { id: string; name: string };

type FacilityLike = {
  id: string;
  lga_id: string;
  facility_type: string;
};

type ExpenditureItemLike = {
  id: string;
  expenditure_category_id: string | null;
};

type AopActivityLike = {
  id: string;
  mda_id: string;
  fiscal_year: number;
};

export function emptyExpenditureDraft(
  today = new Date(),
): ExpenditureEntryDraft {
  return {
    transaction_date: today.toISOString().slice(0, 10),
    mda_id: "",
    programme_area_id: "",
    expenditure_category_id: "",
    expenditure_item_id: "",
    aop_activity_id: "",
    is_phc: false,
    lga_id: "",
    facility_id: "",
    amount: "",
    voucher_ref_no: "",
    payment_method_id: "",
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
  const quarter = Math.ceil(month / 3) as 1 | 2 | 3 | 4;
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

export type ExpenditureValidationReference = {
  programmeAreas: ReferenceLike[];
  expenditureCategories: ReferenceLike[];
  expenditureItems: ExpenditureItemLike[];
  paymentMethods: ReferenceLike[];
  facilities: FacilityLike[];
  aopActivities: AopActivityLike[];
};

export function validateExpenditureEntry(
  draft: ExpenditureEntryDraft,
  reference: ExpenditureValidationReference,
): ExpenditureEntryValidationResult {
  const errors: ExpenditureEntryFieldErrors = {};

  if (!draft.transaction_date) {
    errors.transaction_date = "Pick the date the expenditure was paid.";
  }
  const period = deriveFiscalPeriod(draft.transaction_date);
  if (draft.transaction_date && !period) {
    errors.transaction_date = "Use a valid YYYY-MM-DD date.";
  }

  if (!draft.mda_id) errors.mda_id = "Select an assigned MDA.";
  if (!draft.programme_area_id) {
    errors.programme_area_id = "Pick the relevant programme area.";
  }
  if (!draft.expenditure_category_id) {
    errors.expenditure_category_id = "Pick the expenditure category.";
  }
  if (!draft.payment_method_id) {
    errors.payment_method_id = "Select the payment method used.";
  }

  const amount = parseAmount(draft.amount);
  if (amount === null) {
    errors.amount = "Enter the expenditure amount in naira.";
  } else if (amount <= 0) {
    errors.amount = "Amount must be greater than zero.";
  }

  const voucher_ref_no = draft.voucher_ref_no.trim();
  if (!voucher_ref_no) {
    errors.voucher_ref_no = "Voucher reference number is required.";
  }

  // PHC LGA / facility validation.
  let resolvedLgaId: string | null = null;
  let resolvedFacilityId: string | null = null;
  if (draft.is_phc) {
    if (!draft.lga_id) {
      errors.lga_id = "PHC expenditure requires an LGA.";
    } else {
      resolvedLgaId = draft.lga_id;
    }
    if (!draft.facility_id) {
      errors.facility_id = "PHC expenditure requires a PHC facility.";
    } else {
      resolvedFacilityId = draft.facility_id;
    }
    if (resolvedFacilityId && resolvedLgaId) {
      const facility = reference.facilities.find(
        (f) => f.id === resolvedFacilityId,
      );
      if (facility) {
        if (facility.lga_id !== resolvedLgaId) {
          errors.facility_id =
            "Selected facility must belong to the selected LGA.";
        } else if (facility.facility_type.toLowerCase() !== "phc") {
          errors.facility_id =
            "PHC expenditure must use a PHC facility. Pick a PHC-classified facility.";
        }
      }
    }
  } else {
    // Non-PHC: clear LGA/facility regardless of input state.
    resolvedLgaId = null;
    resolvedFacilityId = null;
  }

  // Expenditure item must match selected category.
  let resolvedExpenditureItemId: string | null = null;
  if (draft.expenditure_item_id) {
    const item = reference.expenditureItems.find(
      (i) => i.id === draft.expenditure_item_id,
    );
    if (
      item &&
      draft.expenditure_category_id &&
      item.expenditure_category_id &&
      item.expenditure_category_id !== draft.expenditure_category_id
    ) {
      errors.expenditure_item_id =
        "Expenditure item must match the selected expenditure category.";
    } else {
      resolvedExpenditureItemId = draft.expenditure_item_id;
    }
  }

  // AOP activity must match MDA and fiscal year.
  let resolvedAopActivityId: string | null = null;
  if (draft.aop_activity_id) {
    const activity = reference.aopActivities.find(
      (a) => a.id === draft.aop_activity_id,
    );
    if (activity) {
      if (
        (draft.mda_id && activity.mda_id !== draft.mda_id) ||
        (period && activity.fiscal_year !== period.fiscal_year)
      ) {
        errors.aop_activity_id =
          "AOP activity must match the entry's MDA and fiscal year.";
      } else {
        resolvedAopActivityId = draft.aop_activity_id;
      }
    }
  }

  // Other -> remarks required.
  const programme = reference.programmeAreas.find(
    (item) => item.id === draft.programme_area_id,
  );
  const category = reference.expenditureCategories.find(
    (item) => item.id === draft.expenditure_category_id,
  );
  const paymentMethod = reference.paymentMethods.find(
    (item) => item.id === draft.payment_method_id,
  );
  const otherSelected =
    isOther(programme?.name) ||
    isOther(category?.name) ||
    isOther(paymentMethod?.name);
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
      expenditure_category_id: draft.expenditure_category_id,
      expenditure_item_id: resolvedExpenditureItemId,
      aop_activity_id: resolvedAopActivityId,
      is_phc: draft.is_phc,
      lga_id: resolvedLgaId,
      facility_id: resolvedFacilityId,
      amount: amount as number,
      voucher_ref_no,
      payment_method_id: draft.payment_method_id,
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
export function mapExpenditureEntryError(error: {
  code?: string | null;
  message?: string | null;
}): { field?: keyof ExpenditureEntryDraft; message: string } {
  const message = error.message ?? "";
  const code = error.code ?? "";

  if (code === "23505" && /voucher_ref_no/i.test(message)) {
    return {
      field: "voucher_ref_no",
      message:
        "This voucher reference is already used for the selected MDA and fiscal year. Pick a different voucher number.",
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
  if (/Selected facility must belong to the selected LGA/i.test(message)) {
    return {
      field: "facility_id",
      message: "Selected facility must belong to the selected LGA.",
    };
  }
  if (/PHC expenditure must use a PHC facility/i.test(message)) {
    return {
      field: "facility_id",
      message:
        "PHC expenditure must use a PHC facility. Pick a PHC-classified facility.",
    };
  }
  if (/AOP activity must match expenditure MDA and fiscal year/i.test(message)) {
    return {
      field: "aop_activity_id",
      message:
        "AOP activity must match the entry's MDA and fiscal year.",
    };
  }
  if (/Expenditure item must match selected expenditure category/i.test(message)) {
    return {
      field: "expenditure_item_id",
      message:
        "Expenditure item must match the selected expenditure category.",
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
 * `expenditure_update_pending_by_submitter`. Used by the UI to hide/disable
 * edit affordances; RLS still enforces authoritatively.
 */
export type ExpenditureEntryEditableInput = {
  status: Tables<"expenditure_entries">["status"];
  entered_by: Tables<"expenditure_entries">["entered_by"];
  mda_id: Tables<"expenditure_entries">["mda_id"];
};

export function canEditExpenditureEntry(
  entry: ExpenditureEntryEditableInput,
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
