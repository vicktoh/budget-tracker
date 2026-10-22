"use client";

import { useState } from "react";
import { motion } from "motion/react";
import {
  AppleIcon,
  BabyIcon,
  BugIcon,
  Building2Icon,
  HeartHandshakeIcon,
  InfoIcon,
  NetworkIcon,
  PillIcon,
  ReceiptIcon,
  ShieldAlertIcon,
  StethoscopeIcon,
  SyringeIcon,
  UsersIcon,
  WalletIcon,
  type LucideIcon,
} from "lucide-react";
import { AskButton } from "@/components/public/ask-panel";
import { BudgetBar, SharePill } from "@/components/public/budget-bar";
import { CountUp, Reveal, Ring } from "@/components/public/motion";
import { SourceLink } from "@/components/public/source-link";
import { LOW_SPEND_THRESHOLD, barLabel, formatNairaShort, formatShare, periodLabel, type Source } from "@/lib/public/model";
import { cn } from "@/lib/utils";

export type PhcProgrammeRow = { key: string; name: string; blurb: string; b: number; y: number; count?: number };

export type PhcReport = {
  slug: string;
  year: number;
  quarter: number;
  board: { b: number | null; y: number | null; source: Source } | null;
  programmes: PhcProgrammeRow[];
  running: PhcProgrammeRow[];
  projectSource: Source;
  econSource: Source;
  officialObjectives: string[];
};

const ICON: Record<string, LucideIcon> = {
  immunisation: SyringeIcon,
  family_planning: HeartHandshakeIcon,
  mnch: BabyIcon,
  nutrition: AppleIcon,
  malaria: BugIcon,
  disease_control: ShieldAlertIcon,
  essential_services: StethoscopeIcon,
  community: UsersIcon,
  drugs_supplies: PillIcon,
  facilities: Building2Icon,
  health_systems: NetworkIcon,
  other: InfoIcon,
  personnel: WalletIcon,
  overhead: ReceiptIcon,
};

function share(r: { b: number | null; y: number | null }) {
  return r.b ? (r.y ?? 0) / r.b : null;
}

