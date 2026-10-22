import type { Metadata } from "next";
import { BudgetBar } from "@/components/public/budget-bar";
import { Explorer } from "@/components/public/explorer";
import { PageHero } from "@/components/public/page-hero";
import { Reveal } from "@/components/public/motion";
import { SourceLink } from "@/components/public/source-link";
import { loadPublicDataset, reportPdfUrl } from "@/lib/public/dataset";
import { barLabel, buildExplorerData, formatNairaShort, formatShare, latestReport, lensRows, periodLabel, sectorValue } from "@/lib/public/model";

export const revalidate = 3600;

export const metadata: Metadata = {
  title: "Explore the numbers",
  description: "Kano State health budget and spending by MDA, programme and function, by type of spending and year.",
};

export default async function ExplorePage() {
  const ds = await loadPublicDataset();
  const data = buildExplorerData(ds, (r) => reportPdfUrl(r));
  const latest = latestReport(data);

  return (
    <>
      <PageHero eyebrow="Explore" title="All the numbers, your way">
        Look at health spending by MDA, programme or function; pick a type of spending and a period; or compare the same point
        across years.
      </PageHero>

      <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
        {latest ? <Explorer data={data} initialYear={latest.year} initialQuarter={latest.quarter} /> : <p>No published figures yet.</p>}
        {latest ? <MoneyIn data={data} year={latest.year} quarter={latest.quarter} /> : null}
      </div>
    </>
  );
}

function MoneyIn({ data, year, quarter }: { data: ReturnType<typeof buildExplorerData>; year: number; quarter: number }) {
  const revenue = sectorValue(data, year, quarter, "revenue", "total");
  if (!revenue) return null;
  const rows = lensRows(data, year, quarter, "revenue", "total").slice(0, 8);
  const max = Math.max(0, ...rows.map((r) => Math.max(r.value.budget ?? 0, r.value.ytd ?? 0)));
  return (
    <section className="mt-20">
      <Reveal className="mb-6 max-w-3xl">
        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[var(--pub-accent-deep)]">Money in</p>
        <h2 className="font-display mt-2 text-4xl text-[var(--pub-navy)]">Revenue the health MDAs expected and collected</h2>
        <p className="mt-3 text-lg text-[var(--pub-ink-2)]">
          Fees, contributions, grants and other income. The report gives one total per MDA; it does not separate fees from grants or
          donor aid.
        </p>
      </Reveal>
      <div className="grid gap-4 lg:grid-cols-[18rem_1fr]">
        <div className="rounded-3xl bg-[var(--pub-accent-deep)] p-6 text-white">
          <p className="text-xs font-semibold uppercase tracking-[0.1em] text-white/80">Health revenue, {periodLabel(year, quarter, true)}</p>
          <p className="font-display mt-2 text-5xl">{formatNairaShort(revenue.ytd)}</p>
          <p className="text-white/85">
            collected of {formatNairaShort(revenue.budget)} expected · {formatShare(revenue.share)}
          </p>
          <p className="mt-5 text-xs [&_a]:text-white/80 [&_a]:decoration-white/30">
            <SourceLink source={revenue.source} />
          </p>
        </div>
        <ul className="space-y-3 rounded-3xl bg-white p-5 ring-1 ring-[var(--pub-line)]">
          {rows.map((r) => (
            <li key={r.entity.code} className="grid gap-1.5 sm:grid-cols-[12rem_1fr_11rem] sm:items-center">
              <span className="truncate text-sm font-semibold">{r.entity.short}</span>
              <BudgetBar
                budget={r.value.budget}
                spent={r.value.ytd}
                maxBudget={max}
                color="var(--pub-accent)"
                trackColor="var(--pub-accent-soft)"
                label={barLabel(`${r.entity.name} revenue`, r.value.budget, r.value.ytd, r.value.share)}
              />
              <span className="text-xs tabular-nums text-[var(--pub-muted)] sm:text-right">
                {formatNairaShort(r.value.ytd)} of {formatNairaShort(r.value.budget)} · {formatShare(r.value.share)}
              </span>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
