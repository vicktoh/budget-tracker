import { describe, expect, it } from "vitest";
import {
  evaluateFundingAllocationWarnings,
  computeFundingPoolBalance,
} from "@/lib/expenditure/funding-balance";

const MDA = "mda-1";
const PA = "pa-1";
const FS = "fs-1";

describe("computeFundingPoolBalance", () => {
  it("subtracts allocated spend from received funding for the scoped pool", () => {
    const pool = computeFundingPoolBalance({
      mdaId: MDA,
      fiscalYear: 2026,
      programmeAreaId: PA,
      fundingSourceId: FS,
      fundingEntries: [
        {
          mda_id: MDA,
          fiscal_year: 2026,
          programme_area_id: PA,
          funding_source_id: FS,
          amount: 1_000_000,
        },
        {
          mda_id: MDA,
          fiscal_year: 2026,
          programme_area_id: PA,
          funding_source_id: FS,
          amount: 500_000,
        },
      ],
      expenditureAllocations: [
        {
          expenditure_entry_id: "e1",
          mda_id: MDA,
          fiscal_year: 2026,
          programme_area_id: PA,
          funding_source_id: FS,
          amount: 300_000,
        },
      ],
    });

    expect(pool).toEqual({
      received_amount: 1_500_000,
      allocated_amount: 300_000,
      available_amount: 1_200_000,
    });
  });
});

describe("evaluateFundingAllocationWarnings", () => {
  it("returns a warning when a proposed allocation exceeds the available pool", () => {
    const warnings = evaluateFundingAllocationWarnings({
      mdaId: MDA,
      fiscalYear: 2026,
      programmeAreaId: PA,
      allocations: [{ funding_source_id: FS, amount: 800_000 }],
      fundingEntries: [
        {
          mda_id: MDA,
          fiscal_year: 2026,
          programme_area_id: PA,
          funding_source_id: FS,
          amount: 500_000,
        },
      ],
      expenditureAllocations: [],
      fundingSourceNames: new Map([[FS, "BHCPF Allocation"]]),
    });

    expect(warnings).toHaveLength(1);
    expect(warnings[0]?.overflow_amount).toBe(300_000);
    expect(warnings[0]?.message).toContain("BHCPF Allocation");
  });
});
