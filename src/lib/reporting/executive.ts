/**
 * Executive (Commissioner) budget-performance metrics. One pure module feeds
 * the /admin overview, the MDA and programme drill-downs, the exceptions page
 * and the assistant's metric tools, so every surface quotes the same numbers.
 *
 * Definitions agreed for the Commissioner view:
 *  - Utilisation = actual ÷ full-year approved budget (no pro-rata).
 *  - Low utilisation / underfunded = below 25% of the annual budget.
 *  - Not reporting = monthly tracking has no submission for the latest month
 *    (presence of a row, even ₦0, counts as reported). In a quarter view, a
 *    missing month anywhere in the quarter also counts.
 *  - An MDA with neither actuals nor monthly returns for the period has no
 *    data, which is not the same as spending nothing: it is flagged "No data
 *    received", never "No spending".
 *  - Release flags apply only when some release was recorded for the period;
 *    otherwise releases are unknown, not zero.
 *  - Revenue & grants collected (IGR and capital receipts) is income against
 *    the approved revenue budget. It is reported beside releases, never
 *    added to them.
 *  - Programme budgets are AOP planned costs mapped to programme areas by
 *    keyword — an approximation, labelled as such wherever it is shown.
 *  - A quarter view measures that quarter's releases and actuals against a
 *    quarterly allocation of ¼ the annual budget (and ¼ the AOP plan), so the
 *    25% thresholds keep their meaning. See `scopeToQuarter`.
 */
import {
  aggregateMdaScorecards,
  type MdaScorecard,
  type TrackingVerdict,
} from "@/lib/reporting/aggregate";
import { ECONOMIC_CLASS_LABEL, type EconomicClass } from "@/lib/reporting/economic-class";
import {
  emptyReportFilters,
  type ReportingDataset,
  type ReportQuarter,
} from "@/lib/reporting/types";

export const LOW_UTILISATION = 0.25;
export const LOW_RELEASE = 0.25;
/** Percentage-point gap between best- and worst-executing component. */
export const LOPSIDED_GAP = 0.2;

export const MONTH_LABELS = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

export type ComponentPerformance = {
  budget_class: EconomicClass;
  label: string;
  budget: number;
  spent: number;
  spent_q1: number;
  spent_q2: number;
  tracked: number;
  utilisation: number | null;
  verdict: TrackingVerdict;
  months: Array<{ month: number; amount: number | null }>;
};

export type ReportingStatus = "up_to_date" | "missed_latest" | "never";

export type MdaFlag =
  | "no_data"
  | "no_spend"
  | "low_utilisation"
  | "no_release"
  | "low_release"
  | "not_reporting"
  | "overspend"
  | "lopsided"
  | "source_mismatch";

export const MDA_FLAG_LABEL: Record<MdaFlag, string> = {
  no_data: "No data received",
  no_spend: "No spending",
  low_utilisation: "Low utilisation",
  no_release: "No funds released",
  low_release: "Underfunded",
  not_reporting: "Not reporting",
  overspend: "Overspend",
  lopsided: "Lopsided execution",
  source_mismatch: "Sources disagree",
};

export type MdaPerformance = {
  mda_id: string;
  mda_name: string;
  budget: number;
  released: number;
  spent: number;
  balance: number;
  utilisation: number | null;
  release_rate: number | null;
  components: ComponentPerformance[];
  months_reported: number[];
  missing_months: number[];
  reporting_status: ReportingStatus;
  flags: MdaFlag[];
};

export type DataCoverage = {
  fiscal_year: number;
  /** Latest transaction date across official actuals, ISO date or null. */
  data_through: string | null;
  quarters_with_actuals: number[];
  /** Latest month any MDA submitted monthly tracking for (1–12), or null. */
  tracking_horizon: number | null;
  mdas_total: number;
  mdas_in_tracking: number;
  mdas_reported_latest: number;
  /** False when no release at all was recorded for the period. */
  releases_recorded: boolean;
  gaps: string[];
};

