"use client";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { ChartCard } from "@/components/reporting/chart-card";
import { ReportStatStrip } from "@/components/reporting/report-stat-strip";
import { BulletPerformanceList } from "@/components/reporting/charts/bullet-performance-list";
import { GroupedCompareChart } from "@/components/reporting/charts/grouped-compare-chart";
import { CHART_COLORS } from "@/components/reporting/charts/palette";
import {
  ReportPreviewScaffold,
  type ReportBodyProps,
} from "@/components/reporting/reports/report-preview-scaffold";
import {
  aggregateAopPlannedVsActual,
  aggregateBudgetVsActual,
  aggregateHeadlineKpis,
  filterExpenditure,
} from "@/lib/reporting/aggregate";
import { proRataBand, proRataTarget } from "@/lib/reporting/signals";
import { formatCompactNaira, formatInteger, formatPercent } from "@/lib/format";

export function MbpReportRoute() {
  return (
    <ReportPreviewScaffold templateId="mbp">
      {(props) => <MbpReportBody {...props} />}
    </ReportPreviewScaffold>
  );
}

function MbpReportBody({
  dataset,
  effectiveFilters,
  quarter,
  periodLabel,
  loading,
}: ReportBodyProps) {
  const rows = aggregateBudgetVsActual(
    dataset.budgets,
    dataset.funding,
    dataset.expenditure,
    effectiveFilters,
    {},
  )
    .filter((row) => row.total_budget_amount > 0)
    .sort((a, b) => (b.budget_used_ratio ?? 0) - (a.budget_used_ratio ?? 0));
  const target = proRataTarget(quarter);
  const kpis = aggregateHeadlineKpis(
    dataset.budgets,
    dataset.funding,
    dataset.expenditure,
    effectiveFilters,
    {},
  );
  const actualMdaIds = new Set(
    filterExpenditure(
      dataset.expenditure,
      { ...effectiveFilters, status: "all" },
      {},
    )
      .filter((row) => row.status === "approved" || row.status === "processed")
      .map((row) => row.mda_id),
  );
  const zeroSpendMdas = rows.filter((row) => !actualMdaIds.has(row.mda_id)).length;

  const allAopRows = aggregateAopPlannedVsActual(
    dataset.aopActivities,
    dataset.expenditure,
    effectiveFilters,
    {},
  );
  const aopPlanned = allAopRows.reduce((sum, row) => sum + row.budgeted_cost, 0);
  const aopLinked = allAopRows.reduce(
    (sum, row) => sum + row.linked_expenditure_amount,
    0,
  );
  const aopImplementation = aopPlanned === 0 ? null : aopLinked / aopPlanned;
  const costedActivities = allAopRows.filter((row) => row.budgeted_cost > 0).length;
  const startedActivities = allAopRows.filter(
    (row) => row.linked_expenditure_amount > 0,
  ).length;
  const aopRows = [...allAopRows]
    .sort((a, b) => b.budgeted_cost - a.budgeted_cost)
    .slice(0, 8);

  return (
    <div className="flex flex-col gap-5">
      <div>
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Execution &amp; Absorption Review · {periodLabel}
        </p>
        <h2 className="text-xl font-semibold tracking-tight">
          Pro-rata execution by MDA
        </h2>
        <p className="mt-0.5 text-sm text-muted-foreground">
          Target for this period: {formatPercent(target)} of the approved budget.
        </p>
      </div>

      <ReportStatStrip
        eyebrow="Budget snapshot"
        title="Execution at a glance"
        stats={[
          {
            label: "Approved budget",
            value: formatCompactNaira(kpis.total_budget_amount),
            helper: "Total approved budget across the MDAs in the current scope.",
          },
          {
            label: "Actual expenditure",
            value: formatCompactNaira(kpis.total_expenditure_amount),
            helper: `Approved and processed expenditure for ${periodLabel}.`,
          },
          {
            label: "Overall execution",
            value: formatPercent(kpis.budget_execution_rate),
            helper: `Measured against the ${formatPercent(target)} pro-rata benchmark.`,
            badge: `${formatPercent(target)} target`,
            tone: proRataBand(kpis.budget_execution_rate, quarter),
            progress: kpis.budget_execution_rate,
            progressLabel: "Share of approved budget spent",
          },
          {
            label: "MDAs with zero spend",
            value: `${formatInteger(zeroSpendMdas)} of ${formatInteger(rows.length)}`,
            helper: "Budgeted MDAs with no approved or processed expenditure recorded.",
            tone: zeroSpendMdas > 0 ? "investigate" : "strong",
          },
        ]}
      />

      <ChartCard
        title="Budget execution vs pro-rata"
        description="MDAs ranked by share of approved budget spent so far. The tick marks the pro-rata target for this period."
        loading={loading}
        isEmpty={!loading && rows.length === 0}
      >
        <BulletPerformanceList
          items={rows.map((row) => ({
            id: row.mda_id,
            label: row.mda_name,
            planLabel: formatCompactNaira(row.total_budget_amount),
            actualLabel: formatCompactNaira(row.total_expenditure_amount),
            ratio: row.budget_used_ratio,
          }))}
          target={target}
        />
      </ChartCard>

      <ReportStatStrip
        eyebrow="Planning snapshot"
        title="AOP implementation at a glance"
        stats={[
          {
            label: "AOP activities",
            value: formatInteger(allAopRows.length),
            helper: `${formatInteger(costedActivities)} activities have a planned cost above zero.`,
          },
          {
            label: "Total planned cost",
            value: formatCompactNaira(aopPlanned),
            helper: "Combined planned cost of active AOP activities in scope.",
          },
          {
            label: "Linked expenditure",
            value: formatCompactNaira(aopLinked),
            helper: `${formatInteger(startedActivities)} activities have approved or processed spend.`,
            tone: aopLinked === 0 && aopPlanned > 0 ? "critical" : "default",
          },
          {
            label: "AOP implementation",
            value: formatPercent(aopImplementation),
            helper: "Linked expenditure as a share of total planned AOP cost.",
            tone: proRataBand(aopImplementation, quarter),
            progress: aopImplementation,
            progressLabel: "Share of planned activity cost implemented",
          },
        ]}
      />

      <ChartCard
        title="AOP planned vs recorded spend"
        description="The eight largest Annual Operational Plan activities by planned cost, against expenditure linked to each."
        loading={loading}
        isEmpty={!loading && aopRows.length === 0}
        emptyDescription="No AOP activities match the current filters."
      >
        <GroupedCompareChart
          data={aopRows.map((row) => ({
            id: row.aop_activity_id,
            label: row.description,
            primary: row.budgeted_cost,
            secondary: row.linked_expenditure_amount,
          }))}
          primaryName="Planned (AOP)"
          secondaryName="Linked spend"
          primaryColor={CHART_COLORS[3]}
          secondaryColor={CHART_COLORS[0]}
          labelWidth={180}
        />
      </ChartCard>

      <Alert>
        <AlertTitle>Full review in progress</AlertTitle>
        <AlertDescription>
          The complete Budget &amp; Planning review — released-vs-spent absorption,
          budget composition, and the release calendar — lands in Phase 5. Execution
          and AOP variance above are computed live from the selected period.
        </AlertDescription>
      </Alert>
    </div>
  );
}
