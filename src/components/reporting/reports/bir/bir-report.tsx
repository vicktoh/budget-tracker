"use client";

import * as React from "react";
import Image from "next/image";
import { ChartCard } from "@/components/reporting/chart-card";
import { ReportStatStrip } from "@/components/reporting/report-stat-strip";
import { BulletPerformanceList } from "@/components/reporting/charts/bullet-performance-list";
import { DonutShareChart } from "@/components/reporting/charts/donut-share-chart";
import { HorizontalBarReport } from "@/components/reporting/charts/horizontal-bar-report";
import { QuarterlyTrendChart } from "@/components/reporting/charts/quarterly-trend-chart";
import {
  ReportPreviewScaffold,
  type ReportBodyProps,
} from "@/components/reporting/reports/report-preview-scaffold";
import {
  ReportTable,
  type ReportTableColumn,
} from "@/components/reporting/reports/report-table";
import {
  aggregateAdminClassification,
  aggregateBudgetComposition,
  aggregateEconomicSummary,
  aggregateFundingBySource,
  aggregateHeadlineKpis,
  aggregateProgrammeAreaSummary,
  aggregateQuarterlyTrend,
  type AdminClassificationRow,
  type EconomicSummaryRow,
  type FundingBySourceRow,
  type ProgrammeAreaSummaryRow,
} from "@/lib/reporting/aggregate";
import { resolvePhcmbMdaId } from "@/lib/reporting/mda-lookup";
import { proRataBand, proRataTarget } from "@/lib/reporting/signals";
import { formatCompactNaira, formatNaira, formatPercent } from "@/lib/format";
import type { ReportFilters } from "@/lib/reporting/types";

export function BirReportRoute() {
  return (
    <ReportPreviewScaffold templateId="bir" compactPeriod={false}>
      {(props) => <BirReportBody {...props} />}
    </ReportPreviewScaffold>
  );
}

/** Zero renders as an en dash, matching government budget-document convention. */
function naira(amount: number): string {
  return amount === 0 ? "–" : formatNaira(amount);
}

/**
 * The BIR follows NCOA, which books programme/project spend as capital. In this
 * health dataset the aggregate's `other` bucket is entirely PHC capital projects
 * (BIR Table 24), so fold it into the capital row for the document — matching
 * the published report. The aggregate stays honest (four classes); only this
 * presentation merges them.
 */
function foldOtherIntoCapital(rows: EconomicSummaryRow[]): EconomicSummaryRow[] {
  const other = rows.find((row) => row.economic_class === "other");
  return rows
    .filter((row) => row.economic_class !== "other")
    .map((row) => {
      if (row.economic_class !== "capital" || !other) return row;
      const actual = row.actual_amount + other.actual_amount;
      return {
        ...row,
        actual_amount: actual,
        balance_amount: row.budget_amount - actual,
        performance_rate: row.budget_amount === 0 ? null : actual / row.budget_amount,
      };
    });
}

