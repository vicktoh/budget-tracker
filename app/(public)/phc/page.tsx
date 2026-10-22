import type { Metadata } from "next";
import { PhcView, type PhcReport, type PhcRow } from "@/components/public/phc-view";
import { Reveal } from "@/components/public/motion";
import { loadPublicDataset, reportPdfUrl } from "@/lib/public/dataset";
import { publishedReports, titleCase } from "@/lib/public/model";
import type { PublicFigure } from "@/lib/public/types";

export const revalidate = 3600;

export const metadata: Metadata = {
  title: "Primary health care",
  description: "Kano State Primary Health Care Management Board budget and spending: by programme, by type and by capital project.",
};

function row(f: PublicFigure): PhcRow {
  return {
    code: f.code ?? "",
    name: titleCase(f.name),
    b: f.original_budget ?? f.revised_budget,
    y: f.ytd_actual,
    q: f.quarter_actual,
    p: f.page,
    t: f.table_number,
  };
}

export default async function PhcPage() {
  const ds = await loadPublicDataset();
  const reports: PhcReport[] = [];
  for (const r of publishedReports(ds)) {
    const figs = ds.figures.filter((f) => f.report_id === r.id && f.lens.startsWith("phc_"));
    if (!figs.length) continue;
    const pick = (lens: PublicFigure["lens"]) => figs.filter((f) => f.lens === lens && f.code).map(row);
    reports.push({
      slug: r.slug,
      year: r.fiscal_year,
      quarter: r.quarter,
      title: r.title,
      pdf: reportPdfUrl(r),
      admin: pick("phc_mda"),
      programme: pick("phc_programme"),
      functions: pick("phc_function"),
      economic: pick("phc_economic"),
      projects: figs.filter((f) => f.lens === "phc_project").map((f) => ({ ...row(f), code: f.mda_code ?? "", name: f.name })),
    });
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-14 sm:px-6">
      <Reveal className="max-w-3xl">
        <p className="text-xs font-semibold uppercase tracking-[0.12em] text-[var(--pub-green-deep)]">Primary health care</p>
        <h1 className="font-display mt-2 text-4xl font-semibold tracking-tight sm:text-5xl">The first stop for most patients</h1>
        <p className="mt-4 text-lg leading-relaxed text-[var(--pub-ink-2)]">
          Primary health care centres are where most people in Kano are seen first. Since 2025 the State&apos;s reports include a
          section on the Primary Health Care Management Board: what it spends by type and programme, and on each capital project.
        </p>
      </Reveal>
      {reports.length ? (
        <div className="mt-10">
          <PhcView reports={reports} />
        </div>
      ) : (
        <p className="mt-10 text-[var(--pub-muted)]">No report with a primary health care section has been published yet.</p>
      )}
    </div>
  );
}
