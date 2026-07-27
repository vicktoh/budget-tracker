/**
 * Pure validation for Approved Budget and AOP Activity admin drafts.
 *
 * Mirrors the database-side checks in
 * `supabase/migrations/202605290001_initial_schema.sql`:
 *  - approved_budgets: fiscal_year + mda_id are required and unique;
 *    every amount must be ≥ 0; total_recurrent must equal
 *    personnel + other_recurrent; total_budget must equal
 *    total_recurrent + capital.
 *  - aop_activities: fiscal_year, mda_id, activity_code, and description
 *    are required; budgeted_cost ≥ 0; (fiscal_year, activity_code, mda_id,
 *    source_row_number) is unique. Workbook duplicates are preserved by
 *    using a distinct `source_row_number` for each duplicate row.
 *
 * The UI calls these helpers before writing; Postgres is the final
 * authority and surfaces unique-violations through `mapBudgetWriteError`
 * and `mapAopActivityWriteError`.
 */

import { isValidFiscalYear } from "@/lib/planning/types";

/* -------------------------------------------------------------------------- */
/* Approved Budget                                                             */
/* -------------------------------------------------------------------------- */

export type ApprovedBudgetDraft = {
  fiscal_year: string; // captured as string from <Input type="number">
  mda_id: string;
  personnel_amount: string;
  other_recurrent_amount: string;
  capital_amount: string;
  source_label: string;
};

export type ApprovedBudgetFieldErrors = Partial<
  Record<keyof ApprovedBudgetDraft, string>
>;

export type ValidatedApprovedBudget = {
  fiscal_year: number;
  mda_id: string;
  personnel_amount: number;
  other_recurrent_amount: number;
  total_recurrent_amount: number;
  capital_amount: number;
  total_budget_amount: number;
  source_label: string | null;
};

export type ApprovedBudgetValidationResult =
  | { ok: true; values: ValidatedApprovedBudget }
  | { ok: false; errors: ApprovedBudgetFieldErrors };

export function emptyApprovedBudgetDraft(
  today: Date = new Date(),
): ApprovedBudgetDraft {
  return {
    fiscal_year: String(today.getFullYear()),
    mda_id: "",
    personnel_amount: "",
    other_recurrent_amount: "",
    capital_amount: "",
    source_label: "",
  };
}

function parseAmount(input: string): number | null {
  const cleaned = input.replace(/[\s,₦]/g, "");
  if (!cleaned) return null;
  const value = Number(cleaned);
  if (!Number.isFinite(value)) return null;
  return value;
}

/** Round to 2 decimal places using banker-safe arithmetic for our scale. */
function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

/**
 * Compute the derived totals for a partial budget draft. Returned values
 * may be `null` when the source amounts are not yet valid; consumers use
 * the result to drive a live "Totals preview" panel in the admin form.
 */
export function previewBudgetTotals(draft: ApprovedBudgetDraft): {
  personnel: number | null;
  other_recurrent: number | null;
  total_recurrent: number | null;
  capital: number | null;
  total_budget: number | null;
} {
  const personnel = parseAmount(draft.personnel_amount);
  const other = parseAmount(draft.other_recurrent_amount);
  const capital = parseAmount(draft.capital_amount);
  const total_recurrent =
    personnel !== null && other !== null ? round2(personnel + other) : null;
  const total_budget =
    total_recurrent !== null && capital !== null
      ? round2(total_recurrent + capital)
      : null;
  return {
    personnel,
    other_recurrent: other,
    total_recurrent,
    capital,
    total_budget,
  };
}

export function validateApprovedBudget(
  draft: ApprovedBudgetDraft,
): ApprovedBudgetValidationResult {
  const errors: ApprovedBudgetFieldErrors = {};

  const fiscalYear = Number(draft.fiscal_year);
  if (!isValidFiscalYear(fiscalYear)) {
    errors.fiscal_year = "Pick a fiscal year between 2000 and 2100.";
  }

  if (!draft.mda_id) errors.mda_id = "Pick the MDA this budget belongs to.";

  const personnel = parseAmount(draft.personnel_amount);
  if (personnel === null) {
    errors.personnel_amount = "Enter the personnel allocation in naira.";
  } else if (personnel < 0) {
    errors.personnel_amount = "Personnel must be zero or greater.";
  }

  const other = parseAmount(draft.other_recurrent_amount);
  if (other === null) {
    errors.other_recurrent_amount =
      "Enter the other recurrent allocation in naira.";
  } else if (other < 0) {
    errors.other_recurrent_amount = "Other recurrent must be zero or greater.";
  }

  const capital = parseAmount(draft.capital_amount);
  if (capital === null) {
    errors.capital_amount = "Enter the capital allocation in naira.";
  } else if (capital < 0) {
    errors.capital_amount = "Capital must be zero or greater.";
  }

  if (Object.keys(errors).length > 0) return { ok: false, errors };

  const total_recurrent = round2((personnel as number) + (other as number));
  const total_budget = round2(total_recurrent + (capital as number));
  const sourceLabel = draft.source_label.trim();

  return {
    ok: true,
    values: {
      fiscal_year: fiscalYear,
      mda_id: draft.mda_id,
      personnel_amount: personnel as number,
      other_recurrent_amount: other as number,
      total_recurrent_amount: total_recurrent,
      capital_amount: capital as number,
      total_budget_amount: total_budget,
      source_label: sourceLabel ? sourceLabel : null,
    },
  };
}

