import { describe, expect, it } from "vitest";
import history from "@/lib/public/full-year-history.json";

describe("full-year history", () => {
  it.each(history.years)("$year reproduces the report's own % column", (row) => {
    expect(Math.abs((row.spent / row.revisedBudget) * 100 - row.printedPct)).toBeLessThanOrEqual(0.05);
  });
});
