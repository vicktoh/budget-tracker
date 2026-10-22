"use client";

import Link from "next/link";
import { useRef, useState } from "react";
import { motion, useInView } from "motion/react";
import { ArrowLeftRightIcon, ArrowRightIcon, Building2Icon, SparklesIcon, UsersIcon, ZapIcon, type LucideIcon } from "lucide-react";
import { useAsk } from "@/components/public/ask-context";
import { BudgetBar, SharePill } from "@/components/public/budget-bar";
import { CountUp, Reveal, Ring } from "@/components/public/motion";
import { SourceLink } from "@/components/public/source-link";
import { CLASS_COLOR, CLASS_HINT, CLASS_LABEL } from "@/lib/public/labels";
import { LOW_SPEND_THRESHOLD, barLabel, formatNairaShort, formatShare, sourceHref, sourceLabel, type Source } from "@/lib/public/model";
import type { EconClass } from "@/lib/public/types";
import { cn } from "@/lib/utils";

// ---------------------------------------------------------------------------
// Headline tiles: four solid colour blocks, one number each.

export function KpiTiles({
  budget,
  spent,
  share,
  healthShare,
  periodShort,
  mdaCount,
  source,
}: {
  budget: number | null;
  spent: number | null;
  share: number | null;
  healthShare: number | null;
  periodShort: string;
  mdaCount: number;
  source: Source | null;
}) {
  return (
    <div className="space-y-3">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Tile className="bg-[var(--pub-navy)]" delay={0}>
          <TileLabel>Health budget</TileLabel>
          <TileNumber>
            <CountUp value={budget} kind="naira" />
          </TileNumber>
          <TileNote>for {mdaCount} health MDAs</TileNote>
        </Tile>
        <Tile className="bg-[#00798c]" delay={0.06}>
          <TileLabel>Spent, {periodShort}</TileLabel>
          <TileNumber>
            <CountUp value={spent} kind="naira" />
          </TileNumber>
          <TileNote>{formatNairaShort(budget !== null && spent !== null ? budget - spent : null)} not yet spent</TileNote>
        </Tile>
        <Tile className="bg-[var(--pub-accent-deep)]" delay={0.12}>
          <TileLabel>Of the budget spent</TileLabel>
          <div className="flex items-center gap-3">
            <Ring fraction={share ?? 0} size={58} stroke={7} color="#ffffff" track="rgba(255,255,255,0.25)" />
            <TileNumber>
              <CountUp value={share} kind="percent" />
            </TileNumber>
          </div>
          <TileNote>spending so far ÷ the year&apos;s budget</TileNote>
        </Tile>
        <Tile className="bg-[#b73535]" delay={0.18}>
          <TileLabel>Health&apos;s share of the state budget</TileLabel>
          <TileNumber>
            <CountUp value={healthShare} kind="percent" />
          </TileNumber>
          <TileNote>Abuja Declaration target: 15%</TileNote>
        </Tile>
      </div>
      {source ? (
        <p className="text-xs">
          <SourceLink source={source} />
        </p>
      ) : null}
    </div>
  );
}

function Tile({ children, className, delay }: { children: React.ReactNode; className: string; delay: number }) {
  return (
    <Reveal delay={delay} className={cn("relative flex min-h-[10.5rem] flex-col gap-2 overflow-hidden rounded-3xl p-5 text-white shadow-[0_18px_40px_-20px_rgba(6,61,79,0.6)]", className)}>
      <span aria-hidden className="pointer-events-none absolute -right-10 -top-10 size-36 rounded-full bg-white/10" />
      <span aria-hidden className="pointer-events-none absolute -bottom-14 -right-4 size-28 rounded-full bg-white/5" />
      {children}
    </Reveal>
  );
}
const TileLabel = ({ children }: { children: React.ReactNode }) => (
  <p className="relative text-xs font-semibold uppercase tracking-[0.1em] text-white/80">{children}</p>
);
const TileNumber = ({ children }: { children: React.ReactNode }) => (
  <p className="font-display relative whitespace-nowrap text-[2.5rem] leading-none sm:text-[2.6rem] lg:text-[2.35rem] xl:text-[2.8rem]">{children}</p>
);
const TileNote = ({ children }: { children: React.ReactNode }) => <p className="relative mt-auto text-sm text-white/85">{children}</p>;

// ---------------------------------------------------------------------------
// Where the money goes: animated donut by spending type.

export type SpendSlice = { cls: EconClass; budget: number; spent: number; share: number | null };

const CLASS_ICON: Record<EconClass, LucideIcon> = {
  total: SparklesIcon,
  personnel: UsersIcon, // staff pay
  overhead: ZapIcon, // utilities, travel, supplies
  capital: Building2Icon, // buildings and equipment
  other: ArrowLeftRightIcon, // grants and transfers
};

