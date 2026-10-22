"use client";

import { useState } from "react";
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
import { Reveal } from "@/components/public/motion";
import { SourceLink } from "@/components/public/source-link";
import { LOW_SPEND_THRESHOLD, barLabel, formatNairaShort, periodLabel, type Source } from "@/lib/public/model";
import { cn } from "@/lib/utils";

/** b / y = the PHC Board's own budget and spending (from the BIR); others = other MDAs' budgets (approved budget lines). */
export type PhcProgrammeRow = {
  key: string;
  name: string;
  blurb: string;
  b: number;
  y: number;
  count?: number;
  others?: { code: string; name: string; amount: number }[];
};

export type PhcReport = {
  slug: string;
  year: number;
  quarter: number;
  programmes: PhcProgrammeRow[];
  operations: PhcProgrammeRow[];
  otherBudgetsSource: string | null;
  passThrough: number;
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

const share = (b: number, y: number) => (b ? y / b : null);
const othersTotal = (p: PhcProgrammeRow) => (p.others ?? []).reduce((a, o) => a + o.amount, 0);

export function PhcView({ reports }: { reports: PhcReport[] }) {
  const [slug, setSlug] = useState(reports[reports.length - 1].slug);
  const r = reports.find((x) => x.slug === slug)!;
  const period = periodLabel(r.year, r.quarter);
  const periodEndMonth = period.split("–")[1] ?? `the end of ${r.year}`;
  const singleObjective = r.officialObjectives.length === 1 ? r.officialObjectives[0] : null;
  const opsMax = Math.max(0, ...r.operations.map((p) => p.b));

  return (
    <div className="space-y-14">
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

      {/* 1. Programmes, across every MDA that funds them */}
      <section>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div className="max-w-2xl">
            <h2 className="font-display text-3xl text-[var(--pub-navy)] sm:text-4xl">Health programmes</h2>
            <p className="mt-2 text-[var(--pub-ink-2)]">
              {r.otherBudgetsSource
                ? `What each programme is budgeted in ${r.year} across all health MDAs, who funds it, and what the PHC Board has spent of its share by ${periodEndMonth}.`
                : `What the PHC Board budgeted for each programme in ${r.year}, and how much it had spent by ${periodEndMonth}. Other MDAs' budgets are shown from 2026.`}
            </p>
          </div>
          <AskButton question={`How much is budgeted for immunisation, malaria and nutrition in Kano in ${r.year}, and which MDAs fund them?`} label="Ask AI about health programmes" />
        </div>

        <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {r.programmes.map((p, i) => (
            <Reveal key={`${slug}-${p.key}`} delay={Math.min(i, 8) * 0.04}>
              <ProgrammeCard p={p} quarter={r.quarter} />
            </Reveal>
          ))}
        </div>
      </section>

      {/* 2. The PHC Board's own operations */}
      <section>
        <div className="max-w-2xl">
          <h2 className="font-display text-3xl text-[var(--pub-navy)] sm:text-4xl">The PHC Board&apos;s own operations</h2>
          <p className="mt-2 text-[var(--pub-ink-2)]">
            The rest of the Primary Health Care Board&apos;s {r.year} budget — facilities, management and services that support every
            programme — and how much of it was spent by {periodEndMonth}.
          </p>
        </div>
        <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {r.operations.map((p, i) => {
            const Icon = ICON[p.key] ?? InfoIcon;
            const s = share(p.b, p.y);
            const running = p.key === "personnel" || p.key === "overhead";
            return (
              <Reveal key={`${slug}-op-${p.key}`} delay={Math.min(i, 8) * 0.04}>
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
                    <SharePill share={s} flag={r.quarter >= 2 && s !== null && s < LOW_SPEND_THRESHOLD} />
                  </div>
                  <BudgetBar budget={p.b} spent={p.y} maxBudget={opsMax} color={running ? "#64706a" : "var(--pub-brand)"} label={barLabel(p.name, p.b, p.y, s)} />
                  {p.count ? <p className="mt-auto text-xs text-[var(--pub-muted)]">{p.count} {p.count === 1 ? "project" : "projects"}</p> : null}
                </div>
              </Reveal>
            );
          })}
        </div>
      </section>

      <div className="flex items-start gap-2 rounded-xl border border-[var(--pub-line)] bg-white px-4 py-3 text-sm text-[var(--pub-ink-2)]">
        <InfoIcon className="mt-0.5 size-4 shrink-0 text-[var(--pub-muted)]" aria-hidden />
        <div className="space-y-1.5">
          <p>
            Programmes are grouped by us from project names. The PHC Board&apos;s budget and spending come from the State&apos;s Budget
            Performance Report{r.otherBudgetsSource ? `; other MDAs' budgets from the ${r.otherBudgetsSource.replace(" (budget lines)", "")}` : ""}.
            Spending by programme is only reported for the PHC Board, so other MDAs show budgets only.
            {singleObjective ? ` The report itself codes all of the Board's ${r.year} spending to a single objective, "${singleObjective}".` : ""}
          </p>
          {r.passThrough > 0 ? (
            <p>
              Not counted: {formatNairaShort(r.passThrough)} that the Kano State Health Trust Fund (KHETFUND) passes on to these
              programmes as remittances — counting it as well would count the same money twice.
            </p>
          ) : null}
          <p className="flex flex-wrap gap-x-4">
            <SourceLink source={r.projectSource} prefix="PHC Board projects" />
            <SourceLink source={r.econSource} prefix="PHC Board totals" />
          </p>
        </div>
      </div>
    </div>
  );
}

function ProgrammeCard({ p, quarter }: { p: PhcProgrammeRow; quarter: number }) {
  const Icon = ICON[p.key] ?? InfoIcon;
  const others = p.others ?? [];
  const total = p.b + othersTotal(p);
  const s = share(p.b, p.y);
  const funders = [...(p.b > 0 ? [{ code: "phc", name: "PHC Board", amount: p.b }] : []), ...others].sort((a, b) => b.amount - a.amount);
  return (
    <div className="flex h-full flex-col gap-4 rounded-3xl border border-[var(--pub-line)] bg-white p-5 shadow-[0_10px_30px_-22px_rgba(6,61,79,0.45)]">
      <div className="flex items-start gap-3">
        <span className="inline-flex size-11 shrink-0 items-center justify-center rounded-2xl bg-[var(--pub-brand-soft)] text-[var(--pub-brand-deep)]">
          <Icon className="size-5" aria-hidden />
        </span>
        <div className="min-w-0">
          <p className="font-semibold leading-snug">{p.name}</p>
          <p className="text-xs text-[var(--pub-muted)]">{p.blurb}</p>
        </div>
      </div>

      <div>
        <p className="font-display text-4xl leading-none text-[var(--pub-navy)]">{formatNairaShort(total)}</p>
        <p className="mt-1 text-xs text-[var(--pub-muted)]">
          budgeted{funders.length > 1 ? ` across ${funders.length} MDAs` : funders[0] ? ` by the ${funders[0].name}` : ""}
        </p>
      </div>

      {funders.length > 1 ? (
        <div>
          {/* Who funds it: one bar split by MDA */}
          <div className="flex h-2.5 w-full gap-[2px] overflow-hidden rounded-full" role="img" aria-label={funders.map((f) => `${f.name} ${formatNairaShort(f.amount)}`).join(", ")}>
            {funders.map((f, i) => (
              <span key={f.code} className="h-full" style={{ flexGrow: f.amount, background: FUNDER_SHADES[i % FUNDER_SHADES.length] }} />
            ))}
          </div>
          <ul className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-xs text-[var(--pub-ink-2)]">
            {funders.slice(0, 4).map((f, i) => (
              <li key={f.code} className="inline-flex items-center gap-1.5">
                <span className="size-2 rounded-full" style={{ background: FUNDER_SHADES[i % FUNDER_SHADES.length] }} aria-hidden />
                {f.name} <span className="tabular-nums text-[var(--pub-muted)]">{formatNairaShort(f.amount)}</span>
              </li>
            ))}
            {funders.length > 4 ? <li className="text-[var(--pub-muted)]">+{funders.length - 4} more</li> : null}
          </ul>
        </div>
      ) : null}

      <div className="mt-auto rounded-2xl bg-[var(--pub-canvas)] p-3">
        {p.b > 0 ? (
          <>
            <div className="flex items-baseline justify-between gap-2 text-sm">
              <span className="text-[var(--pub-ink-2)]">
                PHC Board spent <strong className="text-[var(--pub-ink)]">{formatNairaShort(p.y)}</strong> of {formatNairaShort(p.b)}
              </span>
              <SharePill share={s} flag={quarter >= 2 && s !== null && s < LOW_SPEND_THRESHOLD} />
            </div>
            <div className="mt-2">
              <BudgetBar budget={p.b} spent={p.y} maxBudget={p.b} height={8} label={barLabel(`PHC Board ${p.name}`, p.b, p.y, s)} />
            </div>
            {others.length ? <p className="mt-2 text-[11px] text-[var(--pub-muted)]">Other MDAs&apos; spending on this programme is not reported.</p> : null}
          </>
        ) : (
          <p className="text-xs text-[var(--pub-muted)]">Spending on this programme is not reported for these MDAs.</p>
        )}
      </div>
    </div>
  );
}

// Who-funds-it bar: shades of the brand teal and the accent, largest funder first.
const FUNDER_SHADES = ["#0b5566", "#00879b", "#14b0c8", "#6fd3d9", "#ff7a2e", "#c75414"];
