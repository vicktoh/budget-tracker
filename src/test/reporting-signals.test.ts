import { describe, expect, it } from "vitest";
import {
  aggregateAdminClassification,
  aggregateEconomicSummary,
  aggregateExceptions,
  aggregateHealthSectorObjectives,
  aggregateRevenueComposition,
  aggregateRevenuePerformance,
  aggregateReconciliation,
  aggregateYoyComparison,
} from "@/lib/reporting/aggregate";
import { classifyCategory, classifyEntry } from "@/lib/reporting/economic-class";
import {
  computeFindings,
  computeHubSignals,
  proRataBand,
  proRataTarget,
  summariseByLevel,
  zeroReleaseLevel,
} from "@/lib/reporting/signals";
import { emptyReportFilters } from "@/lib/reporting/types";
import type { ReportingDataset } from "@/lib/reporting/types";
import {
  aopFixtures,
  budgetFixtures,
  expenditureFixtures,
  fundingFixtures,
  revenueFixtures,
} from "@/test/reporting-fixtures";

function dataset(): ReportingDataset {
  return {
    funding: fundingFixtures(),
    expenditure: expenditureFixtures(),
    budgets: budgetFixtures(),
    revenues: revenueFixtures(),
    aopActivities: aopFixtures(),
    publications: [],
  };
}

const fy2026q1 = { ...emptyReportFilters(), fiscalYear: 2026, quarter: 1 as const };

describe("pro-rata rules", () => {
  it("targets a quarter of the budget per quarter", () => {
    expect(proRataTarget(1)).toBe(0.25);
    expect(proRataTarget(3)).toBe(0.75);
    expect(proRataTarget(null)).toBe(1);
  });

  it("bands execution against the pro-rata target", () => {
    expect(proRataBand(0.24, 1)).toBe("strong"); // 0.24/0.25 = 0.96
    expect(proRataBand(0.16, 1)).toBe("on_track"); // 0.64
    expect(proRataBand(0.09, 1)).toBe("investigate"); // 0.36
    expect(proRataBand(0.02, 1)).toBe("critical"); // 0.08
    expect(proRataBand(null, 1)).toBe("investigate");
  });

  it("flags zero release against a non-zero budget", () => {
    expect(zeroReleaseLevel(0, 100)).toBe("critical");
    expect(zeroReleaseLevel(50, 100)).toBeNull();
    expect(zeroReleaseLevel(0, 0)).toBeNull();
  });
});

describe("summariseByLevel", () => {
  it("counts signals per level, most severe first", () => {
    const summary = summariseByLevel([
      { level: "strong", label: "a" },
      { level: "critical", label: "b" },
      { level: "strong", label: "c" },
    ]);
    expect(summary).toEqual([
      { level: "critical", label: "1 Critical" },
      { level: "strong", label: "2 Strong" },
    ]);
  });
});

describe("computeFindings", () => {
  it("flags zero overhead as critical and full AOP linkage as strong", () => {
    const findings = computeFindings(dataset(), fy2026q1);
    const byKey = Object.fromEntries(findings.map((f) => [f.key, f.level]));
    // No overhead category in the fixtures but a non-zero other-recurrent budget.
    expect(byKey.overhead).toBe("critical");
    // Only Q1 actual (e1) is AOP-linked → 100% linkage.
    expect(byKey.aop).toBe("strong");
  });
});

describe("computeHubSignals", () => {
  it("summarises CSO findings into count chips", () => {
    const signals = computeHubSignals("cso", dataset(), fy2026q1);
    const labels = signals.map((s) => s.label);
    expect(labels).toContain("2 Critical");
    expect(labels).toContain("2 Strong");
  });

  it("reports BIR execution against pro-rata", () => {
    const signals = computeHubSignals("bir", dataset(), fy2026q1);
    expect(signals).toHaveLength(1);
    // 600k actual / 2.5M budget = 24% vs 25% pro-rata → strong.
    expect(signals[0].level).toBe("strong");
    expect(signals[0].label).toContain("vs 25% pro-rata");
  });

  it("surfaces audit exceptions", () => {
    const signals = computeHubSignals("audit", dataset(), {
      ...emptyReportFilters(),
      fiscalYear: 2026,
    });
    // No integrity issues in FY2026; e2 and e3 are not linked to an AOP activity.
    expect(signals[0]).toEqual({ level: "on_track", label: "No integrity exceptions" });
    expect(signals).toContainEqual({ level: "investigate", label: "2 unlinked to AOP" });
  });
});

