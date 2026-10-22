import type { Metadata } from "next";
import Link from "next/link";
import { CheckCircle2Icon, ChevronDownIcon, DownloadIcon, ExternalLinkIcon, FileTextIcon, MegaphoneIcon } from "lucide-react";
import { PageHero } from "@/components/public/page-hero";
import { loadPublicBriefs, loadPublicDataset, type PublicBrief } from "@/lib/public/dataset";
import type { PublicReport } from "@/lib/public/types";

export const revalidate = 3600;

// "Briefs and analysis" is hidden until it is decided which reports belong
// there. Published briefs stay in public_briefs; flip this to list them again.
const SHOW_BRIEFS = false;

export const metadata: Metadata = {
  title: "Budget Performance Reports",
  description: "Every Kano State quarterly Budget Performance Report since 2019, to browse and download.",
};

function periodName(r: PublicReport) {
  if (r.full_year_only) return "Full year";
  return ["", "First quarter", "Second quarter", "Third quarter", "Fourth quarter"][r.quarter];
}

function size(bytes: number | null) {
  if (!bytes) return null;
  return bytes > 1e6 ? `${(bytes / 1e6).toFixed(1)} MB` : `${Math.round(bytes / 1e3)} KB`;
}

export default async function ReportsPage() {
  const [ds, briefs] = await Promise.all([loadPublicDataset(), SHOW_BRIEFS ? loadPublicBriefs() : Promise.resolve([] as PublicBrief[])]);
  const reports = [...ds.reports].sort((a, b) => b.fiscal_year - a.fiscal_year || b.quarter - a.quarter);
  const years = [...new Set(reports.map((r) => r.fiscal_year))];

  return (
    <>
      <PageHero eyebrow="Reports" title="Budget Performance Reports">
        The Kano State Ministry of Budget and Planning publishes a Budget Performance Report every quarter. All {reports.length} are
        here, copied unchanged from{" "}
        <a className="underline underline-offset-2" href="https://budget.kn.gov.ng/budget-performance-report/" target="_blank" rel="noopener">
          budget.kn.gov.ng
        </a>
        .
      </PageHero>
    <div className="mx-auto max-w-6xl px-4 pb-14 sm:px-6">

      {briefs.length ? (
        <section id="briefs" className="mt-10 scroll-mt-24" aria-labelledby="briefs-title">
          <h2 id="briefs-title" className="font-display text-3xl text-[var(--pub-navy)]">Briefs and analysis</h2>
          <p className="mt-2 max-w-2xl text-[var(--pub-ink-2)]">
            Plain-language briefs on what the official figures show, with recommendations and what to watch next.
          </p>
          <ul className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {briefs.map((b) => (
              <BriefCard key={b.id} brief={b} />
            ))}
          </ul>
        </section>
      ) : null}

      {briefs.length ? <h2 className="font-display mt-14 text-3xl text-[var(--pub-navy)]">The State&apos;s quarterly reports</h2> : null}
      <div className={briefs.length ? "mt-5 space-y-4" : "mt-10 space-y-4"}>
        {years.map((year, index) => {
          const yearReports = reports.filter((r) => r.fiscal_year === year);
          return (
          <details key={year} open={index === 0} className="group rounded-3xl border border-[var(--pub-line)] bg-white/60 open:bg-transparent open:border-transparent">
            <summary className="flex cursor-pointer list-none items-center gap-4 rounded-3xl px-5 py-4 transition hover:bg-white [&::-webkit-details-marker]:hidden">
              <h2 className="font-display text-3xl text-[var(--pub-navy)]">{year}</h2>
              <span className="text-sm text-[var(--pub-muted)]">
                {yearReports.length} {yearReports.length === 1 ? "report" : "reports"}
              </span>
              <ChevronDownIcon className="ml-auto size-5 text-[var(--pub-muted)] transition group-open:rotate-180" aria-hidden />
            </summary>
            <ul className="grid gap-3 px-1 pb-2 pt-2 sm:grid-cols-2 lg:grid-cols-4">
              {reports
                .filter((r) => r.fiscal_year === year)
                .sort((a, b) => a.quarter - b.quarter)
                .map((r) => (
                  <li key={r.slug} className="flex flex-col gap-3 rounded-2xl border border-[var(--pub-line)] bg-white p-4">
                    <div className="flex items-start gap-3">
                      <span className="flex h-14 w-11 shrink-0 items-center justify-center rounded-md border border-[var(--pub-line)] bg-[var(--pub-canvas)] text-[var(--pub-brand-deep)]">
                        <FileTextIcon className="size-5" aria-hidden />
                      </span>
                      <div className="min-w-0">
                        <p className="font-semibold">{periodName(r)}</p>
                        <p className="text-xs text-[var(--pub-muted)]">
                          {[r.page_count ? `${r.page_count} pages` : null, size(r.file_bytes)].filter(Boolean).join(" · ")}
                        </p>
                      </div>
                    </div>
                    {r.data_status === "published" ? (
                      <p className="inline-flex items-center gap-1.5 text-xs font-medium text-[var(--pub-brand-deep)]">
                        <CheckCircle2Icon className="size-3.5" aria-hidden /> Health figures on this site
                      </p>
                    ) : (
                      <p className="text-xs leading-relaxed text-[var(--pub-muted)]">{r.data_note ?? "PDF only."}</p>
                    )}
                    {r.source_note ? <p className="text-xs text-[var(--pub-muted)]">{r.source_note}</p> : null}
                    <div className="mt-auto flex flex-wrap gap-2 pt-1">
                      {r.storage_path ? (
                        <Link
                          href={`/reports/${r.slug}/pdf`}
                          prefetch={false}
                          className="inline-flex items-center gap-1.5 rounded-md bg-[var(--pub-brand)] px-3 py-2 text-sm font-medium text-white hover:bg-[var(--pub-brand-deep)]"
                        >
                          <DownloadIcon className="size-4" aria-hidden /> Download
                        </Link>
                      ) : null}
                      <a
                        href={r.source_url}
                        target="_blank"
                        rel="noopener"
                        className="inline-flex items-center gap-1.5 rounded-md border border-[var(--pub-line)] px-3 py-2 text-sm text-[var(--pub-ink-2)] hover:border-[var(--pub-ink-2)]"
                        title="The original file on the State Government website"
                      >
                        Original <ExternalLinkIcon className="size-3.5" aria-hidden />
                      </a>
                    </div>
                    {r.sha256 ? (
                      <details className="text-[11px] text-[var(--pub-muted)]">
                        <summary className="cursor-pointer">File fingerprint</summary>
                        <p className="mt-1 break-all font-mono">SHA-256 {r.sha256}</p>
                        <p className="mt-1">Matches the original file, so you can check the copy has not been changed.</p>
                      </details>
                    ) : null}
                  </li>
                ))}
            </ul>
          </details>
          );
        })}
      </div>
    </div>
    </>
  );
}

