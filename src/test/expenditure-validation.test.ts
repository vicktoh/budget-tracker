import { describe, expect, it } from "vitest";
import {
  canEditExpenditureEntry,
  deriveFiscalPeriod,
  emptyExpenditureDraft,
  mapExpenditureEntryError,
  validateExpenditureEntry,
  type ExpenditureEntryDraft,
  type ExpenditureValidationReference,
} from "@/lib/expenditure/validation";

const MDA_A = "11111111-1111-1111-1111-111111111111";
const MDA_B = "22222222-2222-2222-2222-222222222222";

const PROG_PHC = "aaaa1111-aaaa-aaaa-aaaa-aaaaaaaaaaaa";
const PROG_OTHER = "aaaa2222-aaaa-aaaa-aaaa-aaaaaaaaaaaa";

const CAT_PERSONNEL = "bbbb1111-bbbb-bbbb-bbbb-bbbbbbbbbbbb";
const CAT_DRUGS = "bbbb2222-bbbb-bbbb-bbbb-bbbbbbbbbbbb";
const CAT_OTHER = "bbbb3333-bbbb-bbbb-bbbb-bbbbbbbbbbbb";

const ITEM_PERSONNEL = "cccc1111-cccc-cccc-cccc-cccccccccccc";
const ITEM_DRUGS = "cccc2222-cccc-cccc-cccc-cccccccccccc";

const PAYMENT_TRANSFER = "dddd1111-dddd-dddd-dddd-dddddddddddd";
const PAYMENT_OTHER = "dddd2222-dddd-dddd-dddd-dddddddddddd";

const FS_BHCPF = "gggg1111-gggg-gggg-gggg-gggggggggggg";
const FS_STATE = "gggg2222-gggg-gggg-gggg-gggggggggggg";
const FS_UNSPECIFIED = "gggg3333-gggg-gggg-gggg-gggggggggggg";

const LGA_KANO_MUNI = "eeee1111-eeee-eeee-eeee-eeeeeeeeeeee";
const LGA_FAGGE = "eeee2222-eeee-eeee-eeee-eeeeeeeeeeee";

const FAC_PHC_KANO = "ffff1111-ffff-ffff-ffff-ffffffffffff";
const FAC_PHC_FAGGE = "ffff2222-ffff-ffff-ffff-ffffffffffff";
const FAC_HOSPITAL_KANO = "ffff3333-ffff-ffff-ffff-ffffffffffff";

const AOP_A_2026 = "aaaa-aop-1";
const AOP_B_2026 = "aaaa-aop-2";
const AOP_A_2025 = "aaaa-aop-3";

const LINE_A_2026 = "aaaa-line-1";
const LINE_B_2026 = "aaaa-line-2";
const LINE_A_2025 = "aaaa-line-3";

const reference: ExpenditureValidationReference = {
  programmeAreas: [
    { id: PROG_PHC, name: "Primary Health Care" },
    { id: PROG_OTHER, name: "Other" },
  ],
  expenditureCategories: [
    { id: CAT_PERSONNEL, name: "Personnel" },
    { id: CAT_DRUGS, name: "Drugs and Medical Supplies" },
    { id: CAT_OTHER, name: "Other" },
  ],
  expenditureItems: [
    { id: ITEM_PERSONNEL, expenditure_category_id: CAT_PERSONNEL },
    { id: ITEM_DRUGS, expenditure_category_id: CAT_DRUGS },
  ],
  paymentMethods: [
    { id: PAYMENT_TRANSFER, name: "Bank Transfer" },
    { id: PAYMENT_OTHER, name: "Other" },
  ],
  fundingSources: [
    { id: FS_BHCPF, name: "BHCPF Allocation" },
    { id: FS_STATE, name: "Kano State Govt Budget Release" },
    { id: FS_UNSPECIFIED, name: "Unspecified" },
  ],
  unspecifiedFundingSourceId: FS_UNSPECIFIED,
  facilities: [
    { id: FAC_PHC_KANO, lga_id: LGA_KANO_MUNI, facility_type: "PHC" },
    { id: FAC_PHC_FAGGE, lga_id: LGA_FAGGE, facility_type: "PHC" },
    { id: FAC_HOSPITAL_KANO, lga_id: LGA_KANO_MUNI, facility_type: "Hospital" },
  ],
  aopActivities: [
    { id: AOP_A_2026, mda_id: MDA_A, fiscal_year: 2026 },
    { id: AOP_B_2026, mda_id: MDA_B, fiscal_year: 2026 },
    { id: AOP_A_2025, mda_id: MDA_A, fiscal_year: 2025 },
  ],
  approvedBudgetLines: [
    { id: LINE_A_2026, mda_id: MDA_A, fiscal_year: 2026 },
    { id: LINE_B_2026, mda_id: MDA_B, fiscal_year: 2026 },
    { id: LINE_A_2025, mda_id: MDA_A, fiscal_year: 2025 },
  ],
};

