import { describe, expect, it } from "vitest";
import {
  canEditFundingEntry,
  deriveFiscalPeriod,
  emptyFundingDraft,
  mapFundingEntryError,
  validateFundingEntry,
  type FundingEntryDraft,
} from "@/lib/funding/validation";

const MDA_A = "11111111-1111-1111-1111-111111111111";
const MDA_B = "22222222-2222-2222-2222-222222222222";
const PROG_OTHER = "aaaa1111-aaaa-aaaa-aaaa-aaaaaaaaaaaa";
const PROG_PHC = "aaaa2222-aaaa-aaaa-aaaa-aaaaaaaaaaaa";
const SRC_BHCPF = "bbbb1111-bbbb-bbbb-bbbb-bbbbbbbbbbbb";
const SRC_OTHER = "bbbb2222-bbbb-bbbb-bbbb-bbbbbbbbbbbb";

const reference = {
  programmeAreas: [
    { id: PROG_PHC, name: "Primary Health Care" },
    { id: PROG_OTHER, name: "Other" },
  ],
  fundingSources: [
    { id: SRC_BHCPF, name: "BHCPF" },
    { id: SRC_OTHER, name: "Other" },
  ],
};

function draft(overrides: Partial<FundingEntryDraft> = {}): FundingEntryDraft {
  return {
    ...emptyFundingDraft(new Date("2026-04-15T00:00:00Z")),
    mda_id: MDA_A,
    programme_area_id: PROG_PHC,
    funding_source_id: SRC_BHCPF,
    amount: "1500000",
    reference_no: "REF-2026-001",
    remarks: "",
    ...overrides,
  };
}

describe("deriveFiscalPeriod", () => {
  it.each([
    ["2026-01-15", 2026, 1],
    ["2026-04-15", 2026, 2],
    ["2026-07-01", 2026, 3],
    ["2026-12-31", 2026, 4],
  ] as const)("%s -> FY %i Q%i", (date, year, quarter) => {
    const period = deriveFiscalPeriod(date);
    expect(period).toEqual({ fiscal_year: year, quarter });
  });

  it("returns null for missing or malformed dates", () => {
    expect(deriveFiscalPeriod("")).toBeNull();
    expect(deriveFiscalPeriod("2026/04/15")).toBeNull();
    expect(deriveFiscalPeriod("2026-13-01")).toBeNull();
  });
});

describe("validateFundingEntry", () => {
  it("accepts a valid draft and derives fiscal period", () => {
    const result = validateFundingEntry(draft(), reference);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.values.fiscal_year).toBe(2026);
      expect(result.values.quarter).toBe(2);
      expect(result.values.amount).toBe(1500000);
      expect(result.values.remarks).toBeNull();
    }
  });

  it("flags every required field when blank", () => {
    const result = validateFundingEntry(
      draft({
        mda_id: "",
        programme_area_id: "",
        funding_source_id: "",
        amount: "",
        reference_no: "",
        transaction_date: "",
      }),
      reference,
    );
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors.mda_id).toBeDefined();
      expect(result.errors.programme_area_id).toBeDefined();
      expect(result.errors.funding_source_id).toBeDefined();
      expect(result.errors.amount).toBeDefined();
      expect(result.errors.reference_no).toBeDefined();
      expect(result.errors.transaction_date).toBeDefined();
    }
  });

  it("rejects zero and negative amounts", () => {
    const zero = validateFundingEntry(draft({ amount: "0" }), reference);
    const negative = validateFundingEntry(draft({ amount: "-50" }), reference);
    expect(zero.ok).toBe(false);
    expect(negative.ok).toBe(false);
    if (!zero.ok) expect(zero.errors.amount).toMatch(/greater than zero/i);
  });

  it("requires remarks when Programme Area is Other", () => {
    const result = validateFundingEntry(
      draft({ programme_area_id: PROG_OTHER, remarks: "" }),
      reference,
    );
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.errors.remarks).toMatch(/Other/i);
  });

  it("requires remarks when Funding Source is Other", () => {
    const result = validateFundingEntry(
      draft({ funding_source_id: SRC_OTHER, remarks: "" }),
      reference,
    );
    expect(result.ok).toBe(false);
  });

  it("accepts Other when remarks are filled in", () => {
    const result = validateFundingEntry(
      draft({
        funding_source_id: SRC_OTHER,
        remarks: "One-off donor pledge from Foundation X.",
      }),
      reference,
    );
    expect(result.ok).toBe(true);
  });
});

describe("mapFundingEntryError", () => {
  it("translates duplicate-reference unique violations", () => {
    const mapped = mapFundingEntryError({
      code: "23505",
      message:
        'duplicate key value violates unique constraint "funding_entries_fiscal_year_mda_id_reference_no_key"',
    });
    expect(mapped.field).toBe("reference_no");
    expect(mapped.message).toMatch(/already used/i);
  });

  it("translates Other-requires-remarks trigger errors", () => {
    const mapped = mapFundingEntryError({
      code: "P0001",
      message: "Remarks are required when Other is selected.",
    });
    expect(mapped.field).toBe("remarks");
  });

  it("translates RLS denials into a permission message", () => {
    const mapped = mapFundingEntryError({
      code: "42501",
      message: "new row violates row-level security policy",
    });
    expect(mapped.field).toBeUndefined();
    expect(mapped.message).toMatch(/permission/i);
  });
});

describe("canEditFundingEntry", () => {
  const baseEntry = {
    entered_by: "user-1",
    mda_id: MDA_A,
    fiscal_year: 2026,
    quarter: 1,
  };

  it("allows submitter to edit an unpublished own entry on assigned MDA", () => {
    expect(
      canEditFundingEntry(baseEntry, {
        user_id: "user-1",
        submittable_mda_ids: [MDA_A],
        is_admin: false,
      }),
    ).toBe(true);
  });

  it("blocks edit once the entry quarter is published", () => {
    expect(
      canEditFundingEntry(
        baseEntry,
        { user_id: "user-1", submittable_mda_ids: [MDA_A], is_admin: false, published_periods: [{ fiscalYear: 2026, quarter: 1 }] },
      ),
    ).toBe(false);
  });

  it("blocks edit when the entry belongs to another submitter", () => {
    expect(
      canEditFundingEntry(
        { ...baseEntry, entered_by: "user-2" },
        { user_id: "user-1", submittable_mda_ids: [MDA_A], is_admin: false },
      ),
    ).toBe(false);
  });

  it("blocks edit when the user lost membership for the entry's MDA", () => {
    expect(
      canEditFundingEntry(baseEntry, {
        user_id: "user-1",
        submittable_mda_ids: [MDA_B],
        is_admin: false,
      }),
    ).toBe(false);
  });

  it("admins can edit any pending entry regardless of membership", () => {
    expect(
      canEditFundingEntry(
        { ...baseEntry, entered_by: "someone-else" },
        { user_id: "admin-1", submittable_mda_ids: [], is_admin: true },
      ),
    ).toBe(true);
  });
});