export function mapBudgetWriteError(error: {
  code?: string | null;
  message?: string | null;
}): { field?: keyof ApprovedBudgetDraft; message: string } {
  const message = error.message ?? "Couldn't save the budget.";
  const code = error.code ?? "";

  if (code === "23505") {
    return {
      field: "fiscal_year",
      message:
        "An approved budget already exists for this MDA and fiscal year. Edit the existing row instead.",
    };
  }
  if (code === "23514") {
    // CHECK violation — almost always the recurrent/capital arithmetic.
    return {
      message:
        "The totals do not satisfy the budget arithmetic. Personnel + other recurrent must equal total recurrent, and total recurrent + capital must equal total budget.",
    };
  }
  return { message };
}

/* -------------------------------------------------------------------------- */
/* Approved Budget Line                                                        */
/* -------------------------------------------------------------------------- */

export const BUDGET_LINE_CLASSES = [
  "personnel",
  "overhead",
  "capital",
] as const;

export type ApprovedBudgetLineClass = (typeof BUDGET_LINE_CLASSES)[number];

export type ApprovedBudgetLineDraft = {
  fiscal_year: string;
  mda_id: string;
  budget_class: ApprovedBudgetLineClass | "";
  economic_code: string;
  economic_description: string;
  project_description: string;
  function_code: string;
  location_code: string;
  fund_code: string;
  programme_code: string;
  approved_amount: string;
  source_label: string;
  source_row_number: string;
};

export type ApprovedBudgetLineFieldErrors = Partial<
  Record<keyof ApprovedBudgetLineDraft, string>
>;

export type ValidatedApprovedBudgetLine = {
  fiscal_year: number;
  mda_id: string;
  budget_class: ApprovedBudgetLineClass;
  economic_code: string;
  economic_description: string;
  project_description: string | null;
  function_code: string | null;
  location_code: string | null;
  fund_code: string | null;
  programme_code: string | null;
  approved_amount: number;
  source_label: string | null;
  source_row_number: number | null;
};

export type ApprovedBudgetLineValidationResult =
  | { ok: true; values: ValidatedApprovedBudgetLine }
  | { ok: false; errors: ApprovedBudgetLineFieldErrors };

export function emptyApprovedBudgetLineDraft(
  today: Date = new Date(),
): ApprovedBudgetLineDraft {
  return {
    fiscal_year: String(today.getFullYear()),
    mda_id: "",
    budget_class: "",
    economic_code: "",
    economic_description: "",
    project_description: "",
    function_code: "",
    location_code: "",
    fund_code: "",
    programme_code: "",
    approved_amount: "",
    source_label: "",
    source_row_number: "",
  };
}