function draft(
  overrides: Partial<ExpenditureEntryDraft> = {},
): ExpenditureEntryDraft {
  return {
    ...emptyExpenditureDraft(new Date("2026-04-15T00:00:00Z")),
    mda_id: MDA_A,
    programme_area_id: PROG_PHC,
    expenditure_category_id: CAT_DRUGS,
    expenditure_item_id: "",
    approved_budget_line_id: "",
    aop_activity_id: "",
    is_phc: false,
    lga_id: "",
    facility_id: "",
    amount: "1500000",
    funding_allocations: [
      { funding_source_id: FS_BHCPF, amount: "1500000" },
    ],
    voucher_ref_no: "VCH-2026-001",
    payment_method_id: PAYMENT_TRANSFER,
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
    expect(deriveFiscalPeriod(date)).toEqual({ fiscal_year: year, quarter });
  });

  it("returns null for malformed dates", () => {
    expect(deriveFiscalPeriod("")).toBeNull();
    expect(deriveFiscalPeriod("2026/04/15")).toBeNull();
    expect(deriveFiscalPeriod("2026-13-01")).toBeNull();
  });
});

describe("validateExpenditureEntry", () => {
  it("accepts a valid non-PHC draft and derives fiscal period", () => {
    const result = validateExpenditureEntry(draft(), reference);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.values.fiscal_year).toBe(2026);
      expect(result.values.quarter).toBe(2);
      expect(result.values.amount).toBe(1500000);
      expect(result.values.is_phc).toBe(false);
      expect(result.values.lga_id).toBeNull();
      expect(result.values.facility_id).toBeNull();
      expect(result.values.remarks).toBeNull();
      expect(result.values.funding_allocations).toEqual([
        { funding_source_id: FS_BHCPF, amount: 1500000 },
      ]);
    }
  });

  it("requires funding allocations to sum to the expenditure amount", () => {
    const result = validateExpenditureEntry(
      draft({
        funding_allocations: [
          { funding_source_id: FS_BHCPF, amount: "500000" },
          { funding_source_id: FS_STATE, amount: "500000" },
        ],
      }),
      reference,
    );
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors.funding_allocations).toMatch(/sum exactly/i);
    }
  });

  it("flags every required field when blank", () => {
    const result = validateExpenditureEntry(
      draft({
        mda_id: "",
        programme_area_id: "",
        expenditure_category_id: "",
        amount: "",
        voucher_ref_no: "",
        payment_method_id: "",
        transaction_date: "",
      }),
      reference,
    );
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors.mda_id).toBeDefined();
      expect(result.errors.programme_area_id).toBeDefined();
      expect(result.errors.expenditure_category_id).toBeDefined();
      expect(result.errors.amount).toBeDefined();
      expect(result.errors.voucher_ref_no).toBeDefined();
      expect(result.errors.payment_method_id).toBeDefined();
      expect(result.errors.transaction_date).toBeDefined();
    }
  });

  it("rejects zero and negative amounts", () => {
    expect(validateExpenditureEntry(draft({ amount: "0" }), reference).ok).toBe(
      false,
    );
    expect(
      validateExpenditureEntry(draft({ amount: "-50" }), reference).ok,
    ).toBe(false);
  });

  describe("PHC validation", () => {
    it("requires LGA and facility when PHC is on", () => {
      const result = validateExpenditureEntry(
        draft({ is_phc: true, lga_id: "", facility_id: "" }),
        reference,
      );
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.errors.lga_id).toBeDefined();
        expect(result.errors.facility_id).toBeDefined();
      }
    });

    it("rejects facility belonging to another LGA", () => {
      const result = validateExpenditureEntry(
        draft({
          is_phc: true,
          lga_id: LGA_KANO_MUNI,
          facility_id: FAC_PHC_FAGGE,
        }),
        reference,
      );
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.errors.facility_id).toMatch(/LGA/i);
      }
    });

    it("rejects non-PHC facility on a PHC entry", () => {
      const result = validateExpenditureEntry(
        draft({
          is_phc: true,
          lga_id: LGA_KANO_MUNI,
          facility_id: FAC_HOSPITAL_KANO,
        }),
        reference,
      );
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.errors.facility_id).toMatch(/PHC/i);
      }
    });

    it("accepts a valid PHC entry", () => {
      const result = validateExpenditureEntry(
        draft({
          is_phc: true,
          lga_id: LGA_KANO_MUNI,
          facility_id: FAC_PHC_KANO,
        }),
        reference,
      );
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.values.is_phc).toBe(true);
        expect(result.values.lga_id).toBe(LGA_KANO_MUNI);
        expect(result.values.facility_id).toBe(FAC_PHC_KANO);
      }
    });

    it("clears LGA and facility when PHC is off, even if filled in draft", () => {
      const result = validateExpenditureEntry(
        draft({
          is_phc: false,
          lga_id: LGA_KANO_MUNI,
          facility_id: FAC_PHC_KANO,
        }),
        reference,
      );
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.values.lga_id).toBeNull();
        expect(result.values.facility_id).toBeNull();
      }
    });
  });

  describe("AOP linkage", () => {
    it("accepts an AOP activity matching MDA + fiscal year", () => {
      const result = validateExpenditureEntry(
        draft({ aop_activity_id: AOP_A_2026 }),
        reference,
      );
      expect(result.ok).toBe(true);
      if (result.ok) expect(result.values.aop_activity_id).toBe(AOP_A_2026);
    });

    it("rejects AOP activity from a different MDA", () => {
      const result = validateExpenditureEntry(
        draft({ aop_activity_id: AOP_B_2026 }),
        reference,
      );
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.errors.aop_activity_id).toMatch(/MDA|fiscal year/i);
      }
    });

    it("rejects AOP activity from a different fiscal year", () => {
      const result = validateExpenditureEntry(
        draft({ aop_activity_id: AOP_A_2025 }),
        reference,
      );
      expect(result.ok).toBe(false);
    });
  });

  describe("Expenditure Item / category mismatch", () => {
    it("accepts item matching the category", () => {
      const result = validateExpenditureEntry(
        draft({
          expenditure_category_id: CAT_DRUGS,
          expenditure_item_id: ITEM_DRUGS,
        }),
        reference,
      );
      expect(result.ok).toBe(true);
    });

    it("rejects item from a different category", () => {
      const result = validateExpenditureEntry(
        draft({
          expenditure_category_id: CAT_DRUGS,
          expenditure_item_id: ITEM_PERSONNEL,
        }),
        reference,
      );
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.errors.expenditure_item_id).toMatch(/category/i);
      }
    });
  });

  describe("Approved budget line / MDA + fiscal year", () => {
    it("accepts a line matching the entry MDA and fiscal year", () => {
      const result = validateExpenditureEntry(
        draft({ approved_budget_line_id: LINE_A_2026 }),
        reference,
      );
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.values.approved_budget_line_id).toBe(LINE_A_2026);
      }
    });

    it("rejects a line from a different MDA", () => {
      const result = validateExpenditureEntry(
        draft({ mda_id: MDA_A, approved_budget_line_id: LINE_B_2026 }),
        reference,
      );
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.errors.approved_budget_line_id).toMatch(
          /MDA and fiscal year/i,
        );
      }
    });

    it("rejects a line from a different fiscal year", () => {
      const result = validateExpenditureEntry(
        draft({
          transaction_date: "2026-04-15",
          approved_budget_line_id: LINE_A_2025,
        }),
        reference,
      );
      expect(result.ok).toBe(false);
    });

    it("leaves the line null when none is selected", () => {
      const result = validateExpenditureEntry(draft(), reference);
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.values.approved_budget_line_id).toBeNull();
      }
    });
  });

  describe("Other -> remarks required", () => {
    it("requires remarks when Programme Area is Other", () => {
      const result = validateExpenditureEntry(
        draft({ programme_area_id: PROG_OTHER, remarks: "" }),
        reference,
      );
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.errors.remarks).toMatch(/Other/i);
    });

    it("requires remarks when Expenditure Category is Other", () => {
      const result = validateExpenditureEntry(
        draft({ expenditure_category_id: CAT_OTHER, remarks: "" }),
        reference,
      );
      expect(result.ok).toBe(false);
    });

    it("requires remarks when Payment Method is Other", () => {
      const result = validateExpenditureEntry(
        draft({ payment_method_id: PAYMENT_OTHER, remarks: "" }),
        reference,
      );
      expect(result.ok).toBe(false);
    });

    it("accepts Other when remarks are filled in", () => {
      const result = validateExpenditureEntry(
        draft({
          payment_method_id: PAYMENT_OTHER,
          remarks: "Cash advance reconciled against voucher 99.",
        }),
        reference,
      );
      expect(result.ok).toBe(true);
    });
  });
});

