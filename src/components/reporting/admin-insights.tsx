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
import { HorizontalBarReport } from "@/components/reporting/charts/horizontal-bar-report";
import { useReportingData } from "@/components/reporting/use-reporting-data";
import { useReportFilters } from "@/hooks/use-report-filters";
import { hasSupabaseConfig, supabase } from "@/lib/supabase";
import {
  aggregateAopPlannedVsActual,
  aggregateBudgetVsActual,
  aggregateExpenditureByCategory,
  aggregateFundingBySource,
  aggregatePhcFacilitySummary,
  aggregatePhcLgaSummary,
  aggregateProgrammeAreaSummary,
  aggregateStatusCounts,
  aggregateUnlinkedExpenditure,
} from "@/lib/reporting/aggregate";
import { formatCompactNaira, formatInteger, formatNaira, formatPercent } from "@/lib/format";
import type { ReportFilters } from "@/lib/reporting/types";

export function AdminInsightsRoute() {
  const { dataset, options, loading, error } = useReportingData(supabase, {});
  const { filters, setFilters, setFilter, clearFilters } = useReportFilters();
  const [tab, setTab] = React.useState<"overview" | "programme" | "phc" | "aop">("overview");

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
  const status = dataset
    ? aggregateStatusCounts(dataset.funding, dataset.expenditure, filters, {})
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
          <TabsTrigger value="programme">Programme</TabsTrigger>
          <TabsTrigger value="phc">PHC</TabsTrigger>
          <TabsTrigger value="aop">AOP</TabsTrigger>
        </TabsList>

        <TabsContent value="overview">
          <OverviewTab
            empty={empty}
            loading={loading}
            status={status}
            dataset={dataset}
            filters={filters}
            setFilter={setFilter}
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
  status: ReturnType<typeof aggregateStatusCounts> | null;
};

function OverviewTab({ loading, dataset, filters, setFilter, status }: OverviewTabProps) {
  const budgetRows = dataset
    ? aggregateBudgetVsActual(
        dataset.budgets,
        dataset.funding,
        dataset.expenditure,
        filters,
        {},
      )
    : [];
  const fundingRows = dataset ? aggregateFundingBySource(dataset.funding, filters, {}) : [];
  const expenditureRows = dataset
    ? aggregateExpenditureByCategory(dataset.expenditure, filters, {})
    : [];

  return (
    <div className="flex flex-col gap-5">
      <section className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Pending"
          value={status ? formatInteger(status.funding.pending + status.expenditure.pending) : "—"}
          tone="pending"
          helper="Statewide entries awaiting review"
        />
        <StatCard
          label="Approved"
          value={status ? formatInteger(status.funding.approved + status.expenditure.approved) : "—"}
          tone="approved"
        />
        <StatCard
          label="Processed"
          value={status ? formatInteger(status.funding.processed + status.expenditure.processed) : "—"}
          tone="processed"
        />
        <StatCard
          label="Rejected"
          value={status ? formatInteger(status.funding.rejected + status.expenditure.rejected) : "—"}
          tone="rejected"
        />
      </section>

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
        <Table className="mt-4">
          <TableHeader>
            <TableRow>
              <TableHead>MDA</TableHead>
              <TableHead>FY</TableHead>
              <TableHead className="text-right">Budget</TableHead>
              <TableHead className="text-right">Funding</TableHead>
              <TableHead className="text-right">Expenditure</TableHead>
              <TableHead className="text-right">Balance</TableHead>
              <TableHead className="text-right">Used</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {budgetRows.map((row) => (
              <TableRow key={`${row.mda_id}-${row.fiscal_year}`}>
                <TableCell className="font-medium">{row.mda_name}</TableCell>
                <TableCell>FY {row.fiscal_year}</TableCell>
                <TableCell className="text-right tabular-nums">
                  {formatCompactNaira(row.total_budget_amount)}
                </TableCell>
                <TableCell className="text-right tabular-nums">
                  {formatCompactNaira(row.total_funding_amount)}
                </TableCell>
                <TableCell className="text-right tabular-nums">
                  {formatCompactNaira(row.total_expenditure_amount)}
                </TableCell>
                <TableCell className="text-right tabular-nums">
                  {formatCompactNaira(row.budget_balance_amount)}
                </TableCell>
                <TableCell className="text-right tabular-nums">
                  {formatPercent(row.budget_used_ratio)}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </ChartCard>

      <section className="grid gap-4 lg:grid-cols-2">
        <ChartCard
          title="Funding by source"
          description="Click a bar to filter all reports by that funding source."
          loading={loading}
          isEmpty={!loading && fundingRows.length === 0}
        >
          <HorizontalBarReport
            data={fundingRows.map((row) => ({
              id: row.funding_source_id,
              label: row.funding_source_name,
              value: row.total_amount,
            }))}
            activeId={filters.fundingSourceId}
            onSelect={(id) =>
              setFilter("fundingSourceId", id === filters.fundingSourceId ? null : id)
            }
          />
          <SummaryTable
            headers={["Funding source", "Total", "Entries"]}
            rows={fundingRows.map((row) => [
              row.funding_source_name,
              formatNaira(row.total_amount),
              formatInteger(row.entry_count),
            ])}
          />
        </ChartCard>

        <ChartCard
          title="Expenditure by category"
          description="Click a bar to filter all reports by that expenditure category."
          loading={loading}
          isEmpty={!loading && expenditureRows.length === 0}
        >
          <HorizontalBarReport
            data={expenditureRows.map((row) => ({
              id: row.expenditure_category_id,
              label: row.expenditure_category_name,
              value: row.total_amount,
            }))}
            activeId={filters.expenditureCategoryId}
            onSelect={(id) =>
              setFilter(
                "expenditureCategoryId",
                id === filters.expenditureCategoryId ? null : id,
              )
            }
          />
          <SummaryTable
            headers={["Expenditure category", "Total", "Entries"]}
            rows={expenditureRows.map((row) => [
              row.expenditure_category_name,
              formatNaira(row.total_amount),
              formatInteger(row.entry_count),
            ])}
          />
        </ChartCard>
      </section>
    </div>
  );
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
        <Table className="mt-4">
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
        <Table>
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
        <Table>
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

function SummaryTable({
  headers,
  rows,
}: {
  headers: string[];
  rows: (string | number)[][];
}) {
  if (rows.length === 0) return null;
  return (
    <Table className="mt-4">
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
