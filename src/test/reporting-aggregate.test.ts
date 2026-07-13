import { describe, expect, it } from "vitest";
import {
  aggregateAopPlannedVsActual,
  aggregateBudgetComposition,
  aggregateBudgetVsActual,
  aggregateCategoryShare,
  aggregateExpenditureByCategory,
  aggregateExpenditureByFundingSource,
  aggregateFundingBySource,
  aggregateHeadlineKpis,
  aggregateLgaPhcShare,
  aggregateMdaExecutionLeaderboard,
  aggregatePhcCoverage,
  aggregatePhcFacilityLeaderboard,
  aggregatePhcFacilitySummary,
  aggregatePhcLgaSummary,
  aggregatePhcShare,
  aggregateProgrammeAreaSummary,
  aggregateQuarterlyTrend,
  aggregateStatusCounts,
  aggregateUnlinkedExpenditure,
  filterExpenditure,
  filterFunding,
} from "@/lib/reporting/aggregate";
import { emptyReportFilters } from "@/lib/reporting/types";
import {
  AOP_1,
  EC_DRUGS,
  EC_PERSONNEL,
  FACILITY_A,
  FS_FED,
  FS_INT,
  LGA_KANO,
  MDA_HEALTH,
  MDA_PHCMB,
  PA_PRIMARY,
  PA_SECONDARY,
  aopFixtures,
  budgetFixtures,
  expenditureFixtures,
  fundingFixtures,
} from "@/test/reporting-fixtures";

describe("filterFunding", () => {
  it("respects role scope (mdaIds)", () => {
    const filtered = filterFunding(
      fundingFixtures(),
      emptyReportFilters(),
      { mdaIds: [MDA_HEALTH] },
    );
    expect(filtered.every((row) => row.mda_id === MDA_HEALTH)).toBe(true);
    expect(filtered).toHaveLength(3);
  });

  it("filters by status, fiscal year, MDA, and programme area", () => {
    const rows = filterFunding(fundingFixtures(), {
      ...emptyReportFilters(),
      status: "approved",
      fiscalYear: 2026,
      programmeAreaId: PA_PRIMARY,
    });
    expect(rows).toHaveLength(1);
    expect(rows[0].id).toBe("f1");
  });

  it("filters by date range inclusively", () => {
    const rows = filterFunding(fundingFixtures(), {
      ...emptyReportFilters(),
      dateFrom: "2026-01-01",
      dateTo: "2026-03-31",
    });
    expect(rows.map((r) => r.id).sort()).toEqual(["f1", "f2"]);
  });

  it("filters by quarter", () => {
    const rows = filterFunding(fundingFixtures(), {
      ...emptyReportFilters(),
      quarter: 1,
    });
    expect(rows.map((r) => r.id).sort()).toEqual(["f1", "f2"]);
  });
});

describe("filterExpenditure", () => {
  it("filters by PHC and LGA", () => {
    const rows = filterExpenditure(expenditureFixtures(), {
      ...emptyReportFilters(),
      phc: "yes",
      lgaId: LGA_KANO,
    });
    expect(rows.map((r) => r.id).sort()).toEqual(["e2", "e3"]);
  });

  it("excludes PHC entries when phc=no", () => {
    const rows = filterExpenditure(expenditureFixtures(), {
      ...emptyReportFilters(),
      phc: "no",
    });
    expect(rows.every((r) => r.is_phc === false)).toBe(true);
    expect(rows.map((r) => r.id).sort()).toEqual(["e1", "e4"]);
  });

  it("filters by quarter", () => {
    const rows = filterExpenditure(expenditureFixtures(), {
      ...emptyReportFilters(),
      quarter: 2,
    });
    expect(rows.map((r) => r.id).sort()).toEqual(["e2", "e3"]);
  });
});

