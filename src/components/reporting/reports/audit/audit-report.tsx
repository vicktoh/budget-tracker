"use client";

import * as React from "react";
import { DownloadIcon, Loader2Icon } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { ChartCard } from "@/components/reporting/chart-card";
import { ReportStatStrip } from "@/components/reporting/report-stat-strip";
import { DonutShareChart } from "@/components/reporting/charts/donut-share-chart";
import { DivergingVarianceChart } from "@/components/reporting/charts/diverging-variance-chart";
import { CHART_COLORS, STATUS_COLORS } from "@/components/reporting/charts/palette";
import {
  ReportPreviewScaffold,
  type ReportBodyProps,
} from "@/components/reporting/reports/report-preview-scaffold";
import {
  ReportTable,
  type ReportTableColumn,
} from "@/components/reporting/reports/report-table";
import {
  aggregateExceptions,
  aggregateReconciliation,
  filterExpenditure,
  filterFunding,
  type ExceptionRow,
  type ReconciliationRow,
} from "@/lib/reporting/aggregate";
import { downloadCsv, toCsv, type CsvColumn } from "@/lib/reporting/export-csv";
import type { AuditPdfSection } from "@/lib/reporting/export-audit-pdf";
import { periodSlug as makePeriodSlug } from "@/lib/reporting/period";
import { formatCompactNaira, formatInteger, formatNaira } from "@/lib/format";
import type {
  ExpenditureEntryLite,
  FundingEntryLite,
} from "@/lib/reporting/types";

const PREVIEW_ROWS = 25;

const EXCEPTION_LABEL: Record<ExceptionRow["kind"], string> = {
  unlinked_aop: "No AOP activity linked",
  allocation_mismatch: "Allocation mismatch",
  rejected: "Rejected in review",
};

function statusLabel(status: string): string {
  return status.charAt(0).toUpperCase() + status.slice(1);
}

export function AuditReportRoute() {
  return (
    <ReportPreviewScaffold templateId="audit" hideDownload>
      {(props) => <AuditReportBody {...props} />}
    </ReportPreviewScaffold>
  );
}

