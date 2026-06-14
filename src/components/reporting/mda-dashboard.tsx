"use client";

import * as React from "react";
import Link from "next/link";
import { PlusIcon } from "lucide-react";
import { useAuth } from "@/components/auth/auth-provider";
import { PageHeader } from "@/components/layout/page-header";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { buttonVariants } from "@/components/ui/button";
import { StatusBadge } from "@/components/ui/badge";
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
import { useReportFilters } from "@/hooks/use-report-filters";
import { isAdmin, viewableMdaIds } from "@/lib/access";
import { hasSupabaseConfig, supabase } from "@/lib/supabase";
import {
  aggregateBudgetVsActual,
  aggregateExpenditureByCategory,
  aggregateFundingBySource,
  aggregateStatusCounts,
  filterExpenditure,
  filterFunding,
} from "@/lib/reporting/aggregate";
import { formatCompactNaira, formatInteger, formatNaira, formatPercent } from "@/lib/format";
import type { ReportScope } from "@/lib/reporting/types";

export function MdaDashboardRoute() {
  const auth = useAuth();
  const profile = auth.profile;

  const scope: ReportScope = React.useMemo(() => {
    if (!profile) return { mdaIds: [] };
    if (isAdmin(profile)) return {};
    const ids = viewableMdaIds(profile);
    return { mdaIds: ids };
  }, [profile]);

  const { dataset, options, loading, error } = useReportingData(supabase, scope);
  const { filters, setFilters, clearFilters } = useReportFilters();

  if (!hasSupabaseConfig || !supabase) {
    return (
      <div className="flex flex-col gap-5">
        <PageHeader
          title="MDA Dashboard"
          description="Track assigned MDA submissions, pending reviews, and budget movement."
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

  const status = dataset
    ? aggregateStatusCounts(dataset.funding, dataset.expenditure, filters, scope)
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

  const myRejections = dataset
    ? [
        ...filterFunding(dataset.funding, { ...filters, status: "rejected" }, scope).map(
          (row) => ({
            id: row.id,
            kind: "funding" as const,
            mda: row.mda_name,
            amount: row.amount,
          }),
        ),
        ...filterExpenditure(dataset.expenditure, { ...filters, status: "rejected" }, scope).map(
          (row) => ({
            id: row.id,
            kind: "expenditure" as const,
            mda: row.mda_name,
            amount: row.amount,
          }),
        ),
      ].slice(0, 8)
    : [];

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
          <Link className={buttonVariants()} href="/funding/new">
            <PlusIcon aria-hidden="true" data-icon="inline-start" />
            New entry
          </Link>
        }
        description="Track assigned MDA submissions, pending reviews, and budget movement across recorded entries."
        title="MDA Dashboard"
      />

      {error ? (
        <Alert variant="destructive">
          <AlertTitle>Could not load dashboard</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}

      <ReportFiltersBar
        filters={filters}
        options={options ?? {
          mdas: [], programmeAreas: [], fundingSources: [], expenditureCategories: [],
          lgas: [], facilities: [], fiscalYears: [],
        }}
        mode="mda"
        loading={loading}
        onChange={setFilters}
        onClear={clearFilters}
      />

      <section className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Pending entries"
          value={status ? formatInteger(status.funding.pending + status.expenditure.pending) : "—"}
          tone="pending"
          helper="Awaiting reviewer action"
        />
        <StatCard
          label="Approved this view"
          value={status ? formatInteger(status.funding.approved + status.expenditure.approved) : "—"}
          tone="approved"
          helper="Ready for official reporting"
        />
        <StatCard
          label="Processed"
          value={status ? formatInteger(status.funding.processed + status.expenditure.processed) : "—"}
          tone="processed"
          helper="Reconciled & complete"
        />
        <StatCard
          label="Rejected"
          value={status ? formatInteger(status.funding.rejected + status.expenditure.rejected) : "—"}
          tone="rejected"
          helper="Needs resubmission"
        />
      </section>

      <section className="grid gap-4 md:grid-cols-3">
        <StatCard
          label="Funding (approved + processed)"
          value={status ? formatNaira(status.totalFunding) : "—"}
          helper="Total recorded inflows in current filters"
        />
        <StatCard
          label="Expenditure (approved + processed)"
          value={status ? formatNaira(status.totalExpenditure) : "—"}
          helper="Total recorded outflows in current filters"
        />
        <StatCard
          label="Budget utilization"
          value={totalUtilization === null ? "—" : formatPercent(totalUtilization)}
          tone="brown"
          helper="Expenditure vs approved budget across assigned MDAs"
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
        description="Approved budget, funding received, and expenditure for each assigned MDA."
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

      <ChartCard
        title="Recent rejections"
        description="Rejected entries that may need resubmission."
        loading={loading}
        isEmpty={!loading && myRejections.length === 0}
        emptyTitle="No rejections"
        emptyDescription="Rejected entries with comments will appear here."
      >
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Type</TableHead>
              <TableHead>MDA</TableHead>
              <TableHead className="text-right">Amount</TableHead>
              <TableHead>Status</TableHead>
              <TableHead />
            </TableRow>
          </TableHeader>
          <TableBody>
            {myRejections.map((row) => (
              <TableRow key={`${row.kind}-${row.id}`}>
                <TableCell className="capitalize">{row.kind}</TableCell>
                <TableCell>{row.mda}</TableCell>
                <TableCell className="text-right tabular-nums">
                  {formatNaira(row.amount)}
                </TableCell>
                <TableCell>
                  <StatusBadge status="rejected" />
                </TableCell>
                <TableCell className="text-right">
                  <Link
                    className="text-sm font-medium text-primary underline-offset-4 hover:underline"
                    href={`/review/${row.kind}/${row.id}`}
                  >
                    Open
                  </Link>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </ChartCard>
    </div>
  );
}