describe("aggregateExceptions", () => {
  it("reports no integrity exception when allocations match", () => {
    const report = aggregateExceptions(expenditureFixtures(), emptyReportFilters());
    expect(report.counts.allocation_mismatch).toBe(0);
    expect(report.integrity_count).toBe(0);
  });

  it("carries voucher identifiers for the audit register", () => {
    const report = aggregateExceptions(expenditureFixtures(), {
      ...emptyReportFilters(),
      fiscalYear: 2026,
    });
    const unlinked = report.rows.find((row) => row.kind === "unlinked_aop");
    expect(unlinked?.public_id).toBe("EL-2026-0003"); // highest-value unlinked row
    expect(unlinked?.voucher_ref_no).toBe("VCH-e3");
  });
});

describe("aggregateReconciliation", () => {
  it("nets funding received against expenditure allocations per MDA and source", () => {
    const rows = aggregateReconciliation(fundingFixtures(), expenditureFixtures(), {
      ...emptyReportFilters(),
      fiscalYear: 2026,
    });
    const find = (mda: string, source: string) =>
      rows.find((r) => r.mda_name === mda && r.funding_source_name === source);

    // MoH · Federal: received 1M, allocated 600k → +400k
    const healthFed = find("Ministry of Health", "Federal Allocation");
    expect(healthFed?.received_amount).toBe(1_000_000);
    expect(healthFed?.allocated_amount).toBe(600_000);
    expect(healthFed?.variance_amount).toBe(400_000);

    // MoH · International: received 500k, allocated 200k → +300k
    const healthIntl = find("Ministry of Health", "International Donor");
    expect(healthIntl?.received_amount).toBe(500_000);
    expect(healthIntl?.allocated_amount).toBe(200_000);
    expect(healthIntl?.variance_amount).toBe(300_000);
  });
});