function AuditReportBody({
  dataset,
  effectiveFilters,
  fiscalYear,
  quarter,
  periodLabel,
  loading,
}: ReportBodyProps) {
  const [exporting, setExporting] = React.useState(false);

  const expenditure = filterExpenditure(dataset.expenditure, effectiveFilters, {}).sort(
    (a, b) => a.transaction_date.localeCompare(b.transaction_date),
  );
  const funding = filterFunding(dataset.funding, effectiveFilters, {}).sort((a, b) =>
    a.transaction_date.localeCompare(b.transaction_date),
  );
  const exceptions = aggregateExceptions(dataset.expenditure, effectiveFilters, {});
  const reconciliation = aggregateReconciliation(
    dataset.funding,
    dataset.expenditure,
    effectiveFilters,
    {},
  );

  const slug = makePeriodSlug(fiscalYear, quarter);

  const exceptionAmountByKind: Record<ExceptionRow["kind"], number> = {
    unlinked_aop: 0,
    allocation_mismatch: 0,
    rejected: 0,
  };
  for (const row of exceptions.rows) exceptionAmountByKind[row.kind] += row.amount;
  const flaggedTotal =
    exceptionAmountByKind.unlinked_aop +
    exceptionAmountByKind.allocation_mismatch +
    exceptionAmountByKind.rejected;
  const fundingTotal = funding.reduce((sum, row) => sum + row.amount, 0);
  const expenditureTotal = expenditure.reduce((sum, row) => sum + row.amount, 0);
  const positiveVariance = reconciliation.reduce(
    (sum, row) => sum + Math.max(0, row.variance_amount),
    0,
  );
  const negativeVariance = reconciliation.reduce(
    (sum, row) => sum + Math.abs(Math.min(0, row.variance_amount)),
    0,
  );
  const outOfBalance = reconciliation.filter(
    (row) => Math.abs(row.variance_amount) > 0.01,
  ).length;

  const varianceData = reconciliation
    .filter((row) => row.variance_amount !== 0)
    .sort((a, b) => Math.abs(b.variance_amount) - Math.abs(a.variance_amount))
    .slice(0, 12)
    .map((row) => ({
      id: `${row.mda_id}:${row.funding_source_id}`,
      label: `${row.mda_name} · ${row.funding_source_name}`,
      value: row.variance_amount,
    }));

  const handleCsv = React.useCallback(
    (which: "expenditure" | "funding" | "exceptions" | "reconciliation") => {
      switch (which) {
        case "expenditure":
          downloadCsv(
            `expenditure-register-${slug}.csv`,
            toCsv(expenditureCsvColumns, expenditure),
          );
          break;
        case "funding":
          downloadCsv(
            `funding-register-${slug}.csv`,
            toCsv(fundingCsvColumns, funding),
          );
          break;
        case "exceptions":
          downloadCsv(
            `exceptions-${slug}.csv`,
            toCsv(exceptionCsvColumns, exceptions.rows),
          );
          break;
        case "reconciliation":
          downloadCsv(
            `reconciliation-${slug}.csv`,
            toCsv(reconciliationCsvColumns, reconciliation),
          );
          break;
      }
    },
    [slug, expenditure, funding, exceptions, reconciliation],
  );

  const handlePdf = React.useCallback(async () => {
    if (exporting) return;
    setExporting(true);
    try {
      const { exportAuditPdf } = await import("@/lib/reporting/export-audit-pdf");
      const sections: AuditPdfSection[] = [
        {
          title: "Section A.1 — Expenditure register",
          columns: ["Entry", "Voucher", "Date", "MDA", "Programme", "Category", "Amount (₦)", "Status"],
          rows: expenditure.map((row) => [
            row.public_id,
            row.voucher_ref_no,
            row.transaction_date,
            row.mda_name,
            row.programme_area_name,
            row.expenditure_category_name,
            formatNaira(row.amount),
            statusLabel(row.status),
          ]),
          rightAlign: [6],
        },
        {
          title: "Section A.2 — Funding register",
          columns: ["Entry", "Reference", "Date", "MDA", "Programme", "Source", "Amount (₦)", "Status"],
          rows: funding.map((row) => [
            row.public_id,
            row.reference_no,
            row.transaction_date,
            row.mda_name,
            row.programme_area_name,
            row.funding_source_name,
            formatNaira(row.amount),
            statusLabel(row.status),
          ]),
          rightAlign: [6],
        },
        {
          title: "Section B — Exceptions",
          columns: ["Entry", "Voucher", "MDA", "Amount (₦)", "Exception"],
          rows: exceptions.rows.map((row) => [
            row.public_id,
            row.voucher_ref_no,
            row.mda_name,
            formatNaira(row.amount),
            EXCEPTION_LABEL[row.kind],
          ]),
          rightAlign: [3],
        },
        {
          title: "Section C — Funding reconciliation",
          columns: ["MDA", "Funding source", "Received (₦)", "Allocated (₦)", "Variance (₦)"],
          rows: reconciliation.map((row) => [
            row.mda_name,
            row.funding_source_name,
            formatNaira(row.received_amount),
            formatNaira(row.allocated_amount),
            formatNaira(row.variance_amount),
          ]),
          rightAlign: [2, 3, 4],
        },
      ];
      await exportAuditPdf(sections, `audit-health-${slug}.pdf`, {
        title: "Audit Report & Registers — Health Sector",
        period: periodLabel,
        summary: [
          {
            label: "Funding recorded",
            value: formatCompactNaira(fundingTotal),
            helper: `${formatInteger(funding.length)} register entries`,
          },
          {
            label: "Expenditure reviewed",
            value: formatCompactNaira(expenditureTotal),
            helper: `${formatInteger(expenditure.length)} register entries`,
          },
          {
            label: "Integrity exceptions",
            value: formatInteger(exceptions.integrity_count),
            helper: `${formatInteger(exceptions.counts.unlinked_aop)} AOP-linkage gaps`,
          },
          {
            label: "Unallocated receipts",
            value: formatCompactNaira(positiveVariance),
            helper: `${formatInteger(outOfBalance)} out-of-balance groupings`,
          },
        ],
      });
    } catch (cause) {
      // eslint-disable-next-line no-console
      console.error("Audit PDF export failed", cause);
      toast.error("Could not generate the PDF. Please try again.");
    } finally {
      setExporting(false);
    }
  }, [
    exporting,
    expenditure,
    funding,
    exceptions,
    reconciliation,
    slug,
    periodLabel,
    fundingTotal,
    expenditureTotal,
    positiveVariance,
    outOfBalance,
  ]);

  return (
    <article className="flex flex-col gap-8">
      <header className="rounded-lg border p-6 text-center">
        <span className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
          Office of the Auditor General
        </span>
        <h1 className="mt-1 text-xl font-bold tracking-tight">
          Audit Report &amp; Registers — Health Sector
        </h1>
        <span className="text-xs text-muted-foreground">{periodLabel}</span>
      </header>

      <ReportStatStrip
        eyebrow="Audit snapshot"
        title="Registers and controls at a glance"
        stats={[
          {
            label: "Funding recorded",
            value: formatCompactNaira(fundingTotal),
            helper: `${formatInteger(funding.length)} funding ${funding.length === 1 ? "entry" : "entries"} in the register.`,
          },
          {
            label: "Expenditure reviewed",
            value: formatCompactNaira(expenditureTotal),
            helper: `${formatInteger(expenditure.length)} expenditure ${expenditure.length === 1 ? "entry" : "entries"} in the register.`,
          },
          {
            label: "Integrity exceptions",
            value: formatInteger(exceptions.integrity_count),
            helper:
              exceptions.counts.unlinked_aop > 0
                ? `${formatInteger(exceptions.counts.unlinked_aop)} additional entries need AOP linkage.`
                : "No additional AOP-linkage gaps were found.",
            badge:
              exceptions.integrity_count === 0 ? "Controls clear" : "Action required",
            tone: exceptions.integrity_count === 0 ? "strong" : "critical",
          },
          {
            label: "Unallocated receipts",
            value: formatCompactNaira(positiveVariance),
            helper:
              negativeVariance > 0
                ? `${formatCompactNaira(negativeVariance)} is allocated beyond recorded receipts.`
                : "No expenditure was allocated beyond recorded receipts.",
            badge: `${formatInteger(outOfBalance)} ${outOfBalance === 1 ? "balance" : "balances"}`,
            tone:
              negativeVariance > 0
                ? "critical"
                : positiveVariance > 0
                  ? "investigate"
                  : "strong",
          },
        ]}
      />

      {/* Own download controls (vector PDF + per-register CSV) */}
      <div data-pdf-exclude className="flex flex-wrap items-center gap-2">
        <Button type="button" onClick={handlePdf} disabled={exporting}>
          {exporting ? (
            <Loader2Icon aria-hidden className="size-4 animate-spin" />
          ) : (
            <DownloadIcon aria-hidden className="size-4" />
          )}
          {exporting ? "Preparing PDF…" : "Download PDF"}
        </Button>
        <span className="text-xs text-muted-foreground">Machine-readable:</span>
        <Button type="button" variant="outline" size="sm" onClick={() => handleCsv("expenditure")}>
          Expenditure CSV
        </Button>
        <Button type="button" variant="outline" size="sm" onClick={() => handleCsv("funding")}>
          Funding CSV
        </Button>
        <Button type="button" variant="outline" size="sm" onClick={() => handleCsv("exceptions")}>
          Exceptions CSV
        </Button>
        <Button type="button" variant="outline" size="sm" onClick={() => handleCsv("reconciliation")}>
          Reconciliation CSV
        </Button>
      </div>

      {/* Section A — Registers */}
      <RegisterSection
        title="Section A.1 — Expenditure register"
        total={expenditure.length}
      >
        <ReportTable
          columns={expenditureColumns}
          rows={expenditure.slice(0, PREVIEW_ROWS)}
          getRowKey={(row) => row.id}
        />
      </RegisterSection>

      <RegisterSection title="Section A.2 — Funding register" total={funding.length}>
        <ReportTable
          columns={fundingColumns}
          rows={funding.slice(0, PREVIEW_ROWS)}
          getRowKey={(row) => row.id}
        />
      </RegisterSection>

      {/* Section B — Exceptions */}
      <section className="flex flex-col gap-2">
        <h2 className="text-lg font-semibold tracking-tight">Section B — Exceptions</h2>
        <p className="text-sm text-muted-foreground">
          {exceptions.integrity_count} integrity exception
          {exceptions.integrity_count === 1 ? "" : "s"} (allocation mismatches + rejected
          entries); {exceptions.counts.unlinked_aop} entr
          {exceptions.counts.unlinked_aop === 1 ? "y" : "ies"} unlinked to an AOP activity.
        </p>
        {exceptions.rows.length === 0 ? (
          <EmptyNote>No exceptions in this period.</EmptyNote>
        ) : (
          <div className="flex flex-col gap-4">
            <div className="max-w-md">
              <ChartCard
                title="Flagged amount by exception type"
                description="Naira value of entries carrying each exception."
                loading={loading}
                isEmpty={!loading && flaggedTotal === 0}
              >
                <DonutShareChart
                  data={[
                    {
                      id: "rejected",
                      label: EXCEPTION_LABEL.rejected,
                      value: exceptionAmountByKind.rejected,
                      color: STATUS_COLORS.rejected,
                    },
                    {
                      id: "allocation_mismatch",
                      label: EXCEPTION_LABEL.allocation_mismatch,
                      value: exceptionAmountByKind.allocation_mismatch,
                      color: STATUS_COLORS.pending,
                    },
                    {
                      id: "unlinked_aop",
                      label: EXCEPTION_LABEL.unlinked_aop,
                      value: exceptionAmountByKind.unlinked_aop,
                      color: CHART_COLORS[4],
                    },
                  ]}
                  centerValue={formatCompactNaira(flaggedTotal)}
                  centerLabel="Flagged amount"
                  height={200}
                />
              </ChartCard>
            </div>
            <ReportTable
              columns={exceptionColumns}
              rows={exceptions.rows.slice(0, PREVIEW_ROWS)}
              getRowKey={(row) => `${row.entry_id}:${row.kind}`}
            />
          </div>
        )}
      </section>

      {/* Section C — Reconciliation */}
      <section className="flex flex-col gap-2">
        <h2 className="text-lg font-semibold tracking-tight">
          Section C — Funding reconciliation
        </h2>
        {reconciliation.length === 0 ? (
          <EmptyNote>No funding or allocations recorded in this period.</EmptyNote>
        ) : (
          <div className="flex flex-col gap-4">
            {varianceData.length > 0 ? (
              <ChartCard
                title="Reconciliation variance"
                description="Received minus allocated per MDA and funding source. Bars left of the baseline flag allocations beyond recorded receipts."
                loading={loading}
              >
                <DivergingVarianceChart
                  data={varianceData}
                  positiveName="Unallocated balance"
                  negativeName="Allocated beyond receipts"
                  labelWidth={200}
                />
              </ChartCard>
            ) : null}
            <ReportTable
              columns={reconciliationColumns}
              rows={reconciliation}
              getRowKey={(row) => `${row.mda_id}:${row.funding_source_id}`}
            />
          </div>
        )}
      </section>

      <p className="border-t pt-4 text-xs text-muted-foreground">
        Registers show the first {PREVIEW_ROWS} rows on screen; the PDF and CSV exports
        contain every row. Amounts are approved and processed unless a status column shows
        otherwise. {periodLabel}.
      </p>
    </article>
  );
}

