import { describe, expect, it } from "vitest";
import {
  DEFAULT_LEDGER_ENTRY_FILTERS,
  filterExpenditureBySearch,
  filterFundingBySearch,
  paginateItems,
  toLedgerListQueryOptions,
} from "@/lib/ledger/entry-list-filters";

describe("ledger entry list filters", () => {
  it("maps UI filters to list query options", () => {
    expect(
      toLedgerListQueryOptions(
        {
          ...DEFAULT_LEDGER_ENTRY_FILTERS,
          mdaId: "mda-a",
          fiscalYear: "2026",
          quarter: "2",
        },
        ["mda-a", "mda-b"],
      ),
    ).toEqual({
      mdaIds: ["mda-a"],
      fiscalYear: 2026,
      quarter: 2,
      limit: 100,
    });
  });

  it("falls back to scoped MDA ids when MDA filter is all", () => {
    expect(
      toLedgerListQueryOptions(DEFAULT_LEDGER_ENTRY_FILTERS, ["mda-a"]),
    ).toEqual({
      mdaIds: ["mda-a"],
      fiscalYear: undefined,
      quarter: undefined,
      limit: 100,
    });
  });

  it("paginates ledger entry lists", () => {
    const items = Array.from({ length: 25 }, (_, index) => index + 1);

    expect(paginateItems(items, 1).items).toHaveLength(20);
    expect(paginateItems(items, 1)).toMatchObject({
      page: 1,
      pageCount: 2,
      total: 25,
      rangeStart: 1,
      rangeEnd: 20,
    });
    expect(paginateItems(items, 2)).toMatchObject({
      page: 2,
      rangeStart: 21,
      rangeEnd: 25,
      items: [21, 22, 23, 24, 25],
    });
    expect(paginateItems(items, 99).page).toBe(2);
  });

  it("filters funding rows by search text", () => {
    const rows = [
      {
        public_id: "FND-001",
        reference_no: "REF-9",
        remarks: "June release",
        mdas: { name: "Health", abbreviation: "MOH" },
        programme_areas: { name: "Immunization" },
        funding_sources: { name: "FGN" },
      },
      {
        public_id: "FND-002",
        reference_no: "REF-10",
        remarks: null,
        mdas: { name: "Education", abbreviation: "MOE" },
        programme_areas: { name: "Training" },
        funding_sources: { name: "State" },
      },
    ] as Parameters<typeof filterFundingBySearch>[0];

    expect(filterFundingBySearch(rows, "immunization")).toHaveLength(1);
    expect(filterFundingBySearch(rows, "fnd-002")).toHaveLength(1);
    expect(filterFundingBySearch(rows, "")).toHaveLength(2);
  });

  it("filters expenditure rows by voucher and facility text", () => {
    const rows = [
      {
        public_id: "EXP-001",
        voucher_ref_no: "VCH-44",
        remarks: null,
        mdas: { name: "Health", abbreviation: "MOH" },
        programme_areas: { name: "PHC" },
        expenditure_categories: { name: "Drugs" },
        expenditure_items: { name: "ARV" },
        facilities: { name: "Central Clinic" },
      },
    ] as Parameters<typeof filterExpenditureBySearch>[0];

    expect(filterExpenditureBySearch(rows, "central clinic")).toHaveLength(1);
    expect(filterExpenditureBySearch(rows, "vch-44")).toHaveLength(1);
    expect(filterExpenditureBySearch(rows, "school")).toHaveLength(0);
  });
});