export function PhcView({ reports }: { reports: PhcReport[] }) {
  const [slug, setSlug] = useState(reports[reports.length - 1].slug);
  const r = reports.find((x) => x.slug === slug)!;
  const all = [...r.programmes, ...r.running];
  const total = all.reduce((acc, p) => acc + p.b, 0) || 1;
  const max = Math.max(0, ...all.map((p) => p.b));
  const period = periodLabel(r.year, r.quarter);
  const singleObjective = r.officialObjectives.length === 1 ? r.officialObjectives[0] : null;

  return (
    <div className="space-y-12">
      <div className="flex flex-wrap gap-2" role="tablist" aria-label="Report">
        {reports.map((x) => (
          <button
            key={x.slug}
            role="tab"
            aria-selected={x.slug === slug}
            onClick={() => setSlug(x.slug)}
            className={cn(
              "rounded-full border px-3.5 py-1.5 text-sm transition",
              x.slug === slug ? "border-[var(--pub-ink)] bg-[var(--pub-ink)] text-white" : "border-[var(--pub-line)] bg-white text-[var(--pub-ink-2)] hover:border-[var(--pub-ink-2)]",
            )}
          >
            {periodLabel(x.year, x.quarter, true)}
          </button>
        ))}
      </div>

      {r.board ? (
        <section className="grid gap-4 md:grid-cols-[1.4fr_1fr]">
          <div className="rounded-2xl bg-[var(--pub-brand-deep)] p-6 text-white">
            <p className="text-xs font-semibold uppercase tracking-[0.08em] text-white/70">Primary Health Care Management Board · {period}</p>
            <p className="font-display mt-3 text-5xl font-semibold">
              <CountUp key={`b-${slug}`} value={r.board.y} kind="naira" />
            </p>
            <p className="mt-1 text-white/80">spent of a {formatNairaShort(r.board.b)} budget</p>
            <p className="mt-6 text-xs [&_a]:text-white/80 [&_a]:decoration-white/30">
              <SourceLink source={r.board.source} />
            </p>
          </div>
          <div className="flex items-center gap-5 rounded-2xl border border-[var(--pub-line)] bg-white p-6">
            <Ring key={`r-${slug}`} fraction={share(r.board) ?? 0} size={96} stroke={10} />
            <div>
              <p className="font-display text-4xl font-semibold">
                <CountUp key={`s-${slug}`} value={share(r.board)} kind="percent" />
              </p>
              <p className="text-sm text-[var(--pub-muted)]">of the year&apos;s budget spent</p>
            </div>
          </div>
        </section>
      ) : null}

      <section>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div className="max-w-2xl">
            <h2 className="font-display text-3xl font-semibold tracking-tight">Where the money goes</h2>
            <p className="mt-2 text-[var(--pub-ink-2)]">Each health programme&apos;s budget for {r.year}, and how much of it was spent by {period.split("–")[1] ?? "the end of the year"}.</p>
          </div>
          <AskButton question={`Which primary health care programmes have spent the least of their ${r.year} budget, and how much is left?`} label="Ask AI about PHC programmes" />
        </div>

        {/* Composition: every programme's share of the Board's budget */}
        <div className="mt-6 flex h-5 w-full gap-[2px] overflow-hidden rounded-[5px]" role="img" aria-label={all.map((p) => `${p.name} ${formatShare(p.b / total)}`).join(", ")}>
          {all.map((p, i) => (
            <motion.div
              key={`${slug}-${p.key}`}
              title={`${p.name}: ${formatNairaShort(p.b)} (${formatShare(p.b / total)})`}
              className="h-full"
              style={{ background: colorFor(p.key, i) }}
              initial={{ flexGrow: 0.0001 }}
              animate={{ flexGrow: Math.max(p.b / total, 0.003) }}
              transition={{ duration: 0.8, delay: 0.04 * i, ease: [0.16, 1, 0.3, 1] }}
            />
          ))}
        </div>

        <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {all.map((p, i) => {
            const Icon = ICON[p.key] ?? InfoIcon;
            const s = share(p);
            const flag = r.quarter >= 2 && s !== null && s < LOW_SPEND_THRESHOLD;
            const running = p.key === "personnel" || p.key === "overhead";
            return (
              <Reveal key={`${slug}-${p.key}`} delay={Math.min(i, 8) * 0.04}>
                <div className={cn("flex h-full flex-col gap-3 rounded-2xl border p-5", running ? "border-dashed border-[var(--pub-line)] bg-[var(--pub-canvas)]" : "border-[var(--pub-line)] bg-white")}>
                  <div className="flex items-start gap-3">
                    <span className={cn("inline-flex size-10 shrink-0 items-center justify-center rounded-xl", running ? "bg-[#eceeed] text-[#4b5551]" : "bg-[var(--pub-brand-soft)] text-[var(--pub-brand-deep)]")}>
                      <Icon className="size-5" aria-hidden />
                    </span>
                    <div className="min-w-0">
                      <p className="font-semibold leading-snug">{p.name}</p>
                      <p className="text-xs text-[var(--pub-muted)]">{p.blurb}</p>
                    </div>
                  </div>
                  <div className="flex items-baseline justify-between gap-2">
                    <p className="text-xl font-semibold tabular-nums">
                      {formatNairaShort(p.y)} <span className="text-sm font-normal text-[var(--pub-muted)]">of {formatNairaShort(p.b)}</span>
                    </p>
                    <SharePill share={s} flag={flag} />
                  </div>
                  <BudgetBar budget={p.b} spent={p.y} maxBudget={max} color={running ? "#64706a" : "var(--pub-brand)"} label={barLabel(p.name, p.b, p.y, s)} />
                  <p className="mt-auto text-xs text-[var(--pub-muted)]">
                    {formatShare(p.b / total)} of the Board&apos;s budget{p.count ? ` · ${p.count} ${p.count === 1 ? "project" : "projects"}` : ""}
                  </p>
                </div>
              </Reveal>
            );
          })}
        </div>

        <div className="mt-6 flex items-start gap-2 rounded-xl border border-[var(--pub-line)] bg-white px-4 py-3 text-sm text-[var(--pub-ink-2)]">
          <InfoIcon className="mt-0.5 size-4 shrink-0 text-[var(--pub-muted)]" aria-hidden />
          <p>
            Programmes are grouped by us from the names of the Board&apos;s capital projects; every amount is the report&apos;s own, and
            together they add up to the Board&apos;s capital budget. Salaries and running costs are shown separately because the
            report does not split them by programme.
            {singleObjective ? ` The report itself codes all of the Board's ${r.year} spending to a single objective, "${singleObjective}".` : ""}{" "}
            <span className="inline-flex flex-wrap gap-x-4">
              <SourceLink source={r.projectSource} prefix="Projects" />
              <SourceLink source={r.econSource} prefix="Totals" />
            </span>
          </p>
        </div>
      </section>
    </div>
  );
}

// One hue for programmes (identity comes from the labels, not colour — there are
// more programmes than a safe categorical palette); salaries and running costs
// are neutral because they are not programmes.
function colorFor(key: string, index: number) {
  if (key === "personnel" || key === "overhead") return index % 2 ? "#8a958f" : "#64706a";
  return index % 2 ? "#1f8553" : "#167a4a";
}