function RegisterSection({
  title,
  total,
  children,
}: {
  title: string;
  total: number;
  children: React.ReactNode;
}) {
  return (
    <section className="flex flex-col gap-2">
      <div className="flex items-baseline justify-between gap-3">
        <h2 className="text-lg font-semibold tracking-tight">{title}</h2>
        <span className="text-xs text-muted-foreground tabular-nums">
          {total} {total === 1 ? "entry" : "entries"}
        </span>
      </div>
      {total === 0 ? (
        <EmptyNote>No entries in this period.</EmptyNote>
      ) : (
        children
      )}
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

/* -------------------------------------------------------------------------- */
/* On-screen columns                                                          */
/* -------------------------------------------------------------------------- */

const expenditureColumns: ReportTableColumn<ExpenditureEntryLite>[] = [
  { key: "entry", header: "Entry", render: (row) => row.public_id },
  { key: "voucher", header: "Voucher", render: (row) => row.voucher_ref_no },
  { key: "date", header: "Date", render: (row) => row.transaction_date },
  { key: "mda", header: "MDA", render: (row) => row.mda_name },
  { key: "category", header: "Category", render: (row) => row.expenditure_category_name },
  { key: "amount", header: "Amount", align: "right", render: (row) => formatNaira(row.amount) },
  { key: "status", header: "Status", render: (row) => statusLabel(row.status) },
];

const fundingColumns: ReportTableColumn<FundingEntryLite>[] = [
  { key: "entry", header: "Entry", render: (row) => row.public_id },
  { key: "reference", header: "Reference", render: (row) => row.reference_no },
  { key: "date", header: "Date", render: (row) => row.transaction_date },
  { key: "mda", header: "MDA", render: (row) => row.mda_name },
  { key: "source", header: "Source", render: (row) => row.funding_source_name },
  { key: "amount", header: "Amount", align: "right", render: (row) => formatNaira(row.amount) },
  { key: "status", header: "Status", render: (row) => statusLabel(row.status) },
];

const exceptionColumns: ReportTableColumn<ExceptionRow>[] = [
  { key: "entry", header: "Entry", render: (row) => row.public_id },
  { key: "voucher", header: "Voucher", render: (row) => row.voucher_ref_no },
  { key: "mda", header: "MDA", render: (row) => row.mda_name },
  { key: "amount", header: "Amount", align: "right", render: (row) => formatNaira(row.amount) },
  { key: "exception", header: "Exception", render: (row) => EXCEPTION_LABEL[row.kind] },
];

const reconciliationColumns: ReportTableColumn<ReconciliationRow>[] = [
  { key: "mda", header: "MDA", render: (row) => row.mda_name },
  { key: "source", header: "Funding source", render: (row) => row.funding_source_name },
  {
    key: "received",
    header: "Received",
    align: "right",
    render: (row) => formatNaira(row.received_amount),
  },
  {
    key: "allocated",
    header: "Allocated",
    align: "right",
    render: (row) => formatNaira(row.allocated_amount),
  },
  {
    key: "variance",
    header: "Variance",
    align: "right",
    render: (row) => formatNaira(row.variance_amount),
  },
];

/* -------------------------------------------------------------------------- */
/* CSV columns                                                                */
/* -------------------------------------------------------------------------- */

const expenditureCsvColumns: CsvColumn<ExpenditureEntryLite>[] = [
  { header: "Entry", value: (row) => row.public_id },
  { header: "Voucher", value: (row) => row.voucher_ref_no },
  { header: "Date", value: (row) => row.transaction_date },
  { header: "MDA", value: (row) => row.mda_name },
  { header: "Programme", value: (row) => row.programme_area_name },
  { header: "Category", value: (row) => row.expenditure_category_name },
  { header: "Amount", value: (row) => row.amount },
  { header: "Status", value: (row) => row.status },
];

const fundingCsvColumns: CsvColumn<FundingEntryLite>[] = [
  { header: "Entry", value: (row) => row.public_id },
  { header: "Reference", value: (row) => row.reference_no },
  { header: "Date", value: (row) => row.transaction_date },
  { header: "MDA", value: (row) => row.mda_name },
  { header: "Programme", value: (row) => row.programme_area_name },
  { header: "Source", value: (row) => row.funding_source_name },
  { header: "Amount", value: (row) => row.amount },
  { header: "Status", value: (row) => row.status },
];

const exceptionCsvColumns: CsvColumn<ExceptionRow>[] = [
  { header: "Entry", value: (row) => row.public_id },
  { header: "Voucher", value: (row) => row.voucher_ref_no },
  { header: "MDA", value: (row) => row.mda_name },
  { header: "Programme", value: (row) => row.programme_area_name },
  { header: "Amount", value: (row) => row.amount },
  { header: "Exception", value: (row) => EXCEPTION_LABEL[row.kind] },
  { header: "Detail", value: (row) => row.detail },
];

const reconciliationCsvColumns: CsvColumn<ReconciliationRow>[] = [
  { header: "MDA", value: (row) => row.mda_name },
  { header: "Funding source", value: (row) => row.funding_source_name },
  { header: "Received", value: (row) => row.received_amount },
  { header: "Allocated", value: (row) => row.allocated_amount },
  { header: "Variance", value: (row) => row.variance_amount },
];
