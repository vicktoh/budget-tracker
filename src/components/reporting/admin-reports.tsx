"use client";

import * as React from "react";
import { useSearchParams } from "next/navigation";
import {
  ActivityIcon,
  BanknoteIcon,
  HeartPulseIcon,
  ReceiptTextIcon,
} from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { PeriodSelector } from "@/components/reporting/period-selector";
import { ReportCard } from "@/components/reporting/reports-hub/report-card";
import { OfflineDataNotice } from "@/components/offline/offline-data-notice";
import { useReportingData } from "@/components/reporting/use-reporting-data";
import { useReportFilters } from "@/hooks/use-report-filters";
import { hasSupabaseConfig, supabase } from "@/lib/supabase";
import {
  REPORT_TEMPLATES,
  REPORT_TEMPLATE_ORDER,
} from "@/lib/reporting/report-templates";
import { computeHubSignals } from "@/lib/reporting/signals";
import {
  aggregateHeadlineKpis,
  aggregatePhcShare,
  filterExpenditure,
} from "@/lib/reporting/aggregate";
import {
  periodLabel as makePeriodLabel,
  resolveEffectiveFilters,
  resolveFiscalYear,
} from "@/lib/reporting/period";
import { formatCompactNaira, formatInteger, formatPercent } from "@/lib/format";

export function AdminReportsRoute() {
  const { dataset, options, loading, error, cachedAt } = useReportingData(
    supabase,
    {},
  );
  const { filters, setFilter } = useReportFilters();
  const searchParams = useSearchParams();

  if (!hasSupabaseConfig || !supabase) {
    return (
      <div className="flex flex-col gap-5">
        <PageHeader
          title="Reports"
          description="Audience-ready documents generated from the live ledger."
        />
        <Alert variant="warning">
          <AlertTitle>Supabase is not configured</AlertTitle>
          <AlertDescription>
            Add Supabase environment variables to load reporting data.
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  const fiscalYears = options?.fiscalYears ?? [];
  const fiscalYear = resolveFiscalYear(filters, fiscalYears);
  const effectiveFilters = resolveEffectiveFilters(filters, fiscalYears);
  const quarter = effectiveFilters.quarter;
  const label = makePeriodLabel(fiscalYear, quarter);

  const kpis = dataset
    ? aggregateHeadlineKpis(
        dataset.budgets,
        dataset.funding,
        dataset.expenditure,
        effectiveFilters,
        {},
      )
    : null;
  const phcShare = dataset
    ? aggregatePhcShare(dataset.expenditure, effectiveFilters, {})
    : null;
  const entryCount = dataset
    ? filterExpenditure(dataset.expenditure, effectiveFilters, {}).length
    : 0;

  const queryString = searchParams.toString();
  const hrefFor = (route: string) =>
    queryString ? `${route}?${queryString}` : route;

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title="Reports"
        description="Audience-ready documents generated from the live ledger. Preview before you distribute."
      />

      <OfflineDataNotice cachedAt={cachedAt} />

      {error ? (
        <Alert variant="destructive">
          <AlertTitle>Could not load reports</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}

      <PeriodSelector
        fiscalYears={fiscalYears}
        fiscalYear={fiscalYear}
        quarter={quarter}
        phc={filters.phc}
        lgaId={filters.lgaId}
        lgaOptions={options?.lgas ?? []}
        loading={loading}
        onFiscalYearChange={(year) => setFilter("fiscalYear", year)}
        onQuarterChange={(next) => setFilter("quarter", next)}
        onPhcChange={(next) => setFilter("phc", next)}
        onLgaChange={(next) => setFilter("lgaId", next)}
      />

      <section aria-labelledby="reports-snapshot-title" className="overflow-hidden rounded-lg border bg-card">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b bg-muted/35 px-4 py-3">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-primary">
              Reporting snapshot
            </p>
            <h2 id="reports-snapshot-title" className="text-sm font-semibold">
              What the selected period says
            </h2>
          </div>
          <span className="rounded-md border bg-card px-2.5 py-1 text-xs font-medium text-muted-foreground">
            {label}
          </span>
        </div>
        <dl className="grid sm:grid-cols-2 xl:grid-cols-4">
          <SnapshotMetric
            icon={BanknoteIcon}
            label="Approved budget"
            value={kpis ? formatCompactNaira(kpis.total_budget_amount) : "—"}
            helper="Current reporting scope"
          />
          <SnapshotMetric
            icon={ReceiptTextIcon}
            label="Recorded expenditure"
            value={kpis ? formatCompactNaira(kpis.total_expenditure_amount) : "—"}
            helper={`${formatInteger(entryCount)} expenditure ${entryCount === 1 ? "entry" : "entries"}`}
          />
          <SnapshotMetric
            icon={ActivityIcon}
            label="Budget execution"
            value={kpis ? formatPercent(kpis.budget_execution_rate) : "—"}
            helper="Share of approved budget spent"
            progress={kpis?.budget_execution_rate ?? null}
          />
          <SnapshotMetric
            icon={HeartPulseIcon}
            label="PHC share of spend"
            value={phcShare ? formatPercent(phcShare.phc_share) : "—"}
            helper="Expenditure tagged to primary healthcare"
            progress={phcShare?.phc_share ?? null}
          />
        </dl>
      </section>

      <section className="grid gap-4 lg:grid-cols-2">
        {REPORT_TEMPLATE_ORDER.map((id) => {
          const template = REPORT_TEMPLATES[id];
          const signals = dataset
            ? computeHubSignals(id, dataset, effectiveFilters, {})
            : [];
          return (
            <ReportCard
              key={id}
              template={template}
              href={hrefFor(template.route)}
              periodLabel={label}
              signals={signals}
              loading={loading}
            />
          );
        })}
      </section>
    </div>
  );
}

function SnapshotMetric({
  icon: Icon,
  label,
  value,
  helper,
  progress,
}: {
  icon: React.ComponentType<{ className?: string; "aria-hidden"?: boolean }>;
  label: string;
  value: string;
  helper: string;
  progress?: number | null;
}) {
  const percent = progress === null || progress === undefined
    ? null
    : Math.max(0, Math.min(1, progress));

  return (
    <div className="flex min-w-0 gap-3 border-b p-4 last:border-b-0 sm:odd:border-r xl:border-b-0 xl:border-r xl:last:border-r-0">
      <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-accent text-primary">
        <Icon aria-hidden className="size-4" />
      </span>
      <div className="min-w-0 flex-1">
        <dt className="text-xs font-medium text-muted-foreground">{label}</dt>
        <dd className="mt-0.5 text-xl font-semibold tabular-nums">{value}</dd>
        {percent !== null ? (
          <div
            role="progressbar"
            aria-label={label}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={Math.round(percent * 100)}
            className="mt-2 h-1.5 overflow-hidden rounded-full bg-muted"
          >
            <span className="block h-full rounded-full bg-primary" style={{ width: `${percent * 100}%` }} />
          </div>
        ) : null}
        <p className="mt-1 text-[11px] leading-4 text-muted-foreground">{helper}</p>
      </div>
    </div>
  );
}