export type ExecutiveOverview = {
  fiscal_year: number;
  /** null = full year; otherwise every figure is scoped to this quarter. */
  quarter: ReportQuarter | null;
  totals: {
    budget: number;
    released: number;
    spent: number;
    balance: number;
    utilisation: number | null;
    release_rate: number | null;
  };
  components: Array<{
    budget_class: EconomicClass;
    label: string;
    budget: number;
    spent: number;
    utilisation: number | null;
  }>;
  /** Revenue and grants collected in the period (budget_line_revenue_actuals). */
  revenue: {
    collected: number;
    recurrent: number;
    capital_receipt: number;
    /** MDAs with any collection recorded for the period. */
    mdas: number;
  };
  mdas: MdaPerformance[];
  coverage: DataCoverage;
};

/** Collections for the fiscal year, or for one quarter of it. */
export function computeRevenueCollected(
  dataset: ReportingDataset,
  fiscalYear: number,
  quarter: ReportQuarter | null = null,
): ExecutiveOverview["revenue"] {
  const result = { collected: 0, recurrent: 0, capital_receipt: 0, mdas: 0 };
  const mdas = new Set<string>();
  for (const line of dataset.revenues) {
    if (line.fiscal_year !== fiscalYear) continue;
    for (const actual of line.actuals) {
      if (quarter && actual.quarter !== quarter) continue;
      result.collected += actual.amount;
      result[line.stream] += actual.amount;
      if (actual.amount !== 0) mdas.add(line.mda_id);
    }
  }
  result.mdas = mdas.size;
  return result;
}

/** Most recent fiscal year with an approved budget (falls back to actuals). */
export function latestFiscalYear(dataset: ReportingDataset): number {
  const years = [
    ...dataset.budgets.map((b) => b.fiscal_year),
    ...dataset.expenditure.map((e) => e.fiscal_year),
  ];
  return years.length ? Math.max(...years) : new Date().getFullYear();
}

const ratio = (num: number, den: number): number | null => (den > 0 ? num / den : null);

/** Share of the annual budget allocated to one quarter. */
export const QUARTER_BUDGET_SHARE = 0.25;

export const quarterMonths = (quarter: ReportQuarter): number[] => [
  quarter * 3 - 2,
  quarter * 3 - 1,
  quarter * 3,
];

/**
 * The dataset narrowed to one quarter of a fiscal year: that quarter's
 * releases, actuals and monthly returns, with annual budgets and AOP plans
 * scaled to a quarterly allocation. Every executive metric can then run on it
 * unchanged.
 */
export function scopeToQuarter(
  dataset: ReportingDataset,
  fiscalYear: number,
  quarter: ReportQuarter,
): ReportingDataset {
  const months = new Set(quarterMonths(quarter));
  const share = QUARTER_BUDGET_SHARE;
  return {
    ...dataset,
    funding: dataset.funding.filter((f) => f.fiscal_year === fiscalYear && f.quarter === quarter),
    expenditure: dataset.expenditure.filter(
      (e) => e.fiscal_year === fiscalYear && e.quarter === quarter,
    ),
    monthly: dataset.monthly.filter((m) => m.fiscal_year === fiscalYear && months.has(m.month)),
    budgets: dataset.budgets.map((b) => ({
      ...b,
      personnel_amount: b.personnel_amount * share,
      other_recurrent_amount: b.other_recurrent_amount * share,
      total_recurrent_amount: b.total_recurrent_amount * share,
      capital_amount: b.capital_amount * share,
      total_budget_amount: b.total_budget_amount * share,
    })),
    aopActivities: dataset.aopActivities.map((a) => ({
      ...a,
      budgeted_cost: a.budgeted_cost * share,
    })),
  };
}

function toComponent(c: MdaScorecard["components"][number]): ComponentPerformance {
  return {
    budget_class: c.budget_class,
    label: c.label,
    budget: c.approved_amount,
    spent: c.official_amount,
    spent_q1: c.official_q1,
    spent_q2: c.official_q2,
    tracked: c.tracked_amount,
    utilisation: c.burn_rate,
    verdict: c.verdict,
    months: c.months,
  };
}

