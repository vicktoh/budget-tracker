import { describe, expect, it } from "vitest";
import { computeFindings } from "@/lib/reporting/signals";
import {
  RECOMMENDATIONS_KEY,
  WATCHLIST_KEY,
  buildCsoAutoDrafts,
  buildCsoYoy,
  findingSectionKey,
  recommendationsHeading,
} from "@/lib/reporting/cso-content";
import { emptyReportFilters } from "@/lib/reporting/types";
import type { ReportingDataset } from "@/lib/reporting/types";
import {
  aopFixtures,
  budgetFixtures,
  expenditureFixtures,
  fundingFixtures,
  monthlyFixtures,
  revenueFixtures,
} from "@/test/reporting-fixtures";

function dataset(): ReportingDataset {
  return {
    funding: fundingFixtures(),
    expenditure: expenditureFixtures(),
    budgets: budgetFixtures(),
    revenues: revenueFixtures(),
    monthly: monthlyFixtures(),
    aopActivities: aopFixtures(),
    publications: [],
  };
}

const fy2026q1 = { ...emptyReportFilters(), fiscalYear: 2026, quarter: 1 as const };

describe("recommendationsHeading", () => {
  it("varies by publisher voice", () => {
    expect(recommendationsHeading("watchdog")).toBe("Asks before next quarter");
    expect(recommendationsHeading("commitments")).toBe("Commitments before next quarter");
    expect(recommendationsHeading("neutral")).toBe("Recommendations");
  });
});

describe("buildCsoAutoDrafts", () => {
  it("drafts a section for every finding plus recommendations and watchlist", () => {
    const findings = computeFindings(dataset(), fy2026q1);
    const drafts = buildCsoAutoDrafts(findings, "watchdog");
    for (const finding of findings) {
      expect(drafts[findingSectionKey(finding.key)]).toBeTruthy();
    }
    expect(drafts[RECOMMENDATIONS_KEY]).toBeTruthy();
    expect(drafts[WATCHLIST_KEY]).toBeTruthy();
  });

  it("frames recommendations by voice when there are critical findings", () => {
    const findings = computeFindings(dataset(), fy2026q1);
    const watchdog = buildCsoAutoDrafts(findings, "watchdog")[RECOMMENDATIONS_KEY];
    const gov = buildCsoAutoDrafts(findings, "commitments")[RECOMMENDATIONS_KEY];
    // Fixtures have a zero-overhead critical finding, so recommendations list asks.
    expect(watchdog).toMatch(/Address:/);
    expect(gov).toMatch(/Commit to address:/);
  });
});

describe("buildCsoYoy", () => {
  it("returns two comparison rows and detects prior-year ledger data", () => {
    const yoy = buildCsoYoy(dataset(), { ...emptyReportFilters(), fiscalYear: 2026 });
    expect(yoy.rows.map((row) => row.key)).toEqual(["budget", "actual"]);
    expect(yoy.rows[0].current).toBe(2_500_000);
    expect(yoy.hasPrior).toBe(true);
    expect(yoy.rows[0].changeLabel).toBeNull();
  });
});