describe("aggregateStatusCounts", () => {
  it("counts entries by status across both ledgers", () => {
    const result = aggregateStatusCounts(
      fundingFixtures(),
      expenditureFixtures(),
      emptyReportFilters(),
    );
    expect(result.funding).toEqual({
      pending: 1,
      approved: 1,
      processed: 1,
      rejected: 1,
    });
    expect(result.expenditure).toEqual({
      pending: 1,
      approved: 2,
      processed: 0,
      rejected: 1,
    });
  });

  it("sums approved+processed amounts only", () => {
    const result = aggregateStatusCounts(
      fundingFixtures(),
      expenditureFixtures(),
      emptyReportFilters(),
    );
    // funding f1 (1M approved) + f3 (750k processed) = 1.75M
    expect(result.totalFunding).toBe(1_750_000);
    // expenditure e1 (600k approved) + e2 (200k approved) = 800k
    expect(result.totalExpenditure).toBe(800_000);
  });

  it("ignores the status filter so cards always show every state", () => {
    const result = aggregateStatusCounts(
      fundingFixtures(),
      expenditureFixtures(),
      { ...emptyReportFilters(), status: "approved" },
    );
    expect(result.funding.rejected).toBe(1);
    expect(result.expenditure.rejected).toBe(1);
  });

  it("respects role scope", () => {
    const result = aggregateStatusCounts(
      fundingFixtures(),
      expenditureFixtures(),
      emptyReportFilters(),
      { mdaIds: [MDA_PHCMB] },
    );
    expect(result.funding.processed).toBe(1);
    expect(result.expenditure.pending).toBe(1);
    // Health-only rows should be excluded.
    expect(result.funding.approved).toBe(0);
    expect(result.expenditure.approved).toBe(0);
  });
});

describe("aggregateBudgetVsActual", () => {
  it("joins budgets with summed funding & expenditure for the same MDA/FY", () => {
    const rows = aggregateBudgetVsActual(
      budgetFixtures(),
      fundingFixtures(),
      expenditureFixtures(),
      emptyReportFilters(),
    );
    const health = rows.find((r) => r.mda_id === MDA_HEALTH && r.fiscal_year === 2026);
    expect(health).toBeDefined();
    // Health 2026 funding: f1 1M + f2 500k = 1.5M (all FY 2026 + Health)
    expect(health!.total_funding_amount).toBe(1_500_000);
    // Health 2026 expenditure: e1 600k + e2 200k = 800k
    expect(health!.total_expenditure_amount).toBe(800_000);
    expect(health!.budget_balance_amount).toBe(1_500_000 - 800_000);
    expect(health!.budget_used_ratio).toBeCloseTo(800_000 / 1_500_000, 5);
  });

  it("returns null utilization when budget is zero", () => {
    const rows = aggregateBudgetVsActual(
      [
        {
          mda_id: MDA_HEALTH,
          mda_name: "Health",
          fiscal_year: 2026,
          personnel_amount: 0,
          other_recurrent_amount: 0,
          total_recurrent_amount: 0,
          capital_amount: 0,
          total_budget_amount: 0,
        },
      ],
      fundingFixtures(),
      expenditureFixtures(),
      emptyReportFilters(),
    );
    expect(rows[0].budget_used_ratio).toBeNull();
  });

  it("respects role scope", () => {
    const rows = aggregateBudgetVsActual(
      budgetFixtures(),
      fundingFixtures(),
      expenditureFixtures(),
      emptyReportFilters(),
      { mdaIds: [MDA_PHCMB] },
    );
    expect(rows).toHaveLength(1);
    expect(rows[0].mda_id).toBe(MDA_PHCMB);
  });
});

describe("aggregateFundingBySource", () => {
  it("groups by funding source and orders by total descending", () => {
    const rows = aggregateFundingBySource(fundingFixtures(), emptyReportFilters());
    expect(rows.map((r) => r.funding_source_id)).toEqual([FS_FED, FS_INT]);
    expect(rows[0].total_amount).toBe(1_000_000 + 750_000 + 250_000);
    expect(rows[1].total_amount).toBe(500_000);
  });
});

