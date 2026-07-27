"use client";

import * as React from "react";
import { PageHeader } from "@/components/layout/page-header";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ChartCard } from "@/components/reporting/chart-card";
import { ReportFiltersBar } from "@/components/reporting/report-filters-bar";
import { StatCard } from "@/components/reporting/stat-card";
import { BudgetUtilizationBars } from "@/components/reporting/charts/budget-utilization-bars";
import { DonutShareChart } from "@/components/reporting/charts/donut-share-chart";
import { Leaderboard } from "@/components/reporting/insights/leaderboard";
import { MdaAnalysis } from "@/components/reporting/insights/mda-analysis";
import { SectorHero } from "@/components/reporting/insights/sector-hero";
import { HorizontalBarReport } from "@/components/reporting/charts/horizontal-bar-report";
import { useReportingData } from "@/components/reporting/use-reporting-data";
import { OfflineDataNotice } from "@/components/offline/offline-data-notice";
import { useReportFilters } from "@/hooks/use-report-filters";
import { hasSupabaseConfig, supabase } from "@/lib/supabase";
import {
  aggregateAopPlannedVsActual,
  aggregateBudgetVsActual,
  aggregateMdaScorecards,
  aggregatePhcFacilitySummary,
  aggregatePhcLgaSummary,
  aggregateProgrammeAreaSummary,
  aggregateEntrySummary,
  aggregateUnlinkedExpenditure,
} from "@/lib/reporting/aggregate";
import { formatCompactNaira, formatInteger, formatNaira } from "@/lib/format";
import type { ReportFilters } from "@/lib/reporting/types";