describe("mapExpenditureEntryError", () => {
  it("translates duplicate-voucher unique violations", () => {
    const mapped = mapExpenditureEntryError({
      code: "23505",
      message:
        'duplicate key value violates unique constraint "expenditure_entries_fiscal_year_mda_id_voucher_ref_no_key"',
    });
    expect(mapped.field).toBe("voucher_ref_no");
    expect(mapped.message).toMatch(/already used/i);
  });

  it("translates PHC facility/LGA mismatch trigger errors", () => {
    const mapped = mapExpenditureEntryError({
      code: "P0001",
      message: "Selected facility must belong to the selected LGA.",
    });
    expect(mapped.field).toBe("facility_id");
  });

  it("translates non-PHC facility on PHC entry", () => {
    const mapped = mapExpenditureEntryError({
      code: "P0001",
      message: "PHC expenditure must use a PHC facility.",
    });
    expect(mapped.field).toBe("facility_id");
  });

  it("translates AOP MDA/fiscal-year mismatch", () => {
    const mapped = mapExpenditureEntryError({
      code: "P0001",
      message: "AOP activity must match expenditure MDA and fiscal year.",
    });
    expect(mapped.field).toBe("aop_activity_id");
  });

  it("translates expenditure item / category mismatch", () => {
    const mapped = mapExpenditureEntryError({
      code: "P0001",
      message: "Expenditure item must match selected expenditure category.",
    });
    expect(mapped.field).toBe("expenditure_item_id");
  });

  it("translates RLS denials into a permission message", () => {
    const mapped = mapExpenditureEntryError({
      code: "42501",
      message: "new row violates row-level security policy",
    });
    expect(mapped.field).toBeUndefined();
    expect(mapped.message).toMatch(/permission/i);
  });
});

