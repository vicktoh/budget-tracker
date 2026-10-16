"use client";

import * as React from "react";
import Link from "next/link";
import {
  AlertTriangleIcon,
  BanknoteIcon,
  CircleSlashIcon,
  CloudOffIcon,
  FileTextIcon,
  GaugeIcon,
  InfoIcon,
  RefreshCwIcon,
  WifiIcon,
} from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { AskHero } from "@/components/executive/ask-panel";
import { DonutShareChart } from "@/components/reporting/charts/donut-share-chart";
import { STATUS_COLORS } from "@/components/reporting/charts/palette";
import { CLASS_COLORS } from "@/components/reporting/insights/primitives";
import {
  AvailabilityTag,
  DrillLink,
  FlagBadge,
  FlowBar,
  FlowLegend,
  Kpi,
  MissingData,
  SectionCard,
  formatDataDate,
  useExecutiveData,
  utilisationTone,
} from "@/components/executive/primitives";
import { useOnlineStatus } from "@/lib/offline/use-online-status";
import { useSyncQueue } from "@/lib/offline/use-sync-queue";
import { hasSupabaseConfig } from "@/lib/supabase";
import { formatCompactNaira, formatInteger, formatPercent } from "@/lib/format";
import {
  FEATURED_PROGRAMMES,
  MONTH_LABELS,
  UNMAPPED_PROGRAMME,
  type ExecutiveOverview,
  type MdaPerformance,
} from "@/lib/reporting/executive";
import type { ReportQuarter } from "@/lib/reporting/types";
import { cn } from "@/lib/utils";

/** Online / offline / syncing pill shown in every executive page header. */
export function ConnectionStatus({ cachedAt }: { cachedAt: string | null }) {
  const online = useOnlineStatus();
  const { pending } = useSyncQueue();
  const [loadedAt] = React.useState(() => new Date());
  const label = !online
    ? `Offline · showing data saved ${cachedAt ? new Date(cachedAt).toLocaleString("en-NG", { dateStyle: "medium", timeStyle: "short" }) : "on this device"}`
    : pending > 0
      ? `Syncing ${pending} item${pending === 1 ? "" : "s"}…`
      : cachedAt
        ? "Reconnected · refreshing data"
        : `Online · up to date as of ${loadedAt.toLocaleTimeString("en-NG", { timeStyle: "short" })}`;
  const Icon = !online ? CloudOffIcon : pending > 0 || cachedAt ? RefreshCwIcon : WifiIcon;
  return (
    <span
      role="status"
      aria-live="polite"
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium",
        online
          ? "border-status-approved/30 bg-status-approved-bg text-status-approved"
          : "border-status-pending/30 bg-status-pending-bg text-status-pending",
      )}
    >
      <Icon className={cn("size-3.5", online && (pending > 0 || cachedAt) && "animate-spin")} />
      {label}
    </span>
  );
}

function reportingLabel(mda: MdaPerformance, horizon: number | null, quarter: ReportQuarter | null) {
  if (mda.reporting_status === "never") {
    return <MissingData>{quarter ? `No Q${quarter} returns` : "Never submitted"}</MissingData>;
  }
  if (mda.reporting_status === "missed_latest" && horizon) {
    return (
      <span className="text-xs text-status-rejected">
        Missing {mda.missing_months.map((m) => MONTH_LABELS[m - 1]).join(", ")}
      </span>
    );
  }
  return <span className="text-xs text-status-approved">Up to date</span>;
}

const QUARTER_OPTIONS: Array<{ value: ReportQuarter | null; label: string }> = [
  { value: null, label: "Full year" },
  { value: 1, label: "Q1" },
  { value: 2, label: "Q2" },
  { value: 3, label: "Q3" },
  { value: 4, label: "Q4" },
];

