"use client";

import { useMemo, useState } from "react";
import { AnimatePresence, LayoutGroup, motion } from "motion/react";
import { ChevronDownIcon, InfoIcon } from "lucide-react";
import { AskButton } from "@/components/public/ask-panel";
import { BudgetBar, SharePill } from "@/components/public/budget-bar";
import { CLASS_COLOR, CLASS_LABEL } from "@/lib/public/labels";
import { SourceLink } from "@/components/public/source-link";
import {
  barLabel,
  ECON_CLASSES,
  LOW_SPEND_THRESHOLD,
  SECTOR_CODE,
  availablePeriods,
  formatNairaFull,
  formatNairaShort,
  formatShare,
  lensAvailable,
  lensRows,
  periodLabel,
  quarterOnlyLabel,
  samePointHistory,
  sectorValue,
  valueAt,
  type ExplorerData,
  type ExplorerEntity,
  type Value,
} from "@/lib/public/model";
import type { EconClass, ExplorerLens } from "@/lib/public/types";
import { cn } from "@/lib/utils";

type Mode = "breakdown" | "years";
type View = "ytd" | "quarter";
type Sort = "budget" | "share" | "spent";
type Metric = "share" | "budget" | "spent";

const LENS_LABEL: Record<ExplorerLens, { title: string; noun: string; plural: string; hint: string }> = {
  mda: { title: "MDAs", noun: "MDA", plural: "MDAs", hint: "Ministries, departments and agencies that hold the budget" },
  programme: { title: "Programmes", noun: "programme", plural: "programmes", hint: "The health sector objectives spending is meant to serve (from 2025)" },
  function: { title: "Functions", noun: "function", plural: "functions", hint: "What the money pays for: hospitals, public health, medicines…" },
};

const YEAR_COLORS = ["var(--pub-year-1)", "var(--pub-year-2)", "var(--pub-year-3)", "var(--pub-year-4)"];

