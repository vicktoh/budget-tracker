/**
 * Pure view-model functions for the public site. No I/O: the server builds
 * an ExplorerData from the published dataset and hands it to client
 * components, which query it with the helpers below.
 *
 * Definitions (agreed for the public site, matching the BIRs):
 * - "% spent" = year-to-date actual ÷ the year's ORIGINAL budget (nominal ₦).
 * - Flags are descriptive and rule-based: below 25% of budget spent.
 * - Only published reports appear. A quarter without its own published report
 *   may be derived from the next quarter's report (YTD − that quarter); such
 *   values carry a note saying so.
 */
import type {
  EconClass,
  ExplorerLens,
  PublicDataset,
  PublicFigure,
  PublicReport,
} from "@/lib/public/types";

export const ECON_CLASSES: EconClass[] = ["personnel", "overhead", "capital", "other"];
export const EXPLORER_LENSES: ExplorerLens[] = ["mda", "programme", "function"];
export const LOW_SPEND_THRESHOLD = 0.25;

/** Code of the sector-total row in each lens. */
export const SECTOR_CODE: Record<ExplorerLens | "revenue", string> = {
  mda: "052100000000",
  revenue: "052100000000",
  function: "707",
  programme: "04",
};

export function isChildCode(lens: ExplorerLens | "revenue", code: string | null): code is string {
  if (!code) return false;
  if (lens === "mda" || lens === "revenue") return code.length === 12 && code !== SECTOR_CODE[lens];
  return code.length === 4; // 7071…7076, 0401…0410
}

// ---------------------------------------------------------------------------
// Compact client payload

/** One figure: budget, quarter actual, YTD actual, PDF page, note. */
export type Point = { b: number | null; q: number | null; y: number | null; p: number | null; n?: string };

export type ExplorerTable = { t: number | null; rows: Record<string, Point> };

export type ExplorerReport = {
  slug: string;
  year: number;
  quarter: number;
  title: string;
  pdf: string | null;
  lenses: Partial<Record<ExplorerLens | "revenue", Partial<Record<EconClass, ExplorerTable>>>>;
};

export type ExplorerEntity = { code: string; name: string; short: string; order: number };

export type ExplorerData = {
  reports: ExplorerReport[];
  entities: Record<ExplorerLens | "revenue", ExplorerEntity[]>;
};

export function publishedReports(ds: PublicDataset): PublicReport[] {
  return ds.reports
    .filter((r) => r.data_status === "published")
    .sort((a, b) => a.fiscal_year - b.fiscal_year || a.quarter - b.quarter);
}

export function buildExplorerData(ds: PublicDataset, pdfUrl: (r: PublicReport) => string | null): ExplorerData {
  const byReport = new Map<string, PublicFigure[]>();
  for (const f of ds.figures) {
    const list = byReport.get(f.report_id) ?? [];
    list.push(f);
    byReport.set(f.report_id, list);
  }

  const reports: ExplorerReport[] = publishedReports(ds).map((r) => {
    const lenses: ExplorerReport["lenses"] = {};
    for (const f of byReport.get(r.id) ?? []) {
      if (f.lens !== "mda" && f.lens !== "programme" && f.lens !== "function" && f.lens !== "revenue") continue;
      const lens = (lenses[f.lens] ??= {});
      // The table exists even when it has no health rows (its state-wide Total row is
      // still loaded): a missing code then means nothing budgeted or spent.
      const table = (lens[f.econ_class] ??= { t: f.table_number, rows: {} });
      if (!f.code) continue;
      table.rows[f.code] = {
        b: f.original_budget ?? f.revised_budget,
        q: f.quarter_actual,
        y: f.ytd_actual,
        p: f.page,
        ...(f.note ? { n: f.note } : {}),
      };
    }
    return { slug: r.slug, year: r.fiscal_year, quarter: r.quarter, title: r.title, pdf: pdfUrl(r), lenses };
  });

  const entities = { mda: [], programme: [], function: [], revenue: [] } as ExplorerData["entities"];
  const seen = new Set<string>();
  // Display names from bir_entities; fall back to the latest printed name.
  const named = new Map(ds.entities.map((e) => [`${e.lens}:${e.code}`, e]));
  for (const r of [...reports].reverse()) {
    for (const lens of [...EXPLORER_LENSES, "revenue"] as const) {
      for (const table of Object.values(r.lenses[lens] ?? {})) {
        for (const code of Object.keys(table?.rows ?? {})) {
          const key = `${lens}:${code}`;
          if (seen.has(key)) continue;
          seen.add(key);
          const e = named.get(`${lens === "revenue" ? "mda" : lens}:${code}`);
          const printed = ds.figures.find((f) => f.lens === lens && f.code === code)?.name ?? code;
          entities[lens].push({
            code,
            name: e?.name ?? titleCase(printed),
            short: e?.short_name ?? e?.name ?? titleCase(printed),
            order: e?.sort_order ?? 999,
          });
        }
      }
    }
  }
  for (const list of Object.values(entities)) list.sort((a, b) => a.order - b.order || a.name.localeCompare(b.name));
  return { reports, entities };
}