describe("aggregateExpenditureByCategory", () => {
  it("groups expenditure by category", () => {
    const rows = aggregateExpenditureByCategory(expenditureFixtures(), emptyReportFilters());
    const personnel = rows.find((r) => r.expenditure_category_id === EC_PERSONNEL);
    const drugs = rows.find((r) => r.expenditure_category_id === EC_DRUGS);
    expect(personnel?.total_amount).toBe(600_000 + 100_000);
    expect(drugs?.total_amount).toBe(200_000 + 350_000);
  });
});

describe("aggregateExpenditureByFundingSource", () => {
  it("groups expenditure by allocation amounts without double-counting", () => {
    const rows = aggregateExpenditureByFundingSource(
      expenditureFixtures(),
      emptyReportFilters(),
    );
    const federal = rows.find((row) => row.funding_source_id === FS_FED);
    const international = rows.find((row) => row.funding_source_id === FS_INT);
    expect(federal?.total_amount).toBe(600_000 + 350_000 + 100_000);
    expect(international?.total_amount).toBe(200_000);
  });
});

describe("aggregateProgrammeAreaSummary", () => {
  it("returns funding, expenditure, and signed gap per programme area", () => {
    const rows = aggregateProgrammeAreaSummary(
      fundingFixtures(),
      expenditureFixtures(),
      emptyReportFilters(),
    );
    const primary = rows.find((r) => r.programme_area_id === PA_PRIMARY);
    expect(primary?.total_funding_amount).toBe(1_000_000 + 500_000 + 750_000);
    expect(primary?.total_expenditure_amount).toBe(600_000 + 200_000 + 350_000);
    expect(primary?.gap_amount).toBe(primary!.total_funding_amount - primary!.total_expenditure_amount);

    const secondary = rows.find((r) => r.programme_area_id === PA_SECONDARY);
    expect(secondary?.total_funding_amount).toBe(250_000);
    expect(secondary?.total_expenditure_amount).toBe(100_000);
  });
});

describe("aggregatePhcLgaSummary", () => {
  it("only includes PHC entries", () => {
    const rows = aggregatePhcLgaSummary(expenditureFixtures(), emptyReportFilters());
    expect(rows).toHaveLength(1);
    expect(rows[0].lga_id).toBe(LGA_KANO);
    expect(rows[0].total_expenditure_amount).toBe(200_000 + 350_000);
    expect(rows[0].entry_count).toBe(2);
  });
});

describe("aggregatePhcFacilitySummary", () => {
  it("groups PHC entries by facility", () => {
    const rows = aggregatePhcFacilitySummary(expenditureFixtures(), emptyReportFilters());
    expect(rows).toHaveLength(1);
    expect(rows[0].facility_id).toBe(FACILITY_A);
  });
});

describe("aggregateAopPlannedVsActual", () => {
  it("links expenditure by aop_activity_id and computes remaining", () => {
    const rows = aggregateAopPlannedVsActual(
      aopFixtures(),
      expenditureFixtures(),
      emptyReportFilters(),
    );
    const linked = rows.find((r) => r.aop_activity_id === AOP_1);
    expect(linked?.linked_expenditure_amount).toBe(600_000);
    expect(linked?.remaining_amount).toBe(800_000 - 600_000);

    const unlinkedActivity = rows.find((r) => r.aop_activity_id === "aop-2");
    expect(unlinkedActivity?.linked_expenditure_amount).toBe(0);
    expect(unlinkedActivity?.remaining_amount).toBe(300_000);
  });

  it("excludes inactive activities", () => {
    const rows = aggregateAopPlannedVsActual(
      aopFixtures(),
      expenditureFixtures(),
      emptyReportFilters(),
    );
    expect(rows.find((r) => r.aop_activity_id === "aop-archived")).toBeUndefined();
  });

  it("counts only approved and processed expenditure as linked spend", () => {
    const rows = aggregateAopPlannedVsActual(
      aopFixtures(),
      [
        ...expenditureFixtures(),
        {
          ...expenditureFixtures()[2],
          id: "e-pending-linked",
          aop_activity_id: AOP_1,
          amount: 125_000,
        },
      ],
      emptyReportFilters(),
    );

    expect(rows.find((row) => row.aop_activity_id === AOP_1)?.linked_expenditure_amount)
      .toBe(600_000);
  });
});

