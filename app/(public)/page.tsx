import Link from "next/link";
import { ArrowRightIcon, BookOpenIcon, DownloadIcon, StethoscopeIcon } from "lucide-react";
import { AskHeroBox } from "@/components/public/ask-panel";
import { KanoMap } from "@/components/public/kano-map";
import { AskBand, KpiTiles, SpendingDonut, TopMdas, YearColumns } from "@/components/public/landing";
import { Reveal } from "@/components/public/motion";
import { SourceLink } from "@/components/public/source-link";
import { loadPublicDataset, reportPdfUrl } from "@/lib/public/dataset";
import {
  ECON_CLASSES,
  SECTOR_CODE,
  buildExplorerData,
  buildFacts,
  formatNairaShort,
  latestReport,
  lensRows,
  periodEnd,
  periodLabel,
  samePointHistory,
  sectorValue,
  stateHeadline,
} from "@/lib/public/model";

export const revalidate = 3600;

const FACT_COLORS = ["var(--pub-brand)", "var(--pub-accent)", "var(--pub-cyan)"];

export default async function PublicHomePage() {
  const ds = await loadPublicDataset();
  const data = buildExplorerData(ds, (r) => reportPdfUrl(r));
  const latest = latestReport(data);

  if (!latest) {
    return (
      <div className="mx-auto max-w-6xl px-4 py-20 sm:px-6">
        <h1 className="font-display text-5xl text-[var(--pub-navy)]">Kano Health Budget</h1>
        <p className="mt-4 max-w-xl text-[var(--pub-ink-2)]">
          Official figures will appear here once the first Budget Performance Report is published. Past reports are on the{" "}
          <Link className="underline" href="/reports">reports page</Link>.
        </p>
      </div>
    );
  }

  const { year, quarter } = latest;
  const sector = sectorValue(data, year, quarter, "mda", "total");
  const state = stateHeadline(ds, latest, latest.pdf);
  const facts = buildFacts(data, year, quarter);
  const mdaRows = lensRows(data, year, quarter, "mda", "total").filter((r) => (r.value.budget ?? 0) > 0);
  const slices = ECON_CLASSES.map((cls) => {
    const v = sectorValue(data, year, quarter, "mda", cls);
    return { cls, budget: v?.budget ?? 0, spent: v?.ytd ?? 0, share: v?.share ?? null };
  });
  const history = samePointHistory(data, quarter, "mda", "total", SECTOR_CODE.mda)
    .filter((h) => h.value)
    .map((h) => ({ year: h.year, budget: h.value!.budget ?? 0, spent: h.value!.ytd ?? 0, share: h.value!.share }));
  const periodShort = periodLabel(year, quarter, true).replace(` ${year}`, "");
  const healthShare = sector?.budget && state.totalBudget ? sector.budget / state.totalBudget : null;

  return (
    <>
      {/* HERO */}
      <section className="relative overflow-hidden bg-[var(--pub-navy)] text-white">
        <div aria-hidden className="pointer-events-none absolute inset-0 bg-[radial-gradient(900px_500px_at_85%_20%,rgba(20,176,200,0.35),transparent_60%),radial-gradient(700px_400px_at_10%_110%,rgba(255,122,46,0.25),transparent_60%)]" />
        <div aria-hidden className="pointer-events-none absolute inset-0 opacity-[0.07] [background-image:radial-gradient(#ffffff_1px,transparent_1px)] [background-size:22px_22px]" />
        <div className="relative mx-auto grid max-w-6xl gap-10 px-4 pb-28 pt-12 sm:px-6 sm:pt-16 lg:grid-cols-[1.15fr_1fr] lg:items-center">
          <div>
            <Reveal>
              <p className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.12em] text-[var(--pub-aqua)] ring-1 ring-white/15">
                Kano State · health budget · {periodLabel(year, quarter)}
              </p>
              <h1 className="font-display mt-5 text-[2.6rem] leading-[1.04] sm:text-6xl lg:text-[4.2rem]">
                <span className="text-[var(--pub-aqua)]">{formatNairaShort(sector?.budget)}</span> for health in {year}.{" "}
                <span className="text-[var(--pub-accent)]">{formatNairaShort(sector?.ytd)}</span> spent by {periodEnd(quarter).replace("the end of ", "")}.
              </h1>
              <p className="mt-5 max-w-xl text-lg leading-relaxed text-white/80">
                Official figures from Kano State&apos;s own budget reports, made simple. See where the money goes, and ask anything.
              </p>
            </Reveal>
            <Reveal delay={0.1} className="mt-7 max-w-xl">
              <AskHeroBox />
            </Reveal>
            <Reveal delay={0.15} className="mt-6 flex flex-wrap gap-3">
              <Link href="/explore" className="inline-flex items-center gap-2 rounded-full bg-white px-5 py-2.5 text-sm font-semibold text-[var(--pub-navy)] transition hover:bg-[var(--pub-aqua)]">
                Explore the numbers <ArrowRightIcon className="size-4" />
              </Link>
              <Link href="/reports" className="inline-flex items-center gap-2 rounded-full px-5 py-2.5 text-sm font-semibold text-white ring-1 ring-white/30 transition hover:bg-white/10">
                <DownloadIcon className="size-4" /> Official reports
              </Link>
            </Reveal>
          </div>
          <div className="relative">
            <KanoMap className="mx-auto w-full max-w-[26rem] lg:max-w-[30rem]" />
            <div className="pointer-events-none absolute bottom-4 left-0 rounded-2xl bg-white/10 px-4 py-3 ring-1 ring-white/15 backdrop-blur sm:left-4">
              <p className="font-display text-3xl leading-none text-white">44</p>
              <p className="text-xs text-white/75">local government areas</p>
            </div>
          </div>
        </div>
      </section>

      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        {/* TILES, overlapping the hero */}
        <div className="relative -mt-20">
          <KpiTiles
            budget={sector?.budget ?? null}
            spent={sector?.ytd ?? null}
            share={sector?.share ?? null}
            healthShare={healthShare}
            periodShort={periodShort}
            mdaCount={mdaRows.length}
            source={sector?.source ?? null}
          />
        </div>

        <Section eyebrow="Where the money goes" title="Salaries, running costs and projects" lede="Each type of spending is budgeted, and spent, at a very different pace.">
          <SpendingDonut slices={slices} total={sector?.budget ?? 0} source={sector?.source ?? null} />
        </Section>

        {facts.length ? (
          <Section eyebrow={`To ${periodEnd(quarter)} ${year}`} title={`${facts.length} things to know`}>
            <div role="list" className="grid gap-4 md:grid-cols-3">
              {facts.map((f, i) => (
                <Reveal key={f.title} delay={i * 0.08} className="h-full">
                  <div role="listitem" className="relative flex h-full flex-col gap-3 overflow-hidden rounded-3xl bg-white p-6 shadow-[0_10px_30px_-18px_rgba(6,61,79,0.35)] ring-1 ring-[var(--pub-line)]">
                    <span aria-hidden className="absolute inset-x-0 top-0 h-1.5" style={{ background: FACT_COLORS[i % FACT_COLORS.length] }} />
                    <span className="font-display text-5xl leading-none" style={{ color: FACT_COLORS[i % FACT_COLORS.length] }}>
                      {i + 1}
                    </span>
                    <p className="font-display text-2xl leading-snug text-[var(--pub-navy)]">{f.title}</p>
                    <p className="text-sm leading-relaxed text-[var(--pub-ink-2)]">{f.body}</p>
                    {f.source ? (
                      <p className="mt-auto pt-2 text-xs">
                        <SourceLink source={f.source} />
                      </p>
                    ) : null}
                  </div>
                </Reveal>
              ))}
            </div>
          </Section>
        ) : null}

        <Section eyebrow="Who holds the budget" title="Health MDAs at a glance" lede="The ministries, boards and agencies that hold the health budget, and how much of it they have spent so far.">
          <TopMdas
            quarter={quarter}
            rows={mdaRows.map((r) => ({
              code: r.entity.code,
              name: r.entity.name,
              short: r.entity.short,
              budget: r.value.budget ?? 0,
              spent: r.value.ytd ?? 0,
              share: r.value.share,
            }))}
          />
        </Section>

        {history.length > 1 ? (
          <Section eyebrow="Over the years" title={`By ${periodEnd(quarter).replace("the end of ", "end of ")}, year by year`} lede="The same point in each year, so the comparison is like for like.">
            <YearColumns years={history} current={year} />
          </Section>
        ) : null}

        <div className="mt-20">
          <AskBand />
        </div>

        <div className="mt-10 grid gap-4 md:grid-cols-3">
          <QuickLink href="/phc" color="var(--pub-brand)" icon={<StethoscopeIcon className="size-5" />} title="Primary health care" body="Immunisation, family planning, nutrition and more." />
          <QuickLink href="/reports" color="var(--pub-accent)" icon={<BookOpenIcon className="size-5" />} title="Every report since 2019" body="Browse and download the State's Budget Performance Reports." />
          <QuickLink href="/data" color="var(--pub-cyan)" icon={<DownloadIcon className="size-5" />} title="Open data" body="Download every figure (CSV or JSON), free to reuse." />
        </div>
      </div>
    </>
  );
}

