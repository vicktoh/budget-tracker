import { describe, expect, it } from "vitest";
import {
  availablePeriods,
  buildExplorerData,
  buildFacts,
  formatNairaShort,
  lensRows,
  samePointHistory,
  sectorValue,
  valueAt,
} from "@/lib/public/model";
import type { PublicDataset, PublicFigure, PublicReport } from "@/lib/public/types";

function report(slug: string, year: number, quarter: number, status: PublicReport["data_status"] = "published"): PublicReport {
  return {
    id: slug,
    slug,
    fiscal_year: year,
    quarter,
    full_year_only: false,
    title: `Kano State ${year} Q${quarter} Budget Performance Report`,
    source_url: `https://example.test/${slug}.pdf`,
    source_note: null,
    storage_path: `${slug}.pdf`,
    sha256: null,
    file_bytes: null,
    page_count: null,
    data_status: status,
    data_note: null,
    published_at: null,
  };
}

function fig(report_id: string, code: string | null, cls: PublicFigure["econ_class"], b: number, q: number, y: number, lens: PublicFigure["lens"] = "mda"): PublicFigure {
  return {
    report_id,
    lens,
    econ_class: cls,
    code,
    row_key: code ? null : "table_total",
    name: code ?? "Total Expenditure",
    mda_code: null,
    original_budget: b,
    revised_budget: null,
    quarter_actual: q,
    ytd_actual: y,
    table_number: 4,
    page: 14,
    note: null,
  };
}

const SECTOR = "052100000000";
const PHCMB = "052100500100";
const HMB = "052100300100";

const ds: PublicDataset = {
  reports: [report("2025-Q2", 2025, 2), report("2026-Q2", 2026, 2), report("2026-Q1", 2026, 1, "download_only")],
  figures: [
    fig("2025-Q2", SECTOR, "total", 100, 20, 30),
    fig("2025-Q2", PHCMB, "total", 60, 10, 15),
    fig("2025-Q2", HMB, "total", 40, 10, 15),
    fig("2026-Q2", SECTOR, "total", 200, 50, 80),
    fig("2026-Q2", PHCMB, "total", 150, 40, 70),
    fig("2026-Q2", HMB, "total", 50, 10, 10),
    fig("2026-Q2", SECTOR, "capital", 120, 30, 30),
    fig("2026-Q2", SECTOR, "personnel", 80, 20, 50),
    // An "other" table with only its state-wide total row: health spent nothing there.
    fig("2026-Q2", null, "other", 999, 1, 1),
    // Unpublished report figures are never used.
    fig("2026-Q1", SECTOR, "total", 1, 1, 1),
  ],
  entities: [
    { lens: "mda", code: PHCMB, name: "Primary Health Care Management Board", short_name: "PHCMB", sort_order: 4 },
  ],
};

const data = buildExplorerData(ds, (r) => `https://cdn.test/${r.slug}.pdf`);

describe("public explorer model", () => {
  it("only includes published reports", () => {
    expect(data.reports.map((r) => r.slug)).toEqual(["2025-Q2", "2026-Q2"]);
  });

  it("derives Q1 from the Q2 report when Q1 is not published", () => {
    const q1 = valueAt(data, 2026, 1, "mda", "total", SECTOR);
    expect(q1?.ytd).toBe(30); // 80 − 50
    expect(q1?.quarterOnly).toBe(30);
    expect(q1?.derived).toMatch(/January–June spending minus Q2/);
    expect(availablePeriods(data)[0]).toEqual({ year: 2026, quarters: [1, 2] });
  });

  it("measures spending against the original budget", () => {
    expect(sectorValue(data, 2026, 2, "mda", "total")?.share).toBeCloseTo(0.4);
  });

  it("treats a class table without health rows as zero, not missing", () => {
    const other = sectorValue(data, 2026, 2, "mda", "other");
    expect(other).not.toBeNull();
    expect(other?.ytd).toBe(0);
  });

  it("lists child rows largest budget first, with display names", () => {
    const rows = lensRows(data, 2026, 2, "mda", "total");
    expect(rows.map((r) => r.entity.code)).toEqual([PHCMB, HMB]);
    expect(rows[0].entity.short).toBe("PHCMB");
  });

  it("returns the same point in every year", () => {
    const h = samePointHistory(data, 2, "mda", "total", PHCMB);
    expect(h.map((x) => [x.year, x.value?.ytd])).toEqual([[2025, 15], [2026, 70]]);
  });

  it("writes descriptive facts", () => {
    const facts = buildFacts(data, 2026, 2);
    expect(facts[0].title).toBe("₦80 spent by the end of June");
    expect(facts[0].body).toContain("+167% in nominal naira");
    expect(facts.at(-1)?.title).toBe("1 of 2 MDAs below 25% spent");
  });

  it("formats naira compactly", () => {
    expect(formatNairaShort(214_839_309_263.7)).toBe("₦214.8bn");
    expect(formatNairaShort(8_772_500)).toBe("₦8.8m");
  });
});