export function SpendingDonut({ slices, total, source }: { slices: SpendSlice[]; total: number; source: Source | null }) {
  const ref = useRef<HTMLDivElement>(null);
  const seen = useInView(ref, { once: true, margin: "-10% 0px" });
  const [hover, setHover] = useState<EconClass | null>(null);
  const shown = slices.filter((s) => s.budget > 0);
  const sum = shown.reduce((a, s) => a + s.budget, 0) || 1;
  const R = 90;
  const C = 2 * Math.PI * R;
  const GAP = 3;
  let offset = 0;
  return (
    <div ref={ref} className="grid items-center gap-8 lg:grid-cols-[minmax(0,22rem)_1fr]">
      <div className="relative mx-auto aspect-square w-full max-w-[20rem]">
        <svg viewBox="0 0 220 220" className="h-full w-full -rotate-90" role="img" aria-label={shown.map((s) => `${CLASS_LABEL[s.cls]} ${formatShare(s.budget / sum)}`).join(", ")}>
          <circle cx="110" cy="110" r={R} fill="none" stroke="var(--pub-track)" strokeWidth="30" />
          {shown.map((s, i) => {
            const len = (s.budget / sum) * C;
            const dash = Math.max(len - GAP, 0.5);
            const el = (
              <motion.circle
                key={s.cls}
                cx="110"
                cy="110"
                r={R}
                fill="none"
                stroke={CLASS_COLOR[s.cls]}
                strokeWidth={hover === s.cls ? 36 : 30}
                strokeDashoffset={-offset}
                initial={{ strokeDasharray: `0 ${C}` }}
                animate={{ strokeDasharray: seen ? `${dash} ${C - dash}` : `0 ${C}` }}
                transition={{ duration: 1, delay: 0.15 * i, ease: [0.16, 1, 0.3, 1] }}
                onMouseEnter={() => setHover(s.cls)}
                onMouseLeave={() => setHover(null)}
                className="cursor-pointer transition-[stroke-width]"
              />
            );
            offset += len;
            return el;
          })}
        </svg>
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center text-center">
          <p className="text-xs font-semibold uppercase tracking-[0.1em] text-[var(--pub-muted)]">Budget</p>
          <p className="font-display text-4xl text-[var(--pub-navy)]">{formatNairaShort(total)}</p>
        </div>
      </div>
      <ul className="grid gap-3 sm:grid-cols-2">
        {shown.map((s) => (
          <li
            key={s.cls}
            onMouseEnter={() => setHover(s.cls)}
            onMouseLeave={() => setHover(null)}
            className={cn(
              "rounded-2xl border bg-white p-4 transition",
              hover === s.cls ? "border-[var(--pub-ink-2)] shadow-md" : "border-[var(--pub-line)]",
            )}
          >
            <div className="flex items-center gap-3">
              <ClassIcon cls={s.cls} />
              <p className="font-semibold">{CLASS_LABEL[s.cls]}</p>
              <p className="font-display ml-auto text-2xl" style={{ color: "var(--pub-navy)" }}>
                {formatShare(s.budget / sum)}
              </p>
            </div>
            <p className="mt-2 text-xs text-[var(--pub-muted)]">{CLASS_HINT[s.cls]}</p>
            <p className="mt-3 text-sm tabular-nums text-[var(--pub-ink-2)]">
              <strong className="text-[var(--pub-ink)]">{formatNairaShort(s.spent)}</strong> spent of {formatNairaShort(s.budget)} ·{" "}
              {formatShare(s.share)}
            </p>
          </li>
        ))}
        {source ? (
          <li className="text-xs sm:col-span-2">
            <SourceLink source={source} />
          </li>
        ) : null}
      </ul>
    </div>
  );
}

function ClassIcon({ cls }: { cls: EconClass }) {
  const Icon = CLASS_ICON[cls];
  const color = CLASS_COLOR[cls];
  return (
    <span
      aria-hidden
      className="inline-flex size-10 shrink-0 items-center justify-center rounded-xl"
      style={{ background: `color-mix(in srgb, ${color} 14%, white)`, color: `color-mix(in srgb, ${color} 82%, black)` }}
    >
      <Icon className="size-5" strokeWidth={2.2} />
    </span>
  );
}

// ---------------------------------------------------------------------------
// Who holds the budget: MDAs ranked by the share of their budget spent.

export type MdaBar = { code: string; name: string; short: string; budget: number; spent: number; share: number | null };

// Small budgets swing to 0% or 100%+ on a single payment; keep them out of the rankings.
const RANKING_MIN_BUDGET = 1e8;