export function titleCase(value: string): string {
  const cleaned = value.replace(/\b([A-Z]) (?=[A-Z])/g, "$1").replace(/\s+/g, " ").trim();
  if (cleaned !== cleaned.toUpperCase()) return cleaned;
  return cleaned.toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase());
}

// ---------------------------------------------------------------------------
// Periods

const MONTH_END = ["", "March", "June", "September", "December"];
const MONTH_END_SHORT = ["", "Mar", "Jun", "Sep", "Dec"];

export function periodLabel(year: number, quarter: number, short = false): string {
  if (quarter === 4) return short ? `FY ${year}` : `Full year ${year}`;
  return short ? `Jan–${MONTH_END_SHORT[quarter]} ${year}` : `January–${MONTH_END[quarter]} ${year}`;
}

export function quarterOnlyLabel(year: number, quarter: number): string {
  return `Q${quarter} ${year}`;
}

export function reportFor(data: ExplorerData, year: number, quarter: number): ExplorerReport | undefined {
  return data.reports.find((r) => r.year === year && r.quarter === quarter);
}

export function latestReport(data: ExplorerData): ExplorerReport | undefined {
  return data.reports[data.reports.length - 1];
}

/** Years and the quarters that can be shown for each (published, or derivable from the next quarter). */
export function availablePeriods(data: ExplorerData): { year: number; quarters: number[] }[] {
  const years = [...new Set(data.reports.map((r) => r.year))].sort((a, b) => b - a);
  return years.map((year) => {
    const qs = new Set<number>();
    for (const r of data.reports.filter((x) => x.year === year)) {
      qs.add(r.quarter);
      if (r.quarter > 1) qs.add(r.quarter - 1);
    }
    return { year, quarters: [...qs].sort((a, b) => a - b) };
  });
}

// ---------------------------------------------------------------------------
// Values

export type Source = { slug: string; title: string; table: number | null; page: number | null; pdf: string | null };

export type Value = {
  budget: number | null;
  /** Spent January → end of the quarter. */
  ytd: number | null;
  /** Spent within the quarter only (null when it cannot be known). */
  quarterOnly: number | null;
  share: number | null; // ytd ÷ budget
  source: Source;
  derived?: string;
  note?: string;
};

function sourceOf(r: ExplorerReport, table: ExplorerTable | undefined, point: Point | undefined): Source {
  return { slug: r.slug, title: r.title, table: table?.t ?? null, page: point?.p ?? null, pdf: r.pdf };
}

function ratio(a: number | null, b: number | null): number | null {
  if (a === null || b === null || !b) return null;
  return a / b;
}

/**
 * The value of one row at (year, quarter). Falls back to the next quarter's
 * report (YTD − that quarter's own spending) when the quarter has no
 * published report of its own.
 */