export function computeMdaPerformance(
  fullDataset: ReportingDataset,
  fiscalYear: number,
  quarter: ReportQuarter | null = null,
): { mdas: MdaPerformance[]; trackingHorizon: number | null } {
  const dataset = quarter ? scopeToQuarter(fullDataset, fiscalYear, quarter) : fullDataset;
  const firstMonth = quarter ? quarterMonths(quarter)[0] : 1;
  const filters = { ...emptyReportFilters(), fiscalYear };
  const cards = aggregateMdaScorecards(
    dataset.budgets,
    dataset.expenditure,
    dataset.monthly,
    filters,
  );
  const yearMonthly = dataset.monthly.filter((row) => row.fiscal_year === fiscalYear);
  const trackingHorizon = yearMonthly.length
    ? Math.max(...yearMonthly.map((row) => row.month))
    : null;

  const withActuals = new Set(
    dataset.expenditure.filter((e) => e.fiscal_year === fiscalYear).map((e) => e.mda_id),
  );
  const releasesRecorded = dataset.funding.some((f) => f.fiscal_year === fiscalYear);
  const releasedByMda = new Map<string, number>();
  for (const row of dataset.funding) {
    if (row.fiscal_year !== fiscalYear) continue;
    releasedByMda.set(row.mda_id, (releasedByMda.get(row.mda_id) ?? 0) + row.amount);
  }

  const mdas = cards.map((card): MdaPerformance => {
    const components = card.components.map(toComponent);
    const budget = card.approved_total;
    const spent = card.official_total;
    const released = releasedByMda.get(card.mda_id) ?? 0;
    const months = new Set(card.months_reported);
    const missing: number[] = [];
    if (trackingHorizon) {
      for (let m = firstMonth; m <= trackingHorizon; m += 1) if (!months.has(m)) missing.push(m);
    }
    const reporting_status: ReportingStatus =
      months.size === 0
        ? "never"
        : (trackingHorizon && !months.has(trackingHorizon)) || (quarter && missing.length > 0)
          ? "missed_latest"
          : "up_to_date";

    const utilisation = ratio(spent, budget);
    const release_rate = ratio(released, budget);
    const flags: MdaFlag[] = [];
    if (!withActuals.has(card.mda_id) && months.size === 0) flags.push("no_data");
    else if (budget > 0 && spent === 0) flags.push("no_spend");
    else if (utilisation !== null && utilisation < LOW_UTILISATION) flags.push("low_utilisation");
    if (releasesRecorded) {
      if (budget > 0 && released === 0) flags.push("no_release");
      else if (release_rate !== null && release_rate < LOW_RELEASE) flags.push("low_release");
    }
    if (reporting_status !== "up_to_date") flags.push("not_reporting");
    if (components.some((c) => c.spent > c.budget && c.spent > 0)) flags.push("overspend");
    if (lopsidedGap(components) !== null) flags.push("lopsided");
    if (sourceMismatches(components).length > 0) flags.push("source_mismatch");

    return {
      mda_id: card.mda_id,
      mda_name: card.mda_name,
      budget,
      released,
      spent,
      balance: budget - spent,
      utilisation,
      release_rate,
      components,
      months_reported: card.months_reported,
      missing_months: missing,
      reporting_status,
      flags,
    };
  });

  mdas.sort((a, b) => b.budget - a.budget);
  return { mdas, trackingHorizon };
}

/** Gap between best and worst component utilisation, when above the threshold. */
export function lopsidedGap(
  components: ComponentPerformance[],
): { best: ComponentPerformance; worst: ComponentPerformance; gap: number } | null {
  const rated = components.filter(
    (c) => c.budget > 0 && c.utilisation !== null && c.budget_class !== "other",
  );
  if (rated.length < 2) return null;
  const sorted = [...rated].sort((a, b) => (b.utilisation ?? 0) - (a.utilisation ?? 0));
  const best = sorted[0];
  const worst = sorted[sorted.length - 1];
  const gap = (best.utilisation ?? 0) - (worst.utilisation ?? 0);
  return gap > LOPSIDED_GAP ? { best, worst, gap } : null;
}

/**
 * Components where the BPR and the monthly tracking sheet disagree. Personnel
 * is paid centrally and largely absent from tracking, so personnel
 * `untracked_spend` is expected and excluded.
 */
export function sourceMismatches(components: ComponentPerformance[]): ComponentPerformance[] {
  return components.filter((c) => {
    if (c.verdict === "differs" || c.verdict === "tracking_only") return true;
    if (c.verdict === "untracked_spend") return c.budget_class !== "personnel";
    return false;
  });
}