describe("economic classification", () => {
  it("maps category names to NCOA classes", () => {
    expect(classifyCategory("Personnel Costs")).toBe("personnel");
    expect(classifyCategory("Overhead / Running Costs")).toBe("overhead");
    expect(classifyCategory("Capital Expenditure")).toBe("capital");
    expect(classifyCategory("Infrastructure & Rehabilitation")).toBe("capital");
    expect(classifyCategory("Equipment & Furniture")).toBe("capital");
    expect(classifyCategory("Drugs & Supplies")).toBe("other");
  });

  it("prefers the bound budget line's NCOA class over the category name", () => {
    // The Q1 2026 PHCMB case: BPR capital spend recorded under programme-shaped
    // categories. The category name alone reads "other" and under-reported
    // capital by ₦1.89bn; the bound budget line says capital.
    expect(
      classifyEntry({
        budget_class: "capital",
        expenditure_category_name: "Outreach & Service Delivery",
      }),
    ).toBe("capital");
    expect(
      classifyEntry({
        budget_class: "capital",
        expenditure_category_name: "Transport & Logistics",
      }),
    ).toBe("capital");
    expect(
      classifyEntry({
        budget_class: "overhead",
        expenditure_category_name: "Equipment & Furniture",
      }),
    ).toBe("overhead");
  });

  it("falls back to the category name when no budget line is bound", () => {
    expect(
      classifyEntry({
        budget_class: null,
        expenditure_category_name: "Personnel Costs",
      }),
    ).toBe("personnel");
    expect(
      classifyEntry({
        budget_class: null,
        expenditure_category_name: "Drugs & Supplies",
      }),
    ).toBe("other");
  });

  it("ignores a budget_class that isn't a recognised NCOA class", () => {
    expect(
      classifyEntry({
        budget_class: "nonsense",
        expenditure_category_name: "Capital Expenditure",
      }),
    ).toBe("capital");
  });

  it("summarises the sector by economic class and reconciles to a total", () => {
    const rows = aggregateEconomicSummary(budgetFixtures(), expenditureFixtures(), {
      ...emptyReportFilters(),
      fiscalYear: 2026,
    });
    const byClass = Object.fromEntries(rows.map((r) => [r.economic_class, r]));
    // FY2026 recorded entries: e1 personnel 600k, e2/e3 drugs 550k (→ other).
    expect(byClass.personnel.actual_amount).toBe(600_000);
    expect(byClass.other.actual_amount).toBe(550_000);
    // Budget side comes from the clean approved-budget split.
    expect(byClass.personnel.budget_amount).toBe(1_200_000); // 800k + 400k
    expect(byClass.capital.budget_amount).toBe(900_000); // 500k + 400k
    expect(byClass.total.actual_amount).toBe(1_150_000);
    expect(byClass.total.budget_amount).toBe(2_500_000);
  });

  it("builds per-MDA administrative classification with an economic split", () => {
    const rows = aggregateAdminClassification(budgetFixtures(), expenditureFixtures(), {
      ...emptyReportFilters(),
      fiscalYear: 2026,
    });
    const health = rows.find((r) => r.mda_name === "Ministry of Health");
    // e1 personnel 600k + e2 drugs 200k (→ other), both MoH & actual.
    expect(health?.personnel_amount).toBe(600_000);
    expect(health?.other_amount).toBe(200_000);
    expect(health?.actual_total).toBe(800_000);
    // Every budgeted MDA appears even at zero actual.
    expect(rows.map((r) => r.mda_name)).toContain("PHCMB");
  });
});

describe("aggregateYoyComparison", () => {
  it("compares the current year against the prior year", () => {
    const report = aggregateYoyComparison(
      budgetFixtures(),
      expenditureFixtures(),
      { ...emptyReportFilters(), fiscalYear: 2026 },
    );
    expect(report.current_fiscal_year).toBe(2026);
    expect(report.prior_fiscal_year).toBe(2025);
    expect(report.current_budget_amount).toBe(2_500_000);
    expect(report.prior_budget_amount).toBe(0); // no 2025 budget in fixtures
    expect(report.budget_multiple).toBeNull();
  });
});

describe("aggregateHealthSectorObjectives", () => {
  it("maps spend onto the programme segment of the budget line's programme code", () => {
    const rows = aggregateHealthSectorObjectives(expenditureFixtures(), {
      ...emptyReportFilters(),
      fiscalYear: 2026,
    });
    const by = Object.fromEntries(rows.map((r) => [r.code, r]));
    expect(by["0401"].actual_amount).toBe(600_000); // e1 · 0401…
    expect(by["0406"].actual_amount).toBe(200_000); // e2 · 0406…
    expect(by["0403"].actual_amount).toBe(350_000); // e3 · 0403…
  });

  it("keeps objectives with no spend so the strategy gaps stay visible", () => {
    const rows = aggregateHealthSectorObjectives(expenditureFixtures(), {
      ...emptyReportFilters(),
      fiscalYear: 2026,
    });
    const idle = rows.find((r) => r.code === "0409");
    expect(idle).toBeDefined();
    expect(idle?.actual_amount).toBe(0);
    expect(idle?.entry_count).toBe(0);
  });

  it("buckets unbound spend as unclassified rather than dropping it", () => {
    // e4 (FY2025) has no programme code — it must still be counted.
    const rows = aggregateHealthSectorObjectives(expenditureFixtures(), {
      ...emptyReportFilters(),
      fiscalYear: 2025,
    });
    const unclassified = rows.find((r) => r.code === "unclassified");
    expect(unclassified?.actual_amount).toBe(100_000);
    const total = rows.reduce((sum, r) => sum + r.actual_amount, 0);
    expect(total).toBe(100_000);
  });

  it("omits the unclassified bucket when everything is classified", () => {
    const rows = aggregateHealthSectorObjectives(expenditureFixtures(), {
      ...emptyReportFilters(),
      fiscalYear: 2026,
    });
    expect(rows.some((r) => r.code === "unclassified")).toBe(false);
  });

  it("shares sum to 1 across objectives with spend", () => {
    const rows = aggregateHealthSectorObjectives(expenditureFixtures(), {
      ...emptyReportFilters(),
      fiscalYear: 2026,
    });
    const shareTotal = rows.reduce((sum, r) => sum + (r.share_of_total ?? 0), 0);
    expect(shareTotal).toBeCloseTo(1, 10);
  });
});

