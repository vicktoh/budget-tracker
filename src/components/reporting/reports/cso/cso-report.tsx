"use client";

import * as React from "react";
import { PencilIcon } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  ReportPreviewScaffold,
  type ReportBodyProps,
} from "@/components/reporting/reports/report-preview-scaffold";
import {
  ReportTable,
  type ReportTableColumn,
} from "@/components/reporting/reports/report-table";
import { PublisherSwitch } from "@/components/reporting/reports/cso/publisher-switch";
import { useCsoNarratives } from "@/components/reporting/reports/cso/use-cso-narratives";
import { ChartCard } from "@/components/reporting/chart-card";
import { ReportStatStrip } from "@/components/reporting/report-stat-strip";
import { DonutShareChart } from "@/components/reporting/charts/donut-share-chart";
import { GroupedCompareChart } from "@/components/reporting/charts/grouped-compare-chart";
import { QuarterlyTrendChart } from "@/components/reporting/charts/quarterly-trend-chart";
import { CHART_COLORS } from "@/components/reporting/charts/palette";
import { supabase } from "@/lib/supabase";
import {
  DEFAULT_PUBLISHER,
  loadReportPublishers,
  type ReportPublisher,
} from "@/lib/db/report-publishers";
import {
  aggregateHeadlineKpis,
  aggregatePhcShare,
  aggregateProgrammeAreaSummary,
  aggregateQuarterlyTrend,
} from "@/lib/reporting/aggregate";
import { computeFindings, type Finding, type SignalLevel } from "@/lib/reporting/signals";
import {
  RECOMMENDATIONS_KEY,
  WATCHLIST_KEY,
  buildCsoAutoDrafts,
  buildCsoYoy,
  findingSectionKey,
  recommendationsHeading,
  yoyAmount,
  type YoyFigureRow,
} from "@/lib/reporting/cso-content";
import { formatCompactNaira, formatPercent } from "@/lib/format";

const LEVEL_TEXT: Record<SignalLevel, string> = {
  strong: "text-status-approved",
  on_track: "text-status-processed",
  investigate: "text-status-pending",
  critical: "text-status-rejected",
};

const LEVEL_BADGE: Record<SignalLevel, "approved" | "processed" | "pending" | "rejected"> = {
  strong: "approved",
  on_track: "processed",
  investigate: "pending",
  critical: "rejected",
};

