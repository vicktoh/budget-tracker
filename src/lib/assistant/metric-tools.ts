import { tool } from "ai";
import { z } from "zod";
import type { TypedSupabaseClient } from "@/lib/supabase/client";
import { loadReportingDataset } from "@/lib/reporting/queries";
import {
  computeExceptions,
  computeExecutiveOverview,
  computeProgrammePerformance,
  LOW_UTILISATION,
  MONTH_LABELS,
  programmeDetail,
  type MdaPerformance,
} from "@/lib/reporting/executive";
import type { ReportingDataset } from "@/lib/reporting/types";

/**
 * Executive metric tools. They call the exact functions the /admin dashboard
 * renders from, so the assistant's figures always match the screen. The
 * dataset is loaded once per request under the caller's RLS scope.
 */

const pct = (v: number | null) => (v === null ? null : Math.round(v * 1000) / 10);
const naira = (v: number) => Math.round(v);

function normalise(text: string) {
  return text.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

/** Loose name match: full name, bracketed abbreviation (e.g. "PHCMB"), or substring. */
function matchByName<T>(items: T[], name: (item: T) => string, query: string): T | null {
  const q = normalise(query);
  if (!q) return null;
  const scored = items
    .map((item) => {
      const n = normalise(name(item));
      const abbr = (name(item).match(/\(([^)]+)\)/)?.[1] ?? "").toLowerCase();
      let score = 0;
      if (n === q || abbr === q) score = 100;
      else if (abbr && q.split(" ").includes(abbr)) score = 90;
      else if (n.includes(q)) score = 70;
      else if (q.includes(n)) score = 60;
      else {
        const words = q.split(" ").filter((w) => w.length > 3);
        score = words.filter((w) => n.includes(w)).length * 10;
      }
      return { item, score };
    })
    .filter((s) => s.score > 0)
    .sort((a, b) => b.score - a.score);
  return scored[0]?.item ?? null;
}

function compactMda(m: MdaPerformance) {
  return {
    mda: m.mda_name,
    link: `/admin/mdas/${m.mda_id}`,
    budget: naira(m.budget),
    released: naira(m.released),
    spent: naira(m.spent),
    utilisation_pct: pct(m.utilisation),
    release_pct: pct(m.release_rate),
    reporting:
      m.reporting_status === "never"
        ? "never submitted monthly returns"
        : m.missing_months.length
          ? `missing ${m.missing_months.map((x) => MONTH_LABELS[x - 1]).join(", ")}`
          : "up to date",
    flags: m.flags,
  };
}