describe("revenue performance", () => {
  const fy2026 = { ...emptyReportFilters(), fiscalYear: 2026 };

  it("sums collections year-to-date when no quarter is selected", () => {
    const rows = aggregateRevenuePerformance(revenueFixtures(), fy2026);
    const recurrent = rows.find((r) => r.stream === "recurrent");
    // rev-1: 200k (Q1) + 300k (Q2) = 500k against a 1M budget.
    expect(recurrent?.budget_amount).toBe(1_000_000);
    expect(recurrent?.actual_amount).toBe(500_000);
    expect(recurrent?.performance_rate).toBeCloseTo(0.5, 10);
  });

  it("narrows collections to the selected quarter", () => {
    const rows = aggregateRevenuePerformance(revenueFixtures(), {
      ...fy2026,
      quarter: 1,
    });
    expect(rows.find((r) => r.stream === "recurrent")?.actual_amount).toBe(200_000);
    // The capital receipt only has a Q2 actual.
    expect(rows.find((r) => r.stream === "capital_receipt")?.actual_amount).toBe(0);
  });

  it("reports over-collection as a positive variance", () => {
    const rows = aggregateRevenuePerformance(revenueFixtures(), fy2026);
    const capital = rows.find((r) => r.stream === "capital_receipt");
    // rev-2 collected 5M against a 4M budget.
    expect(capital?.variance_amount).toBe(1_000_000);
    expect(capital?.performance_rate).toBeCloseTo(1.25, 10);
  });

  it("totals both streams and excludes other fiscal years", () => {
    const rows = aggregateRevenuePerformance(revenueFixtures(), fy2026);
    const total = rows.find((r) => r.stream === "total");
    expect(total?.budget_amount).toBe(5_000_000); // rev-3 (FY2025) excluded
    expect(total?.actual_amount).toBe(5_500_000);
  });

  it("composes collections by economic code, dropping lines that collected nothing", () => {
    const rows = aggregateRevenueComposition(revenueFixtures(), {
      ...fy2026,
      quarter: 1,
    });
    expect(rows).toHaveLength(1);
    expect(rows[0].economic_code).toBe("12020441");
    expect(rows[0].share_of_total).toBeCloseTo(1, 10);
  });
});

describe("stale offline snapshots", () => {
  it("treats a dataset with no revenues key as having no revenue", () => {
    // A snapshot cached before budget_line_revenues existed.
    const stale = { ...dataset(), revenues: undefined } as unknown as ReportingDataset;
    const rows = aggregateRevenuePerformance(stale.revenues ?? [], {
      ...emptyReportFilters(),
      fiscalYear: 2026,
    });
    expect(rows.find((r) => r.stream === "total")?.actual_amount).toBe(0);
  });

  it("classifies entries with no programme_code as unclassified", () => {
    const rows = aggregateHealthSectorObjectives(
      [{ ...expenditureFixtures()[0], programme_code: undefined as unknown as null }],
      { ...emptyReportFilters(), fiscalYear: 2026 },
    );
    expect(rows.find((r) => r.code === "unclassified")?.actual_amount).toBe(600_000);
  });
});
