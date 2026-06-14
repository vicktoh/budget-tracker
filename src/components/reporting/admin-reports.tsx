"use client";

import * as React from "react";
import { DownloadIcon, Loader2Icon } from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/layout/page-header";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Combobox, type ComboboxOption } from "@/components/ui/combobox";
import { ChartCard } from "@/components/reporting/chart-card";
import { DeltaBadge, KpiTile } from "@/components/reporting/kpi-tile";
import { DonutShareChart } from "@/components/reporting/charts/donut-share-chart";
import { ProgressList } from "@/components/reporting/charts/progress-list";
import { QuarterlyTrendChart } from "@/components/reporting/charts/quarterly-trend-chart";
import { CHART_COLORS } from "@/components/reporting/charts/palette";
import { useReportingData } from "@/components/reporting/use-reporting-data";
import { useReportFilters } from "@/hooks/use-report-filters";
import { hasSupabaseConfig, supabase } from "@/lib/supabase";
import {
  aggregateBudgetComposition,
  aggregateCategoryShare,
  aggregateHeadlineKpis,
  aggregateLgaPhcShare,
  aggregateMdaExecutionLeaderboard,
  aggregatePhcCoverage,
  aggregatePhcFacilityLeaderboard,
  aggregatePhcShare,
  aggregateProgrammeAreaSummary,
  aggregateQuarterlyTrend,
} from "@/lib/reporting/aggregate";
import {
  formatCompactNaira,
  formatNaira,
  formatPercent,
} from "@/lib/format";
import type { ReportFilters, ReportQuarter } from "@/lib/reporting/types";
import { cn } from "@/lib/utils";

const QUARTERS: ReportQuarter[] = [1, 2, 3, 4];

