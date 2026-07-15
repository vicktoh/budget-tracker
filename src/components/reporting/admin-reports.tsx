"use client";

import * as React from "react";
import { useSearchParams } from "next/navigation";
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
import { formatPercent } from "@/lib/format";

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

      <dl className="flex flex-wrap gap-x-8 gap-y-2 px-1 text-xs text-muted-foreground">
        <div className="flex items-center gap-1.5">
          <span
            aria-hidden
            className="size-1.5 rounded-full bg-status-approved"
          />
          <dt>Entries in period</dt>
          <dd className="font-semibold text-foreground tabular-nums">{entryCount}</dd>
        </div>
        <div className="flex items-center gap-1.5">
          <dt>Execution</dt>
          <dd className="font-semibold text-foreground tabular-nums">
            {kpis ? formatPercent(kpis.budget_execution_rate) : "—"}
          </dd>
        </div>
        <div className="flex items-center gap-1.5">
          <dt>PHC share</dt>
          <dd className="font-semibold text-foreground tabular-nums">
            {phcShare ? formatPercent(phcShare.phc_share) : "—"}
          </dd>
        </div>
      </dl>

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