export function valueAt(
  data: ExplorerData,
  year: number,
  quarter: number,
  lens: ExplorerLens | "revenue",
  cls: EconClass,
  code: string,
): Value | null {
  const direct = reportFor(data, year, quarter);
  if (direct) {
    const table = direct.lenses[lens]?.[cls];
    const point = table?.rows[code];
    if (!table) return null;
    // A class table with no row for this code means nothing budgeted or spent.
    const v = point ?? { b: 0, q: 0, y: 0, p: null };
    return {
      budget: v.b,
      ytd: v.y,
      quarterOnly: v.q,
      share: ratio(v.y, v.b),
      source: sourceOf(direct, table, point),
      ...(v.n ? { note: v.n } : {}),
    };
  }
  const next = reportFor(data, year, quarter + 1);
  if (!next) return null;
  const table = next.lenses[lens]?.[cls];
  if (!table) return null;
  const v = table.rows[code] ?? { b: 0, q: 0, y: 0, p: null };
  const ytd = v.y !== null && v.q !== null ? round2(v.y - v.q) : null;
  return {
    budget: v.b,
    ytd,
    quarterOnly: quarter === 1 ? ytd : null,
    share: ratio(ytd, v.b),
    source: sourceOf(next, table, table.rows[code]),
    derived: `Worked out from the ${next.title}: January–${MONTH_END[next.quarter]} spending minus Q${next.quarter} spending.`,
    ...(v.n ? { note: v.n } : {}),
  };
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

export type LensRow = { entity: ExplorerEntity; value: Value };

/** Child rows of a lens at a period, largest budget first. Rows with no budget and no spending are dropped. */
export function lensRows(
  data: ExplorerData,
  year: number,
  quarter: number,
  lens: ExplorerLens | "revenue",
  cls: EconClass,
): LensRow[] {
  const rows: LensRow[] = [];
  for (const entity of data.entities[lens]) {
    if (!isChildCode(lens, entity.code)) continue;
    const value = valueAt(data, year, quarter, lens, cls, entity.code);
    if (!value) continue;
    if (!value.budget && !value.ytd) continue;
    rows.push({ entity, value });
  }
  return rows.sort((a, b) => (b.value.budget ?? 0) - (a.value.budget ?? 0));
}

export function sectorValue(
  data: ExplorerData,
  year: number,
  quarter: number,
  lens: ExplorerLens | "revenue",
  cls: EconClass,
): Value | null {
  return valueAt(data, year, quarter, lens, cls, SECTOR_CODE[lens]);
}

/** The same row at the same point (quarter) of every year that has it. */
export function samePointHistory(
  data: ExplorerData,
  quarter: number,
  lens: ExplorerLens | "revenue",
  cls: EconClass,
  code: string,
): { year: number; value: Value | null }[] {
  const years = [...new Set(data.reports.map((r) => r.year))].sort((a, b) => a - b);
  return years.map((year) => ({ year, value: valueAt(data, year, quarter, lens, cls, code) }));
}

/** Programme tables only exist in BIRs from 2025. */
export function lensAvailable(data: ExplorerData, year: number, quarter: number, lens: ExplorerLens): boolean {
  return Boolean(sectorValue(data, year, quarter, lens, "total"));
}

// ---------------------------------------------------------------------------
// Headline + facts (server-side, from the full dataset)

export type StateHeadline = { totalBudget: number | null; totalSpent: number | null; source: Source | null };

export function stateHeadline(ds: PublicDataset, report: ExplorerReport, pdf: string | null): StateHeadline {
  const r = ds.reports.find((x) => x.slug === report.slug);
  const row = ds.figures.find((f) => f.report_id === r?.id && f.lens === "state" && f.row_key === "total_expenditure");
  if (!row) return { totalBudget: null, totalSpent: null, source: null };
  return {
    totalBudget: row.original_budget ?? row.revised_budget,
    totalSpent: row.ytd_actual,
    source: { slug: report.slug, title: report.title, table: row.table_number, page: row.page, pdf },
  };
}

export type Fact = { title: string; body: string; source: Source | null };

export function formatShare(value: number | null): string {
  if (value === null) return "—";
  return `${(value * 100).toFixed(1)}%`;
}

/** Rule-generated "things to know" — descriptive, no adjectives, never AI. */
export function buildFacts(data: ExplorerData, year: number, quarter: number): Fact[] {
  const facts: Fact[] = [];
  const now = sectorValue(data, year, quarter, "mda", "total");

  // 1. Same point last year (nominal naira).
  const before = sectorValue(data, year - 1, quarter, "mda", "total");
  if (now?.ytd != null && before?.ytd != null) {
    const change = before.ytd ? (now.ytd - before.ytd) / before.ytd : null;
    facts.push({
      title: `${formatNairaShort(now.ytd)} spent by ${periodEnd(quarter)}`,
      body: `By the same point in ${year - 1}, health MDAs had spent ${formatNairaShort(before.ytd)}${
        change !== null ? ` (${change >= 0 ? "+" : "−"}${Math.abs(change * 100).toFixed(0)}% in nominal naira)` : ""
      }. As a share of the year's budget: ${formatShare(now.share)} this year, ${formatShare(before.share)} last year.`,
      source: now.source,
    });
  }

  // 2. Capital vs personnel.
  const capital = sectorValue(data, year, quarter, "mda", "capital");
  const personnel = sectorValue(data, year, quarter, "mda", "personnel");
  if (capital?.share != null && personnel?.share != null) {
    facts.push({
      title: `${formatShare(capital.share)} of the capital budget spent`,
      body: `Capital spending (buildings, equipment, projects) is at ${formatShare(capital.share)} of its ${formatNairaShort(
        capital.budget,
      )} budget; personnel (salaries) is at ${formatShare(personnel.share)}.`,
      source: capital.source,
    });
  }

  // 3. MDAs below the 25% line (only meaningful from Q2 on).
  const rows = lensRows(data, year, quarter, "mda", "total").filter((r) => (r.value.budget ?? 0) > 0);
  const below = rows.filter((r) => (r.value.share ?? 0) < LOW_SPEND_THRESHOLD);
  if (rows.length && quarter >= 2) {
    const big = below.filter((r) => (r.value.budget ?? 0) >= 1e9).slice(0, 3);
    facts.push({
      title: `${below.length} of ${rows.length} MDAs below 25% spent`,
      body: `${below.length} health MDAs had spent less than a quarter of their budget by ${periodEnd(quarter)}.${
        big.length ? ` Among those with budgets above ₦1bn: ${big.map((r) => `${r.entity.short} (${formatShare(r.value.share)})`).join(", ")}.` : ""
      }`,
      source: now?.source ?? null,
    });
  }
  return facts.slice(0, 3);
}

export function periodEnd(quarter: number): string {
  return quarter === 4 ? "the end of the year" : `the end of ${MONTH_END[quarter]}`;
}

// ---------------------------------------------------------------------------
// Formatting

export function formatNairaShort(value: number | null | undefined, digits = 1): string {
  if (value === null || value === undefined || Number.isNaN(value)) return "—";
  const sign = value < 0 ? "−" : "";
  const v = Math.abs(value);
  if (v >= 1e12) return `${sign}₦${(v / 1e12).toFixed(digits)}tn`;
  if (v >= 1e9) return `${sign}₦${(v / 1e9).toFixed(digits)}bn`;
  if (v >= 1e6) return `${sign}₦${(v / 1e6).toFixed(digits)}m`;
  if (v >= 1e3) return `${sign}₦${(v / 1e3).toFixed(0)}k`;
  return `${sign}₦${v.toFixed(0)}`;
}

const fullNaira = new Intl.NumberFormat("en-NG", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export function formatNairaFull(value: number | null | undefined): string {
  if (value === null || value === undefined || Number.isNaN(value)) return "—";
  return `₦${fullNaira.format(value)}`;
}

export function sourceLabel(source: Source): string {
  const parts = [source.title.replace(/^Kano State /, "").replace(/ Budget Performance Report$/, " BIR")];
  if (source.table) parts.push(`Table ${source.table}`);
  if (source.page) parts.push(`p. ${source.page}`);
  return parts.join(", ");
}

/** Our own short link to the mirrored PDF (it redirects to the file at that page). */
export function sourceHref(source: Source): string | null {
  if (!source.pdf) return null;
  return `/reports/${source.slug}/pdf${source.page ? `?page=${source.page}` : ""}`;
}

/** Accessible description of one budget bar. */
export function barLabel(name: string, budget: number | null, spent: number | null, share: number | null) {
  return `${name}: ${formatNairaShort(spent)} spent of a ${formatNairaShort(budget)} budget (${formatShare(share)})`;
}
