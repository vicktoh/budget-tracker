import { describe, expect, it } from "vitest";
import {
  emptyAopActivityDraft,
  emptyApprovedBudgetDraft,
  emptyApprovedBudgetLineDraft,
  mapAopActivityWriteError,
  mapBudgetLineWriteError,
  mapBudgetWriteError,
  previewBudgetTotals,
  validateAopActivity,
  validateApprovedBudget,
  validateApprovedBudgetLine,
} from "@/lib/planning/validation";
import {
  defaultFiscalYearOptions,
  isValidFiscalYear,
} from "@/lib/planning/types";

const MDA = "11111111-1111-1111-1111-111111111111";

describe("isValidFiscalYear", () => {
  it("accepts the supported window", () => {
    expect(isValidFiscalYear(2026)).toBe(true);
    expect(isValidFiscalYear(2000)).toBe(true);
    expect(isValidFiscalYear(2100)).toBe(true);
  });

  it("rejects non-integers and out-of-range values", () => {
    expect(isValidFiscalYear(1999)).toBe(false);
    expect(isValidFiscalYear(2101)).toBe(false);
    expect(isValidFiscalYear(2026.5)).toBe(false);
    expect(isValidFiscalYear("2026")).toBe(false);
    expect(isValidFiscalYear(null)).toBe(false);
  });
});

describe("defaultFiscalYearOptions", () => {
  it("returns a 5-year window centred on the given year", () => {
    const years = defaultFiscalYearOptions(new Date("2026-06-01T00:00:00Z"));
    expect(years).toEqual([2024, 2025, 2026, 2027, 2028]);
  });
});

describe("validateApprovedBudget", () => {
  function draft(overrides: Partial<ReturnType<typeof emptyApprovedBudgetDraft>> = {}) {
    return { ...emptyApprovedBudgetDraft(), ...overrides };
  }

  it("requires fiscal year, MDA, and every amount", () => {
    const result = validateApprovedBudget(
      draft({
        fiscal_year: "",
        mda_id: "",
        personnel_amount: "",
        other_recurrent_amount: "",
        capital_amount: "",
      }),
    );
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors.fiscal_year).toBeTruthy();
      expect(result.errors.mda_id).toBeTruthy();
      expect(result.errors.personnel_amount).toBeTruthy();
      expect(result.errors.other_recurrent_amount).toBeTruthy();
      expect(result.errors.capital_amount).toBeTruthy();
    }
  });

  it("rejects negative amounts and out-of-range fiscal years", () => {
    const result = validateApprovedBudget(
      draft({
        fiscal_year: "1999",
        mda_id: MDA,
        personnel_amount: "-1",
        other_recurrent_amount: "10",
        capital_amount: "5",
      }),
    );
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors.fiscal_year).toBeTruthy();
      expect(result.errors.personnel_amount).toBeTruthy();
    }
  });

  it("accepts zero amounts and computes derived totals", () => {
    const result = validateApprovedBudget(
      draft({
        fiscal_year: "2026",
        mda_id: MDA,
        personnel_amount: "0",
        other_recurrent_amount: "0",
        capital_amount: "0",
      }),
    );
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.values.total_recurrent_amount).toBe(0);
      expect(result.values.total_budget_amount).toBe(0);
    }
  });

  it("computes totals enforcing personnel + other recurrent and recurrent + capital", () => {
    const result = validateApprovedBudget(
      draft({
        fiscal_year: "2026",
        mda_id: MDA,
        personnel_amount: "1500000",
        other_recurrent_amount: "750000.50",
        capital_amount: "2000000.25",
        source_label: " Workbook 2026 ",
      }),
    );
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.values.personnel_amount).toBe(1500000);
      expect(result.values.other_recurrent_amount).toBe(750000.5);
      expect(result.values.total_recurrent_amount).toBe(2250000.5);
      expect(result.values.capital_amount).toBe(2000000.25);
      expect(result.values.total_budget_amount).toBe(4250000.75);
      expect(result.values.source_label).toBe("Workbook 2026");
    }
  });

  it("strips currency formatting from amount inputs", () => {
    const result = validateApprovedBudget(
      draft({
        mda_id: MDA,
        personnel_amount: "₦ 1,000,000",
        other_recurrent_amount: "500,000",
        capital_amount: "0",
      }),
    );
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.values.personnel_amount).toBe(1000000);
      expect(result.values.other_recurrent_amount).toBe(500000);
    }
  });
});

describe("previewBudgetTotals", () => {
  it("returns nulls when amounts are missing or invalid", () => {
    const totals = previewBudgetTotals(emptyApprovedBudgetDraft());
    expect(totals.total_recurrent).toBeNull();
    expect(totals.total_budget).toBeNull();
  });

  it("computes derived totals from valid amounts", () => {
    const totals = previewBudgetTotals({
      fiscal_year: "2026",
      mda_id: MDA,
      personnel_amount: "100",
      other_recurrent_amount: "50",
      capital_amount: "25",
      source_label: "",
    });
    expect(totals.total_recurrent).toBe(150);
    expect(totals.total_budget).toBe(175);
  });
});

