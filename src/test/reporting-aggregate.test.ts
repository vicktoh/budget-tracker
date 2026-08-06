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
  aggregateMdaReportingCoverage,
  aggregatePhcCoverage,
  aggregatePhcFacilityLeaderboard,
  aggregatePhcFacilitySummary,
  aggregatePhcLgaSummary,
  aggregatePhcProgrammeClassification,
  aggregatePhcShare,
  aggregateProgrammeAreaSummary,
  aggregateQuarterlyTrend,
  aggregateEntrySummary,
  aggregateUnlinkedExpenditure,
  filterExpenditure,
  filterFunding,
} from "@/lib/reporting/aggregate";
import { emptyReportFilters } from "@/lib/reporting/types";
import type {
  ApprovedBudgetLineLite,
  ExpenditureEntryLite,
} from "@/lib/reporting/types";
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

  it("filters by fiscal year and programme area", () => {
    const rows = filterFunding(fundingFixtures(), {
      ...emptyReportFilters(),
      fiscalYear: 2026,
      programmeAreaId: PA_PRIMARY,
    });
    expect(rows.map((row) => row.id).sort()).toEqual(["f1", "f2", "f3"]);
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

describe("aggregateEntrySummary", () => {
  it("counts every active entry across both ledgers", () => {
    const result = aggregateEntrySummary(
      fundingFixtures(),
      expenditureFixtures(),
      emptyReportFilters(),
    );
    expect(result.fundingCount).toBe(4);
    expect(result.expenditureCount).toBe(4);
  });

  it("sums every active ledger row", () => {
    const result = aggregateEntrySummary(
      fundingFixtures(),
      expenditureFixtures(),
      emptyReportFilters(),
    );
    expect(result.totalFunding).toBe(2_500_000);
    expect(result.totalExpenditure).toBe(1_250_000);
  });

  it("respects role scope", () => {
    const result = aggregateEntrySummary(
      fundingFixtures(),
      expenditureFixtures(),
      emptyReportFilters(),
      { mdaIds: [MDA_PHCMB] },
    );
    expect(result).toEqual({
      fundingCount: 1,
      expenditureCount: 1,
      totalFunding: 750_000,
      totalExpenditure: 350_000,
    });
  });
});

describe("aggregateMdaReportingCoverage", () => {
  const mdas = [
    { id: MDA_HEALTH, name: "Ministry of Health" },
    { id: MDA_PHCMB, name: "Primary Health Care Board" },
    { id: "mda-no-report", name: "MDA without entries" },
  ];

  it("surfaces complete, partial, and missing MDA reports for the selected period", () => {
    const rows = aggregateMdaReportingCoverage(
      mdas,
      fundingFixtures(),
      expenditureFixtures(),
      { ...emptyReportFilters(), fiscalYear: 2026, quarter: 1 },
    );

    expect(rows.find((row) => row.mda_id === MDA_HEALTH)?.status).toBe("complete");
    expect(rows.find((row) => row.mda_id === MDA_HEALTH)).toMatchObject({
      funding_amount: 1_500_000,
      expenditure_amount: 600_000,
      personnel_amount: 600_000,
      personnel_entry_count: 1,
      overhead_amount: 0,
      overhead_entry_count: 0,
      capital_amount: 0,
      capital_entry_count: 0,
    });
    expect(rows.find((row) => row.mda_id === MDA_PHCMB)).toMatchObject({
      status: "missing",
      personnel_entry_count: 0,
      overhead_entry_count: 0,
      capital_entry_count: 0,
      gaps: ["Funding entries", "Expenditure entries"],
      latest_entry_date: null,
    });
    expect(rows[0].mda_id).toBe("mda-no-report");
  });

  it("marks a single-ledger submission as partial and reports the gap", () => {
    const rows = aggregateMdaReportingCoverage(
      mdas,
      fundingFixtures(),
      [],
      { ...emptyReportFilters(), fiscalYear: 2026 },
    );
    const health = rows.find((row) => row.mda_id === MDA_HEALTH);

    expect(health).toMatchObject({
      status: "partial",
      funding_entry_count: 2,
      expenditure_entry_count: 0,
      gaps: ["Expenditure entries"],
      latest_entry_date: "2026-02-10",
    });
  });

  it("counts expenditure entries by the reporting economic classes", () => {
    const [personnel] = expenditureFixtures();
    const rows = aggregateMdaReportingCoverage(
      [{ id: MDA_HEALTH, name: "Ministry of Health" }],
      [],
      [
        personnel,
        {
          ...personnel,
          id: "e-overhead",
          expenditure_category_name: "Overhead / Running Costs",
        },
        {
          ...personnel,
          id: "e-capital",
          expenditure_category_name: "Medical Equipment",
        },
        {
          ...personnel,
          id: "e-other",
          expenditure_category_name: "Drugs & Supplies",
        },
      ],
      { ...emptyReportFilters(), fiscalYear: 2026 },
    );

    expect(rows[0]).toMatchObject({
      expenditure_amount: 2_400_000,
      expenditure_entry_count: 4,
      personnel_amount: 600_000,
      personnel_entry_count: 1,
      overhead_amount: 600_000,
      overhead_entry_count: 1,
      capital_amount: 600_000,
      capital_entry_count: 1,
    });
  });

  it("limits the coverage population when an MDA filter is selected", () => {
    const rows = aggregateMdaReportingCoverage(
      mdas,
      fundingFixtures(),
      expenditureFixtures(),
      { ...emptyReportFilters(), mdaId: MDA_HEALTH },
    );

    expect(rows).toHaveLength(1);
    expect(rows[0].mda_id).toBe(MDA_HEALTH);
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

describe("aggregatePhcProgrammeClassification", () => {
  const approvedLines: ApprovedBudgetLineLite[] = [
    {
      id: "phc-personnel",
      fiscal_year: 2026,
      mda_id: MDA_PHCMB,
      budget_class: "personnel",
      programme_code: "04010110050001",
      approved_amount: 700_512_000,
    },
    {
      id: "phc-overhead",
      fiscal_year: 2026,
      mda_id: MDA_PHCMB,
      budget_class: "overhead",
      programme_code: "04010110050001",
      approved_amount: 2_016_612_000,
    },
    {
      id: "phc-capital",
      fiscal_year: 2026,
      mda_id: MDA_PHCMB,
      budget_class: "capital",
      programme_code: "04010110050001",
      approved_amount: 12_901_240_748.29,
    },
  ];

  function publishedPhcActuals(): ExpenditureEntryLite[] {
    const base = expenditureFixtures()[2];
    return [
      {
        ...base,
        id: "phc-q1-capital",
        quarter: 1,
        amount: 3_250_448_900,
        budget_class: "capital",
        programme_code: "04010110050001",
        expenditure_category_name: "Capital Expenditure",
      },
      {
        ...base,
        id: "phc-q1-personnel",
        quarter: 1,
        amount: 99_985_872.48,
        budget_class: null,
        programme_code: null,
        expenditure_category_name: "Personnel Costs",
      },
      {
        ...base,
        id: "phc-q2-overhead",
        quarter: 2,
        amount: 653_329_310.13,
        budget_class: null,
        programme_code: null,
        expenditure_category_name: "Overhead Running Costs",
      },
      {
        ...base,
        id: "phc-q2-capital",
        quarter: 2,
        amount: 1_742_281_296.78,
        budget_class: null,
        programme_code: null,
        expenditure_category_name: "Capital Expenditure",
      },
      {
        ...base,
        id: "phc-q2-personnel",
        quarter: 2,
        amount: 194_166_882.53,
        budget_class: null,
        programme_code: null,
        expenditure_category_name: "Personnel Costs",
      },
    ];
  }

  it("reproduces the published Q2 Table 22 and excludes personnel", () => {
    const rows = aggregatePhcProgrammeClassification(
      approvedLines,
      publishedPhcActuals(),
      { ...emptyReportFilters(), fiscalYear: 2026, quarter: 2 },
      MDA_PHCMB,
    );

    expect(rows.map((row) => row.code)).toEqual([null, "04", "0401"]);
    for (const row of rows) {
      expect(row.budget_amount).toBeCloseTo(14_917_852_748.29, 2);
      expect(row.quarter_actual).toBeCloseTo(2_395_610_606.91, 2);
      expect(row.ytd_actual).toBeCloseTo(5_646_059_506.91, 2);
      expect(row.performance_rate).toBeCloseTo(
        5_646_059_506.91 / 14_917_852_748.29,
        10,
      );
      expect(row.balance_amount).toBeCloseTo(9_271_793_241.38, 2);
    }
  });

  it("keeps unlinked actuals unclassified when multiple programmes are eligible", () => {
    const secondProgramme: ApprovedBudgetLineLite = {
      ...approvedLines[1],
      id: "phc-overhead-0405",
      programme_code: "04050110050001",
      approved_amount: 500,
    };
    const [unlinked] = publishedPhcActuals().filter(
      (row) => row.id === "phc-q2-overhead",
    );
    const rows = aggregatePhcProgrammeClassification(
      [...approvedLines, secondProgramme],
      [unlinked],
      { ...emptyReportFilters(), fiscalYear: 2026, quarter: 2 },
      MDA_PHCMB,
    );

    const unclassified = rows.find((row) => row.row_id === "programme-unclassified");
    expect(unclassified?.quarter_actual).toBe(653_329_310.13);
    expect(rows.find((row) => row.code === "0401")?.quarter_actual).toBe(0);
    expect(rows.find((row) => row.code === "0405")?.quarter_actual).toBe(0);
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

  it("counts every active linked expenditure", () => {
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
      .toBe(725_000);
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
    expect(kpis.total_funding_amount).toBe(2_250_000);
    expect(kpis.total_expenditure_amount).toBe(1_150_000);
    expect(kpis.budget_execution_rate).toBeCloseTo(1_150_000 / 2_500_000, 5);
    expect(kpis.funding_utilisation_rate).toBeCloseTo(1_150_000 / 2_250_000, 5);
    expect(kpis.funding_gap_amount).toBe(1_100_000);
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
    expect(kpis.total_expenditure_amount).toBe(550_000);
  });
});

describe("aggregatePhcShare", () => {
  it("splits actual expenditure into PHC and non-PHC", () => {
    const result = aggregatePhcShare(expenditureFixtures(), {
      ...emptyReportFilters(),
      fiscalYear: 2026,
    });
    expect(result.phc_amount).toBe(550_000);
    expect(result.non_phc_amount).toBe(600_000);
    expect(result.total_amount).toBe(1_150_000);
    expect(result.phc_share).toBeCloseTo(550_000 / 1_150_000, 5);
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
      total_funding_amount: 1_500_000,
      total_expenditure_amount: 600_000,
    });
    expect(rows[1]).toEqual({
      quarter: 2,
      total_funding_amount: 750_000,
      total_expenditure_amount: 550_000,
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
    expect(personnel?.share).toBeCloseTo(600_000 / 1_150_000, 5);
    expect(drugs?.total_amount).toBe(550_000);
    expect(drugs?.share).toBeCloseTo(550_000 / 1_150_000, 5);
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
    expect(rows[1].mda_id).toBe(MDA_PHCMB);
    expect(rows[1].execution_rate).toBeCloseTo(350_000 / 1_000_000, 5);
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
    },
  ];
}

describe("aggregateLgaPhcShare", () => {
  it("ranks LGAs by actual PHC spending with shares and facility counts", () => {
    const rows = aggregateLgaPhcShare(expenditureWithSecondLga(), emptyReportFilters());
    expect(rows).toHaveLength(2);
    expect(rows[0].lga_id).toBe(LGA_KANO);
    expect(rows[0].total_expenditure_amount).toBe(550_000);
    expect(rows[0].share).toBeCloseTo(550_000 / 650_000, 5);
    expect(rows[0].facility_count).toBe(1);
    expect(rows[1].lga_name).toBe("Dawakin Tofa");
    expect(rows[1].share).toBeCloseTo(100_000 / 650_000, 5);
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
    expect(rows[0].total_expenditure_amount).toBe(550_000);
    expect(rows[0].lga_name).toBe("Kano Municipal");
    expect(rows[1].facility_name).toBe("PHC Dawakin Tofa");
    expect(rows[1].share).toBeCloseTo(100_000 / 650_000, 5);
  });
});

describe("aggregatePhcCoverage", () => {
  it("counts LGAs and facilities reached by actual PHC spending", () => {
    const coverage = aggregatePhcCoverage(
      expenditureWithSecondLga(),
      emptyReportFilters(),
    );
    expect(coverage.total_phc_amount).toBe(650_000);
    expect(coverage.lga_count).toBe(2);
    expect(coverage.facility_count).toBe(2);
    expect(coverage.average_per_facility).toBe(325_000);
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