describe("aggregateHeadlineKpis", () => {
  const fy2026 = { ...emptyReportFilters(), fiscalYear: 2026 };

  it("sums budget, actual funding, and actual expenditure", () => {
    const kpis = aggregateHeadlineKpis(
      budgetFixtures(),
      fundingFixtures(),
      expenditureFixtures(),
      fy2026,
    );
    expect(kpis.total_budget_amount).toBe(2_500_000);
    // f1 1M approved + f3 750k processed; f2 pending excluded.
    expect(kpis.total_funding_amount).toBe(1_750_000);
    // e1 600k + e2 200k approved; e3 pending excluded.
    expect(kpis.total_expenditure_amount).toBe(800_000);
    expect(kpis.budget_execution_rate).toBeCloseTo(800_000 / 2_500_000, 5);
    expect(kpis.funding_utilisation_rate).toBeCloseTo(800_000 / 1_750_000, 5);
    expect(kpis.funding_gap_amount).toBe(1_750_000 - 800_000);
  });

  it("ignores the status filter and counts only approved/processed entries", () => {
    const kpis = aggregateHeadlineKpis(
      budgetFixtures(),
      fundingFixtures(),
      expenditureFixtures(),
      { ...fy2026, status: "pending" },
    );
    expect(kpis.total_funding_amount).toBe(1_750_000);
    expect(kpis.total_expenditure_amount).toBe(800_000);
  });

  it("returns null rates when there is no budget or funding", () => {
    const kpis = aggregateHeadlineKpis([], [], [], emptyReportFilters());
    expect(kpis.budget_execution_rate).toBeNull();
    expect(kpis.funding_utilisation_rate).toBeNull();
  });

  it("respects the quarter filter for ledger totals", () => {
    const kpis = aggregateHeadlineKpis(
      budgetFixtures(),
      fundingFixtures(),
      expenditureFixtures(),
      { ...fy2026, quarter: 2 },
    );
    expect(kpis.total_funding_amount).toBe(750_000);
    expect(kpis.total_expenditure_amount).toBe(200_000);
  });
});

describe("aggregatePhcShare", () => {
  it("splits actual expenditure into PHC and non-PHC", () => {
    const result = aggregatePhcShare(expenditureFixtures(), {
      ...emptyReportFilters(),
      fiscalYear: 2026,
    });
    // e2 200k approved PHC; e3 pending excluded; e1 600k non-PHC.
    expect(result.phc_amount).toBe(200_000);
    expect(result.non_phc_amount).toBe(600_000);
    expect(result.total_amount).toBe(800_000);
    expect(result.phc_share).toBeCloseTo(0.25, 5);
  });

  it("ignores the PHC filter so the share base stays complete", () => {
    const result = aggregatePhcShare(expenditureFixtures(), {
      ...emptyReportFilters(),
      fiscalYear: 2026,
      phc: "yes",
    });
    expect(result.non_phc_amount).toBe(600_000);
  });

  it("returns null share when nothing was spent", () => {
    expect(aggregatePhcShare([], emptyReportFilters()).phc_share).toBeNull();
  });
});

