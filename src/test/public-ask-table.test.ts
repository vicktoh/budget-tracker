import { describe, expect, it } from "vitest";
import {
  cellNumber,
  csvFileName,
  formatCell,
  isLowSpending,
  nextSort,
  sortRows,
  tableInputSchema,
  tableToCsv,
} from "@/lib/public/assistant-table";

const spec = tableInputSchema.parse({
  title: "Health MDAs, Jan–Jun 2026",
  columns: [
    { key: "mda", label: "MDA" },
    { key: "budget", label: "Budget", format: "naira" },
    { key: "pct", label: "% spent", format: "spent" },
  ],
  rows: [
    { mda: "Ministry of Health", budget: 12_400_000_000, pct: 41.2 },
    { mda: "Hospitals Management Board", budget: 30_100_000_000, pct: 18.6 },
    { mda: "Drugs Agency, \"DMCSA\"", budget: null, pct: null },
  ],
  total: { mda: "Health sector", budget: 42_500_000_000, pct: 36.9 },
  flagLowSpending: true,
});

describe("Ask AI tables", () => {
  it("formats cells the way the rest of the site does", () => {
    const [name, budget, pct] = spec.columns;
    expect(name.format).toBe("text");
    expect(formatCell(budget, 12_400_000_000)).toBe("₦12.4bn");
    expect(formatCell(pct, 41.2)).toBe("41.2%");
    expect(formatCell(budget, null)).toBe("n/a");
    expect(formatCell(budget, "\u2014")).toBe("n/a");
    expect(cellNumber("₦1,200")).toBe(1200);
    expect(cellNumber("42.1%")).toBe(42.1);
    expect(cellNumber("n/a")).toBeNull();
  });

  it("flags below 25% only on 'spent' columns when asked", () => {
    const pct = spec.columns[2];
    expect(isLowSpending(spec, pct, 18.6)).toBe(true);
    expect(isLowSpending(spec, pct, 41.2)).toBe(false);
    expect(isLowSpending({ flagLowSpending: false }, pct, 18.6)).toBe(false);
    expect(isLowSpending(spec, spec.columns[1], 10)).toBe(false);
  });

  it("sorts numbers high to low first, with blanks last", () => {
    const budget = spec.columns[1];
    const sort = nextSort(null, budget);
    expect(sort).toEqual({ key: "budget", dir: "desc" });
    expect(sortRows(spec.rows, spec.columns, sort).map((r) => r.budget)).toEqual([30_100_000_000, 12_400_000_000, null]);
    expect(sortRows(spec.rows, spec.columns, { key: "budget", dir: "asc" }).map((r) => r.budget)).toEqual([
      12_400_000_000, 30_100_000_000, null,
    ]);
    expect(nextSort({ key: "budget", dir: "asc" }, budget)).toBeNull();
    expect(nextSort(null, spec.columns[0])).toEqual({ key: "mda", dir: "asc" });
  });

  it("downloads full values with the totals row, quoted where needed", () => {
    expect(tableToCsv(spec).split("\r\n")).toEqual([
      "MDA,Budget,% spent",
      "Ministry of Health,12400000000,41.2",
      "Hospitals Management Board,30100000000,18.6",
      '"Drugs Agency, ""DMCSA""",,',
      "Health sector,42500000000,36.9",
      "",
    ]);
    expect(csvFileName(spec.title)).toBe("health-mdas-jan-jun-2026.csv");
  });
});
