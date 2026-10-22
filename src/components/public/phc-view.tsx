"use client";

import { useMemo, useState } from "react";
import { SearchIcon } from "lucide-react";
import { BudgetBar, SharePill } from "@/components/public/budget-bar";
import { CountUp, Ring } from "@/components/public/motion";
import { SourceLink } from "@/components/public/source-link";
import { CLASS_COLOR } from "@/lib/public/labels";
import { LOW_SPEND_THRESHOLD, barLabel, formatNairaShort, formatShare, periodLabel, type Source } from "@/lib/public/model";
import { cn } from "@/lib/utils";

export type PhcRow = { code: string; name: string; b: number | null; y: number | null; q: number | null; p: number | null; t: number | null };

export type PhcReport = {
  slug: string;
  year: number;
  quarter: number;
  title: string;
  pdf: string | null;
  admin: PhcRow[];
  programme: PhcRow[];
  functions: PhcRow[];
  economic: PhcRow[];
  projects: PhcRow[];
};

const ECON_GROUPS: { code: string; label: string; color: string }[] = [
  { code: "21", label: "Personnel", color: CLASS_COLOR.personnel },
  { code: "22", label: "Overhead and other recurrent", color: CLASS_COLOR.overhead },
  { code: "23", label: "Capital", color: CLASS_COLOR.capital },
];

function share(r: PhcRow) {
  return r.b ? (r.y ?? 0) / r.b : null;
}

