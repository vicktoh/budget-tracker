import { describe, expect, it } from "vitest";
import * as fx from "@/test/reporting-fixtures";
import { computeExceptions, computeExecutiveOverview, computeProgrammePerformance, classifyAopActivity } from "@/lib/reporting/executive";

describe("executive metrics", () => {
  it("computes overview, programmes and exceptions; maps AOP activities by keyword", () => {
    const ds = { funding: fx.fundingFixtures(), expenditure: fx.expenditureFixtures(), budgets: fx.budgetFixtures(), approvedBudgetLines: [], revenues: fx.revenueFixtures(), monthly: fx.monthlyFixtures(), aopActivities: fx.aopFixtures(), publications: [] };
    expect(ds).toBeTruthy();
    const o = computeExecutiveOverview(ds as any);
    const p = computeProgrammePerformance(ds as any, o.fiscal_year);
    const e = computeExceptions(o, p);
    expect(e.notReporting).toBeInstanceOf(Array);
    expect(o.totals.budget).toBeGreaterThan(0);
    expect(classifyAopActivity("Implement 3 rounds of intensified Routine Immunization (RI)")).toBe("Immunisation & Vaccines");
    expect(classifyAopActivity("Conduct 1-day orientation meetings with 1200 health workers on IPC")).toBe("Human Resource for Health");
  });
});