function BirReportBody({
  dataset,
  effectiveFilters,
  quarter,
  periodLabel,
  loading,
}: ReportBodyProps) {
  const kpis = aggregateHeadlineKpis(
    dataset.budgets,
    dataset.funding,
    dataset.expenditure,
    effectiveFilters,
    {},
  );
  const economic = foldOtherIntoCapital(
    aggregateEconomicSummary(
      dataset.budgets,
      dataset.expenditure,
      effectiveFilters,
      {},
    ),
  );
  const adminRows = aggregateAdminClassification(
    dataset.budgets,
    dataset.expenditure,
    effectiveFilters,
    {},
  );
  const funding = aggregateFundingBySource(dataset.funding, effectiveFilters, {});
  const trend = aggregateQuarterlyTrend(
    dataset.funding,
    dataset.expenditure,
    effectiveFilters,
    {},
  );
  const composition = aggregateBudgetComposition(dataset.budgets, effectiveFilters, {});

  const phcmbId = resolvePhcmbMdaId(dataset);
  const phcFilters: ReportFilters | null = phcmbId
    ? { ...effectiveFilters, mdaId: phcmbId }
    : null;
  const phcEconomic = phcFilters
    ? foldOtherIntoCapital(
        aggregateEconomicSummary(dataset.budgets, dataset.expenditure, phcFilters, {}),
      )
    : [];
  const phcProgrammes = phcFilters
    ? aggregateProgrammeAreaSummary(
        dataset.funding,
        dataset.expenditure,
        phcFilters,
        {},
      )
    : [];

  const hasLedgerData = trend.some(
    (row) => row.total_funding_amount > 0 || row.total_expenditure_amount > 0,
  );
  const target = proRataTarget(quarter);
  const budgetBalance = kpis.total_budget_amount - kpis.total_expenditure_amount;
  const economicBullets = economic
    .filter((row) => row.economic_class !== "total" && row.budget_amount > 0)
    .map((row) => ({
      id: String(row.economic_class),
      label: row.label,
      planLabel: formatCompactNaira(row.budget_amount),
      actualLabel: formatCompactNaira(row.actual_amount),
      ratio: row.performance_rate,
    }));
  const adminBullets = adminRows
    .filter((row) => row.budget_amount > 0)
    .sort(
      (a, b) =>
        b.actual_total - a.actual_total || b.budget_amount - a.budget_amount,
    )
    .slice(0, 10)
    .map((row) => ({
      id: row.mda_id,
      label: row.mda_name,
      planLabel: formatCompactNaira(row.budget_amount),
      actualLabel: formatCompactNaira(row.actual_total),
      ratio: row.performance_rate,
    }));

  return (
    <article className="flex flex-col gap-8 text-foreground">
      <BirDocumentHeader periodLabel={periodLabel} />

      <ReportStatStrip
        eyebrow="Executive summary"
        title="Budget implementation at a glance"
        stats={[
          {
            label: "Approved budget",
            value: formatCompactNaira(kpis.total_budget_amount),
            helper: "Total approved health-sector budget in the current scope.",
          },
          {
            label: "Actual expenditure",
            value: formatCompactNaira(kpis.total_expenditure_amount),
            helper: `Approved and processed expenditure for ${periodLabel}.`,
          },
          {
            label: "Budget execution",
            value: formatPercent(kpis.budget_execution_rate),
            helper: `Performance against the ${formatPercent(target)} pro-rata benchmark.`,
            badge: `${formatPercent(target)} target`,
            tone: proRataBand(kpis.budget_execution_rate, quarter),
            progress: kpis.budget_execution_rate,
            progressLabel: "Share of the approved budget spent",
          },
          {
            label: "Budget balance",
            value: formatCompactNaira(budgetBalance),
            helper: "Approved budget remaining after recorded expenditure.",
            tone: budgetBalance < 0 ? "critical" : "default",
          },
        ]}
      />

      {/* Section 1 — Budget Implementation Summary */}
      <Section
        code="1"
        title="Budget Implementation Summary"
        note={`Health-sector budget performance by economic classification. Actual figures cover approved and processed expenditure for ${periodLabel}.`}
      >
        <ReportTable
          caption="Table 1: Budget Implementation Summary by Economic Classification"
          columns={economicColumns}
          rows={economic}
          getRowKey={(row) => row.economic_class}
          emphasizeLastRow
        />
      </Section>

      {/* Section 1.F — Summary graphs */}
      <Section code="1.F" title="Summary Budget Implementation Graphs">
        <div className="grid gap-5 lg:grid-cols-2">
          <ChartCard
            title="Execution by economic classification"
            description="Actual spend against the approved budget per economic class. The tick marks the pro-rata benchmark for this period."
            loading={loading}
            isEmpty={!loading && economicBullets.length === 0}
          >
            <BulletPerformanceList items={economicBullets} target={target} />
          </ChartCard>
          <ChartCard
            title="Execution by administrative unit"
            description="The ten largest administrative units by spend; Table 4 lists every unit."
            loading={loading}
            isEmpty={!loading && adminBullets.length === 0}
          >
            <BulletPerformanceList items={adminBullets} target={target} />
          </ChartCard>
          <ChartCard
            title="Quarterly performance"
            description="Funding received vs spending recorded per quarter."
            loading={loading}
            isEmpty={!loading && !hasLedgerData}
          >
            <QuarterlyTrendChart data={trend} activeQuarter={quarter} />
          </ChartCard>
          <ChartCard
            title="Expenditure composition"
            description="Approved budget split across personnel, other recurrent, and capital."
            loading={loading}
            isEmpty={!loading && (composition === null || composition.total_budget_amount === 0)}
          >
            <DonutShareChart
              data={
                composition
                  ? [
                      { id: "personnel", label: "Personnel", value: composition.personnel_amount },
                      {
                        id: "other-recurrent",
                        label: "Other recurrent",
                        value: composition.other_recurrent_amount,
                      },
                      { id: "capital", label: "Capital", value: composition.capital_amount },
                    ]
                  : []
              }
              centerValue={formatCompactNaira(kpis.total_budget_amount)}
              centerLabel="Approved budget"
            />
          </ChartCard>
        </div>
      </Section>

      {/* Section 2 — Expenditure by Administrative Classification */}
      <Section
        code="2"
        title="Expenditure by Administrative Classification"
        note="Total expenditure per organisational unit, with the economic split, performance against the approved budget, and remaining balance."
      >
        <ReportTable
          caption="Table 4: Total Expenditure by Administrative Classification"
          columns={adminColumns}
          rows={adminRows}
          getRowKey={(row) => row.mda_id}
        />
      </Section>

      {/* Section 2 — Revenue by Source */}
      <Section code="2.B" title="Revenue by Source">
        {funding.length === 0 ? (
          <EmptyNote>No funding was recorded in this period.</EmptyNote>
        ) : (
          <div className="flex flex-col gap-4">
            <ChartCard
              title="Recorded funding by source"
              description="Total receipts per funding source for the period."
              loading={loading}
            >
              <HorizontalBarReport
                data={funding.map((row) => ({
                  id: row.funding_source_id,
                  label: row.funding_source_name,
                  value: row.total_amount,
                }))}
                height={Math.max(160, funding.length * 44 + 40)}
              />
            </ChartCard>
            <ReportTable
              caption="Table 3: Recorded Funding by Source"
              columns={fundingColumns}
              rows={funding}
              getRowKey={(row) => row.funding_source_id}
            />
          </div>
        )}
      </Section>

      {/* Section 3 — Primary Healthcare */}
      <Section
        code="3"
        title="Primary Healthcare Budget Performance"
        note="Performance of the Primary Health Care Management Board (PHCMB), extracted from the general report."
      >
        {phcFilters ? (
          <div className="flex flex-col gap-6">
            <ReportTable
              caption="Table 23: Primary Healthcare Expenditure by Economic Classification"
              columns={economicColumns}
              rows={phcEconomic}
              getRowKey={(row) => row.economic_class}
              emphasizeLastRow
            />
            {phcProgrammes.length > 0 ? (
              <div className="flex flex-col gap-4">
                <ChartCard
                  title="Primary healthcare spending by programme"
                  description="Recorded PHCMB expenditure per programme area, largest first."
                  loading={loading}
                >
                  <HorizontalBarReport
                    data={phcProgrammes.map((row) => ({
                      id: row.programme_area_id,
                      label: row.programme_area_name,
                      value: row.total_expenditure_amount,
                    }))}
                    height={Math.max(200, phcProgrammes.length * 40 + 40)}
                  />
                </ChartCard>
                <ReportTable
                  caption="Table 22: Primary Healthcare Expenditure by Programme"
                  columns={programmeColumns}
                  rows={phcProgrammes}
                  getRowKey={(row) => row.programme_area_id}
                />
              </div>
            ) : null}
          </div>
        ) : (
          <EmptyNote>
            The Primary Health Care Management Board was not found in the current dataset.
          </EmptyNote>
        )}
      </Section>

      <p className="border-t pt-4 text-xs text-muted-foreground">
        Figures cover approved and processed entries only. Economic classification of
        actual expenditure is derived from expenditure categories. Prepared by the Kano
        State Ministry of Health from the live budget-tracker ledger · {periodLabel}.
      </p>
    </article>
  );
}