describe("aggregateQuarterlyTrend", () => {
  it("buckets actual funding and expenditure into all four quarters", () => {
    const rows = aggregateQuarterlyTrend(
      fundingFixtures(),
      expenditureFixtures(),
      { ...emptyReportFilters(), fiscalYear: 2026 },
    );
    expect(rows).toHaveLength(4);
    expect(rows[0]).toEqual({
      quarter: 1,
      total_funding_amount: 1_000_000,
      total_expenditure_amount: 600_000,
    });
    expect(rows[1]).toEqual({
      quarter: 2,
      total_funding_amount: 750_000,
      total_expenditure_amount: 200_000,
    });
    expect(rows[2].total_funding_amount).toBe(0);
    expect(rows[3].total_expenditure_amount).toBe(0);
  });

  it("ignores the quarter filter so the full-year shape stays visible", () => {
    const rows = aggregateQuarterlyTrend(
      fundingFixtures(),
      expenditureFixtures(),
      { ...emptyReportFilters(), fiscalYear: 2026, quarter: 1 },
    );
    expect(rows[1].total_funding_amount).toBe(750_000);
  });
});

describe("aggregateCategoryShare", () => {
  it("computes each category's share of actual spending", () => {
    const rows = aggregateCategoryShare(expenditureFixtures(), {
      ...emptyReportFilters(),
      fiscalYear: 2026,
    });
    expect(rows).toHaveLength(2);
    const personnel = rows.find((r) => r.expenditure_category_id === EC_PERSONNEL);
    const drugs = rows.find((r) => r.expenditure_category_id === EC_DRUGS);
    expect(personnel?.total_amount).toBe(600_000);
    expect(personnel?.share).toBeCloseTo(0.75, 5);
    expect(drugs?.total_amount).toBe(200_000);
    expect(drugs?.share).toBeCloseTo(0.25, 5);
  });

  it("orders categories by total descending", () => {
    const rows = aggregateCategoryShare(expenditureFixtures(), {
      ...emptyReportFilters(),
      fiscalYear: 2026,
    });
    expect(rows[0].expenditure_category_id).toBe(EC_PERSONNEL);
  });
});

describe("aggregateBudgetComposition", () => {
  it("sums personnel, other recurrent, and capital across scoped budgets", () => {
    const result = aggregateBudgetComposition(budgetFixtures(), {
      ...emptyReportFilters(),
      fiscalYear: 2026,
    });
    expect(result).toEqual({
      personnel_amount: 1_200_000,
      other_recurrent_amount: 400_000,
      capital_amount: 900_000,
      total_budget_amount: 2_500_000,
    });
  });

  it("respects the MDA filter", () => {
    const result = aggregateBudgetComposition(budgetFixtures(), {
      ...emptyReportFilters(),
      mdaId: MDA_PHCMB,
    });
    expect(result.total_budget_amount).toBe(1_000_000);
  });
});

describe("aggregateMdaExecutionLeaderboard", () => {
  it("ranks MDAs by actual expenditure over approved budget", () => {
    const rows = aggregateMdaExecutionLeaderboard(
      budgetFixtures(),
      expenditureFixtures(),
      { ...emptyReportFilters(), fiscalYear: 2026 },
    );
    expect(rows).toHaveLength(2);
    expect(rows[0].mda_id).toBe(MDA_HEALTH);
    expect(rows[0].execution_rate).toBeCloseTo(800_000 / 1_500_000, 5);
    // PHCMB has only a pending entry, so its actual spend is 0.
    expect(rows[1].mda_id).toBe(MDA_PHCMB);
    expect(rows[1].execution_rate).toBe(0);
  });

  it("excludes MDAs without an approved budget", () => {
    const rows = aggregateMdaExecutionLeaderboard(
      [],
      expenditureFixtures(),
      emptyReportFilters(),
    );
    expect(rows).toHaveLength(0);
  });
});

/**
 * Fixtures plus a second approved PHC entry in a different LGA/facility, so
 * the LGA-level aggregations have more than one group to rank.
 */