function optionalText(value: string): string | null {
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

export function validateApprovedBudgetLine(
  draft: ApprovedBudgetLineDraft,
): ApprovedBudgetLineValidationResult {
  const errors: ApprovedBudgetLineFieldErrors = {};
  const fiscalYear = Number(draft.fiscal_year);

  if (!isValidFiscalYear(fiscalYear)) {
    errors.fiscal_year = "Pick a fiscal year between 2000 and 2100.";
  }
  if (!draft.mda_id) errors.mda_id = "Pick the MDA this line belongs to.";
  if (!BUDGET_LINE_CLASSES.includes(draft.budget_class as ApprovedBudgetLineClass)) {
    errors.budget_class = "Pick personnel, overhead, or capital.";
  }

  const economicCode = draft.economic_code.trim();
  if (!economicCode) errors.economic_code = "Budget code is required.";

  const economicDescription = draft.economic_description.trim();
  if (!economicDescription) {
    errors.economic_description = "Add the budget-line title or description.";
  }

  const approvedAmount = parseAmount(draft.approved_amount);
  if (approvedAmount === null) {
    errors.approved_amount = "Enter the approved amount in naira.";
  } else if (approvedAmount < 0) {
    errors.approved_amount = "Approved amount must be zero or greater.";
  }

  const sourceRow = draft.source_row_number.trim();
  const sourceRowNumber = sourceRow ? Number(sourceRow) : null;
  if (
    sourceRowNumber !== null &&
    (!Number.isInteger(sourceRowNumber) || sourceRowNumber < 0)
  ) {
    errors.source_row_number = "Source row must be a whole number.";
  }

  if (Object.keys(errors).length > 0) return { ok: false, errors };

  return {
    ok: true,
    values: {
      fiscal_year: fiscalYear,
      mda_id: draft.mda_id,
      budget_class: draft.budget_class as ApprovedBudgetLineClass,
      economic_code: economicCode,
      economic_description: economicDescription,
      project_description: optionalText(draft.project_description),
      function_code: optionalText(draft.function_code),
      location_code: optionalText(draft.location_code),
      fund_code: optionalText(draft.fund_code),
      programme_code: optionalText(draft.programme_code),
      approved_amount: round2(approvedAmount as number),
      source_label: optionalText(draft.source_label),
      source_row_number: sourceRowNumber,
    },
  };
}

export function mapBudgetLineWriteError(error: {
  code?: string | null;
  message?: string | null;
}): { field?: keyof ApprovedBudgetLineDraft; message: string } {
  if (error.code === "23505") {
    return {
      field: "economic_code",
      message:
        "This coded budget line already exists for the selected year, MDA, class, programme, and source row.",
    };
  }
  if (error.code === "23514") {
    return { message: "The budget class or approved amount is invalid." };
  }
  return { message: error.message ?? "Couldn't save the budget line." };
}

/* -------------------------------------------------------------------------- */
/* AOP Activity                                                                */
/* -------------------------------------------------------------------------- */

export type AopActivityDraft = {
  fiscal_year: string;
  mda_id: string;
  activity_code: string;
  description: string;
  budgeted_cost: string;
  source_row_number: string;
};

export type AopActivityFieldErrors = Partial<
  Record<keyof AopActivityDraft, string>
>;

export type ValidatedAopActivity = {
  fiscal_year: number;
  mda_id: string;
  activity_code: string;
  description: string;
  budgeted_cost: number;
  source_row_number: number | null;
};

export type AopActivityValidationResult =
  | { ok: true; values: ValidatedAopActivity }
  | { ok: false; errors: AopActivityFieldErrors };

export function emptyAopActivityDraft(
  today: Date = new Date(),
): AopActivityDraft {
  return {
    fiscal_year: String(today.getFullYear()),
    mda_id: "",
    activity_code: "",
    description: "",
    budgeted_cost: "",
    source_row_number: "",
  };
}

export function validateAopActivity(
  draft: AopActivityDraft,
): AopActivityValidationResult {
  const errors: AopActivityFieldErrors = {};

  const fiscalYear = Number(draft.fiscal_year);
  if (!isValidFiscalYear(fiscalYear)) {
    errors.fiscal_year = "Pick a fiscal year between 2000 and 2100.";
  }

  if (!draft.mda_id) errors.mda_id = "Pick the responsible MDA.";

  const activityCode = draft.activity_code.trim();
  if (!activityCode) {
    errors.activity_code = "Activity code is required.";
  } else if (activityCode.length > 80) {
    errors.activity_code = "Activity code must be 80 characters or fewer.";
  }

  const description = draft.description.trim();
  if (!description) {
    errors.description = "Add a short description of the activity.";
  }

  const budgeted = parseAmount(draft.budgeted_cost);
  if (budgeted === null) {
    errors.budgeted_cost = "Enter the budgeted cost in naira.";
  } else if (budgeted < 0) {
    errors.budgeted_cost = "Budgeted cost must be zero or greater.";
  }

  let sourceRow: number | null = null;
  const rawSourceRow = draft.source_row_number.trim();
  if (rawSourceRow) {
    const parsed = Number(rawSourceRow);
    if (!Number.isInteger(parsed) || parsed < 1) {
      errors.source_row_number =
        "Source row number must be a positive whole number.";
    } else {
      sourceRow = parsed;
    }
  }

  if (Object.keys(errors).length > 0) return { ok: false, errors };

  return {
    ok: true,
    values: {
      fiscal_year: fiscalYear,
      mda_id: draft.mda_id,
      activity_code: activityCode,
      description,
      budgeted_cost: budgeted as number,
      source_row_number: sourceRow,
    },
  };
}

export function mapAopActivityWriteError(error: {
  code?: string | null;
  message?: string | null;
}): { field?: keyof AopActivityDraft; message: string } {
  const message = error.message ?? "Couldn't save the activity.";
  const code = error.code ?? "";

  if (code === "23505") {
    return {
      field: "activity_code",
      message:
        "Another AOP activity already uses this code for the same MDA, fiscal year, and source row. Set a distinct source row to keep both, or edit the existing one.",
    };
  }
  return { message };
}
