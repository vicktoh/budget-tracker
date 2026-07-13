"use client";

import * as React from "react";
import Link from "next/link";
import { ArrowLeftIcon, DownloadIcon, Loader2Icon } from "lucide-react";
import { toast } from "sonner";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button, buttonVariants } from "@/components/ui/button";
import { PeriodSelector } from "@/components/reporting/period-selector";
import { OfflineDataNotice } from "@/components/offline/offline-data-notice";
import { useReportingData } from "@/components/reporting/use-reporting-data";
import { useReportFilters } from "@/hooks/use-report-filters";
import { hasSupabaseConfig, supabase } from "@/lib/supabase";
import {
  REPORT_TEMPLATES,
  type ReportTemplateId,
} from "@/lib/reporting/report-templates";
import {
  periodLabel as makePeriodLabel,
  periodSlug as makePeriodSlug,
  resolveEffectiveFilters,
  resolveFiscalYear,
} from "@/lib/reporting/period";
import type { ReportFilters, ReportQuarter } from "@/lib/reporting/types";
import type { ReportingDataset } from "@/lib/reporting/types";
import { cn } from "@/lib/utils";

export type ReportBodyProps = {
  dataset: ReportingDataset;
  effectiveFilters: ReportFilters;
  fiscalYear: number | null;
  quarter: ReportQuarter | null;
  periodLabel: string;
  loading: boolean;
};

/**
 * Data loading + toolbar + period selector + PDF capture shared by every
 * report preview. The template body is rendered via `children` inside the
 * captured region, so it stays free of plumbing.
 */
export function ReportPreviewScaffold({
  templateId,
  compactPeriod = true,
  toolbarExtras,
  hideDownload = false,
  children,
}: {
  templateId: ReportTemplateId;
  /** Hide the PHC/LGA period controls (most documents don't use them). */
  compactPeriod?: boolean;
  /** Extra toolbar controls rendered before Download (e.g. publisher switch). */
  toolbarExtras?: React.ReactNode;
  /** Suppress the built-in canvas Download button (report supplies its own). */
  hideDownload?: boolean;
  children: (props: ReportBodyProps) => React.ReactNode;
}) {
  const template = REPORT_TEMPLATES[templateId];
  const { dataset, options, loading, error, cachedAt } = useReportingData(
    supabase,
    {},
  );
  const { filters, setFilter } = useReportFilters();
  const reportRef = React.useRef<HTMLDivElement>(null);
  const [exporting, setExporting] = React.useState(false);

  const fiscalYears = options?.fiscalYears ?? [];
  const fiscalYear = resolveFiscalYear(filters, fiscalYears);
  const effectiveFilters = resolveEffectiveFilters(filters, fiscalYears);
  const quarter = effectiveFilters.quarter;
  const label = makePeriodLabel(fiscalYear, quarter);
  const slug = makePeriodSlug(fiscalYear, quarter);

  const handleDownload = React.useCallback(async () => {
    if (!reportRef.current || exporting) return;
    setExporting(true);
    try {
      const { exportElementToPdf } = await import("@/lib/reporting/export-pdf");
      await exportElementToPdf(reportRef.current, `${templateId}-health-${slug}.pdf`);
    } catch (cause) {
      // eslint-disable-next-line no-console
      console.error("PDF export failed", cause);
      toast.error("Could not generate the PDF. Please try again.");
    } finally {
      setExporting(false);
    }
  }, [exporting, slug, templateId]);

  if (!hasSupabaseConfig || !supabase) {
    return (
      <Alert variant="warning">
        <AlertTitle>Supabase is not configured</AlertTitle>
        <AlertDescription>
          Add Supabase environment variables to load reporting data.
        </AlertDescription>
      </Alert>
    );
  }

  return (
    <div className="report-preview flex flex-col gap-5">
      <div
        className="flex flex-wrap items-center gap-3 rounded-lg border bg-card px-3 py-2.5 shadow-[0_1px_2px_hsl(var(--foreground)/0.03)]"
        data-pdf-exclude
      >
        <Link
          href="/admin/reports"
          className={cn(buttonVariants({ variant: "ghost", size: "sm" }))}
        >
          <ArrowLeftIcon aria-hidden className="size-4" />
          All reports
        </Link>
        <div className="min-w-0">
          <h1 className="truncate text-lg font-semibold tracking-tight">
            {template.title}
          </h1>
          <p className="text-xs text-muted-foreground">{label}</p>
        </div>
        <div className="ml-auto flex items-center gap-2">
          {toolbarExtras}
          {hideDownload ? null : (
            <Button
              type="button"
              variant="default"
              disabled={loading || exporting || !dataset}
              onClick={handleDownload}
            >
              {exporting ? (
                <Loader2Icon aria-hidden className="size-4 animate-spin" />
              ) : (
                <DownloadIcon aria-hidden className="size-4" />
              )}
              {exporting ? "Preparing PDF…" : "Download PDF"}
            </Button>
          )}
        </div>
      </div>

      <div data-pdf-exclude className="flex flex-col gap-3">
        <PeriodSelector
          fiscalYears={fiscalYears}
          fiscalYear={fiscalYear}
          quarter={quarter}
          phc={filters.phc}
          lgaId={filters.lgaId}
          lgaOptions={options?.lgas ?? []}
          loading={loading}
          compact={compactPeriod}
          onFiscalYearChange={(year) => setFilter("fiscalYear", year)}
          onQuarterChange={(next) => setFilter("quarter", next)}
          onPhcChange={(next) => setFilter("phc", next)}
          onLgaChange={(next) => setFilter("lgaId", next)}
        />
        <OfflineDataNotice cachedAt={cachedAt} />
        {error ? (
          <Alert variant="destructive">
            <AlertTitle>Could not load report</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        ) : null}
      </div>

      <div
        ref={reportRef}
        className="report-document flex flex-col gap-5 rounded-xl border border-border/80 bg-card p-4 shadow-[0_1px_2px_hsl(var(--foreground)/0.03),0_20px_55px_hsl(var(--foreground)/0.05)] sm:p-6 lg:p-8"
      >
        {dataset
          ? children({
              dataset,
              effectiveFilters,
              fiscalYear,
              quarter,
              periodLabel: label,
              loading,
            })
          : null}
      </div>
    </div>
  );
}
