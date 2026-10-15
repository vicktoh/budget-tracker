import { describe, expect, it } from "vitest";
import { validateBatch, type ExpenditureProposal, type StagedRowInput, type ValidationContext } from "@/lib/imports/validate";

const MDA = "00000000-0000-0000-0000-00000000000a";

const BASE_MAPPING = {
  transaction_date: "Date",
  amount: "Amount",
  voucher_ref_no: "Voucher",
  funding_source: "Source",
};

function ctx(overrides: Partial<ValidationContext> = {}, options: Partial<ValidationContext["options"]> = {}): ValidationContext {
  return {
    ledger: "expenditure",
    mapping: BASE_MAPPING,
    options: { date_convention: null, default_mda_id: MDA, ...options },
    reference: {
      mdas: [{ id: MDA, name: "Ministry of Health", code: "052100100100", abbreviation: "MoH", active: true }],
      programmeAreas: [
        { id: "p1", name: "Malaria", slug: "malaria", active: true },
        { id: "p2", name: "Old Programme", slug: "old-programme", active: false },
      ],
      fundingSources: [
        { id: "s1", name: "BHCPF Allocation", slug: "bhcpf-allocation", active: true },
        { id: "s-un", name: "Unspecified", slug: "unspecified", active: true },
        { id: "s-state", name: "Kano State Govt Budget Release", slug: "kano-state-govt-budget-release", active: true },
      ],
      expenditureCategories: [
        { id: "c1", name: "Overhead / Running Costs", slug: "overhead", active: true },
        { id: "c2", name: "Capital", slug: "capital", active: true },
      ],
      expenditureItems: [{ id: "i1", name: "Fuel", slug: "fuel", active: true, expenditure_category_id: "c1" }],
      paymentMethods: [{ id: "m1", name: "GIFMIS", slug: "gifmis", active: true }],
      lgas: [],
      facilities: [],
      aopActivities: [],
    },
    permittedMdaIds: new Set([MDA]),
    publishedPeriods: new Set(),
    existingEntries: new Map(),
    today: "2026-10-15",
    ...overrides,
  };
}

function row(n: number, raw: Record<string, string>): StagedRowInput {
  return { id: `r${n}`, sourceRowNumber: n, raw, overrides: {}, meta: {}, userExcluded: false };
}

const ROW = { Date: "2026-07-02", Amount: "1000", Voucher: "PV-1", Source: "BHCPF Allocation" };

describe("one value for all rows", () => {
  it("fills unmapped programme area, category and payment method", () => {
    const [result] = validateBatch(
      [row(2, ROW)],
      ctx({}, { field_defaults: { programme_area: "p1", expenditure_category: "c1", payment_method: "m1" } }),
    );
    expect(result.disposition).toBe("eligible");
    expect(result.proposed).toMatchObject({ programme_area_id: "p1", expenditure_category_id: "c1", payment_method_id: "m1" });
  });

  it("still blocks unmapped fields that have no value chosen", () => {
    const [result] = validateBatch([row(2, ROW)], ctx({}, { field_defaults: { programme_area: "p1" } }));
    expect(result.disposition).toBe("blocked");
    expect(result.issues.filter((i) => i.code === "field_unmapped").map((i) => i.field)).toEqual([
      "expenditure_category",
      "payment_method",
    ]);
  });

  it("uses the value in the row when a column is mapped, and the default only for blank cells", () => {
    const results = validateBatch(
      [row(2, { ...ROW, Category: "Capital" }), row(3, { ...ROW, Voucher: "PV-2", Category: "" })],
      ctx(
        { mapping: { ...BASE_MAPPING, expenditure_category: "Category" } },
        { field_defaults: { programme_area: "p1", expenditure_category: "c1", payment_method: "m1" } },
      ),
    );
    expect(results.map((r) => (r.proposed as ExpenditureProposal | null)?.expenditure_category_id)).toEqual(["c2", "c1"]);
  });

  it("blocks rows when the chosen value is no longer active", () => {
    const [result] = validateBatch(
      [row(2, ROW)],
      ctx({}, { field_defaults: { programme_area: "p2", expenditure_category: "c1", payment_method: "m1" } }),
    );
    expect(result.disposition).toBe("blocked");
    expect(result.issues).toContainEqual(expect.objectContaining({ code: "reference_unknown", field: "programme_area" }));
  });

  it("ignores values for fields that can't take one for this ledger", () => {
    const [result] = validateBatch(
      [row(2, { Date: "2026-07-02", Amount: "1000", Ref: "R-1", Source: "BHCPF Allocation" })],
      ctx(
        { ledger: "funding", mapping: { transaction_date: "Date", amount: "Amount", reference_no: "Ref", funding_source: "Source" } },
        { field_defaults: { programme_area: "p1", funding_source: "s1" } },
      ),
    );
    expect(result.disposition).toBe("eligible");
    expect(result.proposed).toMatchObject({ programme_area_id: "p1", funding_source_id: "s1" });

    const [unmapped] = validateBatch(
      [row(2, { Date: "2026-07-02", Amount: "1000", Ref: "R-1" })],
      ctx(
        { ledger: "funding", mapping: { transaction_date: "Date", amount: "Amount", reference_no: "Ref" } },
        { field_defaults: { programme_area: "p1", funding_source: "s1" } },
      ),
    );
    expect(unmapped.issues).toContainEqual(expect.objectContaining({ code: "field_unmapped", field: "funding_source" }));
  });
});

describe("expenditure import matches manual entry", () => {
  const defaults = { field_defaults: { programme_area: "p1", expenditure_category: "c1", payment_method: "m1" } };

  it("rejects the Unspecified funding source", () => {
    const [result] = validateBatch([row(2, { ...ROW, Source: "Unspecified" })], ctx({}, defaults));
    expect(result.disposition).toBe("blocked");
    expect(result.issues).toContainEqual(expect.objectContaining({ code: "funding_source_unspecified", severity: "blocker" }));
  });

  it("rejects Unspecified even when reached through an answer", () => {
    const [result] = validateBatch(
      [row(2, { ...ROW, Source: "Not known" })],
      ctx({}, { ...defaults, value_aliases: { funding_source: { "not known": "s-un" } } }),
    );
    expect(result.disposition).toBe("blocked");
    expect(result.issues).toContainEqual(expect.objectContaining({ code: "funding_source_unspecified" }));
  });

  it("drops the expenditure item for state-budget spending, with a warning", () => {
    const [result] = validateBatch(
      [row(2, { ...ROW, Source: "Kano State Govt Budget Release", Item: "Fuel" })],
      ctx({ mapping: { ...BASE_MAPPING, expenditure_item: "Item" } }, defaults),
    );
    expect(result.disposition).toBe("eligible");
    expect((result.proposed as ExpenditureProposal).expenditure_item_id).toBeNull();
    expect(result.issues).toContainEqual(expect.objectContaining({ code: "item_ignored_state_budget", severity: "warning" }));
  });

  it("keeps the expenditure item for other funding sources", () => {
    const [result] = validateBatch(
      [row(2, { ...ROW, Item: "Fuel" })],
      ctx({ mapping: { ...BASE_MAPPING, expenditure_item: "Item" } }, defaults),
    );
    expect((result.proposed as ExpenditureProposal).expenditure_item_id).toBe("i1");
  });
});
