import type { Metadata } from "next";
import { PhcView, type PhcProgrammeRow, type PhcReport } from "@/components/public/phc-view";
import { PageHero } from "@/components/public/page-hero";
import { loadPublicDataset } from "@/lib/public/dataset";
import { publishedReports, titleCase } from "@/lib/public/model";
import {
  CROSS_MDA_PROGRAMMES,
  PHC_PROGRAMMES,
  classifyPhcProject,
  isPassThrough,
  type PhcProgrammeKey,
} from "@/lib/public/phc-programmes";
import budgets2026 from "@/lib/public/programme-budgets-2026.json";

export const revalidate = 3600;

export const metadata: Metadata = {
  title: "Health programmes",
  description:
    "What Kano State budgets for immunisation, malaria, nutrition, mothers and children and other health programmes, across all health MDAs.",
};

/** Approved budget lines of MDAs other than the PHC Board, by fiscal year (scripts/public/export-programme-budgets.ts). */
const OTHER_MDA_BUDGETS: Record<number, typeof budgets2026> = { 2026: budgets2026 };

export default async function PhcPage() {
  const ds = await loadPublicDataset();
  const shortName = new Map(ds.entities.filter((e) => e.lens === "mda").map((e) => [e.code, e.short_name ?? e.name]));
  const reports: PhcReport[] = [];

  for (const r of publishedReports(ds)) {
    const figs = ds.figures.filter((f) => f.report_id === r.id && f.lens.startsWith("phc_"));
    const projects = figs.filter((f) => f.lens === "phc_project");
    // The programme view is built from the PHC Board's project table; skip reports where it is unreadable.
    if (!projects.length) continue;

    const groups = new Map<PhcProgrammeKey, PhcProgrammeRow>();
    const group = (key: PhcProgrammeKey) => {
      const g = groups.get(key) ?? { key, name: PHC_PROGRAMMES[key].name, blurb: PHC_PROGRAMMES[key].blurb, b: 0, y: 0, count: 0, others: [] };
      groups.set(key, g);
      return g;
    };
    for (const p of projects) {
      const g = group(classifyPhcProject(p.name));
      g.b += p.original_budget ?? p.revised_budget ?? 0;
      g.y += p.ytd_actual ?? 0;
      g.count = (g.count ?? 0) + 1;
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
        const funder = g.others!.find((o) => o.code === line.mdaCode);
        if (funder) funder.amount += line.amount;
        else g.others!.push({ code: line.mdaCode, name: shortName.get(line.mdaCode) ?? line.mdaCode, amount: line.amount });
      }
    }
    for (const g of groups.values()) g.others!.sort((a, b) => b.amount - a.amount);

    const all = [...groups.values()];
    const total = (g: PhcProgrammeRow) => g.b + (g.others ?? []).reduce((a, o) => a + o.amount, 0);
    reports.push({
      slug: r.slug,
      year: r.fiscal_year,
      quarter: r.quarter,
      programmes: all.filter((g) => CROSS_MDA_PROGRAMMES.includes(g.key as PhcProgrammeKey)).sort((a, b) => total(b) - total(a)),
      otherBudgetsSource: other ? other.source : null,
      passThrough,
      officialObjectives: figs.filter((f) => f.lens === "phc_programme" && f.code?.length === 4).map((o) => titleCase(o.name)),
    });
  }

  return (
    <>
      <PageHero eyebrow="Health programmes" title="Health programmes, across every MDA">
        What Kano State budgets for immunisation, malaria, nutrition, mothers and children and other health programmes, and
        which ministries and agencies fund them.
      </PageHero>
      <div className="mx-auto max-w-6xl px-4 pb-14 sm:px-6">
        {reports.length ? (
          <div className="mt-10">
            <PhcView reports={reports} />
          </div>
        ) : (
          <p className="mt-10 text-[var(--pub-muted)]">No report with a primary health care section has been published yet.</p>
        )}
      </div>
    </>
  );
}
