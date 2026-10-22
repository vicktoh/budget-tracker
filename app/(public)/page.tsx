import Link from "next/link";
import { ArrowRightIcon, BookOpenIcon, MessageCircleQuestionIcon, StethoscopeIcon } from "lucide-react";
import { AskHeroBox } from "@/components/public/ask-panel";
import { Explorer } from "@/components/public/explorer";
import { ClassStrip, HeadlineCards } from "@/components/public/headline";
import { CLASS_LABEL } from "@/lib/public/labels";
import { BudgetBar } from "@/components/public/budget-bar";
import { Reveal } from "@/components/public/motion";
import { SourceLink } from "@/components/public/source-link";
import { loadPublicDataset, reportPdfUrl } from "@/lib/public/dataset";
import {
  barLabel,
  ECON_CLASSES,
  SECTOR_CODE,
  buildExplorerData,
  buildFacts,
  formatNairaShort,
  formatShare,
  latestReport,
  lensRows,
  periodEnd,
  periodLabel,
  samePointHistory,
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
      <Shell>
        <h1 className="font-display text-4xl font-semibold">Kano Health Budget</h1>
        <p className="mt-4 max-w-xl text-[var(--pub-ink-2)]">
          Official figures will appear here once the first Budget Performance Report is published. Past reports are available
          on the <Link className="underline" href="/reports">reports page</Link>.
        </p>
      </Shell>
    );
  }

  const { year, quarter } = latest;
  const sector = sectorValue(data, year, quarter, "mda", "total");
  const state = stateHeadline(ds, latest, latest.pdf);
  const facts = buildFacts(data, year, quarter);
  const mdaCount = lensRows(data, year, quarter, "mda", "total").filter((r) => (r.value.budget ?? 0) > 0).length;
  const classes = ECON_CLASSES.map((cls) => {
    const v = sectorValue(data, year, quarter, "mda", cls);
    return { cls, label: CLASS_LABEL[cls], budget: v?.budget ?? null, spent: v?.ytd ?? null, share: v?.share ?? null };
  });
  const history = samePointHistory(data, quarter, "mda", "total", SECTOR_CODE.mda).filter((h) => h.value);
  const historyMax = Math.max(0, ...history.map((h) => Math.max(h.value?.budget ?? 0, h.value?.ytd ?? 0)));
  const revenue = sectorValue(data, year, quarter, "revenue", "total");
  const revenueRows = lensRows(data, year, quarter, "revenue", "total").slice(0, 8);
  const revenueMax = Math.max(0, ...revenueRows.map((r) => Math.max(r.value.budget ?? 0, r.value.ytd ?? 0)));
  const period = periodLabel(year, quarter);

  return (
    <>
      <section className="border-b border-[var(--pub-line)] bg-[radial-gradient(1200px_500px_at_10%_-10%,#dff0e5_0%,transparent_60%),radial-gradient(900px_420px_at_100%_0%,#f3e9dc_0%,transparent_55%)]">
        <div className="mx-auto max-w-6xl px-4 pb-12 pt-12 sm:px-6 sm:pt-16">
          <Reveal>
            <p className="text-xs font-semibold uppercase tracking-[0.12em] text-[var(--pub-green-deep)]">
              Kano State · Health sector · {period}
            </p>
            <h1 className="font-display mt-3 max-w-4xl text-[2.35rem] font-semibold leading-[1.08] tracking-tight sm:text-6xl">
              {formatNairaShort(sector?.budget)} for health in {year}.{" "}
              <span className="text-[var(--pub-green)]">{formatNairaShort(sector?.ytd)} spent</span> by {periodEnd(quarter)}.
            </h1>
            <p className="mt-5 max-w-2xl text-base leading-relaxed text-[var(--pub-ink-2)] sm:text-lg">
              Official figures from the Kano State {latest.title.replace(/^Kano State /, "")}, covering every health ministry,
              department and agency. Each number links to the page of the report it comes from.
            </p>
          </Reveal>
          <Reveal delay={0.1} className="mt-7 max-w-3xl">
            <AskHeroBox />
          </Reveal>
          <div className="mt-10">
            <HeadlineCards
              periodLabel={periodLabel(year, quarter, true).replace(` ${year}`, "")}
              budget={sector?.budget ?? null}
              spent={sector?.ytd ?? null}
              share={sector?.share ?? null}
              stateBudget={state.totalBudget}
              stateSpent={state.totalSpent}
              mdaCount={mdaCount}
              source={sector?.source ?? null}
              stateSource={state.source}
              classes={classes}
            />
          </div>
        </div>
      </section>

      <Shell>
        <SectionTitle eyebrow="Where the budget goes" title="By type of spending" lede="Salaries, running costs and capital projects are budgeted — and spent — at very different rates." />
        <ClassStrip classes={classes} total={sector?.budget ?? null} />

        {facts.length ? (
          <div className="mt-16">
            <SectionTitle eyebrow={`To ${periodEnd(quarter)} ${year}`} title={`${facts.length} things to know`} />
            <div role="list" className="grid gap-4 md:grid-cols-3">
              {facts.map((f, i) => (
                <Reveal key={f.title} delay={i * 0.08} className="h-full">
                  <div role="listitem" className="flex h-full flex-col gap-3 rounded-2xl border border-[var(--pub-line)] bg-white p-5">
                    <span className="font-display text-3xl font-semibold text-[var(--pub-green)]">{i + 1}</span>
                    <p className="font-display text-xl font-semibold leading-snug">{f.title}</p>
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
          </div>
        ) : null}

        <div id="explore" className="mt-20 scroll-mt-24">
          <SectionTitle
            eyebrow="Explore"
            title="Who has the money, and how much they have spent"
            lede="Choose how to cut the health budget, the type of spending and the period. Open a row to see its breakdown and the same point in other years."
          />
          <Explorer data={data} initialYear={year} initialQuarter={quarter} />
        </div>

        {history.length > 1 ? (
          <div className="mt-20">
            <SectionTitle
              eyebrow="Over the years"
              title={`Health budget and spending, ${periodLabel(year, quarter, true).replace(` ${year}`, "")} each year`}
              lede="The same point in each year, so the comparison is like for like. Nominal naira, not adjusted for inflation."
            />
            <ul className="space-y-4 rounded-2xl border border-[var(--pub-line)] bg-white p-5">
              {history.map((h) => (
                <li key={h.year} className="grid gap-2 sm:grid-cols-[5rem_1fr_14rem] sm:items-center">
                  <span className="font-display text-xl font-semibold">{h.year}</span>
                  <BudgetBar
                    budget={h.value!.budget}
                    spent={h.value!.ytd}
                    maxBudget={historyMax}
                    height={16}
                    label={barLabel(`Health sector ${h.year}`, h.value!.budget, h.value!.ytd, h.value!.share)}
                  />
                  <span className="text-sm tabular-nums text-[var(--pub-ink-2)] sm:text-right">
                    <strong className="text-[var(--pub-ink)]">{formatNairaShort(h.value!.ytd)}</strong> of {formatNairaShort(h.value!.budget)} ·{" "}
                    {formatShare(h.value!.share)}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        ) : null}

        {revenue ? (
          <div className="mt-20">
            <SectionTitle
              eyebrow="Money in"
              title="Revenue the health MDAs expected and collected"
              lede="Fees, contributions, grants and other income budgeted to health MDAs. The report gives one total per MDA; it does not separate fees from grants or donor aid."
            />
            <div className="grid gap-4 lg:grid-cols-[18rem_1fr]">
              <div className="rounded-2xl border border-[var(--pub-line)] bg-[var(--pub-clay)] p-5">
                <p className="text-xs font-semibold uppercase tracking-[0.08em] text-[var(--pub-earth)]">Health revenue, {periodLabel(year, quarter, true)}</p>
                <p className="font-display mt-2 text-4xl font-semibold">{formatNairaShort(revenue.ytd)}</p>
                <p className="text-sm text-[var(--pub-ink-2)]">
                  collected of {formatNairaShort(revenue.budget)} expected · {formatShare(revenue.share)}
                </p>
                <p className="mt-4 text-xs">
                  <SourceLink source={revenue.source} />
                </p>
              </div>
              <ul className="space-y-3 rounded-2xl border border-[var(--pub-line)] bg-white p-5">
                {revenueRows.map((r) => (
                  <li key={r.entity.code} className="grid gap-1.5 sm:grid-cols-[12rem_1fr_11rem] sm:items-center">
                    <span className="truncate text-sm font-semibold">{r.entity.short}</span>
                    <BudgetBar
                      budget={r.value.budget}
                      spent={r.value.ytd}
                      maxBudget={revenueMax}
                      color="var(--pub-earth)"
                      trackColor="var(--pub-clay)"
                      label={barLabel(`${r.entity.name} revenue`, r.value.budget, r.value.ytd, r.value.share)}
                    />
                    <span className="text-xs tabular-nums text-[var(--pub-muted)] sm:text-right">
                      {formatNairaShort(r.value.ytd)} of {formatNairaShort(r.value.budget)} · {formatShare(r.value.share)}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        ) : null}

        <div className="mt-20 grid gap-4 md:grid-cols-3">
          <Teaser href="/phc" icon={<StethoscopeIcon className="size-5" />} title="Primary health care" body="PHC Board spending by programme, by type and by named capital project." />
          <Teaser href="/ask" icon={<MessageCircleQuestionIcon className="size-5" />} title="Ask the data" body="Ask a question in English or Hausa and get an answer, with a chart and sources, from the published figures." />
          <Teaser href="/reports" icon={<BookOpenIcon className="size-5" />} title="Every report since 2019" body="Browse and download all of the State's quarterly Budget Performance Reports." />
        </div>
      </Shell>
    </>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return <div className="mx-auto max-w-6xl px-4 py-14 sm:px-6">{children}</div>;
}

function SectionTitle({ eyebrow, title, lede }: { eyebrow: string; title: string; lede?: string }) {
  return (
    <Reveal className="mb-6 max-w-3xl">
      <p className="text-xs font-semibold uppercase tracking-[0.12em] text-[var(--pub-green-deep)]">{eyebrow}</p>
      <h2 className="font-display mt-2 text-3xl font-semibold leading-tight tracking-tight sm:text-4xl">{title}</h2>
      {lede ? <p className="mt-3 text-base leading-relaxed text-[var(--pub-ink-2)]">{lede}</p> : null}
    </Reveal>
  );
}

function Teaser({ href, icon, title, body }: { href: string; icon: React.ReactNode; title: string; body: string }) {
  return (
    <Link href={href} className="group flex flex-col gap-3 rounded-2xl border border-[var(--pub-line)] bg-white p-5 transition hover:-translate-y-0.5 hover:border-[var(--pub-green)] hover:shadow-[0_8px_30px_rgba(22,122,74,0.08)]">
      <span className="inline-flex size-10 items-center justify-center rounded-xl bg-[var(--pub-mint)] text-[var(--pub-green-deep)]">{icon}</span>
      <span className="font-display text-xl font-semibold">{title}</span>
      <span className="text-sm text-[var(--pub-ink-2)]">{body}</span>
      <span className="mt-auto inline-flex items-center gap-1 text-sm font-semibold text-[var(--pub-green-deep)]">
        Open <ArrowRightIcon className="size-4 transition group-hover:translate-x-0.5" />
      </span>
    </Link>
  );
}