export function AdminReportsRoute() {
  const { dataset, options, loading, error } = useReportingData(supabase, {});
  const { filters, setFilter } = useReportFilters();
  const reportRef = React.useRef<HTMLDivElement>(null);
  const [exporting, setExporting] = React.useState(false);

  const handleDownloadPdf = React.useCallback(async (periodSlug: string) => {
    if (!reportRef.current || exporting) return;
    setExporting(true);
    try {
      // Loaded on demand so the PDF libraries stay out of the main bundle.
      const { exportElementToPdf } = await import("@/lib/reporting/export-pdf");
      await exportElementToPdf(
        reportRef.current,
        `budget-performance-report-${periodSlug}.pdf`,
      );
    } catch (cause) {
      // eslint-disable-next-line no-console
      console.error("PDF export failed", cause);
      toast.error("Could not generate the PDF. Please try again.");
    } finally {
      setExporting(false);
    }
  }, [exporting]);

  if (!hasSupabaseConfig || !supabase) {
    return (
      <div className="flex flex-col gap-5">
        <PageHeader
          title="Budget Performance Report"
          description="Quarterly infographic view of statewide budget performance."
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

  // The report always describes a single fiscal year. Default to the most
  // recent year with data so KPIs never mix budget years.
  const latestFiscalYear = options?.fiscalYears[0] ?? null;
  const fiscalYear = filters.fiscalYear ?? latestFiscalYear;
  const effectiveFilters: ReportFilters = { ...filters, fiscalYear };
  const quarter = effectiveFilters.quarter;

  const periodLabel =
    fiscalYear === null
      ? "—"
      : quarter
        ? `FY ${fiscalYear} · Q${quarter}`
        : `FY ${fiscalYear} · Full year`;

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
  const trend = dataset
    ? aggregateQuarterlyTrend(dataset.funding, dataset.expenditure, effectiveFilters, {})
    : [];
  const phcTrend = dataset
    ? aggregateQuarterlyTrend(
        dataset.funding,
        dataset.expenditure,
        { ...effectiveFilters, phc: "yes" },
        {},
      )
    : [];
  const categories = dataset
    ? aggregateCategoryShare(dataset.expenditure, effectiveFilters, {})
    : [];
  const composition = dataset
    ? aggregateBudgetComposition(dataset.budgets, effectiveFilters, {})
    : null;
  const programmes = dataset
    ? aggregateProgrammeAreaSummary(dataset.funding, dataset.expenditure, effectiveFilters, {})
    : [];
  const leaderboard = dataset
    ? aggregateMdaExecutionLeaderboard(
        dataset.budgets,
        dataset.expenditure,
        effectiveFilters,
        {},
      )
    : [];
  const lgaShare = dataset
    ? aggregateLgaPhcShare(dataset.expenditure, effectiveFilters, {})
    : [];
  const facilityLeaderboard = dataset
    ? aggregatePhcFacilityLeaderboard(dataset.expenditure, effectiveFilters, {})
    : [];
  const phcCoverage = dataset
    ? aggregatePhcCoverage(dataset.expenditure, effectiveFilters, {})
    : null;

  // Quarter-over-quarter expenditure delta for the selected quarter.
  const expenditureDelta = computeQoqDelta(trend, quarter);

  const hasLedgerData = trend.some(
    (row) => row.total_funding_amount > 0 || row.total_expenditure_amount > 0,
  );

  const selectedLgaLabel = filters.lgaId
    ? (options?.lgas.find((option) => option.value === filters.lgaId)?.label ?? null)
    : null;

  const periodSlug = [
    fiscalYear === null
      ? "all"
      : quarter
        ? `fy${fiscalYear}-q${quarter}`
        : `fy${fiscalYear}-full-year`,
    filters.phc === "yes" ? "phc" : filters.phc === "no" ? "non-phc" : null,
    selectedLgaLabel
      ? selectedLgaLabel.toLowerCase().replace(/[^a-z0-9]+/g, "-")
      : null,
  ]
    .filter(Boolean)
    .join("-");

  return (
    <div ref={reportRef} className="flex flex-col gap-5">
      <PageHeader
        title="Budget Performance Report"
        description="Infographic summary of statewide health budget performance — spending by category, PHC share, and quarterly execution."
        actions={
          <div data-pdf-exclude>
            <Button
              type="button"
              variant="outline"
              disabled={loading || exporting || !dataset}
              onClick={() => handleDownloadPdf(periodSlug)}
            >
              {exporting ? (
                <Loader2Icon
                  aria-hidden="true"
                  className="size-4 animate-spin"
                  data-icon="inline-start"
                />
              ) : (
                <DownloadIcon
                  aria-hidden="true"
                  className="size-4"
                  data-icon="inline-start"
                />
              )}
              {exporting ? "Preparing PDF…" : "Download PDF"}
            </Button>
          </div>
        }
      />

      {error ? (
        <Alert variant="destructive">
          <AlertTitle>Could not load report</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}

      <PeriodSelector
        fiscalYears={options?.fiscalYears ?? []}
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

      {/* KPI row */}
      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        <KpiTile
          label="Approved budget"
          value={kpis ? formatCompactNaira(kpis.total_budget_amount) : "—"}
          helper={`State health envelope · ${periodLabel.split(" · ")[0] ?? ""}`}
        />
        <KpiTile
          label="Funding received"
          value={kpis ? formatCompactNaira(kpis.total_funding_amount) : "—"}
          helper={periodLabel}
        />
        <KpiTile
          label="Total spending"
          value={kpis ? formatCompactNaira(kpis.total_expenditure_amount) : "—"}
          helper={periodLabel}
          badge={<DeltaBadge ratio={expenditureDelta} />}
        />
        <KpiTile
          label="Budget execution"
          value={kpis ? formatPercent(kpis.budget_execution_rate) : "—"}
          progress={kpis?.budget_execution_rate ?? null}
          progressLabel="Actual spending vs approved budget"
        />
        <KpiTile
          label="PHC share"
          value={phcShare ? formatPercent(phcShare.phc_share) : "—"}
          progress={phcShare?.phc_share ?? null}
          progressLabel={
            phcShare ? `${formatCompactNaira(phcShare.phc_amount)} on PHC` : undefined
          }
        />
      </section>

      {/* Quarterly performance */}
      <ChartCard
        title="Quarterly performance"
        description="Funding received vs spending recorded per quarter. Click a quarter to focus the whole report on it."
        loading={loading}
        isEmpty={!loading && !hasLedgerData}
      >
        <QuarterlyTrendChart
          data={trend}
          activeQuarter={quarter}
          onSelectQuarter={(next) =>
            setFilter("quarter", next === quarter ? null : next)
          }
        />
      </ChartCard>

      {/* Where the money went */}
      <section className="grid gap-5 lg:grid-cols-2">
        <ChartCard
          title="Where the money went"
          description="Approved and processed spending split by expenditure category."
          loading={loading}
          isEmpty={!loading && categories.length === 0}
        >
          <DonutShareChart
            data={categories.slice(0, 5).map((row) => ({
              id: row.expenditure_category_id,
              label: row.expenditure_category_name,
              value: row.total_amount,
            }))}
            centerValue={
              kpis ? formatCompactNaira(kpis.total_expenditure_amount) : undefined
            }
            centerLabel="Total spending"
          />
        </ChartCard>

        <ChartCard
          title="Spending by category"
          description="All categories ranked by share of total spending in the selected period."
          loading={loading}
          isEmpty={!loading && categories.length === 0}
        >
          <ProgressList
            items={categories.map((row) => ({
              id: row.expenditure_category_id,
              label: row.expenditure_category_name,
              valueLabel: formatCompactNaira(row.total_amount),
              ratio: row.share ?? 0,
              shareLabel: formatPercent(row.share),
            }))}
          />
        </ChartCard>
      </section>

      {/* PHC focus */}
      <section className="grid gap-5 lg:grid-cols-2">
        <ChartCard
          title="PHC share of health spending"
          description="Primary health care spending compared with all other health spending."
          loading={loading}
          isEmpty={!loading && (phcShare === null || phcShare.total_amount === 0)}
        >
          <DonutShareChart
            data={
              phcShare
                ? [
                    {
                      id: "phc",
                      label: "PHC",
                      value: phcShare.phc_amount,
                      color: CHART_COLORS[0],
                    },
                    {
                      id: "non-phc",
                      label: "Non-PHC",
                      value: phcShare.non_phc_amount,
                      color: CHART_COLORS[3],
                    },
                  ]
                : []
            }
            centerValue={phcShare ? formatPercent(phcShare.phc_share) : undefined}
            centerLabel="PHC share"
          />
        </ChartCard>

        <ChartCard
          title="PHC spending by quarter"
          description="How PHC-flagged spending moved through the year."
          loading={loading}
          isEmpty={
            !loading &&
            !phcTrend.some((row) => row.total_expenditure_amount > 0)
          }
        >
          <ProgressList
            items={phcTrend.map((row) => {
              const max = Math.max(
                ...phcTrend.map((r) => r.total_expenditure_amount),
                1,
              );
              return {
                id: `q${row.quarter}`,
                label: `Q${row.quarter}`,
                valueLabel: formatCompactNaira(row.total_expenditure_amount),
                ratio: row.total_expenditure_amount / max,
                color: quarter === row.quarter ? CHART_COLORS[0] : CHART_COLORS[2],
              };
            })}
          />
        </ChartCard>
      </section>

      {/* PHC & LGA analysis */}
      <section className="flex flex-col gap-4">
        <div className="flex flex-col gap-1">
          <h2 className="text-lg font-semibold">PHC &amp; LGA analysis</h2>
          <p className="text-sm text-muted-foreground">
            Where primary health care money landed
            {selectedLgaLabel ? ` in ${selectedLgaLabel}` : " across local government areas"} —
            approved and processed spending only.
          </p>
        </div>

        <div className="grid gap-4 sm:grid-cols-3">
          <KpiTile
            label="LGAs reached"
            value={phcCoverage ? String(phcCoverage.lga_count) : "—"}
            helper={`PHC spending footprint · ${periodLabel}`}
          />
          <KpiTile
            label="Facilities reporting"
            value={phcCoverage ? String(phcCoverage.facility_count) : "—"}
            helper="PHC facilities with recorded spending"
          />
          <KpiTile
            label="Average per facility"
            value={
              phcCoverage?.average_per_facility != null
                ? formatCompactNaira(phcCoverage.average_per_facility)
                : "—"
            }
            helper="Actual PHC spending per reporting facility"
          />
        </div>

        <div className="grid gap-5 lg:grid-cols-2">
          <ChartCard
            title="PHC spending by LGA"
            description="Local government areas ranked by share of PHC spending. Click an LGA to focus the report on it."
            loading={loading}
            isEmpty={!loading && lgaShare.length === 0}
          >
            <ProgressList
              items={lgaShare.map((row) => ({
                id: row.lga_id,
                label: row.lga_name,
                valueLabel: formatCompactNaira(row.total_expenditure_amount),
                ratio: row.share ?? 0,
                shareLabel: `${formatPercent(row.share)} · ${row.facility_count} ${
                  row.facility_count === 1 ? "facility" : "facilities"
                }`,
                color:
                  filters.lgaId === row.lga_id ? CHART_COLORS[0] : undefined,
                active: filters.lgaId === row.lga_id,
                onClick: () =>
                  setFilter("lgaId", filters.lgaId === row.lga_id ? null : row.lga_id),
              }))}
            />
          </ChartCard>

          <ChartCard
            title="Top PHC facilities"
            description="Facilities receiving the most PHC spending in the selected period."
            loading={loading}
            isEmpty={!loading && facilityLeaderboard.length === 0}
          >
            <ProgressList
              items={facilityLeaderboard.slice(0, 8).map((row) => ({
                id: row.facility_id,
                label: row.facility_name,
                valueLabel: formatCompactNaira(row.total_expenditure_amount),
                ratio: row.share ?? 0,
                shareLabel: row.lga_name,
              }))}
            />
          </ChartCard>
        </div>
      </section>

      {/* Programme areas + budget composition */}
      <section className="grid gap-5 lg:grid-cols-2">
        <ChartCard
          title="Top programme areas"
          description="Programme areas ranked by spending, with the funding gap for each."
          loading={loading}
          isEmpty={!loading && programmes.length === 0}
        >
          <ProgressList
            items={programmes.slice(0, 8).map((row) => {
              const max = Math.max(
                ...programmes.map((r) => r.total_expenditure_amount),
                1,
              );
              return {
                id: row.programme_area_id,
                label: row.programme_area_name,
                valueLabel: formatCompactNaira(row.total_expenditure_amount),
                ratio: row.total_expenditure_amount / max,
                shareLabel: `gap ${formatCompactNaira(row.gap_amount)}`,
              };
            })}
          />
        </ChartCard>

        <ChartCard
          title="Budget composition"
          description="How the approved budget splits across personnel, other recurrent, and capital."
          loading={loading}
          isEmpty={
            !loading && (composition === null || composition.total_budget_amount === 0)
          }
        >
          <DonutShareChart
            data={
              composition
                ? [
                    {
                      id: "personnel",
                      label: "Personnel",
                      value: composition.personnel_amount,
                    },
                    {
                      id: "other-recurrent",
                      label: "Other recurrent",
                      value: composition.other_recurrent_amount,
                    },
                    {
                      id: "capital",
                      label: "Capital",
                      value: composition.capital_amount,
                    },
                  ]
                : []
            }
            centerValue={
              composition ? formatCompactNaira(composition.total_budget_amount) : undefined
            }
            centerLabel="Approved budget"
          />
        </ChartCard>
      </section>

      {/* MDA execution leaderboard */}
      <section className="grid gap-5 lg:grid-cols-2">
        <ChartCard
          title="Highest budget execution"
          description="MDAs spending the largest share of their approved budget."
          loading={loading}
          isEmpty={!loading && leaderboard.length === 0}
        >
          <ProgressList
            items={leaderboard.slice(0, 5).map((row) => ({
              id: row.mda_id,
              label: row.mda_name,
              valueLabel: formatCompactNaira(row.total_expenditure_amount),
              ratio: row.execution_rate,
              shareLabel: formatPercent(row.execution_rate),
            }))}
          />
        </ChartCard>

        <ChartCard
          title="Lowest budget execution"
          description="MDAs with the most unspent approved budget."
          loading={loading}
          isEmpty={!loading && leaderboard.length === 0}
        >
          <ProgressList
            items={leaderboard
              .slice(-5)
              .reverse()
              .map((row) => ({
                id: row.mda_id,
                label: row.mda_name,
                valueLabel: formatCompactNaira(row.total_expenditure_amount),
                ratio: row.execution_rate,
                shareLabel: formatPercent(row.execution_rate),
              }))}
          />
        </ChartCard>
      </section>

      <p className="text-xs text-muted-foreground">
        Figures cover approved and processed entries only. Total values shown in
        full: budget {kpis ? formatNaira(kpis.total_budget_amount) : "—"}, funding{" "}
        {kpis ? formatNaira(kpis.total_funding_amount) : "—"}, spending{" "}
        {kpis ? formatNaira(kpis.total_expenditure_amount) : "—"}.
      </p>
    </div>
  );
}

function computeQoqDelta(
  trend: ReturnType<typeof aggregateQuarterlyTrend>,
  quarter: ReportQuarter | null,
): number | null {
  if (!quarter || quarter === 1 || trend.length === 0) return null;
  const current = trend[quarter - 1]?.total_expenditure_amount ?? 0;
  const previous = trend[quarter - 2]?.total_expenditure_amount ?? 0;
  if (previous === 0) return null;
  return (current - previous) / previous;
}

const PHC_FOCUS_OPTIONS: Array<{
  value: ReportFilters["phc"];
  label: string;
}> = [
  { value: "any", label: "All spending" },
  { value: "yes", label: "PHC only" },
  { value: "no", label: "Non-PHC" },
];

type PeriodSelectorProps = {
  fiscalYears: number[];
  fiscalYear: number | null;
  quarter: ReportQuarter | null;
  phc: ReportFilters["phc"];
  lgaId: string | null;
  lgaOptions: ComboboxOption[];
  loading: boolean;
  onFiscalYearChange: (year: number | null) => void;
  onQuarterChange: (quarter: ReportQuarter | null) => void;
  onPhcChange: (phc: ReportFilters["phc"]) => void;
  onLgaChange: (lgaId: string | null) => void;
};

function PeriodSelector({
  fiscalYears,
  fiscalYear,
  quarter,
  phc,
  lgaId,
  lgaOptions,
  loading,
  onFiscalYearChange,
  onQuarterChange,
  onPhcChange,
  onLgaChange,
}: PeriodSelectorProps) {
  const yearOptions: ComboboxOption[] = fiscalYears.map((year) => ({
    value: String(year),
    label: `FY ${year}`,
  }));

  return (
    <section
      aria-label="Report period"
      className="flex flex-wrap items-center gap-3 rounded-lg border bg-card p-4"
    >
      <div className="flex items-center gap-2">
        <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          Fiscal year
        </span>
        <Combobox
          id="report-period-fy"
          options={yearOptions}
          value={fiscalYear === null ? "" : String(fiscalYear)}
          onValueChange={(value) =>
            onFiscalYearChange(value ? Number.parseInt(value, 10) : null)
          }
          placeholder="Fiscal year"
          disabled={loading || yearOptions.length === 0}
          className="w-36"
        />
      </div>

      <div className="flex items-center gap-2" role="group" aria-label="Quarter">
        <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          Quarter
        </span>
        <div className="flex items-center gap-1">
          <QuarterPill
            label="Full year"
            active={quarter === null}
            disabled={loading}
            onClick={() => onQuarterChange(null)}
          />
          {QUARTERS.map((value) => (
            <QuarterPill
              key={value}
              label={`Q${value}`}
              active={quarter === value}
              disabled={loading}
              onClick={() => onQuarterChange(quarter === value ? null : value)}
            />
          ))}
        </div>
      </div>

      <div className="flex items-center gap-2" role="group" aria-label="PHC focus">
        <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          Focus
        </span>
        <div className="flex items-center gap-1">
          {PHC_FOCUS_OPTIONS.map((option) => (
            <QuarterPill
              key={option.value}
              label={option.label}
              active={phc === option.value}
              disabled={loading}
              onClick={() => onPhcChange(option.value)}
            />
          ))}
        </div>
      </div>

      <div className="flex items-center gap-2">
        <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          LGA
        </span>
        <Combobox
          id="report-period-lga"
          options={lgaOptions}
          value={lgaId ?? ""}
          onValueChange={(value) => onLgaChange(value || null)}
          placeholder="All LGAs"
          disabled={loading || lgaOptions.length === 0}
          className="w-44"
        />
      </div>
    </section>
  );
}

function QuarterPill({
  label,
  active,
  disabled,
  onClick,
}: {
  label: string;
  active: boolean;
  disabled?: boolean;
  onClick: () => void;
}) {
  return (
    <Button
      type="button"
      size="sm"
      variant={active ? "default" : "outline"}
      disabled={disabled}
      aria-pressed={active}
      onClick={onClick}
      className={cn("rounded-full px-3", !active && "text-muted-foreground")}
    >
      {label}
    </Button>
  );
}