export function AdminInsightsRoute() {
  const { dataset, options, loading, error, cachedAt } = useReportingData(
    supabase,
    {},
  );
  const { filters, setFilters, setFilter, clearFilters } = useReportFilters();
  const [tab, setTab] = React.useState<"overview" | "mda" | "programme" | "phc" | "aop">("overview");
  const [selectedMdaId, setSelectedMdaId] = React.useState<string | null>(null);

  if (!hasSupabaseConfig || !supabase) {
    return (
      <div className="flex flex-col gap-5">
        <PageHeader
          title="Admin Insights"
          description="Statewide funding, expenditure, planning, and PHC reporting."
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

  const empty = dataset === null;
  const summary = dataset
    ? aggregateEntrySummary(dataset.funding, dataset.expenditure, filters, {})
    : null;

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title="Admin Insights"
        description="Statewide submissions, planning, PHC, and AOP reporting. Filters drive every report below."
      />

      {error ? (
        <Alert variant="destructive">
          <AlertTitle>Could not load insights</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}

      <OfflineDataNotice cachedAt={cachedAt} />

      <ReportFiltersBar
        filters={filters}
        options={options ?? {
          mdas: [], programmeAreas: [], fundingSources: [], expenditureCategories: [],
          lgas: [], facilities: [], fiscalYears: [],
        }}
        mode="admin"
        loading={loading}
        onChange={setFilters}
        onClear={clearFilters}
      />

      <Tabs
        value={tab}
        defaultValue="overview"
        onValueChange={(value) => setTab(value as typeof tab)}
      >
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="mda">MDA Analysis</TabsTrigger>
          <TabsTrigger value="programme">Programme</TabsTrigger>
          <TabsTrigger value="phc">PHC</TabsTrigger>
          <TabsTrigger value="aop">AOP</TabsTrigger>
        </TabsList>

        <TabsContent value="overview">
          <OverviewTab
            empty={empty}
            loading={loading}
            summary={summary}
            dataset={dataset}
            filters={filters}
            setFilter={setFilter}
          />
        </TabsContent>

        <TabsContent value="mda">
          <MdaAnalysisTab
            loading={loading}
            dataset={dataset}
            filters={filters}
            selectedMdaId={selectedMdaId}
            onSelectMda={setSelectedMdaId}
          />
        </TabsContent>

        <TabsContent value="programme">
          <ProgrammeTab
            loading={loading}
            dataset={dataset}
            filters={filters}
            setFilter={setFilter}
          />
        </TabsContent>

        <TabsContent value="phc">
          <PhcTab
            loading={loading}
            dataset={dataset}
            filters={filters}
            setFilter={setFilter}
          />
        </TabsContent>

        <TabsContent value="aop">
          <AopTab loading={loading} dataset={dataset} filters={filters} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

type TabProps = {
  loading: boolean;
  dataset: ReturnType<typeof useReportingData>["dataset"];
  filters: ReportFilters;
  setFilter: <K extends keyof ReportFilters>(key: K, value: ReportFilters[K]) => void;
};

type OverviewTabProps = TabProps & {
  empty: boolean;
  summary: ReturnType<typeof aggregateEntrySummary> | null;
};

function OverviewTab({ loading, dataset, filters, setFilter, summary }: OverviewTabProps) {
  const scorecards = dataset
    ? aggregateMdaScorecards(dataset.budgets, dataset.expenditure, dataset.monthly, filters, {})
    : [];
  const budgetRows = dataset
    ? aggregateBudgetVsActual(dataset.budgets, dataset.funding, dataset.expenditure, filters, {})
    : [];
  const approvedTotal = scorecards.reduce((sum, card) => sum + card.approved_total, 0);
  const officialTotal = scorecards.reduce((sum, card) => sum + card.official_total, 0);
  const monthsCovered = Math.max(
    0,
    ...scorecards.flatMap((card) => card.months_reported),
  );
  const reportingMdaCount = scorecards.filter((card) => card.months_reported.length > 0).length;
  const benchmarkQuarter = benchmarkQuarterFor(dataset);

  const classTotals = new Map<string, { label: string; approved: number; official: number }>();
  for (const card of scorecards) {
    for (const component of card.components) {
      const existing = classTotals.get(component.budget_class) ?? {
        label: component.label,
        approved: 0,
        official: 0,
      };
      existing.approved += component.approved_amount;
      existing.official += component.official_amount;
      classTotals.set(component.budget_class, existing);
    }
  }
  const classRows = Array.from(classTotals.entries());
  const watchlist = scorecards.flatMap((card) =>
    card.components
      .filter(
        (component) =>
          component.verdict === "differs" ||
          component.verdict === "untracked_spend" ||
          component.verdict === "tracking_only" ||
          component.q2_silent,
      )
      .map((component) => ({ card, component })),
  );

  return (
    <div className="flex flex-col gap-5">
      <SectorHero
        approvedTotal={approvedTotal}
        officialTotal={officialTotal}
        mdaCount={scorecards.length}
        monthsCovered={monthsCovered || 6}
        reportingMdaCount={reportingMdaCount}
        fiscalYear={filters.fiscalYear}
      />

      <section className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Recorded expenditure"
          value={summary ? formatCompactNaira(summary.totalExpenditure) : "—"}
          helper="Official BPR ledger, all quarters"
        />
        <StatCard
          label="Monthly tracked spend"
          value={dataset ? formatCompactNaira(dataset.monthly.reduce((sum, row) => sum + row.amount, 0)) : "—"}
          helper="IBP tracking workbook, Jan–Jun"
        />
        <StatCard
          label="MDAs submitting monthly"
          value={scorecards.length ? `${reportingMdaCount} / ${scorecards.length}` : "—"}
          helper="At least one monthly return"
        />
        <StatCard
          label="Reconciliation flags"
          value={formatInteger(watchlist.length)}
          helper="Component lines where sources disagree"
          tone={watchlist.length > 0 ? "pending" : "approved"}
        />
      </section>

      <section className="grid gap-4 lg:grid-cols-3">
        <ChartCard
          title="Approved budget composition"
          description="Personnel, overhead and capital shares of the approved envelope."
          loading={loading}
          isEmpty={!loading && classRows.length === 0}
        >
          <DonutShareChart
            data={classRows.map(([id, row]) => ({ id, label: row.label, value: row.approved }))}
            centerValue={formatCompactNaira(approvedTotal)}
            centerLabel="Approved"
          />
        </ChartCard>
        <ChartCard
          title="Actual spend composition"
          description="The same split for money actually recorded spent."
          loading={loading}
          isEmpty={!loading && officialTotal === 0}
        >
          <DonutShareChart
            data={classRows.map(([id, row]) => ({ id, label: row.label, value: row.official }))}
            centerValue={formatCompactNaira(officialTotal)}
            centerLabel="Recorded spent"
          />
        </ChartCard>
        <ChartCard
          title="Spend share by MDA"
          description="Which agencies the recorded spending sits with. Top six shown."
          loading={loading}
          isEmpty={!loading && officialTotal === 0}
        >
          <DonutShareChart
            data={(() => {
              const bySpend = scorecards
                .filter((card) => card.official_total > 0)
                .sort((a, b) => b.official_total - a.official_total);
              const top = bySpend.slice(0, 6);
              const rest = bySpend.slice(6).reduce((sum, card) => sum + card.official_total, 0);
              const rows = top.map((card) => ({
                id: card.mda_id,
                label: truncate(card.mda_name, 26),
                value: card.official_total,
              }));
              if (rest > 0) rows.push({ id: "rest", label: "All others", value: rest });
              return rows;
            })()}
            centerValue={formatInteger(scorecards.filter((card) => card.official_total > 0).length)}
            centerLabel="MDAs with spend"
          />
        </ChartCard>
      </section>

      <Leaderboard
        cards={scorecards}
        benchmarkQuarter={benchmarkQuarter}
        onSelect={(id) => setFilter("mdaId", id === filters.mdaId ? null : id)}
      />

      {watchlist.length > 0 ? (
        <ChartCard
          title="Reconciliation watchlist"
          description="Where the monthly tracking workbook and the published BPR tell different stories. The BPR stays authoritative."
          loading={loading}
        >
          <SummaryTable
            headers={["MDA", "Component", "Official BPR", "Monthly tracked", "Signal"]}
            rows={watchlist.map(({ card, component }) => [
              card.mda_name,
              component.label,
              formatNaira(component.official_amount),
              formatNaira(component.tracked_amount),
              component.q2_silent
                ? "Active in Q1, silent in Q2"
                : component.verdict === "differs"
                  ? "Totals disagree"
                  : component.verdict === "untracked_spend"
                    ? "Missing from monthly returns"
                    : "Awaiting the quarterly BPR",
            ])}
          />
        </ChartCard>
      ) : null}

      <ChartCard
        title="Budget vs actual by MDA"
        description="Approved budget compared with funding received and expenditure recorded. Click a bar to scope filters to that MDA."
        loading={loading}
        isEmpty={!loading && budgetRows.length === 0}
      >
        <BudgetUtilizationBars
          data={budgetRows.map((row) => ({
            id: row.mda_id,
            label: row.mda_name,
            budget: row.total_budget_amount,
            funding: row.total_funding_amount,
            expenditure: row.total_expenditure_amount,
          }))}
          activeId={filters.mdaId}
          onSelect={(id) => setFilter("mdaId", id === filters.mdaId ? null : id)}
        />
      </ChartCard>
    </div>
  );
}

/**
 * The pro-rata benchmark tracks the latest quarter with official spend, so a
 * half-year dataset is judged against 50%, not the full-year 100%.
 */
function benchmarkQuarterFor(
  dataset: ReturnType<typeof useReportingData>["dataset"],
): 1 | 2 | 3 | 4 | null {
  if (!dataset) return null;
  const quarters = dataset.expenditure.map((row) => row.quarter).filter((q) => q >= 1 && q <= 4);
  if (quarters.length === 0) return null;
  return Math.max(...quarters) as 1 | 2 | 3 | 4;
}

function ProgrammeTab({ loading, dataset, filters, setFilter }: TabProps) {
  const rows = dataset
    ? aggregateProgrammeAreaSummary(dataset.funding, dataset.expenditure, filters, {})
    : [];

  return (
    <div className="flex flex-col gap-5">
      <ChartCard
        title="Programme area: funding vs expenditure"
        description="Programme-area inflows compared with outflows. Negative gap = expenditure exceeds funding recorded."
        loading={loading}
        isEmpty={!loading && rows.length === 0}
      >
        <HorizontalBarReport
          data={rows.map((row) => ({
            id: row.programme_area_id,
            label: row.programme_area_name,
            value: row.total_expenditure_amount,
          }))}
          activeId={filters.programmeAreaId}
          onSelect={(id) =>
            setFilter("programmeAreaId", id === filters.programmeAreaId ? null : id)
          }
        />
        <Table className="mt-4" containerClassName="max-h-[70vh]">
          <TableHeader>
            <TableRow>
              <TableHead>Programme area</TableHead>
              <TableHead className="text-right">Funding</TableHead>
              <TableHead className="text-right">Expenditure</TableHead>
              <TableHead className="text-right">Gap</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((row) => (
              <TableRow key={row.programme_area_id}>
                <TableCell className="font-medium">{row.programme_area_name}</TableCell>
                <TableCell className="text-right tabular-nums">
                  {formatNaira(row.total_funding_amount)}
                </TableCell>
                <TableCell className="text-right tabular-nums">
                  {formatNaira(row.total_expenditure_amount)}
                </TableCell>
                <TableCell
                  className={`text-right tabular-nums ${
                    row.gap_amount < 0 ? "text-status-rejected" : "text-foreground"
                  }`}
                >
                  {formatNaira(row.gap_amount)}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </ChartCard>
    </div>
  );
}

function PhcTab({ loading, dataset, filters, setFilter }: TabProps) {
  const lgaRows = dataset ? aggregatePhcLgaSummary(dataset.expenditure, filters, {}) : [];
  const facilityRows = dataset
    ? aggregatePhcFacilitySummary(dataset.expenditure, filters, {})
    : [];

  return (
    <div className="grid gap-5 lg:grid-cols-2">
      <ChartCard
        title="PHC expenditure by LGA"
        description="Local government totals for PHC-flagged expenditure. Click to scope facility view to that LGA."
        loading={loading}
        isEmpty={!loading && lgaRows.length === 0}
      >
        <HorizontalBarReport
          data={lgaRows.map((row) => ({
            id: row.lga_id,
            label: row.lga_name,
            value: row.total_expenditure_amount,
          }))}
          activeId={filters.lgaId}
          onSelect={(id) => setFilter("lgaId", id === filters.lgaId ? null : id)}
        />
        <SummaryTable
          headers={["LGA", "Total", "Entries"]}
          rows={lgaRows.map((row) => [
            row.lga_name,
            formatNaira(row.total_expenditure_amount),
            formatInteger(row.entry_count),
          ])}
        />
      </ChartCard>

      <ChartCard
        title="PHC expenditure by facility"
        description="Facility-level PHC spending. Filtered by LGA when selected above."
        loading={loading}
        isEmpty={!loading && facilityRows.length === 0}
      >
        <HorizontalBarReport
          data={facilityRows.slice(0, 12).map((row) => ({
            id: row.facility_id,
            label: row.facility_name,
            value: row.total_expenditure_amount,
          }))}
          activeId={filters.facilityId}
          onSelect={(id) => setFilter("facilityId", id === filters.facilityId ? null : id)}
        />
        <SummaryTable
          headers={["Facility", "LGA", "Total", "Entries"]}
          rows={facilityRows.map((row) => [
            row.facility_name,
            row.lga_name,
            formatNaira(row.total_expenditure_amount),
            formatInteger(row.entry_count),
          ])}
        />
      </ChartCard>
    </div>
  );
}

function AopTab({
  loading,
  dataset,
  filters,
}: Omit<TabProps, "setFilter"> & { setFilter?: undefined }) {
  const aopRows = dataset
    ? aggregateAopPlannedVsActual(dataset.aopActivities, dataset.expenditure, filters, {})
    : [];
  const unlinkedRows = dataset
    ? aggregateUnlinkedExpenditure(dataset.expenditure, filters, {})
    : [];

  return (
    <div className="flex flex-col gap-5">
      <ChartCard
        title="AOP planned vs actual"
        description="AOP activity budget compared with linked expenditure. Negative remaining = activity is over budget."
        loading={loading}
        isEmpty={!loading && aopRows.length === 0}
      >
        <Table containerClassName="max-h-[70vh]">
          <TableHeader>
            <TableRow>
              <TableHead>FY</TableHead>
              <TableHead>Activity</TableHead>
              <TableHead>MDA</TableHead>
              <TableHead className="text-right">Budgeted</TableHead>
              <TableHead className="text-right">Linked actual</TableHead>
              <TableHead className="text-right">Remaining</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {aopRows.map((row) => (
              <TableRow key={row.aop_activity_id}>
                <TableCell>FY {row.fiscal_year}</TableCell>
                <TableCell>
                  <div className="flex flex-col">
                    <span className="font-medium">{row.activity_code}</span>
                    <span className="text-xs text-muted-foreground">
                      {truncate(row.description, 80)}
                    </span>
                  </div>
                </TableCell>
                <TableCell>{row.mda_name}</TableCell>
                <TableCell className="text-right tabular-nums">
                  {formatNaira(row.budgeted_cost)}
                </TableCell>
                <TableCell className="text-right tabular-nums">
                  {formatNaira(row.linked_expenditure_amount)}
                </TableCell>
                <TableCell
                  className={`text-right tabular-nums ${
                    row.remaining_amount < 0 ? "text-status-rejected" : "text-foreground"
                  }`}
                >
                  {formatNaira(row.remaining_amount)}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </ChartCard>

      <ChartCard
        title="Unlinked expenditure"
        description="Expenditure entries that have no AOP activity link, grouped by MDA / programme / category."
        loading={loading}
        isEmpty={!loading && unlinkedRows.length === 0}
        emptyTitle="No unlinked expenditure"
        emptyDescription="Every expenditure entry in the current filters is linked to an AOP activity."
      >
        <Table containerClassName="max-h-[70vh]">
          <TableHeader>
            <TableRow>
              <TableHead>MDA</TableHead>
              <TableHead>Programme area</TableHead>
              <TableHead>Category</TableHead>
              <TableHead className="text-right">Total</TableHead>
              <TableHead className="text-right">Entries</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {unlinkedRows.map((row) => (
              <TableRow
                key={`${row.mda_id}-${row.programme_area_id}-${row.expenditure_category_id}`}
              >
                <TableCell>{row.mda_name}</TableCell>
                <TableCell>{row.programme_area_name}</TableCell>
                <TableCell>{row.expenditure_category_name}</TableCell>
                <TableCell className="text-right tabular-nums">
                  {formatNaira(row.total_amount)}
                </TableCell>
                <TableCell className="text-right tabular-nums">
                  {formatInteger(row.entry_count)}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </ChartCard>
    </div>
  );
}

function MdaAnalysisTab({
  loading,
  dataset,
  filters,
  selectedMdaId,
  onSelectMda,
}: Omit<TabProps, "setFilter"> & {
  selectedMdaId: string | null;
  onSelectMda: (mdaId: string) => void;
}) {
  const scorecards = dataset
    ? aggregateMdaScorecards(dataset.budgets, dataset.expenditure, dataset.monthly, filters, {})
    : [];
  if (loading && scorecards.length === 0) {
    return <p className="py-10 text-center text-sm text-muted-foreground">Loading MDA analysis…</p>;
  }
  return (
    <MdaAnalysis
      cards={scorecards}
      selectedId={selectedMdaId}
      onSelect={onSelectMda}
      benchmarkQuarter={benchmarkQuarterFor(dataset)}
    />
  );
}

function SummaryTable({
  headers,
  rows,
}: {
  headers: string[];
  rows: (string | number)[][];
}) {
  if (rows.length === 0) return null;
  return (
    <Table className="mt-4" containerClassName="max-h-[70vh]">
      <TableHeader>
        <TableRow>
          {headers.map((header, index) => (
            <TableHead key={header} className={index === 0 ? "" : "text-right"}>
              {header}
            </TableHead>
          ))}
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.map((cells, rowIndex) => (
          <TableRow key={rowIndex}>
            {cells.map((cell, cellIndex) => (
              <TableCell
                key={cellIndex}
                className={
                  cellIndex === 0
                    ? "font-medium"
                    : "text-right tabular-nums"
                }
              >
                {cell}
              </TableCell>
            ))}
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

function truncate(value: string, max: number): string {
  if (value.length <= max) return value;
  return `${value.slice(0, max - 1)}…`;
}
