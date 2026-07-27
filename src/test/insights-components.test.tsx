import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { aggregateMdaScorecards } from "@/lib/reporting/aggregate";
import { emptyReportFilters } from "@/lib/reporting/types";
import { Leaderboard } from "@/components/reporting/insights/leaderboard";
import { MdaAnalysis } from "@/components/reporting/insights/mda-analysis";
import { MonthTracker } from "@/components/reporting/insights/primitives";
import { SectorHero } from "@/components/reporting/insights/sector-hero";
import {
  budgetFixtures,
  expenditureFixtures,
  monthlyFixtures,
} from "@/test/reporting-fixtures";

afterEach(() => {
  cleanup();
});

const cards = () =>
  aggregateMdaScorecards(budgetFixtures(), expenditureFixtures(), monthlyFixtures(), {
    ...emptyReportFilters(),
    fiscalYear: 2026,
  });

describe("SectorHero", () => {
  it("shows the sector burn percentage and approved envelope", () => {
    render(
      <SectorHero
        approvedTotal={2_500_000}
        officialTotal={1_150_000}
        mdaCount={21}
        monthsCovered={6}
        reportingMdaCount={17}
        fiscalYear={2026}
      />,
    );
    expect(screen.getAllByText("46.0%").length).toBeGreaterThan(0);
    expect(screen.getByText(/Monthly returns from 17 of 21 MDAs/)).toBeDefined();
  });
});

describe("Leaderboard", () => {
  it("ranks MDAs and fires the select callback", () => {
    const selected: string[] = [];
    render(
      <Leaderboard cards={cards()} benchmarkQuarter={2} onSelect={(id) => selected.push(id)} />,
    );
    expect(screen.getByText("Top performing MDAs")).toBeDefined();
    // MoH (53.3%) must appear before PHCMB (35%) in document order.
    const moh = screen.getAllByText("Ministry of Health")[0]!;
    fireEvent.click(moh.closest("button")!);
    expect(selected).toHaveLength(1);
  });
});

describe("MdaAnalysis", () => {
  it("renders the month tracker with explicit-zero and blank cells", () => {
    const list = cards();
    const phcmb = list.find((card) => card.mda_name === "PHCMB")!;
    render(
      <MdaAnalysis
        cards={list}
        selectedId={phcmb.mda_id}
        onSelect={() => undefined}
        benchmarkQuarter={2}
      />,
    );
    expect(screen.getAllByText("PHCMB").length).toBeGreaterThan(0);
    // Jan reported 120k, Mar explicit zero, Apr nothing submitted.
    expect(screen.getByTitle(/Jan: ₦\s?120,000/)).toBeDefined();
    expect(screen.getByTitle("Mar: ₦0.00").textContent).toBe("0");
    expect(screen.getAllByTitle("Apr: nothing submitted").length).toBeGreaterThan(0);
  });

  it("navigates between MDAs with the next button", () => {
    const list = cards();
    const selected: string[] = [];
    render(
      <MdaAnalysis
        cards={list}
        selectedId={list[0]!.mda_id}
        onSelect={(id) => selected.push(id)}
        benchmarkQuarter={2}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: /Next/ }));
    expect(selected).toEqual([list[1]!.mda_id]);
  });
});

describe("MonthTracker", () => {
  it("keeps the zero vs blank distinction visible", () => {
    render(
      <MonthTracker
        months={[
          { month: 1, amount: 50_000 },
          { month: 2, amount: 0 },
          { month: 3, amount: null },
        ]}
        color="#123456"
      />,
    );
    expect(screen.getByTitle(/Jan/).textContent).toBe("✓");
    expect(screen.getByTitle(/Feb/).textContent).toBe("0");
    expect(screen.getByTitle("Mar: nothing submitted")).toBeDefined();
  });
});