export function computeExecutiveOverview(
  dataset: ReportingDataset,
  fiscalYear: number = latestFiscalYear(dataset),
  quarter: ReportQuarter | null = null,
): ExecutiveOverview {
  const { mdas, trackingHorizon } = computeMdaPerformance(dataset, fiscalYear, quarter);

  const totals = mdas.reduce(
    (acc, m) => {
      acc.budget += m.budget;
      acc.released += m.released;
      acc.spent += m.spent;
      return acc;
    },
    { budget: 0, released: 0, spent: 0 },
  );

  const byClass = new Map<EconomicClass, { budget: number; spent: number }>();
  for (const mda of mdas) {
    for (const c of mda.components) {
      const entry = byClass.get(c.budget_class) ?? { budget: 0, spent: 0 };
      entry.budget += c.budget;
      entry.spent += c.spent;
      byClass.set(c.budget_class, entry);
    }
  }
  const components = (["personnel", "overhead", "capital", "other"] as EconomicClass[])
    .filter((cls) => byClass.has(cls))
    .map((cls) => {
      const v = byClass.get(cls)!;
      return {
        budget_class: cls,
        label: ECONOMIC_CLASS_LABEL[cls],
        budget: v.budget,
        spent: v.spent,
        utilisation: ratio(v.spent, v.budget),
      };
    });

  return {
    fiscal_year: fiscalYear,
    quarter,
    totals: {
      ...totals,
      balance: totals.budget - totals.spent,
      utilisation: ratio(totals.spent, totals.budget),
      release_rate: ratio(totals.released, totals.budget),
    },
    components,
    revenue: computeRevenueCollected(dataset, fiscalYear, quarter),
    mdas,
    coverage: computeCoverage(dataset, fiscalYear, mdas, trackingHorizon, quarter),
  };
}

const GENERIC_PROGRAMMES = new Set(["Admin & General Services", "Other"]);

function computeCoverage(
  dataset: ReportingDataset,
  fiscalYear: number,
  mdas: MdaPerformance[],
  trackingHorizon: number | null,
  quarter: ReportQuarter | null,
): DataCoverage {
  const expenditure = dataset.expenditure.filter((e) => e.fiscal_year === fiscalYear);
  const dataThrough = expenditure.reduce<string | null>(
    (latest, e) => (latest === null || e.transaction_date > latest ? e.transaction_date : latest),
    null,
  );
  const quarters = Array.from(new Set(expenditure.map((e) => e.quarter))).sort();
  const inTracking = mdas.filter((m) => m.months_reported.length > 0).length;
  const reportedLatest = mdas.filter((m) => m.reporting_status === "up_to_date").length;

  const gaps: string[] = [];
  const lastQuarter = quarters.length ? Math.max(...quarters) : 0;
  const releasesRecorded = dataset.funding.some(
    (f) => f.fiscal_year === fiscalYear && (!quarter || f.quarter === quarter),
  );
  if (quarter) {
    gaps.push(
      `Q${quarter} figures are measured against a quarterly allocation of one quarter of the annual budget.`,
    );
    if (!quarters.includes(quarter)) {
      gaps.push(`No Q${quarter} ${fiscalYear} actuals have been received yet.`);
    }
  } else if (lastQuarter < 4) {
    const missingQ = [];
    for (let q = lastQuarter + 1; q <= 4; q += 1) missingQ.push(`Q${q}`);
    gaps.push(
      `${missingQ.join(", ")} ${fiscalYear} actuals have not been received; utilisation is measured against the full-year budget.`,
    );
  }
  // The newest quarter with actuals (or the selected one) may cover only the
  // MDAs that have reported so far; say so instead of implying a full picture.
  const coverageQuarter = quarter ?? (lastQuarter || null);
  if (coverageQuarter && quarters.includes(coverageQuarter)) {
    const reported = new Set(
      expenditure.filter((e) => e.quarter === coverageQuarter).map((e) => e.mda_id),
    ).size;
    if (reported < mdas.length) {
      gaps.push(
        `Q${coverageQuarter} ${fiscalYear} actuals cover ${reported} of ${mdas.length} MDAs so far; the rest have not reported.`,
      );
    }
  }
  if (quarter && !releasesRecorded) {
    gaps.push(`No Q${quarter} ${fiscalYear} releases have been recorded, so release figures are not available.`);
  } else if (!quarter && lastQuarter > 0 && !dataset.funding.some((f) => f.fiscal_year === fiscalYear && f.quarter === lastQuarter)) {
    gaps.push(`No Q${lastQuarter} ${fiscalYear} releases have been recorded yet; released figures stop at the previous quarter.`);
  }
  const notTracked = mdas.length - inTracking;
  if (notTracked > 0) {
    gaps.push(
      quarter
        ? `${notTracked} of ${mdas.length} MDAs submitted no monthly expenditure tracking for Q${quarter}.`
        : `${notTracked} of ${mdas.length} MDAs have never submitted monthly expenditure tracking.`,
    );
  }
  for (const q of quarters) {
    if (quarter && q !== quarter) continue;
    const rows = expenditure.filter((e) => e.quarter === q);
    const specific = rows.filter((e) => !GENERIC_PROGRAMMES.has(e.programme_area_name));
    const share = rows.length ? specific.reduce((s, e) => s + e.amount, 0) / rows.reduce((s, e) => s + e.amount, 0) : 0;
    if (share < 0.05) {
      gaps.push(`Q${q} actuals are reported as MDA totals only — no programme breakdown is available.`);
    }
  }
  gaps.push(
    "Programme budgets are AOP planned costs mapped by keyword, not appropriations; AOP covers only some MDAs.",
  );
  gaps.push("Personnel is paid centrally, so it is largely absent from monthly MDA tracking.");

  return {
    fiscal_year: fiscalYear,
    data_through: dataThrough,
    quarters_with_actuals: quarters,
    tracking_horizon: trackingHorizon,
    mdas_total: mdas.length,
    mdas_in_tracking: inTracking,
    mdas_reported_latest: reportedLatest,
    releases_recorded: releasesRecorded,
    gaps,
  };
}