export function CsoReportRoute() {
  const [publishers, setPublishers] = React.useState<ReportPublisher[]>([]);
  const [publisherSlug, setPublisherSlug] = React.useState(DEFAULT_PUBLISHER.slug);
  const [editMode, setEditMode] = React.useState(false);

  React.useEffect(() => {
    if (!supabase) return;
    let cancelled = false;
    loadReportPublishers(supabase)
      .then((rows) => {
        if (!cancelled && rows.length > 0) setPublishers(rows);
      })
      .catch((cause: unknown) => {
        // eslint-disable-next-line no-console
        console.error("Failed to load publishers", cause);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const publisher =
    publishers.find((row) => row.slug === publisherSlug) ?? DEFAULT_PUBLISHER;

  return (
    <ReportPreviewScaffold
      templateId="cso"
      toolbarExtras={
        <>
          <PublisherSwitch
            publishers={publishers}
            value={publisherSlug}
            onChange={setPublisherSlug}
          />
          <Button
            type="button"
            variant={editMode ? "default" : "outline"}
            onClick={() => setEditMode((prev) => !prev)}
          >
            <PencilIcon aria-hidden className="size-4" />
            {editMode ? "Editing" : "Edit narrative"}
          </Button>
        </>
      }
    >
      {(props) => (
        <CsoReportBody {...props} publisher={publisher} editMode={editMode} />
      )}
    </ReportPreviewScaffold>
  );
}

type EditableSection = { sectionKey: string; label: string; headline?: string };

function CsoReportBody({
  dataset,
  effectiveFilters,
  fiscalYear,
  quarter,
  periodLabel,
  loading,
  publisher,
  editMode,
}: ReportBodyProps & { publisher: ReportPublisher; editMode: boolean }) {
  const findings = computeFindings(dataset, effectiveFilters, {});
  const kpis = aggregateHeadlineKpis(
    dataset.budgets,
    dataset.funding,
    dataset.expenditure,
    effectiveFilters,
    {},
  );
  const autoDrafts = React.useMemo(
    () => buildCsoAutoDrafts(findings, publisher.voicePreset),
    [findings, publisher.voicePreset],
  );
  const yoy = buildCsoYoy(dataset, effectiveFilters);
  const budgetYoy = yoy.rows.find((row) => row.key === "budget");
  const budgetChange = budgetYoy?.changeLabel;
  const budgetBadge = budgetChange
    ? `${budgetChange.includes("×") || budgetChange.startsWith("-") ? "" : "+"}${budgetChange}${
        yoy.priorFiscalYear ? ` vs FY${yoy.priorFiscalYear}` : ""
      }`
    : undefined;
  const executionFinding = findings.find((finding) => finding.key === "execution");
  const overheadFinding = findings.find((finding) => finding.key === "overhead");
  const capitalFinding = findings.find((finding) => finding.key === "capital");
  const programmes = aggregateProgrammeAreaSummary(
    dataset.funding,
    dataset.expenditure,
    effectiveFilters,
    {},
  ).slice(0, 6);
  const phcShare = aggregatePhcShare(dataset.expenditure, effectiveFilters, {});
  const trend = aggregateQuarterlyTrend(
    dataset.funding,
    dataset.expenditure,
    effectiveFilters,
    {},
  );
  const hasTrendData = trend.some(
    (row) => row.total_funding_amount > 0 || row.total_expenditure_amount > 0,
  );

  const narratives = useCsoNarratives({
    client: supabase,
    fiscalYear,
    quarter,
    autoDrafts,
  });

  const editableSections: EditableSection[] = [
    ...findings.map((finding) => ({
      sectionKey: findingSectionKey(finding.key),
      label: finding.title,
      headline: `${finding.headline} · ${finding.context}`,
    })),
    { sectionKey: RECOMMENDATIONS_KEY, label: recommendationsHeading(publisher.voicePreset) },
    { sectionKey: WATCHLIST_KEY, label: "Next-quarter watchlist" },
  ];

  return (
    <article className="flex flex-col gap-8">
      {editMode ? (
        <NarrativeEditor
          sections={editableSections}
          narratives={narratives}
          periodLabel={periodLabel}
        />
      ) : null}

      <CsoCover publisher={publisher} periodLabel={periodLabel} />

      <ReportStatStrip
        eyebrow="The numbers now"
        title={`Health financing at a glance — ${periodLabel}`}
        stats={[
          {
            label: "Health approved budget",
            value: formatCompactNaira(kpis.total_budget_amount),
            helper: "Annual health-sector envelope in the current reporting scope.",
            badge: budgetBadge,
          },
          {
            label: "Budget execution",
            value: executionFinding?.headline ?? "—",
            helper: executionFinding?.context ?? "No execution benchmark available.",
            tone: executionFinding?.level ?? "investigate",
            progress: kpis.budget_execution_rate,
            progressLabel: "Share of the approved budget spent",
          },
          {
            label: "Health overhead",
            value: overheadFinding?.headline ?? "—",
            helper: overheadFinding?.context ?? "No overhead budget available.",
            tone: overheadFinding?.level ?? "investigate",
          },
          {
            label: "Capital execution",
            value: capitalFinding?.headline ?? "—",
            helper: capitalFinding?.context ?? "No capital budget available.",
            tone: capitalFinding?.level ?? "investigate",
          },
        ]}
      />

      {/* Findings */}
      <section className="flex flex-col gap-3">
        <SectionHeading>Findings — {periodLabel}</SectionHeading>
        <div className="flex flex-col gap-3">
          {findings.map((finding) => (
            <FindingCard
              key={finding.key}
              finding={finding}
              body={narratives.bodyFor(findingSectionKey(finding.key))}
            />
          ))}
        </div>
      </section>

      {/* Where the money went */}
      <section className="flex flex-col gap-3">
        <SectionHeading>Where the money went — {periodLabel}</SectionHeading>
        <div className="grid gap-5 lg:grid-cols-5">
          <div className="lg:col-span-3">
            <ChartCard
              title="Funding vs spending by programme"
              description="The six largest programme areas, money received against money spent."
              loading={loading}
              isEmpty={!loading && programmes.length === 0}
            >
              <GroupedCompareChart
                data={programmes.map((row) => ({
                  id: row.programme_area_id,
                  label: row.programme_area_name,
                  primary: row.total_funding_amount,
                  secondary: row.total_expenditure_amount,
                }))}
                primaryName="Funding received"
                secondaryName="Spending recorded"
              />
            </ChartCard>
          </div>
          <div className="lg:col-span-2">
            <ChartCard
              title="Primary healthcare share"
              description="How much of all spending reached primary healthcare."
              loading={loading}
              isEmpty={!loading && phcShare.total_amount === 0}
            >
              <DonutShareChart
                data={[
                  {
                    id: "phc",
                    label: "Primary healthcare",
                    value: phcShare.phc_amount,
                    color: CHART_COLORS[0],
                  },
                  {
                    id: "non-phc",
                    label: "Other health spending",
                    value: phcShare.non_phc_amount,
                    color: CHART_COLORS[4],
                  },
                ]}
                centerValue={formatPercent(phcShare.phc_share)}
                centerLabel="PHC share"
              />
            </ChartCard>
          </div>
        </div>
      </section>

      {/* Quarterly rhythm */}
      <section className="flex flex-col gap-3">
        <SectionHeading>The quarterly rhythm</SectionHeading>
        <ChartCard
          title="When money arrived vs when it was spent"
          description="Quarter by quarter across the fiscal year. Gaps between the bars show release timing pressure."
          loading={loading}
          isEmpty={!loading && !hasTrendData}
        >
          <QuarterlyTrendChart data={trend} activeQuarter={quarter} />
        </ChartCard>
      </section>

      {/* Programme at a glance */}
      <section className="flex flex-col gap-3">
        <SectionHeading>Programme at a glance</SectionHeading>
        {programmes.length === 0 ? (
          <EmptyNote>No programme spending recorded this period.</EmptyNote>
        ) : (
          <ReportTable
            columns={programmeColumns}
            rows={programmes.map((row) => ({
              id: row.programme_area_id,
              name: row.programme_area_name,
              expenditure: row.total_expenditure_amount,
              funding: row.total_funding_amount,
            }))}
            getRowKey={(row) => row.id}
          />
        )}
      </section>

      {/* Recommendations */}
      <section className="flex flex-col gap-2">
        <SectionHeading>{recommendationsHeading(publisher.voicePreset)}</SectionHeading>
        <Prose>{narratives.bodyFor(RECOMMENDATIONS_KEY)}</Prose>
      </section>

      {/* Watchlist */}
      <section className="flex flex-col gap-2">
        <SectionHeading>Next-quarter watchlist</SectionHeading>
        <Prose>{narratives.bodyFor(WATCHLIST_KEY)}</Prose>
      </section>

      {/* Verified figures */}
      <section className="flex flex-col gap-3">
        <SectionHeading>The full picture — verified figures</SectionHeading>
        {yoy.hasPrior ? (
          <div className="flex flex-col gap-4">
            <ChartCard
              title="Year over year"
              description={`Approved budget and actual spending, FY ${yoy.priorFiscalYear} against the current year.`}
              loading={loading}
            >
              <GroupedCompareChart
                data={yoy.rows.map((row) => ({
                  id: row.key,
                  label: row.label,
                  primary: row.prior,
                  secondary: row.current,
                }))}
                primaryName={`FY ${yoy.priorFiscalYear}`}
                secondaryName="Current year"
                primaryColor={CHART_COLORS[4]}
                secondaryColor={CHART_COLORS[0]}
                labelWidth={170}
              />
            </ChartCard>
            <ReportTable
              caption={`Health-sector figures, FY ${yoy.priorFiscalYear} vs the current year.`}
              columns={yoyColumns}
              rows={yoy.rows}
              getRowKey={(row) => row.key}
            />
          </div>
        ) : (
          <EmptyNote>
            No prior-year baseline is available for year-over-year comparison yet.
          </EmptyNote>
        )}
      </section>

      <p className="border-t pt-4 text-xs text-muted-foreground">
        Published by {publisher.name}. Findings and figures are computed from the live
        budget-tracker ledger; narrative interpretation is editorial. {periodLabel}.
      </p>
    </article>
  );
}

/* -------------------------------------------------------------------------- */
/* Pieces                                                                     */
/* -------------------------------------------------------------------------- */

function CsoCover({
  publisher,
  periodLabel,
}: {
  publisher: ReportPublisher;
  periodLabel: string;
}) {
  return (
    <header
      className="flex flex-col gap-3 rounded-lg p-6 text-white"
      style={{ background: publisher.palette.cover }}
    >
      <span
        className="text-[11px] font-semibold uppercase tracking-[0.14em]"
        style={{ color: publisher.palette.accent }}
      >
        {publisher.name} · Health Financing
      </span>
      <h1 className="max-w-2xl text-2xl font-bold leading-tight">
        What the numbers{" "}
        <span style={{ color: publisher.palette.accent }}>actually tell us</span> about
        Kano&apos;s health system
      </h1>
      <span className="text-sm text-white/70">
        Accountability Brief · {periodLabel}
      </span>
    </header>
  );
}

function FindingCard({ finding, body }: { finding: Finding; body: string }) {
  return (
    <div className="flex gap-4 rounded-lg border border-l-[3px] bg-card p-4"
      style={{ borderLeftColor: `hsl(var(--status-${LEVEL_BADGE[finding.level]}))` }}
    >
      <div className="w-28 shrink-0">
        <Badge variant={LEVEL_BADGE[finding.level]}>{finding.label}</Badge>
        <p className={`mt-1.5 text-2xl font-bold tabular-nums ${LEVEL_TEXT[finding.level]}`}>
          {finding.headline}
        </p>
        <p className="text-xs text-muted-foreground">{finding.context}</p>
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold">{finding.title}</p>
        <p className="mt-1 whitespace-pre-wrap text-sm text-muted-foreground">{body}</p>
      </div>
    </div>
  );
}

function NarrativeEditor({
  sections,
  narratives,
  periodLabel,
}: {
  sections: EditableSection[];
  narratives: ReturnType<typeof useCsoNarratives>;
  periodLabel: string;
}) {
  return (
    <aside
      data-pdf-exclude
      className="flex flex-col gap-3 rounded-lg border bg-muted/30 p-4"
    >
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold">Edit narrative — {periodLabel}</h2>
        <span className="text-xs text-muted-foreground">
          {narratives.loading ? "Loading…" : "Auto-drafts regenerate when data changes"}
        </span>
      </div>
      <div className="grid gap-3 lg:grid-cols-2">
        {sections.map((section) => {
          const edited = narratives.isEdited(section.sectionKey);
          const dirty = narratives.isDirty(section.sectionKey);
          return (
            <div key={section.sectionKey} className="flex flex-col gap-1.5 rounded-md border bg-card p-3">
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-semibold">{section.label}</span>
                <Badge variant={edited ? "processed" : "outline"}>
                  {edited ? "Edited" : "Auto-draft"}
                </Badge>
              </div>
              {section.headline ? (
                <p className="rounded bg-muted px-2 py-1 text-[11px] tabular-nums text-muted-foreground">
                  {section.headline}
                </p>
              ) : null}
              <Textarea
                value={narratives.bodyFor(section.sectionKey)}
                onChange={(event) => narratives.setEdit(section.sectionKey, event.target.value)}
                className="min-h-20 focus-visible:ring-status-approved"
              />
              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  size="sm"
                  disabled={!dirty || narratives.savingKey === section.sectionKey}
                  onClick={() => narratives.save(section.sectionKey)}
                >
                  {narratives.savingKey === section.sectionKey ? "Saving…" : "Save"}
                </Button>
                {dirty ? (
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    onClick={() => narratives.revert(section.sectionKey)}
                  >
                    Revert
                  </Button>
                ) : null}
              </div>
            </div>
          );
        })}
      </div>
    </aside>
  );
}

function SectionHeading({ children }: { children: React.ReactNode }) {
  return <h2 className="text-lg font-semibold tracking-tight">{children}</h2>;
}

function Prose({ children }: { children: React.ReactNode }) {
  return <p className="max-w-3xl whitespace-pre-wrap text-sm text-muted-foreground">{children}</p>;
}

function EmptyNote({ children }: { children: React.ReactNode }) {
  return (
    <p className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
      {children}
    </p>
  );
}

/* -------------------------------------------------------------------------- */
/* Columns                                                                    */
/* -------------------------------------------------------------------------- */

type ProgrammeRow = { id: string; name: string; expenditure: number; funding: number };

const programmeColumns: ReportTableColumn<ProgrammeRow>[] = [
  { key: "name", header: "Programme area", render: (row) => row.name },
  {
    key: "expenditure",
    header: "Spending",
    align: "right",
    render: (row) => formatCompactNaira(row.expenditure),
  },
  {
    key: "funding",
    header: "Funding",
    align: "right",
    render: (row) => formatCompactNaira(row.funding),
  },
];

const yoyColumns: ReportTableColumn<YoyFigureRow>[] = [
  { key: "metric", header: "Metric", render: (row) => row.label },
  {
    key: "prior",
    header: "Prior year",
    align: "right",
    render: (row) => yoyAmount(row.prior),
  },
  {
    key: "current",
    header: "Current year",
    align: "right",
    render: (row) => yoyAmount(row.current),
  },
  {
    key: "change",
    header: "Change",
    align: "right",
    render: (row) => row.changeLabel ?? "—",
  },
];