/** Segmented Full year / Q1–Q4 switch. Quarters without actuals stay selectable. */
function QuarterPicker({
  value,
  onChange,
  quartersWithActuals,
}: {
  value: ReportQuarter | null;
  onChange: (next: ReportQuarter | null) => void;
  quartersWithActuals: number[];
}) {
  return (
    <div
      role="radiogroup"
      aria-label="Period"
      className="inline-flex h-9 items-center gap-1 rounded-md border bg-muted p-1"
    >
      {QUARTER_OPTIONS.map((option) => {
        const selected = option.value === value;
        const noActuals = option.value !== null && !quartersWithActuals.includes(option.value);
        return (
          <button
            key={option.label}
            type="button"
            role="radio"
            aria-checked={selected}
            title={noActuals ? `No ${option.label} actuals received yet` : undefined}
            onClick={() => onChange(option.value)}
            className={cn(
              "focus-ring inline-flex h-7 items-center rounded px-3 text-sm font-medium transition-colors",
              selected
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground",
              noActuals && !selected && "text-muted-foreground/60",
            )}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}

export function ExecutiveOverviewRoute() {
  const [quarter, setQuarter] = React.useState<ReportQuarter | null>(null);
  const { overview, programmes, exceptions, loading, error, cachedAt } = useExecutiveData(quarter);

  if (!hasSupabaseConfig) {
    return (
      <div className="flex flex-col gap-5">
        <h1 className="text-2xl font-bold tracking-normal">Health sector budget performance</h1>
        <Alert variant="warning">
          <AlertTitle>Supabase is not configured</AlertTitle>
          <AlertDescription>Add Supabase environment variables to load data.</AlertDescription>
        </Alert>
      </div>
    );
  }

  const coverage = overview?.coverage;
  const horizon = coverage?.tracking_horizon ?? null;
  const period = quarter ? `Q${quarter}` : null;
  const budgetLabel = period ? `${period} allocation` : "Approved budget";

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
        <div className="flex flex-col gap-1">
          <h1 className="text-2xl font-bold tracking-normal">
            Health sector budget performance
            {overview ? ` · FY ${overview.fiscal_year}${period ? ` · ${period}` : ""}` : ""}
          </h1>
          <p className="text-sm text-muted-foreground">
            Every health MDA in one view.{" "}
            {coverage
              ? `Actuals through ${formatDataDate(coverage.data_through)} · ${coverage.mdas_total} MDAs.`
              : null}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2 md:justify-end">
          <QuarterPicker
            value={quarter}
            onChange={setQuarter}
            quartersWithActuals={coverage?.quarters_with_actuals ?? []}
          />
          <ConnectionStatus cachedAt={cachedAt} />
        </div>
      </div>

      {error ? (
        <Alert variant="destructive">
          <AlertTitle>Could not load the latest figures</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}

      <AskHero />

      {loading && !overview ? (
        <div className="grid grid-cols-1 gap-3 md:grid-cols-5">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-24 rounded-xl" />
          ))}
        </div>
      ) : null}

      {overview && exceptions && programmes && coverage ? (
        <>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
            <Kpi
              label={budgetLabel}
              value={formatCompactNaira(overview.totals.budget)}
              helper={
                period
                  ? `¼ of ${formatCompactNaira(overview.totals.budget * 4)} annual budget`
                  : `FY ${overview.fiscal_year} · ${coverage.mdas_total} MDAs`
              }
            />
            <Kpi
              label="Released"
              value={coverage.releases_recorded ? formatCompactNaira(overview.totals.released) : "Not recorded"}
              helper={
                coverage.releases_recorded
                  ? `${formatPercent(overview.totals.release_rate)} of budget`
                  : `No ${period ? `${period} ` : ""}releases recorded yet`
              }
            />
            <Kpi
              label="Actual spend"
              value={formatCompactNaira(overview.totals.spent)}
              helper={
                quarter
                  ? coverage.quarters_with_actuals.includes(quarter)
                    ? `${period} actuals`
                    : `No ${period} actuals yet`
                  : coverage.quarters_with_actuals.length
                    ? `Q${coverage.quarters_with_actuals.join(" + Q")} actuals`
                    : "No actuals yet"
              }
            />
            <Kpi
              label="Utilisation"
              value={formatPercent(overview.totals.utilisation)}
              tone={utilisationTone(overview.totals.utilisation)}
              helper={`Balance ${formatCompactNaira(overview.totals.balance)} unspent`}
            />
            <Kpi
              label={
                horizon
                  ? `Reported for ${MONTH_LABELS[horizon - 1]}`
                  : period
                    ? `Reported in ${period}`
                    : "Reporting"
              }
              value={`${coverage.mdas_reported_latest} / ${coverage.mdas_total}`}
              tone={coverage.mdas_reported_latest < coverage.mdas_total ? "warn" : "good"}
              helper="MDAs with monthly returns"
            />
          </div>

          <AtAGlance overview={overview} period={period} />

          <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
            <AttentionCard
              href="/admin/exceptions#not-reporting"
              icon={AlertTriangleIcon}
              count={exceptions.notReporting.length}
              title="Not reporting"
              names={exceptions.notReporting.map((m) => m.mda_name)}
              helper={
                horizon
                  ? `No return for ${MONTH_LABELS[horizon - 1]} or ${period ? `none in ${period}` : "never submitted"}`
                  : "No monthly returns"
              }
            />
            <AttentionCard
              href="/admin/exceptions#no-funding"
              icon={CircleSlashIcon}
              count={exceptions.noFundingMdas.length + exceptions.noFundingProgrammes.length}
              unavailable={
                coverage.releases_recorded ? undefined : `No ${period ? `${period} ` : ""}releases recorded yet`
              }
              title="Receiving no funding"
              names={[
                ...exceptions.noFundingMdas.map((m) => m.mda_name),
                ...exceptions.noFundingProgrammes.map((p) => `${p.name} (programme)`),
              ]}
              helper="₦0 released against a budget or AOP plan"
            />
            <AttentionCard
              href="/admin/exceptions#low-utilisation"
              icon={GaugeIcon}
              count={exceptions.lowUtilisationMdas.length}
              title="Low utilisation (<25%)"
              names={exceptions.lowUtilisationMdas.map((m) => `${m.mda_name} · ${formatPercent(m.utilisation)}`)}
              helper={period ? `Share of ${period} allocation spent` : "Share of annual budget spent"}
            />
            <AttentionCard
              href="/admin/exceptions#variances"
              icon={BanknoteIcon}
              count={exceptions.overspend.length + exceptions.lopsided.length}
              title="Significant variances"
              names={[
                ...exceptions.overspend.map((o) => `${o.mda.mda_name} · ${o.component.label} overspent`),
                ...exceptions.lopsided.map((l) => `${l.mda.mda_name} · ${l.best.label} vs ${l.worst.label}`),
              ]}
              helper="Overspend or lopsided execution"
            />
          </div>

          <SectionCard
            title="Personnel, overhead and capital"
            description={
              period
                ? `${period} actual spend against the ${period} allocation (¼ of the annual budget) for each economic class.`
                : "Actual spend against the annual approved budget for each economic class."
            }
          >
            <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
              {overview.components
                .filter((c) => c.budget > 0)
                .map((c) => (
                  <div key={c.budget_class} className="flex flex-col gap-2 rounded-lg border p-3">
                    <div className="flex items-baseline justify-between">
                      <span className="text-sm font-medium">{c.label}</span>
                      <span
                        className={cn(
                          "text-lg font-semibold tabular-nums",
                          utilisationTone(c.utilisation) === "good" && "text-status-approved",
                          utilisationTone(c.utilisation) === "warn" && "text-status-pending",
                          utilisationTone(c.utilisation) === "bad" && "text-status-rejected",
                        )}
                      >
                        {formatPercent(c.utilisation)}
                      </span>
                    </div>
                    <FlowBar budget={c.budget} spent={c.spent} />
                    <span className="text-xs text-muted-foreground tabular-nums">
                      {formatCompactNaira(c.spent)} of {formatCompactNaira(c.budget)}
                    </span>
                  </div>
                ))}
            </div>
          </SectionCard>

          <SectionCard
            title="All MDAs"
            description="Sorted by budget size. Open any MDA to see its categories, monthly returns and line items."
            action={<FlowLegend />}
          >
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>MDA</TableHead>
                  <TableHead className="text-right">{period ? `${period} allocation` : "Budget"}</TableHead>
                  <TableHead className="text-right">Released</TableHead>
                  <TableHead className="text-right">Spent</TableHead>
                  <TableHead className="w-[18%]">Utilisation</TableHead>
                  <TableHead>Monthly returns</TableHead>
                  <TableHead>Flags</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {overview.mdas.map((mda) => (
                  <TableRow key={mda.mda_id}>
                    <TableCell className="max-w-[16rem]">
                      <Link
                        href={`/admin/mdas/${mda.mda_id}`}
                        className="font-medium text-primary hover:underline"
                      >
                        {mda.mda_name}
                      </Link>
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {formatCompactNaira(mda.budget)}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {mda.released > 0 ? (
                        formatCompactNaira(mda.released)
                      ) : (
                        <MissingData>{coverage.releases_recorded ? "None" : "Not recorded"}</MissingData>
                      )}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {formatCompactNaira(mda.spent)}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <FlowBar budget={mda.budget} released={mda.released} spent={mda.spent} />
                        <span className="w-12 text-right text-xs tabular-nums">
                          {formatPercent(mda.utilisation)}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell>{reportingLabel(mda, horizon, quarter)}</TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1">
                        {mda.flags
                          .filter((f) => f !== "not_reporting" && f !== "source_mismatch")
                          .map((f) => (
                            <FlagBadge key={f} flag={f} />
                          ))}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </SectionCard>

          <SectionCard
            title="Programmes"
            description={`Budget is the AOP planned cost mapped to each programme${
              period ? ` (¼ of the annual plan for ${period})` : ""
            }; actuals are spending recorded against that programme area.`}
          >
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              {programmes
                .filter((p) => FEATURED_PROGRAMMES.includes(p.name))
                .map((p) => (
                  <Link
                    key={p.slug}
                    href={`/admin/programmes/${p.slug}`}
                    className="focus-ring flex flex-col gap-2 rounded-xl border p-4 hover:border-primary/40 hover:bg-primary/5"
                  >
                    <div className="flex items-baseline justify-between gap-2">
                      <span className="font-semibold">{p.name}</span>
                      <span className="text-sm tabular-nums text-muted-foreground">
                        {p.planned > 0 ? formatPercent(p.utilisation) : "—"}
                      </span>
                    </div>
                    <FlowBar budget={p.planned} released={p.funded} spent={p.spent} />
                    <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground tabular-nums">
                      <span>
                        Planned{" "}
                        {p.planned > 0 ? formatCompactNaira(p.planned) : <MissingData>no AOP activities</MissingData>}
                      </span>
                      <span>Released {formatCompactNaira(p.funded)}</span>
                      <span>
                        Spent{" "}
                        {p.spent > 0 ? formatCompactNaira(p.spent) : <MissingData>none recorded</MissingData>}
                      </span>
                    </div>
                  </Link>
                ))}
            </div>
            <Table className="mt-4">
              <TableHeader>
                <TableRow>
                  <TableHead>Programme</TableHead>
                  <TableHead className="text-right">AOP planned</TableHead>
                  <TableHead className="text-right">Released</TableHead>
                  <TableHead className="text-right">Spent</TableHead>
                  <TableHead className="text-right">Spent / planned</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {programmes
                  .filter((p) => !FEATURED_PROGRAMMES.includes(p.name))
                  .map((p) => (
                    <TableRow key={p.slug}>
                      <TableCell>
                        <Link
                          href={`/admin/programmes/${p.slug}`}
                          className={cn(
                            "font-medium hover:underline",
                            p.name === UNMAPPED_PROGRAMME ? "text-muted-foreground" : "text-primary",
                          )}
                        >
                          {p.name}
                        </Link>
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {p.planned > 0 ? formatCompactNaira(p.planned) : <MissingData>no plan</MissingData>}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">{formatCompactNaira(p.funded)}</TableCell>
                      <TableCell className="text-right tabular-nums">{formatCompactNaira(p.spent)}</TableCell>
                      <TableCell className="text-right tabular-nums">
                        {p.planned > 0 ? formatPercent(p.utilisation) : "—"}
                      </TableCell>
                    </TableRow>
                  ))}
              </TableBody>
            </Table>
          </SectionCard>

          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <SectionCard
              title="What the data does not cover yet"
              description="Figures above are only as complete as the returns received."
            >
              <ul className="flex flex-col gap-2 text-sm">
                {coverage.gaps.map((gap) => (
                  <li key={gap} className="flex gap-2">
                    <InfoIcon className="mt-0.5 size-4 shrink-0 text-status-pending" />
                    <span>{gap}</span>
                  </li>
                ))}
              </ul>
            </SectionCard>

            <SectionCard
              title="Reports"
              description="Generate on demand from the same figures."
              action={<DrillLink href="/admin/reports">All reports</DrillLink>}
            >
              <div className="flex flex-col gap-2">
                <ReportLink
                  href="/admin/reports/mbp"
                  title="Budget performance — Ministry of Budget & Planning"
                  helper="Execution and absorption by MDA. Pick quarter or half-year, download PDF."
                />
                <ReportLink
                  href="/admin/reports/bir"
                  title="Budget Implementation Report"
                  helper="Official quarterly tables by MDA and economic class."
                />
                <ReportLink
                  href="/admin/exceptions"
                  title="Reporting & funding exceptions"
                  helper="Non-reporting, unfunded, low utilisation and variances."
                />
                <div className="flex flex-wrap gap-x-4 gap-y-1 pt-1">
                  <span className="text-xs text-muted-foreground">Dashboards & reports</span>
                  <AvailabilityTag offline />
                  <span className="text-xs text-muted-foreground">Assistant</span>
                  <AvailabilityTag offline={false} />
                </div>
              </div>
            </SectionCard>
          </div>
        </>
      ) : null}
    </div>
  );
}

const formatMdaCount = (value: number) => `${formatInteger(value)} MDA${value === 1 ? "" : "s"}`;

/** Four donuts: budget absorbed, funds released, spend mix and reporting compliance. */
function AtAGlance({
  overview,
  period,
}: {
  overview: ExecutiveOverview;
  period: string | null;
}) {
  const { totals, coverage } = overview;
  const budgetBase = period ? `${period} allocation` : "approved budget";
  const noActuals = period ? `No ${period} actuals yet` : "No actuals yet";
  const reporting = {
    up_to_date: overview.mdas.filter((m) => m.reporting_status === "up_to_date").length,
    missed_latest: overview.mdas.filter((m) => m.reporting_status === "missed_latest").length,
    never: overview.mdas.filter((m) => m.reporting_status === "never").length,
  };

  return (
    <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
      <GlanceCard title="Budget absorbed" description={`Actual spend as a share of the ${budgetBase}.`}>
        <DonutShareChart
          height={180}
          centerValue={formatPercent(totals.utilisation)}
          centerLabel="spent"
          emptyMessage="No approved budget"
          data={[
            {
              id: "spent",
              label: totals.spent > totals.budget ? "Spent (over budget)" : "Spent",
              value: Math.min(totals.spent, totals.budget),
              color: totals.spent > totals.budget ? STATUS_COLORS.rejected : "hsl(var(--primary))",
            },
            {
              id: "unspent",
              label: "Unspent",
              value: Math.max(0, totals.budget - totals.spent),
              color: "hsl(var(--muted-foreground) / 0.2)",
            },
          ]}
        />
      </GlanceCard>
      <GlanceCard title="Funds released" description={`Releases as a share of the ${budgetBase}.`}>
        <DonutShareChart
          height={180}
          centerValue={formatPercent(totals.release_rate)}
          centerLabel="released"
          emptyMessage={
            coverage.releases_recorded ? "No approved budget" : `No ${period ? `${period} ` : ""}releases recorded yet`
          }
          data={!coverage.releases_recorded ? [] : [
            {
              id: "released",
              label: "Released",
              value: Math.min(totals.released, totals.budget),
              color: "hsl(var(--chart-2))",
            },
            {
              id: "not-released",
              label: "Not released",
              value: Math.max(0, totals.budget - totals.released),
              color: "hsl(var(--muted-foreground) / 0.2)",
            },
          ]}
        />
      </GlanceCard>
      <GlanceCard
        title="Where the money went"
        description={`${period ?? "Year-to-date"} actual spend by economic class.`}
      >
        <DonutShareChart
          height={180}
          centerValue={formatCompactNaira(totals.spent)}
          centerLabel="spent"
          emptyMessage={noActuals}
          data={overview.components.map((c) => ({
            id: c.budget_class,
            label: c.label,
            value: c.spent,
            color: CLASS_COLORS[c.budget_class],
          }))}
        />
      </GlanceCard>
      <GlanceCard
        title="Monthly returns"
        description={
          coverage.tracking_horizon
            ? `MDAs that returned ${MONTH_LABELS[coverage.tracking_horizon - 1]} tracking.`
            : `No monthly returns${period ? ` in ${period}` : ""} yet.`
        }
      >
        <DonutShareChart
          height={180}
          centerValue={`${reporting.up_to_date} / ${coverage.mdas_total}`}
          centerLabel="up to date"
          formatValue={formatMdaCount}
          emptyMessage="No MDAs"
          data={[
            { id: "up_to_date", label: "Up to date", value: reporting.up_to_date, color: STATUS_COLORS.approved },
            {
              id: "missed_latest",
              label: period ? "Missing months" : "Missed latest",
              value: reporting.missed_latest,
              color: STATUS_COLORS.pending,
            },
            {
              id: "never",
              label: period ? `None in ${period}` : "Never submitted",
              value: reporting.never,
              color: STATUS_COLORS.rejected,
            },
          ]}
        />
      </GlanceCard>
    </div>
  );
}

function GlanceCard({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-2 rounded-xl border bg-card p-4">
      <div className="flex flex-col gap-0.5">
        <span className="text-sm font-semibold">{title}</span>
        <span className="text-xs text-muted-foreground">{description}</span>
      </div>
      {children}
    </div>
  );
}

function AttentionCard({
  href,
  icon: Icon,
  count,
  title,
  names,
  helper,
  unavailable,
}: {
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  count: number;
  title: string;
  names: string[];
  helper: string;
  /** Why this check can't be made for the period; replaces the count. */
  unavailable?: string;
}) {
  if (unavailable) {
    return (
      <div className="flex flex-col gap-2 rounded-xl border bg-card p-4">
        <div className="flex items-center justify-between">
          <span className="flex items-center gap-2 text-sm font-semibold">
            <Icon className="size-4 text-muted-foreground" />
            {title}
          </span>
          <span className="text-2xl font-semibold text-muted-foreground">—</span>
        </div>
        <span className="text-xs text-muted-foreground">{helper}</span>
        <MissingData>{unavailable}</MissingData>
      </div>
    );
  }
  return (
    <Link
      href={href}
      className={cn(
        "focus-ring flex flex-col gap-2 rounded-xl border p-4 transition-colors hover:border-primary/40",
        count > 0 ? "bg-status-rejected-bg/40" : "bg-card",
      )}
    >
      <div className="flex items-center justify-between">
        <span className="flex items-center gap-2 text-sm font-semibold">
          <Icon className={cn("size-4", count > 0 ? "text-status-rejected" : "text-status-approved")} />
          {title}
        </span>
        <span
          className={cn(
            "text-2xl font-semibold tabular-nums",
            count > 0 ? "text-status-rejected" : "text-status-approved",
          )}
        >
          {count}
        </span>
      </div>
      <span className="text-xs text-muted-foreground">{helper}</span>
      {names.length > 0 ? (
        <ul className="flex flex-col gap-0.5 text-xs">
          {names.slice(0, 3).map((n) => (
            <li key={n} className="truncate">
              {n}
            </li>
          ))}
          {names.length > 3 ? (
            <li className="text-muted-foreground">+{names.length - 3} more</li>
          ) : null}
        </ul>
      ) : (
        <span className="text-xs text-status-approved">None</span>
      )}
    </Link>
  );
}

function ReportLink({ href, title, helper }: { href: string; title: string; helper: string }) {
  return (
    <Link
      href={href}
      className="focus-ring flex items-start gap-3 rounded-lg border p-3 hover:border-primary/40 hover:bg-primary/5"
    >
      <FileTextIcon className="mt-0.5 size-4 shrink-0 text-primary" />
      <span className="flex flex-col">
        <span className="text-sm font-medium">{title}</span>
        <span className="text-xs text-muted-foreground">{helper}</span>
      </span>
    </Link>
  );
}