/* -------------------------------------------------------------------------- */
/* Programmes                                                                 */
/* -------------------------------------------------------------------------- */

/**
 * Keyword rules mapping AOP activity descriptions to programme areas. Order
 * matters: the first match wins, so specific programmes precede broad ones.
 * Names must match `programme_areas.name` in 001_reference_data.sql.
 */
const PROGRAMME_RULES: Array<{ programme: string; pattern: RegExp }> = [
  {
    programme: "Immunisation & Vaccines",
    pattern: /immuni[sz]|vaccin|\bRI\b|cold (chain|store)|zero[- ]dose|antigen|penta|\bBCG\b|AEFI|\bSIA\b|polio|measles/i,
  },
  { programme: "HIV/AIDS, TB & Malaria", pattern: /\bHIV|AIDS|tubercul|\bTB\b|malaria|\bSMC\b|mRDT|\bITNs?\b|LLIN|\bART\b|PMTCT/i },
  {
    programme: "Reproductive, Maternal, Newborn & Child Health",
    pattern: /maternal|newborn|neonat|child health|antenatal|\bANC\b|family planning|\bFP\b|RMNCH|MNCH|postnatal|nutrition|breastfeed|midwi|obstetric|delivery/i,
  },
  {
    programme: "Human Resource for Health",
    pattern: /health[- ]workers?|\bHRH\b|human resource|recruit|scholarship|\bCHEWs?\b|frontline worker|deploy(ment)? of|staff (training|development)|in-service/i,
  },
  { programme: "Mental Health", pattern: /mental|psychiatr/i },
  { programme: "Non-Communicable Diseases", pattern: /non[- ]communicable|\bNCDs?\b|diabet|hypertens|cancer|sickle/i },
  {
    programme: "Health Emergency, Preparedness & Response",
    pattern: /emergenc|outbreak|epidemic|surveillance|cholera|lassa|diphtheria|\bEOC\b|preparedness|IDSR/i,
  },
  { programme: "Disease Control", pattern: /disease control|\bNTDs?\b|neglected tropical|onchocerc|trachoma|leprosy/i },
  { programme: "Health Financing", pattern: /financing|insurance|BHCPF|contributory|enrol(l)?ee|premium/i },
  { programme: "Drug & Supply Management", pattern: /\bdrugs?\b|commodit|supply chain|pharmac|consumable|LMIS|logistics/i },
  { programme: "Community Health Services", pattern: /communit|ward development|\bWDCs?\b|\bVCMs?\b|town hall|traditional|religious leader/i },
  {
    programme: "Planning, Research & Statistics",
    pattern: /\bAOP\b|MTSS|M&E|monitoring|evaluation|DHIS|research|data (quality|validation|review)|strategic plan|review meeting|planning/i,
  },
];