function Section({ eyebrow, title, lede, children }: { eyebrow: string; title: string; lede?: string; children: React.ReactNode }) {
  return (
    <section className="mt-20">
      <Reveal className="mb-7 max-w-3xl">
        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[var(--pub-accent-deep)]">{eyebrow}</p>
        <h2 className="font-display mt-2 text-4xl leading-tight text-[var(--pub-navy)] sm:text-5xl">{title}</h2>
        {lede ? <p className="mt-3 text-lg leading-relaxed text-[var(--pub-ink-2)]">{lede}</p> : null}
      </Reveal>
      {children}
    </section>
  );
}

function QuickLink({ href, icon, title, body, color }: { href: string; icon: React.ReactNode; title: string; body: string; color: string }) {
  return (
    <Link href={href} className="group flex items-start gap-4 rounded-3xl bg-white p-5 ring-1 ring-[var(--pub-line)] transition hover:-translate-y-0.5 hover:shadow-[0_14px_30px_-18px_rgba(6,61,79,0.45)]">
      <span className="inline-flex size-11 shrink-0 items-center justify-center rounded-2xl text-white" style={{ background: color }}>
        {icon}
      </span>
      <span>
        <span className="font-display block text-xl text-[var(--pub-navy)]">{title}</span>
        <span className="block text-sm text-[var(--pub-ink-2)]">{body}</span>
        <span className="mt-2 inline-flex items-center gap-1 text-sm font-semibold text-[var(--pub-brand-deep)]">
          Open <ArrowRightIcon className="size-4 transition group-hover:translate-x-0.5" />
        </span>
      </span>
    </Link>
  );
}