describe("mapBudgetWriteError", () => {
  it("maps unique violations to the fiscal year field", () => {
    const mapped = mapBudgetWriteError({
      code: "23505",
      message: "duplicate key approved_budgets_fiscal_year_mda_id_key",
    });
    expect(mapped.field).toBe("fiscal_year");
  });

  it("explains check-constraint violations as arithmetic errors", () => {
    const mapped = mapBudgetWriteError({
      code: "23514",
      message: "violates check constraint",
    });
    expect(mapped.field).toBeUndefined();
    expect(mapped.message).toMatch(/arithmetic/i);
  });

  it("falls through to a generic message otherwise", () => {
    const mapped = mapBudgetWriteError({
      code: "42501",
      message: "permission denied",
    });
    expect(mapped.message).toBe("permission denied");
  });
});

describe("validateApprovedBudgetLine", () => {
  function draft(
    overrides: Partial<ReturnType<typeof emptyApprovedBudgetLineDraft>> = {},
  ) {
    return { ...emptyApprovedBudgetLineDraft(), ...overrides };
  }

  it("requires the classification, budget code, title, and amount", () => {
    const result = validateApprovedBudgetLine(
      draft({ fiscal_year: "", approved_amount: "" }),
    );

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors.fiscal_year).toBeTruthy();
      expect(result.errors.mda_id).toBeTruthy();
      expect(result.errors.budget_class).toBeTruthy();
      expect(result.errors.economic_code).toBeTruthy();
      expect(result.errors.economic_description).toBeTruthy();
      expect(result.errors.approved_amount).toBeTruthy();
    }
  });

  it("normalises a valid line and keeps optional codes nullable", () => {
    const result = validateApprovedBudgetLine(
      draft({
        fiscal_year: "2026",
        mda_id: MDA,
        budget_class: "capital",
        economic_code: " 23010101 ",
        economic_description: " Medical equipment ",
        approved_amount: "₦1,250,000.50",
        function_code: " 70721 ",
        source_row_number: "14",
      }),
    );

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.values.economic_code).toBe("23010101");
      expect(result.values.approved_amount).toBe(1_250_000.5);
      expect(result.values.function_code).toBe("70721");
      expect(result.values.project_description).toBeNull();
      expect(result.values.source_row_number).toBe(14);
    }
  });

  it("rejects negative amounts and fractional source rows", () => {
    const result = validateApprovedBudgetLine(
      draft({
        fiscal_year: "2026",
        mda_id: MDA,
        budget_class: "overhead",
        economic_code: "22020101",
        economic_description: "Travel",
        approved_amount: "-1",
        source_row_number: "1.5",
      }),
    );

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors.approved_amount).toBeTruthy();
      expect(result.errors.source_row_number).toBeTruthy();
    }
  });
});

describe("mapBudgetLineWriteError", () => {
  it("maps natural-key conflicts to the budget code field", () => {
    const mapped = mapBudgetLineWriteError({ code: "23505" });
    expect(mapped.field).toBe("economic_code");
    expect(mapped.message).toMatch(/already exists/i);
  });
});

describe("validateAopActivity", () => {
  function draft(overrides: Partial<ReturnType<typeof emptyAopActivityDraft>> = {}) {
    return { ...emptyAopActivityDraft(), ...overrides };
  }

  it("requires fiscal year, MDA, code, description, and budgeted cost", () => {
    const result = validateAopActivity(
      draft({
        fiscal_year: "",
        mda_id: "",
        activity_code: "",
        description: "",
        budgeted_cost: "",
      }),
    );
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors.fiscal_year).toBeTruthy();
      expect(result.errors.mda_id).toBeTruthy();
      expect(result.errors.activity_code).toBeTruthy();
      expect(result.errors.description).toBeTruthy();
      expect(result.errors.budgeted_cost).toBeTruthy();
    }
  });

  it("accepts a valid activity without source row", () => {
    const result = validateAopActivity(
      draft({
        fiscal_year: "2026",
        mda_id: MDA,
        activity_code: " RH-001 ",
        description: " Routine immunisation ",
        budgeted_cost: "500000",
      }),
    );
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.values.activity_code).toBe("RH-001");
      expect(result.values.description).toBe("Routine immunisation");
      expect(result.values.budgeted_cost).toBe(500000);
      expect(result.values.source_row_number).toBeNull();
    }
  });

  it("preserves a positive integer source row number for workbook duplicates", () => {
    const result = validateAopActivity(
      draft({
        fiscal_year: "2026",
        mda_id: MDA,
        activity_code: "RH-001",
        description: "Repeated row",
        budgeted_cost: "100",
        source_row_number: "42",
      }),
    );
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.values.source_row_number).toBe(42);
  });

  it("rejects non-integer or non-positive source row numbers", () => {
    const negative = validateAopActivity(
      draft({
        fiscal_year: "2026",
        mda_id: MDA,
        activity_code: "RH-001",
        description: "Bad row",
        budgeted_cost: "100",
        source_row_number: "0",
      }),
    );
    expect(negative.ok).toBe(false);
    if (!negative.ok) expect(negative.errors.source_row_number).toBeTruthy();

    const fractional = validateAopActivity(
      draft({
        fiscal_year: "2026",
        mda_id: MDA,
        activity_code: "RH-001",
        description: "Bad row",
        budgeted_cost: "100",
        source_row_number: "1.5",
      }),
    );
    expect(fractional.ok).toBe(false);
    if (!fractional.ok) expect(fractional.errors.source_row_number).toBeTruthy();
  });
});

describe("mapAopActivityWriteError", () => {
  it("maps unique violations onto the activity code field with workbook-duplicate guidance", () => {
    const mapped = mapAopActivityWriteError({
      code: "23505",
      message: "duplicate key value violates unique constraint",
    });
    expect(mapped.field).toBe("activity_code");
    expect(mapped.message).toMatch(/source row/i);
  });
});