export function Explorer({ data, initialYear, initialQuarter }: { data: ExplorerData; initialYear: number; initialQuarter: number }) {
  const periods = useMemo(() => availablePeriods(data), [data]);
  const [lens, setLens] = useState<ExplorerLens>("mda");
  const [cls, setCls] = useState<EconClass>("total");
  const [year, setYear] = useState(initialYear);
  const [quarter, setQuarter] = useState(initialQuarter);
  const [mode, setMode] = useState<Mode>("breakdown");
  const [view, setView] = useState<View>("ytd");
  const [sort, setSort] = useState<Sort>("budget");
  const [metric, setMetric] = useState<Metric>("share");
  const [open, setOpen] = useState<string | null>(null);

  const quarters = periods.find((p) => p.year === year)?.quarters ?? [];
  const lensOk = lensAvailable(data, year, quarter, lens);

  function chooseYear(next: number) {
    setYear(next);
    const qs = periods.find((p) => p.year === next)?.quarters ?? [];
    if (!qs.includes(quarter)) setQuarter(qs[qs.length - 1] ?? 4);
    if (lens === "programme" && !lensAvailable(data, next, qs.includes(quarter) ? quarter : qs[qs.length - 1] ?? 4, "programme")) setLens("mda");
  }

  const sector = sectorValue(data, year, quarter, lens, cls);
  const rows = useMemo(() => {
    const list = lensRows(data, year, quarter, lens, cls).map((r) => ({
      ...r,
      spent: view === "ytd" ? r.value.ytd : r.value.quarterOnly,
    }));
    const key = (r: (typeof list)[number]) =>
      sort === "budget" ? r.value.budget ?? 0 : sort === "spent" ? r.spent ?? 0 : r.value.budget ? (r.spent ?? 0) / r.value.budget : -1;
    return list.sort((a, b) => key(b) - key(a));
  }, [data, year, quarter, lens, cls, view, sort]);
  const maxBudget = Math.max(0, ...rows.map((r) => Math.max(r.value.budget ?? 0, r.spent ?? 0)));
  const quarterOnlyMissing = view === "quarter" && rows.some((r) => r.spent === null);
  const color = CLASS_COLOR[cls];
  const sectorSpent = view === "ytd" ? sector?.ytd ?? null : sector?.quarterOnly ?? null;
  const spentLabel = view === "ytd" ? periodLabel(year, quarter) : `${quarterOnlyLabel(year, quarter)} only`;

  return (
    <div className="space-y-6">
      {/* Controls: one row per decision, closest to the data */}
      <div className="space-y-4 rounded-2xl border border-[var(--pub-line)] bg-white p-4 sm:p-5">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <Segmented
            label="Look at spending by"
            value={lens}
            onChange={(v) => {
              setLens(v);
              setOpen(null);
            }}
            options={(Object.keys(LENS_LABEL) as ExplorerLens[]).map((l) => ({
              value: l,
              label: LENS_LABEL[l].title,
              disabled: !lensAvailable(data, year, quarter, l),
              title: !lensAvailable(data, year, quarter, l) ? "Programme tables start in the 2025 reports" : LENS_LABEL[l].hint,
            }))}
          />
          <Segmented
            label="Show"
            value={mode}
            onChange={setMode}
            options={[
              { value: "breakdown", label: "Breakdown" },
              { value: "years", label: "Compare years" },
            ]}
          />
        </div>
        <div className="flex flex-wrap gap-2" role="group" aria-label="Type of spending">
          {(["total", ...ECON_CLASSES] as EconClass[]).map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => setCls(c)}
              aria-pressed={cls === c}
              className={cn(
                "inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-sm transition",
                cls === c
                  ? "border-[var(--pub-ink)] bg-[var(--pub-ink)] text-white"
                  : "border-[var(--pub-line)] bg-white text-[var(--pub-ink-2)] hover:border-[var(--pub-ink-2)]",
              )}
            >
              <span className="size-2 rounded-full" style={{ background: CLASS_COLOR[c] }} aria-hidden />
              {CLASS_LABEL[c]}
            </button>
          ))}
        </div>
        <div className="flex flex-wrap items-end gap-3">
          <label className={cn("flex flex-col gap-1 text-xs font-medium text-[var(--pub-muted)]", mode === "years" && "hidden")}>
            Year
            <select
              className="h-10 rounded-md border border-[var(--pub-line)] bg-white px-3 text-sm text-[var(--pub-ink)]"
              value={year}
              onChange={(e) => chooseYear(Number(e.target.value))}
            >
              {periods.map((p) => (
                <option key={p.year} value={p.year}>
                  {p.year}
                </option>
              ))}
            </select>
          </label>
          <div className="flex flex-col gap-1 text-xs font-medium text-[var(--pub-muted)]">
              {mode === "years" ? "Point in each year" : "Up to"}
              <div className="flex flex-wrap gap-1">
                {[1, 2, 3, 4].map((q) => {
                  const ok = mode === "years" ? data.reports.some((r) => r.quarter === q || r.quarter === q + 1) : quarters.includes(q);
                  return (
                    <button
                      key={q}
                      type="button"
                      disabled={!ok}
                      onClick={() => setQuarter(q)}
                      aria-pressed={quarter === q}
                      className={cn(
                        "h-10 rounded-md border px-3 text-sm transition disabled:cursor-not-allowed disabled:opacity-40",
                        quarter === q ? "border-[var(--pub-brand)] bg-[var(--pub-brand-soft)] font-semibold text-[var(--pub-brand-deep)]" : "border-[var(--pub-line)] bg-white text-[var(--pub-ink-2)]",
                      )}
                    >
                      {q === 4 ? "Full year" : `Jan–${["", "Mar", "Jun", "Sep"][q]}`}
                    </button>
                  );
                })}
              </div>
            </div>
          {mode === "breakdown" ? (
            <Segmented
              label="Spending"
              value={view}
              onChange={setView}
              options={[
                { value: "ytd", label: "So far this year" },
                { value: "quarter", label: `In Q${quarter} only` },
              ]}
            />
          ) : (
            <Segmented
              label="Compare"
              value={metric}
              onChange={setMetric}
              options={[
                { value: "share", label: "% spent" },
                { value: "spent", label: "Amount spent" },
                { value: "budget", label: "Budget" },
              ]}
            />
          )}
        </div>
      </div>

      {!lensOk ? (
        <Notice>The {year} reports do not include a {LENS_LABEL[lens].noun} breakdown. Programme tables start in 2025.</Notice>
      ) : mode === "breakdown" ? (
        <section aria-live="polite" className="space-y-4">
          <div className="flex flex-col gap-3 rounded-2xl bg-[var(--pub-ink)] p-5 text-white sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.08em] text-white/70">
                Health sector · {CLASS_LABEL[cls].toLowerCase()} · {spentLabel}
              </p>
              <p className="font-display mt-1 text-3xl font-semibold">
                {formatNairaShort(sectorSpent)} <span className="text-lg font-normal text-white/70">spent of {formatNairaShort(sector?.budget)}</span>
              </p>
            </div>
            <div className="text-left sm:text-right">
              <p className="font-display text-3xl font-semibold">{formatShare(sector?.budget ? (sectorSpent ?? 0) / sector.budget : null)}</p>
              <p className="text-xs text-white/70">of the {year} {cls === "total" ? "" : CLASS_LABEL[cls].toLowerCase() + " "}budget</p>
            </div>
          </div>
          {sector?.derived ? <Notice>{sector.derived}</Notice> : null}
          {quarterOnlyMissing ? (
            <Notice>Spending within this quarter alone is not printed for every row; those rows show &ldquo;—&rdquo;.</Notice>
          ) : null}

          <div className="flex items-center justify-between gap-3 text-sm">
            <p className="text-[var(--pub-muted)]">
              {rows.length} {rows.length === 1 ? LENS_LABEL[lens].noun : LENS_LABEL[lens].plural} · bar length is the budget, the filled part is what has been spent
            </p>
            <label className="flex items-center gap-2 text-[var(--pub-muted)]">
              Sort
              <select className="h-9 rounded-md border border-[var(--pub-line)] bg-white px-2 text-sm text-[var(--pub-ink)]" value={sort} onChange={(e) => setSort(e.target.value as Sort)}>
                <option value="budget">Largest budget</option>
                <option value="spent">Most spent</option>
                <option value="share">Highest % spent</option>
              </select>
            </label>
          </div>

          <LayoutGroup>
            <ul className="divide-y divide-[var(--pub-line)] overflow-hidden rounded-2xl border border-[var(--pub-line)] bg-white">
              {rows.length === 0 ? (
                <li className="p-6 text-sm text-[var(--pub-muted)]">Nothing was budgeted or spent under {CLASS_LABEL[cls].toLowerCase()} in this period.</li>
              ) : null}
              {rows.map((r) => {
                const share = r.value.budget ? (r.spent ?? 0) / r.value.budget : null;
                const flag = view === "ytd" && quarter >= 2 && share !== null && share < LOW_SPEND_THRESHOLD;
                const isOpen = open === r.entity.code;
                return (
                  <motion.li key={r.entity.code} layout="position" transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1] }}>
                    <button
                      type="button"
                      onClick={() => setOpen(isOpen ? null : r.entity.code)}
                      aria-expanded={isOpen}
                      className="grid w-full grid-cols-[1fr_auto] items-center gap-x-4 gap-y-2 px-4 py-3.5 text-left transition hover:bg-[var(--pub-canvas)] sm:grid-cols-[minmax(10rem,16rem)_1fr_auto] sm:px-5"
                    >
                      <span className="min-w-0">
                        <span className="block truncate text-sm font-semibold">{r.entity.short}</span>
                        {r.entity.short !== r.entity.name ? (
                          <span className="block truncate text-xs text-[var(--pub-muted)]">{r.entity.name}</span>
                        ) : null}
                      </span>
                      <span className="col-span-2 row-start-2 sm:col-span-1 sm:row-start-auto">
                        <BudgetBar
                          budget={r.value.budget}
                          spent={r.spent}
                          maxBudget={maxBudget}
                          color={color}
                          label={barLabel(r.entity.name, r.value.budget, r.spent, share)}
                        />
                      </span>
                      <span className="flex items-center gap-3 justify-self-end">
                        <span className="hidden text-right text-xs tabular-nums text-[var(--pub-muted)] sm:block">
                          <span className="block text-sm font-semibold text-[var(--pub-ink)]">{formatNairaShort(r.spent)}</span>
                          of {formatNairaShort(r.value.budget)}
                        </span>
                        <SharePill share={r.value.budget ? share : null} flag={flag} />
                        <ChevronDownIcon className={cn("size-4 text-[var(--pub-muted)] transition", isOpen && "rotate-180")} aria-hidden />
                      </span>
                      <span className="col-span-2 -mt-1 text-xs tabular-nums text-[var(--pub-muted)] sm:hidden">
                        {formatNairaShort(r.spent)} of {formatNairaShort(r.value.budget)}
                        {flag ? " · below 25% spent" : ""}
                      </span>
                    </button>
                    <AnimatePresence initial={false}>
                      {isOpen ? (
                        <motion.div
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: "auto", opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
                          className="overflow-hidden bg-[var(--pub-canvas)]"
                        >
                          <RowDetail data={data} entity={r.entity} lens={lens} cls={cls} year={year} quarter={quarter} value={r.value} />
                        </motion.div>
                      ) : null}
                    </AnimatePresence>
                  </motion.li>
                );
              })}
            </ul>
          </LayoutGroup>
          <div className="flex flex-wrap gap-x-6 gap-y-1 text-xs">
            {sector ? <SourceLink source={sector.source} /> : null}
            <span className="text-[var(--pub-muted)]">Amber % = below 25% of the budget spent{quarter >= 2 ? "" : " (shown from Q2)"}.</span>
          </div>
        </section>
      ) : (
        <YearsCompare data={data} lens={lens} cls={cls} quarter={quarter} metric={metric} />
      )}
    </div>
  );
}

