"use client";

import * as React from "react";
import Link from "next/link";
import { AlertTriangleIcon, CheckCircle2Icon, PlusIcon } from "lucide-react";
import { useAuth } from "@/components/auth/auth-provider";
import { PageHeader } from "@/components/layout/page-header";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ChartCard } from "@/components/reporting/chart-card";
import { ReportFiltersBar } from "@/components/reporting/report-filters-bar";
import { StatCard } from "@/components/reporting/stat-card";
import { HorizontalBarReport } from "@/components/reporting/charts/horizontal-bar-report";
import { useReportingData } from "@/components/reporting/use-reporting-data";
import { OfflineDataNotice } from "@/components/offline/offline-data-notice";
import { useReportFilters } from "@/hooks/use-report-filters";
import { isAdmin, isReviewer, viewableMdaIds } from "@/lib/access";
import { hasSupabaseConfig, supabase } from "@/lib/supabase";
import {
  aggregateBudgetVsActual,
  aggregateExpenditureByCategory,
  aggregateExpenditureByFundingSource,
  aggregateFundingBySource,
  aggregateEntrySummary,
  aggregateMdaReportingCoverage,
} from "@/lib/reporting/aggregate";
import { formatCompactNaira, formatInteger, formatNaira, formatPercent } from "@/lib/format";
import type { ReportScope } from "@/lib/reporting/types";

