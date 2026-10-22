"use client";

import { useRef } from "react";
import { motion, useInView } from "motion/react";
import { CoinsIcon, HandHeartIcon, InfoIcon, LandmarkIcon, MapPinnedIcon, ReceiptIcon, type LucideIcon } from "lucide-react";
import { SharePill } from "@/components/public/budget-bar";
import { CountUp, Reveal } from "@/components/public/motion";
import { SourceLink } from "@/components/public/source-link";
import { formatNairaShort, formatShare, type Source } from "@/lib/public/model";
import { REVENUE_ORDER, REVENUE_SOURCES, type RevenueSourceKey } from "@/lib/public/revenue-sources";

export type RevenuePart = { key: RevenueSourceKey; amount: number };

export type RevenueMda = {
  code: string;
  name: string;
  short: string;
  expected: number | null; // BIR revenue budget
  collected: number | null; // BIR year-to-date collections
  share: number | null;
  parts: RevenuePart[]; // approved budget lines by source
  top: { description: string; amount: number }[];
};

const ICON: Record<RevenueSourceKey, LucideIcon> = {
  federal: LandmarkIcon,
  lga: MapPinnedIcon,
  donor: HandHeartIcon,
  fees: ReceiptIcon,
  other: CoinsIcon,
};

export function RevenueView({
  year,
  periodShort,
  expected,
  collected,
  share,
  source,
  composition,
  mdas,
  compositionSource,
}: {
  year: number;
  periodShort: string;
  expected: number | null;
  collected: number | null;
  share: number | null;
  source: Source | null;
  composition: RevenuePart[];
  mdas: RevenueMda[];
  compositionSource: string | null;
}) {
  const total = composition.reduce((a, p) => a + p.amount, 0);
  return (
    <div className="space-y-16">
      {/* Summary */}
      <section className="grid gap-4 lg:grid-cols-[minmax(0,20rem)_1fr]">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-1">
          <div className="relative overflow-hidden rounded-3xl bg-[var(--pub-navy)] p-6 text-white">
            <span aria-hidden className="absolute -right-10 -top-10 size-32 rounded-full bg-white/10" />
            <p className="relative text-xs font-semibold uppercase tracking-[0.1em] text-white/75">Expected in {year}</p>
            <p className="font-display relative mt-2 text-5xl">
              <CountUp value={expected} kind="naira" />
            </p>
            <p className="relative mt-1 text-sm text-white/80">revenue budgeted for health MDAs</p>
          </div>
          <div className="relative overflow-hidden rounded-3xl bg-[var(--pub-accent-deep)] p-6 text-white">
            <span aria-hidden className="absolute -right-10 -top-10 size-32 rounded-full bg-white/10" />
            <p className="relative text-xs font-semibold uppercase tracking-[0.1em] text-white/80">Collected, {periodShort}</p>
            <p className="font-display relative mt-2 text-5xl">
              <CountUp value={collected} kind="naira" />
            </p>
            <p className="relative mt-1 text-sm text-white/85">{formatShare(share)} of what was expected</p>
          </div>
          {source ? (
            <p className="text-xs sm:col-span-2 lg:col-span-1">
              <SourceLink source={source} />
            </p>
          ) : null}
        </div>

        {composition.length ? (
          <div className="rounded-3xl border border-[var(--pub-line)] bg-white p-5 sm:p-6">
            <h2 className="font-display text-3xl text-[var(--pub-navy)]">Where it is expected to come from</h2>
            <p className="mt-1 text-sm text-[var(--pub-muted)]">Health MDAs&apos; {year} revenue budget, by source.</p>
            <StackedBar parts={composition} height={22} className="mt-5" />
            <ul className="mt-5 grid gap-3 sm:grid-cols-2">
              {REVENUE_ORDER.filter((k) => composition.some((p) => p.key === k && p.amount > 0)).map((k) => {
                const amount = composition.find((p) => p.key === k)!.amount;
                const Icon = ICON[k];
                const color = REVENUE_SOURCES[k].color;
                return (
                  <li key={k} className="flex items-start gap-3 rounded-2xl bg-[var(--pub-canvas)] p-3">
                    <span
                      aria-hidden
                      className="inline-flex size-10 shrink-0 items-center justify-center rounded-xl"
                      style={{ background: `color-mix(in srgb, ${color} 15%, white)`, color: `color-mix(in srgb, ${color} 82%, black)` }}
                    >
                      <Icon className="size-5" strokeWidth={2.2} />
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-baseline justify-between gap-2">
                        <p className="font-semibold">{REVENUE_SOURCES[k].name}</p>
                        <p className="font-display text-2xl text-[var(--pub-navy)]">{formatShare(amount / total)}</p>
                      </div>
                      <p className="text-sm tabular-nums text-[var(--pub-ink-2)]">{formatNairaShort(amount)}</p>
                      <p className="mt-0.5 text-xs text-[var(--pub-muted)]">{REVENUE_SOURCES[k].hint}</p>
                    </div>
                  </li>
                );
              })}
            </ul>
          </div>
        ) : null}
      </section>

      {/* By MDA */}
      <section>
        <Reveal className="mb-6 max-w-3xl">
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[var(--pub-accent-deep)]">By MDA</p>
          <h2 className="font-display mt-2 text-4xl text-[var(--pub-navy)]">Each MDA&apos;s revenue mix</h2>
          <p className="mt-3 text-lg text-[var(--pub-ink-2)]">
            What each ministry, board and agency expects to receive in {year}, where it comes from, and how much it has collected so
            far.
          </p>
        </Reveal>
        <div className="grid gap-4 md:grid-cols-2">
          {mdas.map((m, i) => (
            <Reveal key={m.code} delay={Math.min(i, 6) * 0.04}>
              <MdaCard m={m} periodShort={periodShort} />
            </Reveal>
          ))}
        </div>
      </section>

      <div className="flex items-start gap-2 rounded-xl border border-[var(--pub-line)] bg-white px-4 py-3 text-sm text-[var(--pub-ink-2)]">
        <InfoIcon className="mt-0.5 size-4 shrink-0 text-[var(--pub-muted)]" aria-hidden />
        <p>
          This page covers money health MDAs receive directly — fees, grants and transfers. Most of their spending is paid from the
          State&apos;s general budget, which is not shown here. The split by source comes from the{" "}
          {compositionSource ?? "approved revenue budget"}; amounts collected come from the Budget Performance Report, which gives
          one total per MDA and does not split collections by source.
        </p>
      </div>
    </div>
  );
}

