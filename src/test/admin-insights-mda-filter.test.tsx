/**
 * Repro harness: render the real AdminInsightsRoute with an mdaId filter set,
 * across all tabs, and surface any render crash.
 */
import { cleanup, render, screen, fireEvent } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import * as React from "react";
import {
  budgetFixtures,
  expenditureFixtures,
  fundingFixtures,
  monthlyFixtures,
  revenueFixtures,
  aopFixtures,
  MDA_HEALTH,
  MDA_PHCMB,
} from "@/test/reporting-fixtures";
import { emptyReportFilters, type ReportFilters } from "@/lib/reporting/types";

let currentFilters: ReportFilters = { ...emptyReportFilters(), mdaId: MDA_HEALTH };
const setFilter = vi.fn(<K extends keyof ReportFilters>(key: K, value: ReportFilters[K]) => {
  currentFilters = { ...currentFilters, [key]: value };
});

vi.mock("@/hooks/use-report-filters", () => ({
  useReportFilters: () => ({
    filters: currentFilters,
    setFilter,
    setFilters: vi.fn(),
    clearFilters: vi.fn(),
    toggleFilter: vi.fn(),
  }),
}));

vi.mock("@/lib/supabase", () => ({
  hasSupabaseConfig: true,
  supabase: {},
  createClient: () => ({}),
}));

vi.mock("@/components/reporting/use-reporting-data", () => ({
  useReportingData: () => ({
    dataset: {
      funding: fundingFixtures(),
      expenditure: expenditureFixtures(),
      budgets: budgetFixtures(),
      revenues: revenueFixtures(),
      monthly: monthlyFixtures(),
      aopActivities: aopFixtures(),
      publications: [],
    },
    options: {
      mdas: [
        { id: MDA_HEALTH, name: "Ministry of Health", abbreviation: null },
        { id: MDA_PHCMB, name: "PHCMB", abbreviation: null },
      ].map((m) => ({ value: m.id, label: m.name })),
      programmeAreas: [],
      fundingSources: [],
      expenditureCategories: [],
      lgas: [],
      facilities: [],
      fiscalYears: [2026],
    },
    loading: false,
    error: null,
    cachedAt: null,
  }),
}));

import { AdminInsightsRoute } from "@/components/reporting/admin-insights";

afterEach(() => cleanup());

describe("AdminInsightsRoute with mdaId filter", () => {
  it("renders the overview tab", () => {
    currentFilters = { ...emptyReportFilters(), mdaId: MDA_HEALTH };
    render(<AdminInsightsRoute />);
    expect(screen.getByText(/Admin Insights/)).toBeDefined();
  });

  it("renders the MDA analysis tab", () => {
    currentFilters = { ...emptyReportFilters(), mdaId: MDA_HEALTH };
    render(<AdminInsightsRoute />);
    fireEvent.click(screen.getByRole("tab", { name: /MDA Analysis/ }));
    expect(screen.getAllByText(/Ministry of Health/).length).toBeGreaterThan(0);
  });

  it("renders with an mdaId that matches nothing", () => {
    currentFilters = { ...emptyReportFilters(), mdaId: "00000000-dead-beef-0000-000000000000" };
    render(<AdminInsightsRoute />);
    expect(screen.getByText(/Admin Insights/)).toBeDefined();
  });

  it("renders programme/phc/aop tabs with the filter set", () => {
    currentFilters = { ...emptyReportFilters(), mdaId: MDA_PHCMB };
    render(<AdminInsightsRoute />);
    for (const tab of ["Programme", "PHC", "AOP"]) {
      fireEvent.click(screen.getByRole("tab", { name: new RegExp(tab) }));
    }
    expect(screen.getByText(/Admin Insights/)).toBeDefined();
  });
});
