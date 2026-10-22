"use client";

import { motion } from "motion/react";
import { CountUp, GrowBar, Reveal, Ring } from "@/components/public/motion";
import { SourceLink } from "@/components/public/source-link";
import { formatNairaShort, formatShare, type Source } from "@/lib/public/model";
import type { EconClass } from "@/lib/public/types";
import { CLASS_COLOR, CLASS_HINT } from "@/lib/public/labels";

export type HeadlineProps = {
  periodLabel: string;
  budget: number | null;
  spent: number | null;
  share: number | null;
  stateBudget: number | null;
  stateSpent: number | null;
  mdaCount: number;
  source: Source | null;
  stateSource: Source | null;
  classes: { cls: EconClass; label: string; budget: number | null; spent: number | null; share: number | null }[];
};

const ABUJA_TARGET = 0.15;

export function HeadlineCards(props: HeadlineProps) {
  const healthShareOfBudget = props.budget && props.stateBudget ? props.budget / props.stateBudget : null;
  const healthShareOfSpend = props.spent && props.stateSpent ? props.spent / props.stateSpent : null;
  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Card delay={0}>
          <Eyebrow>Health budget</Eyebrow>
          <p className="font-display text-4xl font-semibold tracking-tight sm:text-[2.6rem]">
            <CountUp value={props.budget} kind="naira" />
          </p>
          <p className="text-sm text-[var(--pub-muted)]">Original budget across {props.mdaCount} health MDAs</p>
        </Card>
        <Card delay={0.08}>
          <Eyebrow>Spent, {props.periodLabel}</Eyebrow>
          <p className="font-display text-4xl font-semibold tracking-tight sm:text-[2.6rem]">
            <CountUp value={props.spent} kind="naira" />
          </p>
          <div className="h-2 w-full overflow-hidden rounded-full bg-[var(--pub-track)]">
            <GrowBar fraction={props.share ?? 0} className="h-full rounded-full bg-[var(--pub-green)]" delay={0.2} />
          </div>
          <p className="text-sm text-[var(--pub-muted)]">
            {formatNairaShort(props.budget && props.spent !== null ? props.budget - props.spent : null)} of the budget not yet spent
          </p>
        </Card>
        <Card delay={0.16}>
          <Eyebrow>Share of budget spent</Eyebrow>
          <div className="flex items-center gap-4">
            <Ring fraction={props.share ?? 0} />
            <p className="font-display text-4xl font-semibold tracking-tight sm:text-[2.6rem]">
              <CountUp value={props.share} kind="percent" />
            </p>
          </div>
          <p className="text-sm text-[var(--pub-muted)]">Year-to-date spending ÷ the year&apos;s original budget</p>
        </Card>
        <Card delay={0.24}>
          <Eyebrow>Health&apos;s share of the state budget</Eyebrow>
          <p className="font-display text-4xl font-semibold tracking-tight sm:text-[2.6rem]">
            <CountUp value={healthShareOfBudget} kind="percent" />
          </p>
          <AbujaScale value={healthShareOfBudget} />
          <p className="text-sm text-[var(--pub-muted)]">
            Abuja Declaration target: 15%. Share of state spending so far: {formatShare(healthShareOfSpend)}
          </p>
        </Card>
      </div>
      <div className="flex flex-wrap gap-x-6 gap-y-1 text-xs text-[var(--pub-muted)]">
        {props.source ? <SourceLink source={props.source} /> : null}
        {props.stateSource ? <SourceLink source={props.stateSource} prefix="State totals" /> : null}
      </div>
    </div>
  );
}

function AbujaScale({ value }: { value: number | null }) {
  // 0–25% scale with the 15% target marked.
  const max = 0.25;
  return (
    <div className="relative h-2 w-full rounded-full bg-[var(--pub-track)]" aria-hidden>
      <GrowBar fraction={(value ?? 0) / max} className="h-full rounded-full bg-[var(--pub-earth)]" delay={0.3} />
      <span className="absolute -top-1 h-4 w-[2px] rounded bg-[var(--pub-ink)]" style={{ left: `${(ABUJA_TARGET / max) * 100}%` }} />
    </div>
  );
}

function Card({ children, delay }: { children: React.ReactNode; delay: number }) {
  return (
    <Reveal delay={delay} className="flex flex-col gap-3 rounded-2xl border border-[var(--pub-line)] bg-white p-5 shadow-[0_1px_0_rgba(20,32,26,0.04)]">
      {children}
    </Reveal>
  );
}

function Eyebrow({ children }: { children: React.ReactNode }) {
  return <p className="text-xs font-semibold uppercase tracking-[0.08em] text-[var(--pub-muted)]">{children}</p>;
}

/** Budget by type of spending: a composition bar plus a mini card per class. */
export function ClassStrip({ classes, total }: { classes: HeadlineProps["classes"]; total: number | null }) {
  const shown = classes.filter((c) => (c.budget ?? 0) > 0 || (c.spent ?? 0) > 0);
  const sum = shown.reduce((acc, c) => acc + (c.budget ?? 0), 0) || total || 1;
  return (
    <div className="space-y-4">
      <div className="flex h-4 w-full gap-[2px] overflow-hidden rounded-[4px]" role="img" aria-label={shown.map((c) => `${c.label} ${formatShare((c.budget ?? 0) / sum)} of the budget`).join(", ")}>
        {shown.map((c, i) => (
          <motion.div
            key={c.cls}
            className="h-full first:rounded-l-[4px] last:rounded-r-[4px]"
            style={{ background: CLASS_COLOR[c.cls] }}
            initial={{ flexGrow: 0.0001 }}
            whileInView={{ flexGrow: Math.max((c.budget ?? 0) / sum, 0.004) }}
            viewport={{ once: true }}
            transition={{ duration: 0.9, delay: 0.1 * i, ease: [0.16, 1, 0.3, 1] }}
          />
        ))}
      </div>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {shown.map((c) => (
          <div key={c.cls} className="rounded-xl border border-[var(--pub-line)] bg-white p-4">
            <div className="flex items-center gap-2">
              <span className="size-2.5 rounded-full" style={{ background: CLASS_COLOR[c.cls] }} aria-hidden />
              <p className="text-sm font-semibold">{c.label}</p>
              <p className="ml-auto text-xs text-[var(--pub-muted)]">{formatShare((c.budget ?? 0) / sum)} of budget</p>
            </div>
            <p className="mt-2 text-xs text-[var(--pub-muted)]">{CLASS_HINT[c.cls]}</p>
            <p className="mt-3 text-lg font-semibold tabular-nums">
              {formatNairaShort(c.spent)} <span className="text-sm font-normal text-[var(--pub-muted)]">of {formatNairaShort(c.budget)}</span>
            </p>
            <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-[var(--pub-track)]">
              <GrowBar fraction={c.share ?? 0} className="h-full rounded-full" style={{ background: CLASS_COLOR[c.cls] }} delay={0.15} />
            </div>
            <p className="mt-1.5 text-xs text-[var(--pub-muted)]">{formatShare(c.share)} spent</p>
          </div>
        ))}
      </div>
    </div>
  );
}
