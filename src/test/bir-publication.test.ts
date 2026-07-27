import { describe, expect, it } from "vitest";
import {
  isPublishedPeriod,
  normaliseFiscalPeriods,
  transactionPeriod,
} from "@/lib/db/bir-publications";
import type { BirPublication } from "@/lib/db/types";

const q2Publication: BirPublication = {
  id: "publication-1",
  fiscal_year: 2026,
  quarter: 2,
  version: 1,
  published_by: "admin-1",
  published_at: "2026-07-15T12:00:00.000Z",
  supersedes_publication_id: null,
  amendment_reason: null,
};

describe("BIR publication periods", () => {
  it.each([
    ["2026-01-01", 2026, 1],
    ["2026-03-31", 2026, 1],
    ["2026-04-01", 2026, 2],
    ["2026-09-30", 2026, 3],
    ["2026-12-31", 2026, 4],
  ] as const)("maps %s to FY%s Q%s", (date, fiscalYear, quarter) => {
    expect(transactionPeriod(date)).toEqual({ fiscalYear, quarter });
  });

  it("locks only the exact published fiscal-year quarter", () => {
    expect(isPublishedPeriod([q2Publication], "2026-04-01")).toBe(true);
    expect(isPublishedPeriod([q2Publication], "2026-06-30")).toBe(true);
    expect(isPublishedPeriod([q2Publication], "2026-03-31")).toBe(false);
    expect(isPublishedPeriod([q2Publication], "2025-04-01")).toBe(false);
  });

  it("treats all versions as one published period", () => {
    const version2 = {
      ...q2Publication,
      id: "publication-2",
      version: 2,
      supersedes_publication_id: q2Publication.id,
      amendment_reason: "Correct voucher amount",
    };
    expect(isPublishedPeriod([q2Publication, version2], "2026-05-10")).toBe(true);
  });

  it("treats publication metadata missing from an older cache as empty", () => {
    expect(normaliseFiscalPeriods(undefined)).toEqual([]);
    expect(normaliseFiscalPeriods(null)).toEqual([]);
  });

  it("discards malformed periods from persisted cache data", () => {
    expect(normaliseFiscalPeriods([
      { fiscalYear: 2026, quarter: 2 },
      { fiscalYear: 2026, quarter: 5 },
      { quarter: 1 },
    ])).toEqual([{ fiscalYear: 2026, quarter: 2 }]);
  });
});