export function TopMdas({ rows, quarter }: { rows: MdaBar[]; quarter: number }) {
  const [mode, setMode] = useState<"highest" | "lowest">("highest");
  const eligible = rows.filter((r) => r.budget >= RANKING_MIN_BUDGET && r.share !== null);
  const list = [...eligible]
    .sort((a, b) => (mode === "highest" ? (b.share ?? 0) - (a.share ?? 0) : (a.share ?? 0) - (b.share ?? 0)))
    .slice(0, 6);
  return (
    <div className="rounded-3xl border border-[var(--pub-line)] bg-white p-5 sm:p-6">
      <div className="mb-5 inline-flex rounded-full bg-[var(--pub-sand)] p-1" role="tablist" aria-label="Rank MDAs by budget performance (share of budget spent)">
        {(
          [
            ["highest", "Highest performing"],
            ["lowest", "Lowest performing"],
          ] as const
        ).map(([key, label]) => (
          <button
            key={key}
            role="tab"
            aria-selected={mode === key}
            onClick={() => setMode(key)}
            className={cn("relative rounded-full px-4 py-2 text-sm font-medium transition", mode === key ? "text-white" : "text-[var(--pub-ink-2)]")}
          >
            {mode === key ? <motion.span layoutId="top-mdas-tab" className="absolute inset-0 rounded-full bg-[var(--pub-navy)]" transition={{ type: "spring", bounce: 0.15, duration: 0.4 }} /> : null}
            <span className="relative">{label}</span>
          </button>
        ))}
      </div>
      <ul className="space-y-4">
        {list.map((r, i) => (
          <motion.li key={`${mode}-${r.code}`} layout initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.05 }} className="grid gap-1.5 sm:grid-cols-[13rem_1fr_14.5rem] sm:items-center sm:gap-4">
            <div className="min-w-0">
              <p className="truncate font-semibold">{r.short}</p>
              <p className="truncate text-xs text-[var(--pub-muted)]">{r.name}</p>
            </div>
            {/* Each bar is the MDA's own budget, so bars compare performance, not size. */}
            <BudgetBar budget={r.budget} spent={r.spent} maxBudget={r.budget} height={14} color="var(--pub-brand)" label={barLabel(r.name, r.budget, r.spent, r.share)} />
            <div className="flex items-center justify-between gap-3 sm:justify-end">
              <span className="text-sm tabular-nums text-[var(--pub-ink-2)]">
                {formatNairaShort(r.spent)} <span className="text-[var(--pub-muted)]">of {formatNairaShort(r.budget)}</span>
              </span>
              <SharePill share={r.share} flag={quarter >= 2 && r.share !== null && r.share < LOW_SPEND_THRESHOLD} />
            </div>
          </motion.li>
        ))}
      </ul>
      <div className="mt-6 flex flex-wrap items-center justify-between gap-3 border-t border-[var(--pub-line)] pt-5">
        <p className="text-sm text-[var(--pub-muted)]">
          Each bar is one MDA&apos;s own budget; the filled part is the share it has spent. MDAs with budgets of ₦100m or more.
        </p>
        <Link href="/explore" className="inline-flex items-center gap-2 rounded-full bg-[var(--pub-brand)] px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-[var(--pub-brand-deep)]">
          Explore all MDAs, programmes and years <ArrowRightIcon className="size-4" />
        </Link>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Same point each year: animated columns.

export type YearColumn = { year: number; budget: number; spent: number; share: number | null; partial?: string; source: Source | null };

