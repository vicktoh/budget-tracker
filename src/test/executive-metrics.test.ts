import { describe, expect, it } from "vitest";
import * as fx from "@/test/reporting-fixtures";
import { computeExceptions, computeExecutiveOverview, computeProgrammePerformance, classifyAopActivity } from "@/lib/reporting/executive";

const dataset = () => ({ funding: fx.fundingFixtures(), expenditure: fx.expenditureFixtures(), budgets: fx.budgetFixtures(), approvedBudgetLines: [], revenues: fx.revenueFixtures(), monthly: fx.monthlyFixtures(), aopActivities: fx.aopFixtures(), publications: [] });

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

  it("scopes a quarter to its actuals and releases against a quarterly allocation", () => {
    const ds = dataset() as any;
    const full = computeExecutiveOverview(ds, 2026);
    const q1 = computeExecutiveOverview(ds, 2026, 1);
    const q2 = computeExecutiveOverview(ds, 2026, 2);
    const sum = (rows: Array<{ fiscal_year: number; quarter: number; amount: number }>, q: number) =>
      rows.filter((r) => r.fiscal_year === 2026 && r.quarter === q).reduce((s, r) => s + r.amount, 0);

    expect(full.quarter).toBeNull();
    expect(q1.quarter).toBe(1);
    expect(q1.totals.budget).toBeCloseTo(full.totals.budget / 4);
    expect(q1.totals.spent).toBe(sum(ds.expenditure, 1));
    expect(q2.totals.spent).toBe(sum(ds.expenditure, 2));
    expect(q1.totals.released).toBe(sum(ds.funding, 1));
    expect(q1.totals.spent + q2.totals.spent).toBe(full.totals.spent);

    // Monthly returns only count months inside the quarter.
    expect(q1.coverage.tracking_horizon).toBe(3);
    expect(q2.coverage.tracking_horizon).toBeNull();
    expect(q2.coverage.mdas_reported_latest).toBe(0);
    // Coverage still knows which quarters have actuals across the year.
    expect(q2.coverage.quarters_with_actuals).toEqual(full.coverage.quarters_with_actuals);

    const q4 = computeExecutiveOverview(ds, 2026, 4);
    expect(q4.totals.spent).toBe(0);
    expect(q4.coverage.gaps.some((g) => g.includes("No Q4 2026 actuals"))).toBe(true);

    const fullAop = computeProgrammePerformance(ds, 2026);
    const q1Aop = computeProgrammePerformance(ds, 2026, 1);
    const planned = (rows: typeof fullAop) => rows.reduce((s, p) => s + p.planned, 0);
    expect(planned(q1Aop)).toBeCloseTo(planned(fullAop) / 4);
  });
});