export function MdaDashboardRoute() {
  const auth = useAuth();
  const profile = auth.profile;
  const viewerDashboard = isReviewer(profile);

  const scope: ReportScope = React.useMemo(() => {
    if (!profile) return { mdaIds: [] };
    if (isAdmin(profile) || isReviewer(profile)) return {};
    const ids = viewableMdaIds(profile);
    return { mdaIds: ids };
  }, [profile]);

  const { dataset, options, loading, error, cachedAt } = useReportingData(
    supabase,
    scope,
  );
  const { filters, setFilters, clearFilters } = useReportFilters();

  if (!hasSupabaseConfig || !supabase) {
    return (
      <div className="flex flex-col gap-5">
        <PageHeader
          title={viewerDashboard ? "Oversight Dashboard" : "MDA Dashboard"}
          description={
            viewerDashboard
              ? "Monitor statewide reporting coverage and budget performance."
              : "Track assigned MDA entries and budget movement."
          }
        />
        <Alert variant="warning">
          <AlertTitle>Supabase is not configured</AlertTitle>
          <AlertDescription>
            Add Supabase environment variables to load dashboard data.
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  const summary = dataset
    ? aggregateEntrySummary(dataset.funding, dataset.expenditure, filters, scope)
    : null;
  const budgetRows = dataset
    ? aggregateBudgetVsActual(dataset.budgets, dataset.funding, dataset.expenditure, filters, scope)
    : [];
  const fundingRows = dataset
    ? aggregateFundingBySource(dataset.funding, filters, scope)
    : [];
  const expenditureRows = dataset
    ? aggregateExpenditureByCategory(dataset.expenditure, filters, scope)
    : [];
  const expenditureBySourceRows = dataset
    ? aggregateExpenditureByFundingSource(dataset.expenditure, filters, scope)
    : [];
  const coverageRows =
    dataset && options
      ? aggregateMdaReportingCoverage(
          options.mdas.map((mda) => ({ id: mda.value, name: mda.label })),
          dataset.funding,
          dataset.expenditure,
          filters,
          scope,
        )
      : [];
  const missingReports = coverageRows.filter((row) => row.status === "missing").length;
  const partialReports = coverageRows.filter((row) => row.status === "partial").length;
  const completeReports = coverageRows.filter((row) => row.status === "complete").length;
  const reportingRate =
    coverageRows.length > 0 ? completeReports / coverageRows.length : null;
  const budgetByMda = budgetRows.reduce(
    (byMda, row) => {
      const existing = byMda.get(row.mda_id) ?? { budget: 0, expenditure: 0 };
      existing.budget += row.total_budget_amount;
      existing.expenditure += row.total_expenditure_amount;
      byMda.set(row.mda_id, existing);
      return byMda;
    },
    new Map<string, { budget: number; expenditure: number }>(),
  );

  const totalUtilization =
    budgetRows.length > 0
      ? budgetRows.reduce((acc, row) => acc + row.total_expenditure_amount, 0) /
        Math.max(
          1,
          budgetRows.reduce((acc, row) => acc + row.total_budget_amount, 0),
        )
      : null;

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        actions={
          viewerDashboard ? null : (
            <Link className={buttonVariants()} href="/funding/new">
              <PlusIcon aria-hidden="true" data-icon="inline-start" />
              New entry
            </Link>
          )
        }
        description={
          viewerDashboard
            ? "Monitor which MDAs are reporting, identify missing entry types, and compare budget execution statewide. Filters drive every signal below."
            : "Track assigned MDA submissions and budget movement across recorded entries."
        }
        title={viewerDashboard ? "Oversight Dashboard" : "MDA Dashboard"}
      />

      {error ? (
        <Alert variant="destructive">
          <AlertTitle>Could not load dashboard</AlertTitle>
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
        mode={viewerDashboard ? "admin" : "mda"}
        loading={loading}
        onChange={setFilters}
        onClear={clearFilters}
      />

      {viewerDashboard ? (
        <>
          <section className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <StatCard
              label="MDAs reporting"
              value={loading ? "—" : `${completeReports} / ${coverageRows.length}`}
              helper="Both funding and expenditure entries recorded"
              tone="approved"
            />
            <StatCard
              label="No update"
              value={loading ? "—" : formatInteger(missingReports)}
              helper="No entries in the selected period"
              tone="rejected"
            />
            <StatCard
              label="Partial reports"
              value={loading ? "—" : formatInteger(partialReports)}
              helper="One expected ledger type is missing"
              tone="pending"
            />
            <StatCard
              label="Reporting coverage"
              value={loading ? "—" : formatPercent(reportingRate)}
              helper="MDAs with both entry types"
              tone="brown"
            />
          </section>

          <ChartCard
            title="MDA reporting gaps"
            description="Submission coverage for the selected filters. ‘Complete’ means the MDA has recorded at least one funding entry and one expenditure entry; it is not an approval status."
            loading={loading}
            isEmpty={!loading && coverageRows.length === 0}
            emptyTitle="No MDAs in scope"
            emptyDescription="No active MDAs are available for the selected filters."
          >
            <Table containerClassName="max-h-[70vh]">
              <TableHeader>
                <TableRow>
                  <TableHead rowSpan={2}>Status</TableHead>
                  <TableHead rowSpan={2}>MDA</TableHead>
                  <TableHead className="text-right" rowSpan={2}>Funding entries</TableHead>
                  <TableHead className="text-right" rowSpan={2}>Expenditure entries</TableHead>
                  <TableHead
                    className="border-l text-center"
                    colSpan={3}
                    scope="colgroup"
                  >
                    Economic class
                  </TableHead>
                  <TableHead rowSpan={2}>Latest transaction</TableHead>
                  <TableHead rowSpan={2}>Report gap</TableHead>
                  <TableHead className="min-w-36" rowSpan={2}>Budget used</TableHead>
                </TableRow>
                <TableRow>
                  <TableHead className="border-l text-right">Personnel</TableHead>
                  <TableHead className="text-right">Overhead</TableHead>
                  <TableHead className="text-right">Capital</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {coverageRows.map((row) => {
                  const budget = budgetByMda.get(row.mda_id);
                  const utilization =
                    budget && budget.budget > 0
                      ? budget.expenditure / budget.budget
                      : null;
                  return (
                    <TableRow key={row.mda_id}>
                      <TableCell>
                        <CoverageBadge status={row.status} />
                      </TableCell>
                      <TableCell className="max-w-64 font-medium">
                        {row.mda_name}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        <AmountWithCount
                          amount={row.funding_amount}
                          count={row.funding_entry_count}
                        />
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        <AmountWithCount
                          amount={row.expenditure_amount}
                          count={row.expenditure_entry_count}
                        />
                      </TableCell>
                      <TableCell className="border-l text-right tabular-nums">
                        <AmountWithCount
                          amount={row.personnel_amount}
                          count={row.personnel_entry_count}
                        />
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        <AmountWithCount
                          amount={row.overhead_amount}
                          count={row.overhead_entry_count}
                        />
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        <AmountWithCount
                          amount={row.capital_amount}
                          count={row.capital_entry_count}
                        />
                      </TableCell>
                      <TableCell className="tabular-nums">
                        {row.latest_entry_date ?? "No entry"}
                      </TableCell>
                      <TableCell>
                        {row.gaps.length > 0 ? row.gaps.join(" and ") : "No entry gap"}
                      </TableCell>
                      <TableCell>
                        <div className="flex min-w-32 items-center gap-2">
                          <Progress
                            className="flex-1"
                            label={`${row.mda_name} budget utilization`}
                            max={1}
                            value={utilization ?? 0}
                            tone={utilization !== null && utilization > 1 ? "red" : "primary"}
                          />
                          <span className="w-12 text-right text-xs tabular-nums text-muted-foreground">
                            {formatPercent(utilization)}
                          </span>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </ChartCard>
        </>
      ) : null}

      <section className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Funding entries"
          value={summary ? formatInteger(summary.fundingCount) : "—"}
          helper="Recorded inflows"
        />
        <StatCard
          label="Expenditure entries"
          value={summary ? formatInteger(summary.expenditureCount) : "—"}
          helper="Recorded outflows"
        />
        <StatCard
          label="Funding recorded"
          value={summary ? formatCompactNaira(summary.totalFunding) : "—"}
          helper="All active funding entries"
        />
        <StatCard
          label="Expenditure recorded"
          value={summary ? formatCompactNaira(summary.totalExpenditure) : "—"}
          helper="All active expenditure entries"
        />
      </section>

      <section className="grid gap-4 md:grid-cols-3">
        <StatCard
          label="Funding recorded"
          value={summary ? formatNaira(summary.totalFunding) : "—"}
          helper="Total recorded inflows in current filters"
        />
        <StatCard
          label="Expenditure recorded"
          value={summary ? formatNaira(summary.totalExpenditure) : "—"}
          helper="Total recorded outflows in current filters"
        />
        <StatCard
          label="Budget utilization"
          value={totalUtilization === null ? "—" : formatPercent(totalUtilization)}
          tone="brown"
          helper={
            viewerDashboard
              ? "Expenditure vs approved budget statewide"
              : "Expenditure vs approved budget across assigned MDAs"
          }
        />
      </section>

      <section className="grid gap-4 lg:grid-cols-2">
        <ChartCard
          title="Funding by source"
          description="Top funding sources for assigned MDAs."
          loading={loading}
          isEmpty={!loading && fundingRows.length === 0}
        >
          <HorizontalBarReport
            data={fundingRows.map((row) => ({
              id: row.funding_source_id,
              label: row.funding_source_name,
              value: row.total_amount,
            }))}
          />
        </ChartCard>

        <ChartCard
          title="Expenditure by funding source"
          description="Spend attributed to each funding source from allocation splits."
          loading={loading}
          isEmpty={!loading && expenditureBySourceRows.length === 0}
        >
          <HorizontalBarReport
            data={expenditureBySourceRows.map((row) => ({
              id: row.funding_source_id,
              label: row.funding_source_name,
              value: row.total_amount,
            }))}
          />
        </ChartCard>
      </section>

      <section className="grid gap-4 lg:grid-cols-2">
        <ChartCard
          title="Expenditure by category"
          description="Top expenditure categories for assigned MDAs."
          loading={loading}
          isEmpty={!loading && expenditureRows.length === 0}
        >
          <HorizontalBarReport
            data={expenditureRows.map((row) => ({
              id: row.expenditure_category_id,
              label: row.expenditure_category_name,
              value: row.total_amount,
            }))}
          />
        </ChartCard>
      </section>

      <ChartCard
        title="Budget vs actual"
          description={
            viewerDashboard
              ? "Approved budget, funding received, and expenditure for each MDA."
              : "Approved budget, funding received, and expenditure for each assigned MDA."
          }
        loading={loading}
        isEmpty={!loading && budgetRows.length === 0}
        emptyTitle="No approved budgets in scope"
        emptyDescription="Once Admins record approved budgets for the assigned MDA(s), totals appear here."
      >
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>MDA</TableHead>
              <TableHead>FY</TableHead>
              <TableHead className="text-right">Approved budget</TableHead>
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

    </div>
  );
}

function AmountWithCount({ amount, count }: { amount: number; count: number }) {
  return (
    <span
      className="whitespace-nowrap"
      title={`${formatNaira(amount)} across ${formatInteger(count)} entries`}
    >
      {formatCompactNaira(amount)}{" "}
      <span className="text-muted-foreground">({formatInteger(count)})</span>
    </span>
  );
}

function CoverageBadge({
  status,
}: {
  status: "complete" | "partial" | "missing";
}) {
  if (status === "complete") {
    return (
      <Badge variant="approved" className="gap-1">
        <CheckCircle2Icon aria-hidden="true" className="size-3" />
        Complete
      </Badge>
    );
  }

  return (
    <Badge variant={status === "partial" ? "pending" : "rejected"} className="gap-1">
      <AlertTriangleIcon aria-hidden="true" className="size-3" />
      {status === "partial" ? "Partial" : "No update"}
    </Badge>
  );
}
