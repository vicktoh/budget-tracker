import type { Metadata } from "next";
import { PhcView, type PhcProgrammeRow, type PhcReport } from "@/components/public/phc-view";
import { PageHero } from "@/components/public/page-hero";
import { loadPublicDataset, reportPdfUrl } from "@/lib/public/dataset";
import { publishedReports, titleCase, type Source } from "@/lib/public/model";
import { PHC_PROGRAMMES, classifyPhcProject, type PhcProgrammeKey } from "@/lib/public/phc-programmes";
import type { PublicFigure } from "@/lib/public/types";

export const revalidate = 3600;

export const metadata: Metadata = {
  title: "Primary health care",
  description: "Kano State Primary Health Care Management Board budget and spending, by health programme.",
};

export default async function PhcPage() {
  const ds = await loadPublicDataset();
  const reports: PhcReport[] = [];

  for (const r of publishedReports(ds)) {
    const figs = ds.figures.filter((f) => f.report_id === r.id && f.lens.startsWith("phc_"));
    const projects = figs.filter((f) => f.lens === "phc_project");
    // The programme view is built from the project table; skip reports where it is unreadable.
    if (!projects.length) continue;
    const pdf = reportPdfUrl(r);
    const source = (f?: PublicFigure | null): Source => ({ slug: r.slug, title: r.title, table: f?.table_number ?? null, page: f?.page ?? null, pdf });
    const econ = (code: string) => figs.find((f) => f.lens === "phc_economic" && f.code === code) ?? null;

    const groups = new Map<PhcProgrammeKey, PhcProgrammeRow>();
    for (const p of projects) {
      const key = classifyPhcProject(p.name);
      const g = groups.get(key) ?? { key, name: PHC_PROGRAMMES[key].name, blurb: PHC_PROGRAMMES[key].blurb, b: 0, y: 0, count: 0 };
      g.b += p.original_budget ?? p.revised_budget ?? 0;
      g.y += p.ytd_actual ?? 0;
      g.count = (g.count ?? 0) + 1;
      groups.set(key, g);
    }
    const objectives = figs.filter((f) => f.lens === "phc_programme" && f.code?.length === 4);

    const personnel = econ("21");
    const overhead = econ("22");
    reports.push({
      slug: r.slug,
      year: r.fiscal_year,
      quarter: r.quarter,
      programmes: [...groups.values()].sort((a, b) => b.b - a.b),
      running: [
        ...(personnel && (personnel.original_budget ?? 0) > 0
          ? [{ key: "personnel", name: "Salaries", blurb: "Staff pay — not tied to one programme", b: personnel.original_budget ?? 0, y: personnel.ytd_actual ?? 0 }]
          : []),
        ...(overhead && (overhead.original_budget ?? 0) > 0
          ? [{ key: "overhead", name: "Running costs", blurb: "Overheads: travel, utilities, supplies — not tied to one programme", b: overhead.original_budget ?? 0, y: overhead.ytd_actual ?? 0 }]
          : []),
      ],
      projectSource: source(projects[0]),
      econSource: source(econ("23") ?? econ("2")),
      officialObjectives: objectives.map((o) => titleCase(o.name)),
    });
  }

  return (
    <>
      <PageHero eyebrow="Primary health care" title="Primary health care, by health programme">
        Primary health care centres are where most people in Kano are seen first. Here is what the Primary Health Care Management
        Board has budgeted and spent on immunisation, family planning, nutrition, mothers and children, and more.
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
