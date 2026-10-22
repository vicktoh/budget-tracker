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
import { LOW_SPEND_THRESHOLD, barLabel, formatNairaShort, periodLabel } from "@/lib/public/model";
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
  otherBudgetsSource: string | null;
  passThrough: number;
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
                ? `What each programme is budgeted in ${r.year} across all health MDAs and who funds it, with spending up to ${periodEndMonth} where the reports show it.`
                : `What each programme was budgeted in ${r.year}, with spending up to ${periodEndMonth} where the reports show it. Budgets across all MDAs are shown from 2026.`}
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


      <div className="flex items-start gap-2 rounded-xl border border-[var(--pub-line)] bg-white px-4 py-3 text-sm text-[var(--pub-ink-2)]">
        <InfoIcon className="mt-0.5 size-4 shrink-0 text-[var(--pub-muted)]" aria-hidden />
        <p>
          Programmes are grouped by name from the approved budget and the State&apos;s quarterly reports. Spending is shown only for
          the PHC Board, the one agency that reports spending by programme{r.passThrough > 0 ? "; KHETFUND transfers to these programmes are not counted twice" : ""}.
        </p>
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

      {p.b > 0 ? (
        <div className="mt-auto rounded-2xl bg-[var(--pub-canvas)] p-3">
            <div className="flex items-baseline justify-between gap-2 text-sm">
              <span className="text-[var(--pub-ink-2)]">
                PHC Board spent <strong className="text-[var(--pub-ink)]">{formatNairaShort(p.y)}</strong> of {formatNairaShort(p.b)}
              </span>
              <SharePill share={s} flag={quarter >= 2 && s !== null && s < LOW_SPEND_THRESHOLD} />
            </div>
            <div className="mt-2">
              <BudgetBar budget={p.b} spent={p.y} maxBudget={p.b} height={8} label={barLabel(`PHC Board ${p.name}`, p.b, p.y, s)} />
            </div>
        </div>
      ) : null}
    </div>
  );
}

// Who-funds-it bar: shades of the brand teal and the accent, largest funder first.
const FUNDER_SHADES = ["#0b5566", "#00879b", "#14b0c8", "#6fd3d9", "#ff7a2e", "#c75414"];
