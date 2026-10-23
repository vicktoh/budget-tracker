import { publishedReports } from "@/lib/public/model";
import {
  CROSS_MDA_PROGRAMMES,
  PHC_BOARD_CODE,
  PHC_BOARD_LABEL,
  PHC_PROGRAMMES,
  classifyPhcProject,
  isPassThrough,
  programmeTotal,
  type PhcProgrammeKey,
  type PhcProgrammeRow,
  type PhcReport,
} from "@/lib/public/phc-programmes";
import budgets2026 from "@/lib/public/programme-budgets-2026.json";
import type { PublicDataset } from "@/lib/public/types";

/**
 * The health programmes on /phc, shared by the page's cards and Ask AI so the
 * two always show the same figures. The PHC Board's budget and spending come
 * from its project table in the quarterly report; other MDAs' budgets come
 * from their approved budget lines. Both are grouped by classifyPhcProject.
 */

type BudgetFile = {
  fiscalYear: number;
  source: string;
  lines: { mdaCode: string; description: string; budgetClass: string; economicCode: string; amount: number }[];
};

/** Approved budget lines of MDAs other than the PHC Board, by fiscal year (scripts/public/export-programme-budgets.ts). */
const OTHER_MDA_BUDGETS: Record<number, BudgetFile> = { 2026: budgets2026 };

/** One entry per published report that has the PHC Board's project table, oldest first. */
export function buildHealthProgrammes(ds: PublicDataset, { withLines = false } = {}): PhcReport[] {
  const shortName = new Map(ds.entities.filter((e) => e.lens === "mda").map((e) => [e.code, e.short_name ?? e.name]));
  const reports: PhcReport[] = [];

  for (const r of publishedReports(ds)) {
    const projects = ds.figures.filter((f) => f.report_id === r.id && f.lens === "phc_project");
    // The programme view is built from the PHC Board's project table; skip reports where it is unreadable.
    if (!projects.length) continue;

    const groups = new Map<PhcProgrammeKey, PhcProgrammeRow>();
    const group = (key: PhcProgrammeKey) => {
      const g = groups.get(key) ?? {
        key,
        name: PHC_PROGRAMMES[key].name,
        blurb: PHC_PROGRAMMES[key].blurb,
        b: 0,
        y: 0,
        count: 0,
        others: [],
        ...(withLines ? { lines: [] } : {}),
      };
      groups.set(key, g);
      return g;
    };
    for (const p of projects) {
      const g = group(classifyPhcProject(p.name));
      const budget = p.original_budget ?? p.revised_budget ?? 0;
      g.b += budget;
      g.y += p.ytd_actual ?? 0;
      g.count = (g.count ?? 0) + 1;
      g.lines?.push({ mdaCode: PHC_BOARD_CODE, mda: PHC_BOARD_LABEL, description: p.name, budget, spent: p.ytd_actual, page: p.page });
    }

    // Other MDAs' approved budget lines for the same programmes (budget only: their
    // spending is not reported by programme).
    const other = OTHER_MDA_BUDGETS[r.fiscal_year];
    let passThrough = 0;
    if (other) {
      for (const line of other.lines) {
        const key = classifyPhcProject(line.description);
        if (!CROSS_MDA_PROGRAMMES.includes(key)) continue;
        if (isPassThrough(line.description)) {
          passThrough += line.amount;
          continue;
        }
        const g = group(key);
        const name = shortName.get(line.mdaCode) ?? line.mdaCode;
        const funder = g.others!.find((o) => o.code === line.mdaCode);
        if (funder) funder.amount += line.amount;
        else g.others!.push({ code: line.mdaCode, name, amount: line.amount });
        g.lines?.push({ mdaCode: line.mdaCode, mda: name, description: line.description, budget: line.amount, spent: null, page: null });
      }
    }
    for (const g of groups.values()) {
      g.others!.sort((a, b) => b.amount - a.amount);
      g.lines?.sort((a, b) => b.budget - a.budget);
    }

    reports.push({
      slug: r.slug,
      year: r.fiscal_year,
      quarter: r.quarter,
      programmes: [...groups.values()]
        .filter((g) => CROSS_MDA_PROGRAMMES.includes(g.key))
        .sort((a, b) => programmeTotal(b) - programmeTotal(a)),
      otherBudgetsSource: other ? other.source : null,
      passThrough,
    });
  }
  return reports;
}

/**
 * Match a visitor's words ("maternal", "MNCH", "vaccines", "mothers and
 * newborns") to a programme on the page.
 */
const PROGRAMME_ALIASES: Partial<Record<PhcProgrammeKey, string>> = {
  immunisation: "immunization vaccination vaccines polio routine immunisation",
  family_planning: "birth spacing contraception",
  mnch: "mnch imnch rmnch maternal health child health mothers newborn babies pregnancy antenatal ante-natal school health",
  nutrition: "malnutrition feeding iycf sam",
  malaria: "smc seasonal malaria chemoprevention",
  disease_control: "tb tuberculosis hiv aids epidemics outbreaks surveillance laboratory communicable",
};

const STOP_WORDS = new Set(["and", "the", "for", "of", "in", "on", "to", "by", "health", "programme", "programmes", "program", "kano", "budget"]);

export function matchProgrammes(query: string): PhcProgrammeKey[] {
  const words = query
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, " ")
    .split(/\s+/)
    .filter((w) => w.length >= 2 && !STOP_WORDS.has(w));
  // The page's own grouping rules catch project words such as "resuscitation".
  const ruled = classifyPhcProject(query);
  const scores = CROSS_MDA_PROGRAMMES.map((key) => {
    const hay = ` ${key.replace("_", " ")} ${PHC_PROGRAMMES[key].name} ${PHC_PROGRAMMES[key].blurb} ${PROGRAMME_ALIASES[key] ?? ""} `.toLowerCase();
    const hits = words.filter((w) => (w.length <= 3 ? hay.includes(` ${w} `) : hay.includes(w.replace(/s$/, "")))).length;
    return { key, score: hits + (key === ruled ? 1 : 0) };
  });
  // Keep every programme named, but drop stray one-word overlaps ("child" in
  // "child birth spacing") when another programme clearly matches better.
  const best = Math.max(0, ...scores.map((s) => s.score));
  return scores.filter((s) => s.score > 0 && s.score * 2 >= best).map((s) => s.key);
}