const QUARTER_MONTHS = ["", "January–March", "April–June", "July–September", "October–December"];

function BriefCard({ brief }: { brief: PublicBrief }) {
  const period = brief.quarter ? `Q${brief.quarter} ${brief.fiscal_year} · ${QUARTER_MONTHS[brief.quarter]}` : `Full year ${brief.fiscal_year}`;
  return (
    <li className="relative flex flex-col gap-3 overflow-hidden rounded-3xl bg-[var(--pub-navy)] p-5 text-white">
      <span aria-hidden className="pointer-events-none absolute -right-10 -top-10 size-36 rounded-full bg-white/10" />
      <div className="relative flex items-start gap-3">
        <span className="inline-flex size-11 shrink-0 items-center justify-center rounded-2xl bg-[var(--pub-accent)] text-[var(--pub-navy)]">
          <MegaphoneIcon className="size-5" aria-hidden />
        </span>
        <div className="min-w-0">
          <p className="font-display text-2xl leading-tight">{brief.title}</p>
          <p className="text-sm text-[var(--pub-aqua)]">{period}</p>
        </div>
      </div>
      <p className="relative text-sm text-white/80">
        Findings, plain-language interpretation, recommendations and a watchlist{brief.publisher ? `, prepared by ${brief.publisher}` : ""}.
      </p>
      <div className="relative mt-auto flex flex-wrap items-center gap-3 pt-1">
        <Link
          href={`/reports/briefs/${brief.id}/pdf`}
          prefetch={false}
          className="inline-flex items-center gap-1.5 rounded-full bg-white px-4 py-2 text-sm font-semibold text-[var(--pub-navy)] hover:bg-[var(--pub-aqua)]"
        >
          <DownloadIcon className="size-4" aria-hidden /> Download PDF
        </Link>
        <span className="text-xs text-white/70">
          Published {new Date(brief.published_at).toLocaleDateString("en-NG", { day: "numeric", month: "long", year: "numeric" })}
        </span>
      </div>
    </li>
  );
}