export function PhcView({ reports }: { reports: PhcReport[] }) {
  const [slug, setSlug] = useState(reports[reports.length - 1].slug);
  const [query, setQuery] = useState("");
  const [projectSort, setProjectSort] = useState<"budget" | "share">("budget");
  const r = reports.find((x) => x.slug === slug)!;
  const source = (row?: PhcRow): Source => ({ slug: r.slug, title: r.title, table: row?.t ?? null, page: row?.p ?? null, pdf: r.pdf });

  const board = r.admin.find((x) => x.code === "052100500100") ?? r.admin.find((x) => x.code.length === 12);
  const programmes = r.programme.filter((x) => x.code.length === 4).sort((a, b) => (b.b ?? 0) - (a.b ?? 0));
  const programmeMax = Math.max(0, ...programmes.map((x) => x.b ?? 0));
  const groups = ECON_GROUPS.map((g) => ({
    ...g,
    total: r.economic.find((x) => x.code === g.code),
    lines: r.economic
      .filter((x) => x.code.length === 8 && x.code.startsWith(g.code))
      .filter((x) => (x.b ?? 0) > 0 || (x.y ?? 0) > 0)
      .sort((a, b) => (b.b ?? 0) - (a.b ?? 0)),
  })).filter((g) => g.total && ((g.total.b ?? 0) > 0 || (g.total.y ?? 0) > 0));
  const projects = useMemo(() => {
    const q = query.trim().toLowerCase();
    return r.projects
      .filter((p) => !q || p.name.toLowerCase().includes(q))
      .sort((a, b) => (projectSort === "budget" ? (b.b ?? 0) - (a.b ?? 0) : (share(b) ?? -1) - (share(a) ?? -1)));
  }, [r, query, projectSort]);
  const projectMax = Math.max(0, ...r.projects.map((p) => p.b ?? 0));
  const projectsUnspent = r.projects.filter((p) => (p.b ?? 0) > 0 && !(p.y ?? 0)).length;

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

      {board ? (
        <section className="grid gap-4 md:grid-cols-[1.4fr_1fr]">
          <div className="rounded-2xl bg-[var(--pub-green-deep)] p-6 text-white">
            <p className="text-xs font-semibold uppercase tracking-[0.08em] text-white/70">Primary Health Care Management Board · {periodLabel(r.year, r.quarter)}</p>
            <p className="font-display mt-3 text-5xl font-semibold">
              <CountUp key={`b-${slug}`} value={board.y} kind="naira" />
            </p>
            <p className="mt-1 text-white/80">spent of a {formatNairaShort(board.b)} budget</p>
            <p className="mt-6 text-xs text-white/70">
              <SourceLinkLight source={source(board)} />
            </p>
          </div>
          <div className="flex items-center gap-5 rounded-2xl border border-[var(--pub-line)] bg-white p-6">
            <Ring key={`r-${slug}`} fraction={share(board) ?? 0} size={96} stroke={10} />
            <div>
              <p className="font-display text-4xl font-semibold">
                <CountUp key={`s-${slug}`} value={share(board)} kind="percent" />
              </p>
              <p className="text-sm text-[var(--pub-muted)]">of the year&apos;s budget spent</p>
            </div>
          </div>
        </section>
      ) : null}

      {groups.length ? (
        <section>
          <h2 className="font-display text-3xl font-semibold tracking-tight">What the money pays for</h2>
          <p className="mt-2 max-w-2xl text-[var(--pub-ink-2)]">The Board&apos;s budget line by line, grouped by type. The largest lines come first.</p>
          <div className="mt-6 grid gap-4 lg:grid-cols-3">
            {groups.map((g) => {
              const max = Math.max(0, ...g.lines.map((l) => l.b ?? 0));
              return (
                <div key={g.code} className="rounded-2xl border border-[var(--pub-line)] bg-white p-5">
                  <div className="flex items-center gap-2">
                    <span className="size-2.5 rounded-full" style={{ background: g.color }} aria-hidden />
                    <h3 className="font-semibold">{g.label}</h3>
                  </div>
                  <p className="mt-2 text-2xl font-semibold tabular-nums">
                    {formatNairaShort(g.total!.y)} <span className="text-sm font-normal text-[var(--pub-muted)]">of {formatNairaShort(g.total!.b)} · {formatShare(share(g.total!))}</span>
                  </p>
                  <ul className="mt-4 space-y-3">
                    {g.lines.slice(0, 8).map((l) => (
                      <li key={l.code} className="space-y-1">
                        <div className="flex items-baseline justify-between gap-3 text-xs">
                          <span className="min-w-0 truncate text-[var(--pub-ink-2)]" title={l.name}>{l.name}</span>
                          <span className="shrink-0 tabular-nums text-[var(--pub-muted)]">{formatShare(share(l))}</span>
                        </div>
                        <BudgetBar budget={l.b} spent={l.y} maxBudget={max} color={g.color} height={8} label={barLabel(l.name, l.b, l.y, share(l))} />
                      </li>
                    ))}
                  </ul>
                  {g.lines.length > 8 ? <p className="mt-3 text-xs text-[var(--pub-muted)]">+ {g.lines.length - 8} smaller lines</p> : null}
                  <p className="mt-4 text-xs">
                    <SourceLink source={source(g.total)} />
                  </p>
                </div>
              );
            })}
          </div>
        </section>
      ) : null}

      {programmes.length ? (
        <section>
          <h2 className="font-display text-3xl font-semibold tracking-tight">By health programme</h2>
          <ul className="mt-6 space-y-3 rounded-2xl border border-[var(--pub-line)] bg-white p-5">
            {programmes.map((p) => (
              <li key={p.code} className="grid gap-1.5 sm:grid-cols-[16rem_1fr_11rem] sm:items-center">
                <span className="text-sm font-semibold">{p.name}</span>
                <BudgetBar budget={p.b} spent={p.y} maxBudget={programmeMax} label={barLabel(p.name, p.b, p.y, share(p))} />
                <span className="text-xs tabular-nums text-[var(--pub-muted)] sm:text-right">
                  {formatNairaShort(p.y)} of {formatNairaShort(p.b)} · {formatShare(share(p))}
                </span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {r.projects.length ? (
        <section>
          <h2 className="font-display text-3xl font-semibold tracking-tight">Capital projects</h2>
          <p className="mt-2 max-w-2xl text-[var(--pub-ink-2)]">
            {r.projects.length} projects in the {r.year} budget. {projectsUnspent} had no spending recorded by {periodLabel(r.year, r.quarter).split("–")[1] ?? "the end of the year"}.
            Project names appear as printed in the report, which shortens some of them.
          </p>
          <div className="mt-5 flex flex-wrap items-center gap-3">
            <label className="relative flex-1 sm:max-w-sm">
              <span className="sr-only">Search projects</span>
              <SearchIcon className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-[var(--pub-muted)]" aria-hidden />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search projects, e.g. solar, Sumaila, vehicles"
                className="h-10 w-full rounded-md border border-[var(--pub-line)] bg-white pl-9 pr-3 text-sm"
              />
            </label>
            <select
              value={projectSort}
              onChange={(e) => setProjectSort(e.target.value as "budget" | "share")}
              className="h-10 rounded-md border border-[var(--pub-line)] bg-white px-3 text-sm"
              aria-label="Sort projects"
            >
              <option value="budget">Largest budget</option>
              <option value="share">Highest % spent</option>
            </select>
          </div>
          <ul className="mt-4 divide-y divide-[var(--pub-line)] rounded-2xl border border-[var(--pub-line)] bg-white">
            {projects.map((p, i) => {
              const s = share(p);
              return (
                <li key={`${p.name}-${i}`} className="grid gap-2 px-4 py-3.5 sm:grid-cols-[1fr_14rem_auto] sm:items-center sm:px-5">
                  <span className="text-sm">{p.name}</span>
                  <BudgetBar budget={p.b} spent={p.y} maxBudget={projectMax} color={CLASS_COLOR.capital} label={barLabel(p.name, p.b, p.y, s)} />
                  <span className="flex items-center justify-between gap-3 sm:justify-end">
                    <span className="text-xs tabular-nums text-[var(--pub-muted)]">
                      {formatNairaShort(p.y)} of {formatNairaShort(p.b)}
                    </span>
                    <SharePill share={s} flag={r.quarter >= 2 && s !== null && s < LOW_SPEND_THRESHOLD} />
                  </span>
                </li>
              );
            })}
            {!projects.length ? <li className="px-5 py-6 text-sm text-[var(--pub-muted)]">No project matches &ldquo;{query}&rdquo;.</li> : null}
          </ul>
          <p className="mt-2 text-xs">
            <SourceLink source={source(r.projects[0])} />
          </p>
        </section>
      ) : null}
    </div>
  );
}

function SourceLinkLight({ source }: { source: Source }) {
  return (
    <span className="[&_a]:text-white/80 [&_a]:decoration-white/30 hover:[&_a]:text-white">
      <SourceLink source={source} />
    </span>
  );
}
