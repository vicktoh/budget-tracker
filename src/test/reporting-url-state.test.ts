import { describe, expect, it } from "vitest";
import {
  hasActiveFilter,
  parseReportFilters,
  serializeReportFilters,
} from "@/lib/reporting/url-state";
import { emptyReportFilters } from "@/lib/reporting/types";

describe("parseReportFilters", () => {
  it("returns defaults for an empty URL", () => {
    expect(parseReportFilters(new URLSearchParams())).toEqual(emptyReportFilters());
  });

  it("ignores obsolete status and invalid phc values", () => {
    const params = new URLSearchParams("status=oops&phc=maybe");
    expect(parseReportFilters(params)).toEqual(emptyReportFilters());
  });

  it("parses every supported field", () => {
    const params = new URLSearchParams(
      "fy=2026&q=2&from=2026-01-01&to=2026-06-30" +
        "&mda=mda-1&pa=pa-1&fs=fs-1&ec=ec-1&lga=lga-1&fac=fac-1&phc=yes",
    );
    expect(parseReportFilters(params)).toEqual({
      fiscalYear: 2026,
      quarter: 2,
      dateFrom: "2026-01-01",
      dateTo: "2026-06-30",
      mdaId: "mda-1",
      programmeAreaId: "pa-1",
      fundingSourceId: "fs-1",
      expenditureCategoryId: "ec-1",
      lgaId: "lga-1",
      facilityId: "fac-1",
      phc: "yes",
    });
  });

  it("rejects out-of-range fiscal years", () => {
    expect(parseReportFilters(new URLSearchParams("fy=1999")).fiscalYear).toBeNull();
    expect(parseReportFilters(new URLSearchParams("fy=2200")).fiscalYear).toBeNull();
    expect(parseReportFilters(new URLSearchParams("fy=abc")).fiscalYear).toBeNull();
  });

  it("rejects invalid quarters", () => {
    expect(parseReportFilters(new URLSearchParams("q=0")).quarter).toBeNull();
    expect(parseReportFilters(new URLSearchParams("q=5")).quarter).toBeNull();
    expect(parseReportFilters(new URLSearchParams("q=abc")).quarter).toBeNull();
    expect(parseReportFilters(new URLSearchParams("q=3")).quarter).toBe(3);
  });
});

describe("serializeReportFilters", () => {
  it("omits default values for tidy URLs", () => {
    expect(serializeReportFilters(emptyReportFilters()).toString()).toBe("");
  });

  it("round-trips a fully populated filter", () => {
    const filters = {
      fiscalYear: 2025,
      quarter: 4 as const,
      dateFrom: "2025-01-01",
      dateTo: "2025-12-31",
      mdaId: "mda-1",
      programmeAreaId: "pa-1",
      fundingSourceId: "fs-1",
      expenditureCategoryId: "ec-1",
      lgaId: "lga-1",
      facilityId: "fac-1",
      phc: "no" as const,
    };
    const params = serializeReportFilters(filters);
    expect(parseReportFilters(params)).toEqual(filters);
  });
});

describe("hasActiveFilter", () => {
  it("returns false for the default state", () => {
    expect(hasActiveFilter(emptyReportFilters())).toBe(false);
  });

  it("returns true when any field deviates from the default", () => {
    expect(
      hasActiveFilter({ ...emptyReportFilters(), fiscalYear: 2026 }),
    ).toBe(true);
    expect(hasActiveFilter({ ...emptyReportFilters(), quarter: 1 })).toBe(true);
    expect(hasActiveFilter({ ...emptyReportFilters(), phc: "yes" })).toBe(true);
  });
});
