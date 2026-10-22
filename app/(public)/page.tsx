import Link from "next/link";
import { ArrowRightIcon, BookOpenIcon, DownloadIcon, StethoscopeIcon } from "lucide-react";
import { KanoMap } from "@/components/public/kano-map";
import { AskBand, KpiTiles, SpendingDonut, TopMdas, YearColumns } from "@/components/public/landing";
import { Reveal } from "@/components/public/motion";
import { loadPublicDataset, reportPdfUrl } from "@/lib/public/dataset";
import { yearByYear } from "@/lib/public/history";
import {
  ECON_CLASSES,
  buildExplorerData,
  latestReport,
  lensRows,
  periodEnd,
  periodLabel,
  sectorValue,
  stateHeadline,
} from "@/lib/public/model";

export const revalidate = 3600;

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
  const mdaRows = lensRows(data, year, quarter, "mda", "total").filter((r) => (r.value.budget ?? 0) > 0);
  const slices = ECON_CLASSES.map((cls) => {
    const v = sectorValue(data, year, quarter, "mda", cls);
    return { cls, budget: v?.budget ?? 0, spent: v?.ytd ?? 0, share: v?.share ?? null };
  });
  const history = yearByYear(data, year, quarter, (slug) => {
    const report = ds.reports.find((r) => r.slug === slug);
    return report ? reportPdfUrl(report) : null;
  });
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
                Kano State health budget tracker
              </p>
              <h1 className="font-display mt-5 text-[2.6rem] leading-[1.04] sm:text-6xl lg:text-[4.2rem]">
                Your <span className="text-[var(--pub-aqua)]">health budget</span>, in{" "}
                <span className="text-[var(--pub-accent)]">plain numbers</span>.
              </h1>
              <p className="mt-5 max-w-xl text-lg leading-relaxed text-white/80">
                Kano State&apos;s health budget and spending, made simple: where the money is planned, where it has gone, and what is
                still to be spent.
              </p>
            </Reveal>
            <Reveal delay={0.1} className="mt-8 flex flex-wrap gap-3">
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

        <Section
          eyebrow="Who holds the budget"
          title="Health MDAs at a glance"
          lede={`Budget performance is the share of its yearly budget an MDA has spent, here up to ${periodEnd(quarter)} — the same measure the State's Budget Performance Reports use. "Highest performing" are the MDAs that have spent the largest share so far; "lowest performing", the smallest. It tracks spending progress, not the quality of services.`}
        >
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
          <Section
            eyebrow="Over the years"
            title="Year by year"
            lede={`Each year's health budget and what was spent by the end of that year.${
              quarter < 4 ? ` ${year} shows spending so far, up to the latest published quarter.` : ""
            }`}
          >
            <YearColumns years={history} current={year} />
          </Section>
        ) : null}

        <div className="mt-20">
          <AskBand />
        </div>

        <div className="mt-10 grid gap-4 md:grid-cols-3">
          <QuickLink href="/phc" color="var(--pub-brand)" icon={<StethoscopeIcon className="size-5" />} title="Health programmes" body="Immunisation, malaria, nutrition and more, across every MDA." />
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
