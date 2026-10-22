import history from "@/lib/public/full-year-history.json";
import { SECTOR_CODE, periodLabel, valueAt, type ExplorerData, type Source } from "@/lib/public/model";

export type YearPoint = {
  year: number;
  budget: number;
  spent: number;
  share: number | null;
  /** Set for the current year while it is not finished, e.g. "Jan–Jun so far". */
  partial?: string;
  source: Source | null;
};

/**
 * Health sector budget and spending by year: full years from each year's Q4
 * report (published figures first, then the checked full-year rows in
 * full-year-history.json), and the current year up to its latest published
 * quarter. Original budgets throughout, nominal naira.
 */
export function yearByYear(
  data: ExplorerData,
  latestYear: number,
  latestQuarter: number,
  pdfForSlug: (slug: string) => string | null,
): YearPoint[] {
  const years = new Set<number>([...history.years.map((h) => h.year), ...data.reports.filter((r) => r.quarter === 4).map((r) => r.year)]);
  const points: YearPoint[] = [];
  for (const year of [...years].sort((a, b) => a - b)) {
    if (year > latestYear || (year === latestYear && latestQuarter < 4)) continue;
    const v = valueAt(data, year, 4, "mda", "total", SECTOR_CODE.mda);
    if (v && v.budget) {
      points.push({ year, budget: v.budget, spent: v.ytd ?? 0, share: v.share, source: v.source });
      continue;
    }
    const h = history.years.find((x) => x.year === year);
    if (!h) continue;
    points.push({
      year,
      budget: h.originalBudget,
      spent: h.spent,
      share: h.spent / h.originalBudget,
      source: { slug: h.slug, title: `Kano State ${year} Q4 Budget Performance Report`, table: h.table, page: h.page, pdf: pdfForSlug(h.slug) },
    });
  }
  if (latestQuarter < 4) {
    const v = valueAt(data, latestYear, latestQuarter, "mda", "total", SECTOR_CODE.mda);
    if (v && v.budget) {
      points.push({
        year: latestYear,
        budget: v.budget,
        spent: v.ytd ?? 0,
        share: v.share,
        partial: `${periodLabel(latestYear, latestQuarter, true).replace(` ${latestYear}`, "")} so far`,
        source: v.source,
      });
    }
  }
  return points;
}