export function createMetricTools(supabase: TypedSupabaseClient) {
  let datasetPromise: Promise<ReportingDataset> | null = null;
  const dataset = () => (datasetPromise ??= loadReportingDataset(supabase));
  const views = async () => {
    const data = await dataset();
    const overview = computeExecutiveOverview(data);
    const programmes = computeProgrammePerformance(data, overview.fiscal_year);
    const exceptions = computeExceptions(overview, programmes);
    return { data, overview, programmes, exceptions };
  };

  const getOverview = tool({
    description:
      "Statewide health-sector budget performance for the latest fiscal year: totals (approved budget, " +
      "released, actual spend, balance, utilisation = spend ÷ annual budget), personnel/overhead/capital " +
      "split, every MDA with flags, and data-coverage gaps. Use first for any general or 'how are we doing' question.",
    inputSchema: z.object({}),
    execute: async () => {
      const { overview } = await views();
      return {
        fiscal_year: overview.fiscal_year,
        totals: {
          budget: naira(overview.totals.budget),
          released: naira(overview.totals.released),
          spent: naira(overview.totals.spent),
          balance: naira(overview.totals.balance),
          utilisation_pct: pct(overview.totals.utilisation),
          release_pct: pct(overview.totals.release_rate),
        },
        by_economic_class: overview.components.map((c) => ({
          class: c.label,
          budget: naira(c.budget),
          spent: naira(c.spent),
          utilisation_pct: pct(c.utilisation),
        })),
        coverage: overview.coverage,
        mdas: overview.mdas.map(compactMda),
        link: "/admin",
      };
    },
  });

  const getMdaPerformance = tool({
    description:
      "Detailed budget performance for one MDA (name or abbreviation such as 'PHCMB', 'HMB', 'KCHIMA'): " +
      "budget vs actual by economic class and quarter, releases, monthly return status, programmes and largest line items.",
    inputSchema: z.object({ mda: z.string().describe("MDA name or abbreviation") }),
    execute: async ({ mda }) => {
      const { data, overview, programmes } = await views();
      const match = matchByName(overview.mdas, (m) => m.mda_name, mda);
      if (!match) {
        return { error: `No MDA matches "${mda}".`, available: overview.mdas.map((m) => m.mda_name) };
      }
      return {
        ...compactMda(match),
        by_economic_class: match.components.map((c) => ({
          class: c.label,
          budget: naira(c.budget),
          spent_q1: naira(c.spent_q1),
          spent_q2: naira(c.spent_q2),
          spent: naira(c.spent),
          utilisation_pct: pct(c.utilisation),
          monthly_tracking_total: naira(c.tracked),
          tracking_vs_bpr: c.verdict,
        })),
        programmes: programmes
          .map((p) => ({ p, row: p.mdas.find((m) => m.mda_id === match.mda_id) }))
          .filter((x) => x.row)
          .map(({ p, row }) => ({
            programme: p.name,
            link: `/admin/programmes/${p.slug}`,
            aop_planned: naira(row!.planned),
            released: naira(row!.funded),
            spent: naira(row!.spent),
          })),
        largest_line_items: data.expenditure
          .filter((e) => e.mda_id === match.mda_id && e.fiscal_year === overview.fiscal_year)
          .sort((a, b) => b.amount - a.amount)
          .slice(0, 8)
          .map((e) => ({
            description: e.remarks || e.voucher_ref_no,
            quarter: e.quarter,
            programme: e.programme_area_name,
            amount: naira(e.amount),
          })),
      };
    },
  });

  const getProgrammePerformance = tool({
    description:
      "Programme performance (e.g. immunization, health workers / human resource for health, malaria, maternal health). " +
      "Budget = AOP planned cost of activities mapped to the programme by keyword (state budgets are not appropriated by programme). " +
      "Actuals = releases and spending tagged to the programme area. Omit `programme` to list all programmes.",
    inputSchema: z.object({
      programme: z
        .string()
        .optional()
        .describe("Programme name or keyword, e.g. 'immunization', 'health workers'"),
    }),
    execute: async ({ programme }) => {
      const { data, overview, programmes } = await views();
      const caveat =
        "Programme budget is the AOP planned cost (keyword-mapped), not an appropriation. Q2 actuals were reported as MDA totals with no programme detail, so programme actuals only reflect Q1.";
      if (!programme) {
        return {
          caveat,
          programmes: programmes.map((p) => ({
            programme: p.name,
            link: `/admin/programmes/${p.slug}`,
            aop_planned: naira(p.planned),
            released: naira(p.funded),
            spent: naira(p.spent),
            spent_vs_planned_pct: pct(p.utilisation),
            flags: p.flags,
          })),
        };
      }
      const aliases: Record<string, string> = {
        immunization: "Immunisation & Vaccines",
        immunisation: "Immunisation & Vaccines",
        vaccine: "Immunisation & Vaccines",
        "health worker": "Human Resource for Health",
        "health workers": "Human Resource for Health",
        hrh: "Human Resource for Health",
        workforce: "Human Resource for Health",
        malaria: "HIV/AIDS, TB & Malaria",
        maternal: "Reproductive, Maternal, Newborn & Child Health",
      };
      const q = normalise(programme);
      const alias = Object.entries(aliases).find(([k]) => q.includes(k))?.[1];
      const match =
        (alias && programmes.find((p) => p.name === alias)) ||
        matchByName(programmes, (p) => p.name, programme);
      if (!match) {
        return { error: `No programme matches "${programme}".`, available: programmes.map((p) => p.name) };
      }
      const detail = programmeDetail(data, match.slug, overview.fiscal_year)!;
      return {
        caveat,
        programme: match.name,
        link: `/admin/programmes/${match.slug}`,
        aop_planned: naira(match.planned),
        aop_activities: match.activities,
        released: naira(match.funded),
        spent: naira(match.spent),
        spent_vs_planned_pct: pct(match.utilisation),
        flags: match.flags,
        by_mda: match.mdas.map((m) => ({
          mda: m.mda_name,
          link: `/admin/mdas/${m.mda_id}`,
          aop_planned: naira(m.planned),
          released: naira(m.funded),
          spent: naira(m.spent),
        })),
        spending_items: detail.spending.slice(0, 8).map((e) => ({
          description: e.remarks || e.voucher_ref_no,
          mda: e.mda_name,
          quarter: e.quarter,
          amount: naira(e.amount),
        })),
        largest_planned_activities: detail.activities.slice(0, 8).map((a) => ({
          activity: a.description,
          mda: a.mda_name,
          planned: naira(a.budgeted_cost),
        })),
      };
    },
  });

  const listExceptions = tool({
    description:
      "Reporting and funding exceptions: MDAs not submitting monthly expenditure returns, MDAs and programmes " +
      `receiving no funding, underfunded MDAs (<${LOW_UTILISATION * 100}% released), low utilisation ` +
      `(<${LOW_UTILISATION * 100}% of annual budget spent), overspend, lopsided execution across categories, ` +
      "and BPR vs monthly-tracking disagreement.",
    inputSchema: z.object({
      type: z
        .enum(["all", "not_reporting", "no_funding", "low_utilisation", "variances"])
        .default("all"),
    }),
    execute: async ({ type }) => {
      const { overview, exceptions: ex } = await views();
      const want = (t: string) => type === "all" || type === t;
      return {
        fiscal_year: overview.fiscal_year,
        link: "/admin/exceptions",
        latest_tracking_month: overview.coverage.tracking_horizon
          ? MONTH_LABELS[overview.coverage.tracking_horizon - 1]
          : null,
        ...(want("not_reporting") && { not_reporting: ex.notReporting.map(compactMda) }),
        ...(want("no_funding") && {
          mdas_no_funding: ex.noFundingMdas.map(compactMda),
          mdas_underfunded: ex.underfundedMdas.map(compactMda),
          programmes_no_funding: ex.noFundingProgrammes.map((p) => ({
            programme: p.name,
            link: `/admin/programmes/${p.slug}`,
            aop_planned: naira(p.planned),
          })),
        }),
        ...(want("low_utilisation") && {
          mdas_low_utilisation: ex.lowUtilisationMdas.map(compactMda),
          programmes_low_utilisation: ex.lowUtilisationProgrammes.map((p) => ({
            programme: p.name,
            spent_vs_planned_pct: pct(p.utilisation),
          })),
        }),
        ...(want("variances") && {
          overspend: ex.overspend.map((o) => ({
            mda: o.mda.mda_name,
            class: o.component.label,
            budget: naira(o.component.budget),
            spent: naira(o.component.spent),
          })),
          lopsided: ex.lopsided.map((l) => ({
            mda: l.mda.mda_name,
            ahead: `${l.best.label} ${pct(l.best.utilisation)}%`,
            behind: `${l.worst.label} ${pct(l.worst.utilisation)}%`,
          })),
          source_disagreement: ex.sourceMismatch.map((s) => ({
            mda: s.mda.mda_name,
            class: s.component.label,
            bpr: naira(s.component.spent),
            monthly_tracking: naira(s.component.tracked),
            verdict: s.component.verdict,
          })),
        }),
      };
    },
  });

  const compareComponents = tool({
    description:
      "Compare personnel, overhead and capital expenditure: statewide budget vs actual per class, by quarter, and per MDA.",
    inputSchema: z.object({}),
    execute: async () => {
      const { overview } = await views();
      const byQuarter = new Map<string, { q1: number; q2: number }>();
      for (const m of overview.mdas) {
        for (const c of m.components) {
          const e = byQuarter.get(c.label) ?? { q1: 0, q2: 0 };
          e.q1 += c.spent_q1;
          e.q2 += c.spent_q2;
          byQuarter.set(c.label, e);
        }
      }
      return {
        fiscal_year: overview.fiscal_year,
        statewide: overview.components.map((c) => ({
          class: c.label,
          budget: naira(c.budget),
          spent: naira(c.spent),
          utilisation_pct: pct(c.utilisation),
          spent_q1: naira(byQuarter.get(c.label)?.q1 ?? 0),
          spent_q2: naira(byQuarter.get(c.label)?.q2 ?? 0),
        })),
        by_mda: overview.mdas.map((m) => ({
          mda: m.mda_name,
          ...Object.fromEntries(
            m.components.flatMap((c) => [
              [`${c.budget_class}_budget`, naira(c.budget)],
              [`${c.budget_class}_spent`, naira(c.spent)],
            ]),
          ),
        })),
      };
    },
  });

  const generateReport = tool({
    description:
      "Prepare a budget-performance report for a period (monthly, quarterly, half-year or full-year). Returns the " +
      "headline figures for the period and links to the downloadable reports (Ministry of Budget & Planning " +
      "execution review, official BIR). Always give the user the report links.",
    inputSchema: z.object({
      period: z.enum(["month", "quarter", "half_year", "full_year"]),
      quarter: z.number().int().min(1).max(4).optional(),
      month: z.number().int().min(1).max(12).optional(),
    }),
    execute: async ({ period, quarter, month }) => {
      const { data, overview } = await views();
      const fy = overview.fiscal_year;
      const available = overview.coverage.quarters_with_actuals;
      const latestQ = available.length ? Math.max(...available) : null;
      const q = quarter ?? latestQ ?? 1;
      const quarters =
        period === "quarter" ? [q] : period === "half_year" ? [1, 2] : period === "full_year" ? [1, 2, 3, 4] : [];
      const missingQuarters = quarters.filter((x) => !available.includes(x));

      if (period === "month") {
        const m = month ?? overview.coverage.tracking_horizon ?? 1;
        const rows = data.monthly.filter((r) => r.fiscal_year === fy && r.month === m);
        const byMda = new Map<string, number>();
        for (const r of rows) byMda.set(r.mda_name, (byMda.get(r.mda_name) ?? 0) + r.amount);
        const notSubmitted = overview.mdas.filter((x) => !x.months_reported.includes(m)).map((x) => x.mda_name);
        return {
          title: `Monthly budget-performance report — ${MONTH_LABELS[m - 1]} ${fy}`,
          source: "MDA monthly tracking returns (official BPR is quarterly)",
          total_reported: naira(rows.reduce((s, r) => s + r.amount, 0)),
          by_mda: Array.from(byMda, ([mda, amount]) => ({ mda, amount: naira(amount) })).sort((a, b) => b.amount - a.amount),
          mdas_not_submitted: notSubmitted,
          links: { exceptions: "/admin/exceptions", dashboard: "/admin" },
        };
      }

      const inPeriod = data.expenditure.filter((e) => e.fiscal_year === fy && quarters.includes(e.quarter));
      const releasedInPeriod = data.funding.filter((f) => f.fiscal_year === fy && quarters.includes(f.quarter));
      const spent = inPeriod.reduce((s, e) => s + e.amount, 0);
      const released = releasedInPeriod.reduce((s, f) => s + f.amount, 0);
      const byMda = new Map<string, number>();
      for (const e of inPeriod) byMda.set(e.mda_name, (byMda.get(e.mda_name) ?? 0) + e.amount);
      const label =
        period === "quarter" ? `Q${q} ${fy}` : period === "half_year" ? `H1 ${fy}` : `FY ${fy}`;
      const qParam = period === "quarter" ? `&q=${q}` : "";
      return {
        title: `Budget-performance report — ${label}`,
        missing_quarters: missingQuarters.map((x) => `Q${x}`),
        note: missingQuarters.length
          ? `Actuals for ${missingQuarters.map((x) => `Q${x}`).join(", ")} have not been received; the report covers available quarters only.`
          : null,
        annual_budget: naira(overview.totals.budget),
        released_in_period: naira(released),
        spent_in_period: naira(spent),
        spent_as_pct_of_annual_budget: pct(overview.totals.budget ? spent / overview.totals.budget : null),
        by_mda: Array.from(byMda, ([mda, amount]) => ({ mda, spent: naira(amount) })).sort((a, b) => b.spent - a.spent),
        links: {
          budget_and_planning_report: `/admin/reports/mbp?fy=${fy}${qParam}`,
          official_bir: `/admin/reports/bir?fy=${fy}${qParam}`,
          exceptions: "/admin/exceptions",
        },
      };
    },
  });

  return {
    getOverview,
    getMdaPerformance,
    getProgrammePerformance,
    listExceptions,
    compareComponents,
    generateReport,
  };
}
