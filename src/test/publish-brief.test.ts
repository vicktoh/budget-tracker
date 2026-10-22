import { describe, expect, it } from "vitest";
import { briefPeriodPublished } from "@/components/reporting/reports/cso/publish-brief";

const pubs = [
  { fiscal_year: 2026, quarter: 1 },
  { fiscal_year: 2026, quarter: 2 },
];

describe("briefPeriodPublished", () => {
  it("allows a published quarter", () => expect(briefPeriodPublished(pubs, 2026, 2)).toBe(true));
  it("refuses an unpublished quarter", () => expect(briefPeriodPublished(pubs, 2026, 3)).toBe(false));
  it("needs all four quarters for a full-year brief", () => expect(briefPeriodPublished(pubs, 2026, null)).toBe(false));
});