function MdaCard({ m, periodShort }: { m: RevenueMda; periodShort: string }) {
  const partsTotal = m.parts.reduce((a, p) => a + p.amount, 0);
  return (
    <div className="flex h-full flex-col gap-4 rounded-3xl border border-[var(--pub-line)] bg-white p-5 shadow-[0_10px_30px_-22px_rgba(6,61,79,0.45)]">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="font-semibold">{m.short}</p>
          <p className="truncate text-xs text-[var(--pub-muted)]">{m.name}</p>
        </div>
        <div className="text-right">
          <p className="font-display text-3xl leading-none text-[var(--pub-navy)]">{formatNairaShort(m.expected)}</p>
          <p className="mt-1 text-xs text-[var(--pub-muted)]">expected</p>
        </div>
      </div>

      {partsTotal > 0 ? (
        <div>
          <StackedBar parts={m.parts} height={12} />
          <ul className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-xs text-[var(--pub-ink-2)]">
            {REVENUE_ORDER.filter((k) => m.parts.some((p) => p.key === k && p.amount > 0)).map((k) => (
              <li key={k} className="inline-flex items-center gap-1.5">
                <span className="size-2 rounded-full" style={{ background: REVENUE_SOURCES[k].color }} aria-hidden />
                {REVENUE_SOURCES[k].name}{" "}
                <span className="tabular-nums text-[var(--pub-muted)]">{formatShare(m.parts.find((p) => p.key === k)!.amount / partsTotal)}</span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {m.top.length ? (
        <ul className="space-y-1 text-xs text-[var(--pub-ink-2)]">
          {m.top.map((t) => (
            <li key={t.description} className="flex justify-between gap-3">
              <span className="truncate" title={t.description}>
                {t.description}
              </span>
              <span className="shrink-0 tabular-nums text-[var(--pub-muted)]">{formatNairaShort(t.amount)}</span>
            </li>
          ))}
        </ul>
      ) : null}

      <div className="mt-auto flex items-center justify-between gap-2 rounded-2xl bg-[var(--pub-canvas)] px-3 py-2.5 text-sm">
        <span className="text-[var(--pub-ink-2)]">
          Collected, {periodShort}: <strong className="text-[var(--pub-ink)]">{formatNairaShort(m.collected)}</strong>
        </span>
        <SharePill share={m.share} />
      </div>
    </div>
  );
}

function StackedBar({ parts, height, className }: { parts: RevenuePart[]; height: number; className?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const seen = useInView(ref, { once: true });
  const shown = REVENUE_ORDER.map((k) => parts.find((p) => p.key === k)).filter((p): p is RevenuePart => Boolean(p && p.amount > 0));
  const total = shown.reduce((a, p) => a + p.amount, 0) || 1;
  return (
    <div
      ref={ref}
      className={`flex w-full gap-[2px] overflow-hidden rounded-[6px] ${className ?? ""}`}
      style={{ height }}
      role="img"
      aria-label={shown.map((p) => `${REVENUE_SOURCES[p.key].name} ${formatShare(p.amount / total)}`).join(", ")}
    >
      {shown.map((p, i) => (
        <motion.span
          key={p.key}
          title={`${REVENUE_SOURCES[p.key].name}: ${formatNairaShort(p.amount)}`}
          className="h-full"
          style={{ background: REVENUE_SOURCES[p.key].color }}
          initial={{ flexGrow: 0.0001 }}
          animate={{ flexGrow: seen ? p.amount / total : 0.0001 }}
          transition={{ duration: 0.9, delay: 0.08 * i, ease: [0.16, 1, 0.3, 1] }}
        />
      ))}
    </div>
  );
}
