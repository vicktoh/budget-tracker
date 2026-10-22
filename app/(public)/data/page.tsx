import type { Metadata } from "next";
import { DownloadIcon } from "lucide-react";
import { PageHero } from "@/components/public/page-hero";
import { SourceLink } from "@/components/public/source-link";
import { loadPublicDataset, reportPdfUrl } from "@/lib/public/dataset";
import { CLASS_LABEL } from "@/lib/public/labels";
import {
  ECON_CLASSES,
  buildExplorerData,
  formatNairaFull,
  formatShare,
  latestReport,
  lensRows,
  periodLabel,
  sectorValue,
  valueAt,
} from "@/lib/public/model";

export const revalidate = 3600;

export const metadata: Metadata = {
  title: "Open data",
  description: "Download Kano State health budget figures (CSV or JSON, CC BY 4.0) and read how they are checked.",
};

export default async function DataPage() {
  const ds = await loadPublicDataset();
  const data = buildExplorerData(ds, (r) => reportPdfUrl(r));
  const latest = latestReport(data);
  const notes = ds.reports.filter((r) => r.data_note).sort((a, b) => a.fiscal_year - b.fiscal_year || a.quarter - b.quarter);
  const derivedNotes = [...new Set(ds.figures.filter((f) => f.note).map((f) => f.note!))];
  const rows = latest ? lensRows(data, latest.year, latest.quarter, "mda", "total") : [];
  const sector = latest ? sectorValue(data, latest.year, latest.quarter, "mda", "total") : null;

  return (
    <>
      <PageHero eyebrow="Open data" title="Take the data with you">
        Every figure on this site, with the report, table and page it comes from. Free to reuse under{" "}
        <a className="underline underline-offset-2" href="https://creativecommons.org/licenses/by/4.0/" target="_blank" rel="license noopener">
          CC BY 4.0
        </a>{" "}
        — please credit &ldquo;Kano State Government, Budget Performance Reports, via kanohealthbudget.org&rdquo;.
      </PageHero>
    <div className="mx-auto max-w-6xl px-4 pb-14 pt-8 sm:px-6">
        <div className="flex flex-wrap gap-3">
          <a href="/api/public/dataset?format=csv" className="inline-flex items-center gap-2 rounded-md bg-[var(--pub-brand)] px-4 py-2.5 text-sm font-medium text-white hover:bg-[var(--pub-brand-deep)]">
            <DownloadIcon className="size-4" aria-hidden /> All figures (CSV)
          </a>
          <a href="/api/public/dataset?format=json" className="inline-flex items-center gap-2 rounded-md border border-[var(--pub-line)] bg-white px-4 py-2.5 text-sm font-medium hover:border-[var(--pub-ink-2)]">
            <DownloadIcon className="size-4" aria-hidden /> All figures (JSON)
          </a>
        </div>


      {latest && sector ? (
        <section className="mt-14" aria-labelledby="table-view">
          <h2 id="table-view" className="font-display text-2xl font-semibold">
            Table view · health MDAs, {periodLabel(latest.year, latest.quarter)}
          </h2>
          <p className="mt-2 text-sm text-[var(--pub-muted)]">Budget and spending so far, and the share spent by type. Amounts in naira.</p>
          <div className="mt-4 overflow-x-auto rounded-2xl border border-[var(--pub-line)] bg-white">
            <table className="w-full min-w-[56rem] text-sm">
              <thead className="bg-[var(--pub-canvas)] text-left text-xs uppercase tracking-[0.06em] text-[var(--pub-muted)]">
                <tr>
                  <th className="min-w-[16rem] px-4 py-3 font-semibold">MDA</th>
                  <th className="px-4 py-3 text-right font-semibold">Budget</th>
                  <th className="px-4 py-3 text-right font-semibold">Spent</th>
                  <th className="px-4 py-3 text-right font-semibold">% spent</th>
                  {ECON_CLASSES.map((c) => (
                    <th key={c} className="px-4 py-3 text-right font-semibold">
                      {CLASS_LABEL[c]} %
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--pub-line)] tabular-nums">
                {[{ entity: { code: "052100000000", name: "Health sector (all MDAs)", short: "Health sector", order: -1 }, value: sector }, ...rows].map((r) => (
                  <tr key={r.entity.code} className={r.entity.order === -1 ? "bg-[var(--pub-brand-soft)] font-semibold" : undefined}>
                    <td className="px-4 py-2.5">{r.entity.name}</td>
                    <td className="px-4 py-2.5 text-right">{formatNairaFull(r.value.budget)}</td>
                    <td className="px-4 py-2.5 text-right">{formatNairaFull(r.value.ytd)}</td>
                    <td className="px-4 py-2.5 text-right">{formatShare(r.value.share)}</td>
                    {ECON_CLASSES.map((c) => {
                      const v = valueAt(data, latest.year, latest.quarter, "mda", c, r.entity.code);
                      return (
                        <td key={c} className="px-4 py-2.5 text-right text-[var(--pub-ink-2)]">
                          {v && (v.budget ?? 0) > 0 ? formatShare(v.share) : "—"}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="mt-2 text-xs">
            <SourceLink source={sector.source} />
          </p>
        </section>
      ) : null}

      <section id="method" className="mt-16 scroll-mt-24 max-w-3xl space-y-5 text-[var(--pub-ink-2)]">
        <h2 className="font-display text-2xl font-semibold text-[var(--pub-ink)]">How the figures are checked</h2>
        <p>
          Each report is downloaded from budget.kn.gov.ng, stored unchanged (with its SHA-256 fingerprint) and read table by
          table. Only health-sector rows are kept — administrative codes beginning 0521, function 707 and programme 04 — plus the
          State&apos;s headline totals.
        </p>
        <ul className="list-disc space-y-2 pl-5">
          <li>Every row must reproduce the report&apos;s own &ldquo;% performance&rdquo; and &ldquo;balance&rdquo; columns.</li>
          <li>Each MDA&apos;s total must equal its personnel + overhead + capital + other spending, and the health total must equal the sum of the MDAs.</li>
          <li>A report&apos;s figures go on the site only when every check passes. For the current year, the quarter must also have been published by the State.</li>
          <li>&ldquo;% spent&rdquo; is year-to-date spending ÷ the year&apos;s original budget, the basis the reports use. Amounts are nominal naira (not adjusted for inflation).</li>
          <li>Flags are descriptive: amber marks less than 25% of the budget spent, shown from the second quarter.</li>
        </ul>
        {derivedNotes.length ? (
          <>
            <h3 className="font-display pt-2 text-xl font-semibold text-[var(--pub-ink)]">Values worked out from the reports</h3>
            <ul className="list-disc space-y-2 pl-5">
              {derivedNotes.map((n) => (
                <li key={n}>{n}</li>
              ))}
              <li>Where a quarter&apos;s own report is not on the site, its figures are worked out from the next quarter&apos;s report (year to date minus that quarter). Such values say so.</li>
            </ul>
          </>
        ) : null}
        {notes.length ? (
          <>
            <h3 className="font-display pt-2 text-xl font-semibold text-[var(--pub-ink)]">Reports whose figures are not on the site</h3>
            <ul className="space-y-2">
              {notes
                .filter((r) => r.fiscal_year >= 2023)
                .map((r) => (
                  <li key={r.slug}>
                    <strong className="text-[var(--pub-ink)]">{r.title.replace(/^Kano State /, "")}:</strong> {r.data_note}
                  </li>
                ))}
              <li>
                <strong className="text-[var(--pub-ink)]">2019–2022 reports:</strong> available to download; their figures have not been extracted yet.
              </li>
            </ul>
          </>
        ) : null}
      </section>
    </div>
    </>
  );
}