export function YearColumns({ years, current }: { years: YearColumn[]; current: number }) {
  const ref = useRef<HTMLDivElement>(null);
  const seen = useInView(ref, { once: true, margin: "-10% 0px" });
  const max = Math.max(1, ...years.map((y) => Math.max(y.budget, y.spent)));
  return (
    <div ref={ref} className="rounded-3xl border border-[var(--pub-line)] bg-white p-5 sm:p-8">
      <div className="flex h-64 items-end justify-around gap-2 border-b border-[var(--pub-line)] pt-8 sm:h-72 sm:gap-4">
        {years.map((y, i) => {
          const isNow = y.year === current;
          return (
            <div key={y.year} className="relative h-full w-full max-w-[7rem]">
              <motion.p
                className={cn("absolute inset-x-0 text-center text-sm font-semibold tabular-nums", isNow ? "text-[var(--pub-accent-deep)]" : "text-[var(--pub-ink-2)]")}
                initial={{ bottom: 0, opacity: 0 }}
                animate={{ bottom: seen ? `calc(${(y.budget / max) * 100}% + 6px)` : 0, opacity: seen ? 1 : 0 }}
                transition={{ duration: 0.9, delay: i * 0.1, ease: [0.16, 1, 0.3, 1] }}
              >
                {formatShare(y.share)} spent
              </motion.p>
              <motion.div
                className="absolute inset-x-0 bottom-0 rounded-t-xl bg-[var(--pub-brand-soft)]"
                initial={{ height: 0 }}
                animate={{ height: seen ? `${(y.budget / max) * 100}%` : 0 }}
                transition={{ duration: 0.9, delay: i * 0.1, ease: [0.16, 1, 0.3, 1] }}
              />
              <motion.div
                className={cn("absolute inset-x-0 bottom-0 rounded-t-xl", isNow ? "bg-[var(--pub-accent)]" : "bg-[var(--pub-brand)]")}
                initial={{ height: 0 }}
                animate={{ height: seen ? `${(y.spent / max) * 100}%` : 0 }}
                transition={{ duration: 0.9, delay: 0.25 + i * 0.1, ease: [0.16, 1, 0.3, 1] }}
                title={`${y.year}: ${formatNairaShort(y.spent)} spent of ${formatNairaShort(y.budget)}`}
              />
            </div>
          );
        })}
      </div>
      <div className="mt-3 flex justify-around gap-2 sm:gap-4">
        {years.map((y) => (
          <div key={y.year} className="w-full max-w-[7rem] text-center">
            <p className="font-display text-2xl text-[var(--pub-navy)]">{y.year}</p>
            {y.partial ? <p className="text-[11px] font-semibold text-[var(--pub-accent-deep)]">{y.partial}</p> : null}
            <p className="text-xs tabular-nums text-[var(--pub-muted)]">
              {formatNairaShort(y.spent)} of {formatNairaShort(y.budget)}
            </p>
          </div>
        ))}
      </div>
      <div className="mt-5 flex flex-wrap gap-x-5 gap-y-1 text-xs text-[var(--pub-muted)]">
        <span className="inline-flex items-center gap-1.5">
          <span className="size-3 rounded bg-[var(--pub-brand-soft)] ring-1 ring-[var(--pub-line)]" /> Budget
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="size-3 rounded bg-[var(--pub-brand)]" /> Spent
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="size-3 rounded bg-[var(--pub-accent)]" /> Spent, {current}
        </span>
        <span>Nominal naira, not adjusted for inflation.</span>
      </div>
      <p className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-xs text-[var(--pub-muted)]">
        Sources:
        {years
          .filter((y) => y.source && sourceHref(y.source))
          .map((y) => (
            <a key={y.year} href={sourceHref(y.source!)!} target="_blank" rel="noopener" className="underline decoration-[var(--pub-line)] underline-offset-2 hover:text-[var(--pub-brand-deep)]">
              {sourceLabel(y.source!)}
            </a>
          ))}
      </p>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Ask AI band.

const BAND_EXAMPLES = [
  "Which MDAs have spent the least of their budget so far?",
  "How does this year compare with last year?",
  "Nawa aka kashe a kan rigakafi a 2026?",
];

export function AskBand() {
  const { ask } = useAsk();
  return (
    <section className="relative overflow-hidden rounded-[2rem] bg-[linear-gradient(120deg,var(--pub-navy)_0%,#0b5566_45%,#00879b_100%)] p-7 text-white sm:p-10">
      <span aria-hidden className="pointer-events-none absolute -right-16 -top-16 size-64 rounded-full bg-[var(--pub-accent)]/25 blur-2xl" />
      <span aria-hidden className="pointer-events-none absolute -bottom-20 left-1/3 size-56 rounded-full bg-[var(--pub-aqua)]/20 blur-2xl" />
      <div className="relative grid gap-6 lg:grid-cols-[1fr_auto] lg:items-center">
        <div>
          <p className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.1em]">
            <SparklesIcon className="size-3.5" /> Ask AI
          </p>
          <h2 className="font-display mt-3 text-3xl leading-tight sm:text-4xl">Have a question about the numbers?</h2>
          <p className="mt-2 max-w-xl text-white/80">Ask in English or Hausa. Answers come only from the official reports, with a chart when it helps.</p>
          <div className="mt-5 flex flex-wrap gap-2">
            {BAND_EXAMPLES.map((q) => (
              <button key={q} type="button" onClick={() => ask(q)} className="rounded-full bg-white/10 px-3.5 py-2 text-left text-sm ring-1 ring-white/20 transition hover:bg-white/20">
                {q}
              </button>
            ))}
          </div>
        </div>
        <button
          type="button"
          onClick={() => ask()}
          className="inline-flex items-center justify-center gap-2 rounded-full bg-[var(--pub-accent)] px-7 py-4 text-base font-semibold text-[var(--pub-navy)] shadow-lg transition hover:bg-white"
        >
          <SparklesIcon className="size-5" /> Ask AI
        </button>
      </div>
    </section>
  );
}