/* -------------------------------------------------------------------------- */
/* Column definitions                                                         */
/* -------------------------------------------------------------------------- */

const economicColumns: ReportTableColumn<EconomicSummaryRow>[] = [
  { key: "label", header: "Economic class", render: (row) => row.label },
  {
    key: "budget",
    header: "Approved budget",
    align: "right",
    render: (row) => naira(row.budget_amount),
  },
  {
    key: "actual",
    header: "Actual",
    align: "right",
    render: (row) => naira(row.actual_amount),
  },
  {
    key: "performance",
    header: "% performance",
    align: "right",
    render: (row) => formatPercent(row.performance_rate),
  },
  {
    key: "balance",
    header: "Balance",
    align: "right",
    render: (row) => naira(row.balance_amount),
  },
];

const adminColumns: ReportTableColumn<AdminClassificationRow>[] = [
  { key: "mda", header: "Administrative unit", render: (row) => row.mda_name },
  {
    key: "budget",
    header: "Approved budget",
    align: "right",
    render: (row) => naira(row.budget_amount),
  },
  {
    key: "personnel",
    header: "Personnel",
    align: "right",
    render: (row) => naira(row.personnel_amount),
  },
  {
    key: "overhead",
    header: "Overhead",
    align: "right",
    render: (row) => naira(row.overhead_amount),
  },
  {
    key: "capital",
    header: "Capital",
    align: "right",
    render: (row) => naira(row.capital_amount + row.other_amount),
  },
  {
    key: "total",
    header: "Total actual",
    align: "right",
    render: (row) => naira(row.actual_total),
  },
  {
    key: "performance",
    header: "% perf.",
    align: "right",
    render: (row) => formatPercent(row.performance_rate),
  },
  {
    key: "balance",
    header: "Balance",
    align: "right",
    render: (row) => naira(row.balance_amount),
  },
];