function expenditureWithSecondLga() {
  const base = expenditureFixtures();
  return [
    ...base,
    {
      ...base[1], // clone of e2: approved PHC entry in Kano Municipal
      id: "e5",
      lga_id: "lga-dawakin",
      lga_name: "Dawakin Tofa",
      facility_id: "facility-b",
      facility_name: "PHC Dawakin Tofa",
      quarter: 1 as const,
      transaction_date: "2026-02-01",
      amount: 100_000,
      status: "processed" as const,
    },
  ];
}

describe("aggregateLgaPhcShare", () => {
  it("ranks LGAs by actual PHC spending with shares and facility counts", () => {
    const rows = aggregateLgaPhcShare(expenditureWithSecondLga(), emptyReportFilters());
    // e2 (approved, 200k, Kano) + e5 (processed, 100k, Dawakin); e3 is pending.
    expect(rows).toHaveLength(2);
    expect(rows[0].lga_id).toBe(LGA_KANO);
    expect(rows[0].total_expenditure_amount).toBe(200_000);
    expect(rows[0].share).toBeCloseTo(200_000 / 300_000, 5);
    expect(rows[0].facility_count).toBe(1);
    expect(rows[1].lga_name).toBe("Dawakin Tofa");
    expect(rows[1].share).toBeCloseTo(100_000 / 300_000, 5);
  });

  it("respects the LGA filter", () => {
    const rows = aggregateLgaPhcShare(expenditureWithSecondLga(), {
      ...emptyReportFilters(),
      lgaId: LGA_KANO,
    });
    expect(rows).toHaveLength(1);
    expect(rows[0].lga_id).toBe(LGA_KANO);
    expect(rows[0].share).toBe(1);
  });

  it("always describes PHC money even when the PHC filter is 'no'", () => {
    const rows = aggregateLgaPhcShare(expenditureWithSecondLga(), {
      ...emptyReportFilters(),
      phc: "no",
    });
    expect(rows).toHaveLength(2);
  });
});

describe("aggregatePhcFacilityLeaderboard", () => {
  it("ranks facilities by actual PHC spending", () => {
    const rows = aggregatePhcFacilityLeaderboard(
      expenditureWithSecondLga(),
      emptyReportFilters(),
    );
    expect(rows).toHaveLength(2);
    expect(rows[0].facility_id).toBe(FACILITY_A);
    expect(rows[0].total_expenditure_amount).toBe(200_000);
    expect(rows[0].lga_name).toBe("Kano Municipal");
    expect(rows[1].facility_name).toBe("PHC Dawakin Tofa");
    expect(rows[1].share).toBeCloseTo(100_000 / 300_000, 5);
  });
});

describe("aggregatePhcCoverage", () => {
  it("counts LGAs and facilities reached by actual PHC spending", () => {
    const coverage = aggregatePhcCoverage(
      expenditureWithSecondLga(),
      emptyReportFilters(),
    );
    expect(coverage.total_phc_amount).toBe(300_000);
    expect(coverage.lga_count).toBe(2);
    expect(coverage.facility_count).toBe(2);
    expect(coverage.average_per_facility).toBe(150_000);
  });

  it("returns zero coverage and a null average when nothing was spent", () => {
    const coverage = aggregatePhcCoverage([], emptyReportFilters());
    expect(coverage.total_phc_amount).toBe(0);
    expect(coverage.lga_count).toBe(0);
    expect(coverage.facility_count).toBe(0);
    expect(coverage.average_per_facility).toBeNull();
  });
});

describe("aggregateUnlinkedExpenditure", () => {
  it("only returns expenditure rows without an aop_activity_id", () => {
    const rows = aggregateUnlinkedExpenditure(expenditureFixtures(), emptyReportFilters());
    const totalEntries = rows.reduce((acc, row) => acc + row.entry_count, 0);
    // e2, e3, e4 have no AOP link.
    expect(totalEntries).toBe(3);
  });
});