export const UNMAPPED_PROGRAMME = "Not mapped to a programme";

export function classifyAopActivity(description: string): string {
  for (const rule of PROGRAMME_RULES) {
    if (rule.pattern.test(description)) return rule.programme;
  }
  return UNMAPPED_PROGRAMME;
}

export function programmeSlug(name: string): string {
  return name
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

export type ProgrammePerformance = {
  slug: string;
  name: string;
  planned: number;
  activities: number;
  funded: number;
  spent: number;
  utilisation: number | null;
  mdas: Array<{ mda_id: string; mda_name: string; planned: number; funded: number; spent: number }>;
  flags: Array<"no_funding" | "low_utilisation" | "overspend" | "no_plan">;
};

/** Programmes the Commissioner asks about first; pinned to the top of lists. */
export const FEATURED_PROGRAMMES = ["Immunisation & Vaccines", "Human Resource for Health"];

export function computeProgrammePerformance(
  fullDataset: ReportingDataset,
  fiscalYear: number = latestFiscalYear(fullDataset),
  quarter: ReportQuarter | null = null,
): ProgrammePerformance[] {
  const dataset = quarter ? scopeToQuarter(fullDataset, fiscalYear, quarter) : fullDataset;
  type Acc = {
    planned: number;
    activities: number;
    funded: number;
    spent: number;
    mdas: Map<string, { mda_name: string; planned: number; funded: number; spent: number }>;
  };
  const byProgramme = new Map<string, Acc>();
  const ensure = (name: string): Acc => {
    let acc = byProgramme.get(name);
    if (!acc) {
      acc = { planned: 0, activities: 0, funded: 0, spent: 0, mdas: new Map() };
      byProgramme.set(name, acc);
    }
    return acc;
  };
  const ensureMda = (acc: Acc, id: string, name: string) => {
    let m = acc.mdas.get(id);
    if (!m) {
      m = { mda_name: name, planned: 0, funded: 0, spent: 0 };
      acc.mdas.set(id, m);
    }
    return m;
  };

  for (const a of dataset.aopActivities) {
    if (a.fiscal_year !== fiscalYear || !a.active) continue;
    const acc = ensure(classifyAopActivity(a.description));
    acc.planned += a.budgeted_cost;
    acc.activities += 1;
    ensureMda(acc, a.mda_id, a.mda_name).planned += a.budgeted_cost;
  }
  for (const f of dataset.funding) {
    if (f.fiscal_year !== fiscalYear || GENERIC_PROGRAMMES.has(f.programme_area_name)) continue;
    const acc = ensure(f.programme_area_name);
    acc.funded += f.amount;
    ensureMda(acc, f.mda_id, f.mda_name).funded += f.amount;
  }
  for (const e of dataset.expenditure) {
    if (e.fiscal_year !== fiscalYear || GENERIC_PROGRAMMES.has(e.programme_area_name)) continue;
    const acc = ensure(e.programme_area_name);
    acc.spent += e.amount;
    ensureMda(acc, e.mda_id, e.mda_name).spent += e.amount;
  }

  const rows: ProgrammePerformance[] = [];
  for (const [name, acc] of byProgramme) {
    const utilisation = ratio(acc.spent, acc.planned);
    const flags: ProgrammePerformance["flags"] = [];
    if (acc.planned > 0 && acc.funded === 0 && acc.spent === 0) flags.push("no_funding");
    else if (utilisation !== null && utilisation < LOW_UTILISATION) flags.push("low_utilisation");
    if (acc.planned > 0 && acc.spent > acc.planned) flags.push("overspend");
    if (acc.planned === 0 && name !== UNMAPPED_PROGRAMME) flags.push("no_plan");
    rows.push({
      slug: programmeSlug(name),
      name,
      planned: acc.planned,
      activities: acc.activities,
      funded: acc.funded,
      spent: acc.spent,
      utilisation,
      mdas: Array.from(acc.mdas, ([mda_id, m]) => ({ mda_id, ...m })).sort(
        (a, b) => b.planned + b.spent - (a.planned + a.spent),
      ),
      flags,
    });
  }
  // Featured programmes always appear, even with no data, so the gap is visible.
  for (const name of FEATURED_PROGRAMMES) {
    if (!byProgramme.has(name)) {
      rows.push({
        slug: programmeSlug(name),
        name,
        planned: 0,
        activities: 0,
        funded: 0,
        spent: 0,
        utilisation: null,
        mdas: [],
        flags: ["no_plan"],
      });
    }
  }

  return rows.sort((a, b) => {
    const fa = FEATURED_PROGRAMMES.indexOf(a.name);
    const fb = FEATURED_PROGRAMMES.indexOf(b.name);
    if (fa !== -1 || fb !== -1) return (fa === -1 ? 99 : fa) - (fb === -1 ? 99 : fb);
    if (a.name === UNMAPPED_PROGRAMME) return 1;
    if (b.name === UNMAPPED_PROGRAMME) return -1;
    return b.planned + b.spent - (a.planned + a.spent);
  });
}

/** AOP activities and ledger rows behind one programme, for the drill-down. */
export function programmeDetail(
  dataset: ReportingDataset,
  slug: string,
  fiscalYear: number = latestFiscalYear(dataset),
) {
  const programme = computeProgrammePerformance(dataset, fiscalYear).find((p) => p.slug === slug);
  if (!programme) return null;
  const activities = dataset.aopActivities
    .filter(
      (a) =>
        a.fiscal_year === fiscalYear &&
        a.active &&
        classifyAopActivity(a.description) === programme.name,
    )
    .sort((a, b) => b.budgeted_cost - a.budgeted_cost);
  const spending = dataset.expenditure
    .filter((e) => e.fiscal_year === fiscalYear && e.programme_area_name === programme.name)
    .sort((a, b) => b.amount - a.amount);
  const releases = dataset.funding
    .filter((f) => f.fiscal_year === fiscalYear && f.programme_area_name === programme.name)
    .sort((a, b) => b.amount - a.amount);
  return { programme, activities, spending, releases };
}

/* -------------------------------------------------------------------------- */
/* Exceptions                                                                 */
/* -------------------------------------------------------------------------- */

export type ExecutiveExceptions = {
  notReporting: MdaPerformance[];
  noFundingMdas: MdaPerformance[];
  underfundedMdas: MdaPerformance[];
  noFundingProgrammes: ProgrammePerformance[];
  lowUtilisationMdas: MdaPerformance[];
  lowUtilisationProgrammes: ProgrammePerformance[];
  overspend: Array<{ mda: MdaPerformance; component: ComponentPerformance }>;
  lopsided: Array<{ mda: MdaPerformance; best: ComponentPerformance; worst: ComponentPerformance; gap: number }>;
  sourceMismatch: Array<{ mda: MdaPerformance; component: ComponentPerformance }>;
};

export function computeExceptions(
  overview: ExecutiveOverview,
  programmes: ProgrammePerformance[],
): ExecutiveExceptions {
  const mdas = overview.mdas;
  return {
    notReporting: mdas
      .filter((m) => m.reporting_status !== "up_to_date")
      .sort((a, b) => b.missing_months.length - a.missing_months.length),
    noFundingMdas: mdas.filter((m) => m.flags.includes("no_release")),
    underfundedMdas: mdas
      .filter((m) => m.flags.includes("low_release"))
      .sort((a, b) => (a.release_rate ?? 0) - (b.release_rate ?? 0)),
    noFundingProgrammes: programmes.filter((p) => p.flags.includes("no_funding")),
    lowUtilisationMdas: mdas
      .filter((m) => m.flags.includes("no_spend") || m.flags.includes("low_utilisation"))
      .sort((a, b) => (a.utilisation ?? 0) - (b.utilisation ?? 0)),
    lowUtilisationProgrammes: programmes
      .filter((p) => p.flags.includes("low_utilisation"))
      .sort((a, b) => (a.utilisation ?? 0) - (b.utilisation ?? 0)),
    overspend: mdas.flatMap((mda) =>
      mda.components
        .filter((c) => c.spent > c.budget && c.spent > 0)
        .map((component) => ({ mda, component })),
    ),
    lopsided: mdas.flatMap((mda) => {
      const gap = lopsidedGap(mda.components);
      return gap ? [{ mda, ...gap }] : [];
    }),
    sourceMismatch: mdas.flatMap((mda) =>
      sourceMismatches(mda.components).map((component) => ({ mda, component })),
    ),
  };
}