const fundingColumns: ReportTableColumn<FundingBySourceRow>[] = [
  { key: "source", header: "Funding source", render: (row) => row.funding_source_name },
  {
    key: "amount",
    header: "Amount received",
    align: "right",
    render: (row) => naira(row.total_amount),
  },
  {
    key: "count",
    header: "Entries",
    align: "right",
    render: (row) => String(row.entry_count),
  },
];

const programmeColumns: ReportTableColumn<ProgrammeAreaSummaryRow>[] = [
  { key: "programme", header: "Programme area", render: (row) => row.programme_area_name },
  {
    key: "funding",
    header: "Funding",
    align: "right",
    render: (row) => naira(row.total_funding_amount),
  },
  {
    key: "expenditure",
    header: "Expenditure",
    align: "right",
    render: (row) => naira(row.total_expenditure_amount),
  },
  {
    key: "gap",
    header: "Balance",
    align: "right",
    render: (row) => naira(row.gap_amount),
  },
];

/* -------------------------------------------------------------------------- */
/* Presentational pieces                                                      */
/* -------------------------------------------------------------------------- */

function BirDocumentHeader({ periodLabel }: { periodLabel: string }) {
  return (
    <header className="relative overflow-hidden rounded-lg border">
      <div
        className="h-1.5 w-full"
        style={{ background: "#167a4a", borderBottom: "2px solid #9a7b2e" }}
      />
      <div className="flex flex-col items-center gap-1 px-6 py-6 text-center">
        <Image
          alt="Coat of arms of Kano State"
          className="mb-1 size-16 object-contain"
          height={64}
          width={64}
          priority
          src="/kano-seal.png"
        />
        <span className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
          Kano State Government
        </span>
        <h1 className="text-xl font-bold tracking-tight" style={{ color: "#0f5132" }}>
          Budget Implementation Report — Health Sector
        </h1>
        <span className="text-xs text-muted-foreground">{periodLabel}</span>
      </div>
    </header>
  );
}

function Section({
  code,
  title,
  note,
  children,
}: {
  code: string;
  title: string;
  note?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="flex flex-col gap-3">
      <div className="flex flex-col gap-1">
        <h2 className="text-lg font-semibold tracking-tight">
          <span className="mr-2 text-muted-foreground">{code}</span>
          {title}
        </h2>
        {note ? <p className="max-w-3xl text-sm text-muted-foreground">{note}</p> : null}
      </div>
      {children}
    </section>
  );
}

function EmptyNote({ children }: { children: React.ReactNode }) {
  return (
    <p className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
      {children}
    </p>
  );
}