function RowDetail({
  data,
  entity,
  lens,
  cls,
  year,
  quarter,
  value,
}: {
  data: ExplorerData;
  entity: ExplorerEntity;
  lens: ExplorerLens;
  cls: EconClass;
  year: number;
  quarter: number;
  value: Value;
}) {
  const split = ECON_CLASSES.map((c) => ({ c, v: valueAt(data, year, quarter, lens, c, entity.code) })).filter(
    (x) => x.v && ((x.v.budget ?? 0) > 0 || (x.v.ytd ?? 0) > 0),
  );
  const splitMax = Math.max(0, ...split.map((x) => x.v?.budget ?? 0));
  const history = samePointHistory(data, quarter, lens, cls, entity.code).filter((h) => h.value && ((h.value.budget ?? 0) > 0 || (h.value.ytd ?? 0) > 0));
  const historyMax = Math.max(0, ...history.map((h) => Math.max(h.value?.budget ?? 0, h.value?.ytd ?? 0)));
  return (
    <div className="grid gap-6 px-4 py-5 sm:px-5 md:grid-cols-2">
      <div className="space-y-3">
        <p className="text-xs font-semibold uppercase tracking-[0.08em] text-[var(--pub-muted)]">
          {cls === "total" ? "By type of spending" : "The figures"}
        </p>
        {cls === "total" && split.length ? (
          <ul className="space-y-3">
            {split.map(({ c, v }) => (
              <li key={c} className="space-y-1">
                <div className="flex items-baseline justify-between gap-2 text-sm">
                  <span className="flex items-center gap-2">
                    <span className="size-2 rounded-full" style={{ background: CLASS_COLOR[c] }} aria-hidden />
                    {CLASS_LABEL[c]}
                  </span>
                  <span className="tabular-nums text-[var(--pub-muted)]">
                    {formatNairaShort(v!.ytd)} of {formatNairaShort(v!.budget)} · {formatShare(v!.share)}
                  </span>
                </div>
                <BudgetBar budget={v!.budget} spent={v!.ytd} maxBudget={splitMax} color={CLASS_COLOR[c]} height={8} label={barLabel(CLASS_LABEL[c], v!.budget, v!.ytd, v!.share)} />
              </li>
            ))}
          </ul>
        ) : (
          <dl className="grid grid-cols-2 gap-3 text-sm">
            <div>
              <dt className="text-xs text-[var(--pub-muted)]">Budget</dt>
              <dd className="font-semibold tabular-nums">{formatNairaFull(value.budget)}</dd>
            </div>
            <div>
              <dt className="text-xs text-[var(--pub-muted)]">Spent, {periodLabel(year, quarter, true)}</dt>
              <dd className="font-semibold tabular-nums">{formatNairaFull(value.ytd)}</dd>
            </div>
          </dl>
        )}
        <AskButton
          className="mt-1"
          label={`Ask AI about ${entity.short}`}
          question={`Tell me about ${entity.name}'s ${cls === "total" ? "" : CLASS_LABEL[cls].toLowerCase() + " "}budget and spending in ${year} (${periodLabel(year, quarter)}), and how it compares with earlier years.`}
        />
        <div className="space-y-1 text-xs">
          <SourceLink source={value.source} />
          {value.derived ? <p className="text-[var(--pub-muted)]">{value.derived}</p> : null}
          {value.note ? <p className="text-[var(--pub-muted)]">{value.note}</p> : null}
        </div>
      </div>
      <div className="space-y-3">
        <p className="text-xs font-semibold uppercase tracking-[0.08em] text-[var(--pub-muted)]">Same point in other years · {periodLabel(year, quarter, true).replace(/ \d{4}$/, "")}</p>
        {history.length ? (
          <ul className="space-y-3">
            {history.map((h, i) => (
              <li key={h.year} className="space-y-1">
                <div className="flex items-baseline justify-between gap-2 text-sm">
                  <span className={cn(h.year === year && "font-semibold")}>{h.year}</span>
                  <span className="tabular-nums text-[var(--pub-muted)]">
                    {formatNairaShort(h.value!.ytd)} of {formatNairaShort(h.value!.budget)} · {formatShare(h.value!.share)}
                  </span>
                </div>
                <BudgetBar
                  budget={h.value!.budget}
                  spent={h.value!.ytd}
                  maxBudget={historyMax}
                  color={YEAR_COLORS[Math.min(i, YEAR_COLORS.length - 1)]}
                  height={8}
                  label={barLabel(`${entity.name} ${h.year}`, h.value!.budget, h.value!.ytd, h.value!.share)}
                />
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-[var(--pub-muted)]">No other year has this row at this point.</p>
        )}
        <p className="text-xs text-[var(--pub-muted)]">Nominal naira: amounts are not adjusted for inflation.</p>
      </div>
    </div>
  );
}

/** One row per entity; one dot per year at the same point in the year. */
function YearsCompare({ data, lens, cls, quarter, metric }: { data: ExplorerData; lens: ExplorerLens; cls: EconClass; quarter: number; metric: Metric }) {
  const years = [...new Set(data.reports.map((r) => r.year))].sort((a, b) => a - b);
  const colorFor = (y: number) => YEAR_COLORS[Math.max(0, YEAR_COLORS.length - (years.length - years.indexOf(y)))];
  const entities = [
    { code: SECTOR_CODE[lens], name: "Health sector (total)", short: "Health sector", order: -1 },
    ...data.entities[lens].filter((e) => e.code !== SECTOR_CODE[lens] && (lens === "mda" ? e.code.length === 12 : e.code.length === 4)),
  ];
  const rows = entities
    .map((e) => ({ e, points: years.map((y) => ({ year: y, v: valueAt(data, y, quarter, lens, cls, e.code) })) }))
    .filter((r) => r.points.some((p) => p.v && ((p.v.budget ?? 0) > 0 || (p.v.ytd ?? 0) > 0)));
  const metricOf = (v: Value | null) => (!v ? null : metric === "share" ? v.share : metric === "spent" ? v.ytd : v.budget);
  const nonSector = rows.slice(1);
  const max = Math.max(
    metric === "share" ? 1 : 0,
    ...(metric === "share" ? rows : nonSector).flatMap((r) => r.points.map((p) => metricOf(p.v) ?? 0)),
  );
  const fmt = (n: number | null) => (metric === "share" ? formatShare(n) : formatNairaShort(n));
  const [hover, setHover] = useState<string | null>(null);

  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-sm">
        <span className="text-[var(--pub-muted)]">{periodLabel(2000, quarter, true).replace(" 2000", "")} of each year:</span>
        {years.map((y) => (
          <span key={y} className="inline-flex items-center gap-1.5">
            <span className="size-3 rounded-full ring-2 ring-white" style={{ background: colorFor(y) }} aria-hidden />
            {y}
          </span>
        ))}
      </div>
      <ul className="divide-y divide-[var(--pub-line)] rounded-2xl border border-[var(--pub-line)] bg-white">
        <li aria-hidden className="hidden px-4 pb-1 pt-3 sm:grid sm:grid-cols-[minmax(10rem,16rem)_1fr_5.5rem] sm:px-5">
          <span />
          <span className="relative h-4 text-[11px] text-[var(--pub-muted)]">
            {ticks(max, metric).map((t) => (
              <span key={t} className="absolute -translate-x-1/2" style={{ left: `${(t / max) * 100}%` }}>
                {fmt(t)}
              </span>
            ))}
          </span>
          <span className="text-right text-[11px] text-[var(--pub-muted)]">{years[years.length - 1]}</span>
        </li>
        {rows.map((r, idx) => {
          const own = idx === 0 && metric !== "share" ? Math.max(...r.points.map((p) => metricOf(p.v) ?? 0), 1) : max;
          const missing = r.points.filter((p) => !p.v).map((p) => p.year);
          return (
            <li key={r.e.code} className={cn("grid grid-cols-[1fr_auto] gap-2 px-4 py-4 sm:grid-cols-[minmax(10rem,16rem)_1fr_5.5rem] sm:items-center sm:px-5", idx === 0 && "bg-[var(--pub-canvas)]")}>
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold">{r.e.short}</p>
                {missing.length ? <p className="text-xs text-[var(--pub-muted)]">Not available: {missing.join(", ")}</p> : null}
              </div>
              <span className="text-right text-sm font-semibold tabular-nums sm:order-last">{fmt(metricOf(r.points[r.points.length - 1].v))}</span>
              <div className="relative col-span-2 h-9 sm:col-span-1">
                <div className="absolute inset-x-0 top-1/2 h-[2px] -translate-y-1/2 rounded bg-[var(--pub-track)]" />
                {metric === "share" ? (
                  <div className="absolute top-1 h-7 w-[2px] bg-[var(--pub-line)]" style={{ left: `${(LOW_SPEND_THRESHOLD / own) * 100}%` }} title="25% line" />
                ) : null}
                {r.points.map((p) => {
                  const m = metricOf(p.v);
                  if (m === null || !p.v) return null;
                  const key = `${r.e.code}-${p.year}`;
                  return (
                    <motion.button
                      key={p.year}
                      type="button"
                      className="absolute top-1/2 size-4 -translate-x-1/2 -translate-y-1/2 rounded-full ring-2 ring-white focus:outline-none focus-visible:ring-[var(--pub-ink)]"
                      style={{ background: colorFor(p.year) }}
                      initial={{ left: "0%", opacity: 0 }}
                      animate={{ left: `${Math.min(m / own, 1) * 100}%`, opacity: 1 }}
                      transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
                      onMouseEnter={() => setHover(key)}
                      onMouseLeave={() => setHover(null)}
                      onFocus={() => setHover(key)}
                      onBlur={() => setHover(null)}
                      aria-label={`${r.e.name}, ${p.year}: ${fmt(m)}`}
                    >
                      {hover === key ? (
                        <span className="pointer-events-none absolute bottom-6 left-1/2 z-10 w-max -translate-x-1/2 rounded-md bg-[var(--pub-ink)] px-2.5 py-1.5 text-left text-xs text-white shadow-lg">
                          <span className="block font-semibold">
                            {p.year}: {fmt(m)}
                          </span>
                          {formatNairaShort(p.v.ytd)} spent of {formatNairaShort(p.v.budget)}
                          {p.v.derived ? <span className="block text-white/70">Worked out from the next quarter</span> : null}
                        </span>
                      ) : null}
                    </motion.button>
                  );
                })}
              </div>
            </li>
          );
        })}
      </ul>
      <p className="flex items-start gap-1.5 text-xs text-[var(--pub-muted)]">
        <InfoIcon className="mt-0.5 size-3.5 shrink-0" aria-hidden />
        Each dot is the same point in a different year, so years compare like with like. Amounts are nominal naira. The health sector total is scaled on its own.
        {metric === "share" ? " The thin vertical line marks 25% spent." : ""}
      </p>
    </section>
  );
}

function ticks(max: number, metric: Metric): number[] {
  if (metric === "share") return [0, 0.25, 0.5, 0.75, 1, ...(max > 1.2 ? [Math.floor(max * 4) / 4] : [])].filter((t) => t <= max);
  return [0, max / 2, max];
}

function Segmented<T extends string>({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: T;
  onChange: (v: T) => void;
  options: { value: T; label: string; disabled?: boolean; title?: string }[];
}) {
  return (
    <div className="flex flex-col gap-1 text-xs font-medium text-[var(--pub-muted)]">
      {label}
      <div role="radiogroup" aria-label={label} className="inline-flex w-full rounded-lg border border-[var(--pub-line)] bg-[var(--pub-canvas)] p-1 sm:w-auto">
        {options.map((o) => (
          <button
            key={o.value}
            type="button"
            role="radio"
            aria-checked={value === o.value}
            disabled={o.disabled}
            title={o.title}
            onClick={() => onChange(o.value)}
            className={cn(
              "relative flex-1 rounded-md px-3 py-2 text-sm transition disabled:cursor-not-allowed disabled:opacity-40 sm:flex-none",
              value === o.value ? "text-[var(--pub-ink)]" : "text-[var(--pub-ink-2)] hover:text-[var(--pub-ink)]",
            )}
          >
            {value === o.value ? (
              <motion.span layoutId={`seg-${label}`} className="absolute inset-0 rounded-md bg-white shadow-sm ring-1 ring-[var(--pub-line)]" transition={{ type: "spring", bounce: 0.15, duration: 0.4 }} />
            ) : null}
            <span className="relative font-medium">{o.label}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

function Notice({ children }: { children: React.ReactNode }) {
  return (
    <p className="flex items-start gap-2 rounded-xl border border-[var(--pub-line)] bg-white px-4 py-3 text-sm text-[var(--pub-ink-2)]">
      <InfoIcon className="mt-0.5 size-4 shrink-0 text-[var(--pub-muted)]" aria-hidden />
      <span>{children}</span>
    </p>
  );
}
