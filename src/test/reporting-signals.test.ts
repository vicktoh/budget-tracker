import { describe, expect, it } from "vitest";
import {
  aggregateAdminClassification,
  aggregateEconomicSummary,
  aggregateExceptions,
  aggregateReconciliation,
  aggregateYoyComparison,
} from "@/lib/reporting/aggregate";
import { classifyCategory } from "@/lib/reporting/economic-class";
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
} from "@/test/reporting-fixtures";

function dataset(): ReportingDataset {
  return {
    funding: fundingFixtures(),
    expenditure: expenditureFixtures(),
    budgets: budgetFixtures(),
    aopActivities: aopFixtures(),
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
    // Full-year FY2026: e2 (Q2, approved, no AOP link) is the unlinked actual.
    const signals = computeHubSignals("audit", dataset(), {
      ...emptyReportFilters(),
      fiscalYear: 2026,
    });
    // No integrity issues in FY2026, one unlinked-to-AOP actual entry (e2).
    expect(signals[0]).toEqual({ level: "on_track", label: "No integrity exceptions" });
    expect(signals).toContainEqual({ level: "investigate", label: "1 unlinked to AOP" });
  });
});

describe("aggregateExceptions", () => {
  it("counts a rejected entry as an integrity exception across all years", () => {
    const report = aggregateExceptions(expenditureFixtures(), emptyReportFilters());
    expect(report.counts.rejected).toBe(1); // e4 (2025, rejected)
    expect(report.integrity_count).toBe(1);
  });

  it("carries voucher identifiers for the audit register", () => {
    const report = aggregateExceptions(expenditureFixtures(), {
      ...emptyReportFilters(),
      fiscalYear: 2026,
    });
    const unlinked = report.rows.find((row) => row.kind === "unlinked_aop");
    expect(unlinked?.public_id).toBe("EL-2026-0002"); // e2
    expect(unlinked?.voucher_ref_no).toBe("VCH-e2");
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

    // MoH · Federal: received 1M (f1 approved), allocated 600k (e1) → +400k
    const healthFed = find("Ministry of Health", "Federal Allocation");
    expect(healthFed?.received_amount).toBe(1_000_000);
    expect(healthFed?.allocated_amount).toBe(600_000);
    expect(healthFed?.variance_amount).toBe(400_000);

    // MoH · International: no funding, 200k allocated (e2) → over-allocated
    const healthIntl = find("Ministry of Health", "International Donor");
    expect(healthIntl?.received_amount).toBe(0);
    expect(healthIntl?.allocated_amount).toBe(200_000);
    expect(healthIntl?.variance_amount).toBe(-200_000);
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

  it("summarises the sector by economic class and reconciles to a total", () => {
    const rows = aggregateEconomicSummary(budgetFixtures(), expenditureFixtures(), {
      ...emptyReportFilters(),
      fiscalYear: 2026,
    });
    const byClass = Object.fromEntries(rows.map((r) => [r.economic_class, r]));
    // FY2026 actual (approved/processed): e1 personnel 600k, e2 drugs 200k (→ other).
    expect(byClass.personnel.actual_amount).toBe(600_000);
    expect(byClass.other.actual_amount).toBe(200_000);
    // Budget side comes from the clean approved-budget split.
    expect(byClass.personnel.budget_amount).toBe(1_200_000); // 800k + 400k
    expect(byClass.capital.budget_amount).toBe(900_000); // 500k + 400k
    expect(byClass.total.actual_amount).toBe(800_000);
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