describe("canEditExpenditureEntry", () => {
  const baseEntry = {
    status: "pending" as const,
    entered_by: "user-1",
    mda_id: MDA_A,
  };

  it("allows submitter to edit own pending entry on assigned MDA", () => {
    expect(
      canEditExpenditureEntry(baseEntry, {
        user_id: "user-1",
        submittable_mda_ids: [MDA_A],
        is_admin: false,
      }),
    ).toBe(true);
  });

  it("blocks edit once the entry is approved", () => {
    expect(
      canEditExpenditureEntry(
        { ...baseEntry, status: "approved" },
        {
          user_id: "user-1",
          submittable_mda_ids: [MDA_A],
          is_admin: false,
        },
      ),
    ).toBe(false);
  });

  it("blocks edit when the entry belongs to another submitter", () => {
    expect(
      canEditExpenditureEntry(
        { ...baseEntry, entered_by: "user-2" },
        {
          user_id: "user-1",
          submittable_mda_ids: [MDA_A],
          is_admin: false,
        },
      ),
    ).toBe(false);
  });

  it("blocks edit when the user lost membership for the entry's MDA", () => {
    expect(
      canEditExpenditureEntry(baseEntry, {
        user_id: "user-1",
        submittable_mda_ids: [MDA_B],
        is_admin: false,
      }),
    ).toBe(false);
  });

  it("admins can edit any pending entry regardless of membership", () => {
    expect(
      canEditExpenditureEntry(
        { ...baseEntry, entered_by: "someone-else" },
        {
          user_id: "admin-1",
          submittable_mda_ids: [],
          is_admin: true,
        },
      ),
    ).toBe(true);
  });
});
