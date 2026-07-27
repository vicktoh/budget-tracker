"use client";

/**
 * Per-MDA walkthrough: hero figures, then one card per budget component with
 * a burn gauge, the official Q1/Q2 story, the Jan-Jun month tracker, and a
 * reconciliation verdict. Mirrors the IBP validation companion's structure
 * inside the app's own design language.
 */
import * as React from "react";
import { ChevronLeftIcon, ChevronRightIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { formatCompactNaira, formatNaira } from "@/lib/format";
import type { MdaComponentScore, MdaScorecard } from "@/lib/reporting/aggregate";
import { proRataBand } from "@/lib/reporting/signals";
import {
  CLASS_COLORS,
  FIGURE_FONT,
  MonthTracker,
  PaceChip,
  QuarterCompare,
  RingGauge,
  VerdictChip,
} from "@/components/reporting/insights/primitives";

type MdaAnalysisProps = {
  cards: MdaScorecard[];
  selectedId: string | null;
  onSelect: (mdaId: string) => void;
  benchmarkQuarter: 1 | 2 | 3 | 4 | null;
};

function overallStatus(card: MdaScorecard): { label: string; className: string } {
  const verdicts = card.components.map((component) => component.verdict);
  if (card.components.some((component) => component.q2_silent)) {
    return { label: "Active in Q1, silent in Q2", className: "bg-status-pending/15 text-status-pending" };
  }
  if (verdicts.includes("differs") || verdicts.includes("untracked_spend")) {
    return { label: "Reconciliation worth checking", className: "bg-status-pending/15 text-status-pending" };
  }
  if (verdicts.includes("tracking_only")) {
    return { label: "Monthly figures await the BPR", className: "bg-status-processed/15 text-status-processed" };
  }
  return { label: "Sources consistent", className: "bg-status-approved/15 text-status-approved" };
}

function storyLine(component: MdaComponentScore): string {
  const q1 = formatCompactNaira(component.official_q1);
  const q2 = formatCompactNaira(component.official_q2);
  if (component.official_amount === 0 && component.tracked_amount === 0) {
    return "Nothing recorded in either source yet.";
  }
  if (component.official_amount === 0 && component.tracked_amount > 0) {
    return `The monthly tracker shows ${formatCompactNaira(component.tracked_amount)} that the published BPR has not yet booked.`;
  }
  if (component.q2_silent) {
    return `Active in Q1 (${q1}) with nothing recorded for Q2 — has spending stopped, or is the return outstanding?`;
  }
  return `Official BPR: ${q1} in Q1, ${q2} in Q2.`;
}

function reconciliationNote(component: MdaComponentScore): string | null {
  if (component.verdict === "differs") {
    const delta = component.official_amount - component.tracked_amount;
    const direction = delta > 0 ? "less" : "more";
    return `Monthly tracking totals ${formatCompactNaira(component.tracked_amount)} — ${formatCompactNaira(Math.abs(delta))} ${direction} than the official figure. The published BPR remains authoritative.`;
  }
  if (component.verdict === "untracked_spend") {
    return `The official figure (${formatCompactNaira(component.official_amount)}) never appeared in the monthly returns — likely paid centrally or reported straight to the quarterly BPR.`;
  }
  return null;
}

function ComponentCard({
  component,
  benchmarkQuarter,
}: {
  component: MdaComponentScore;
  benchmarkQuarter: MdaAnalysisProps["benchmarkQuarter"];
}) {
  const color = CLASS_COLORS[component.budget_class] ?? CLASS_COLORS.other;
  const level = proRataBand(component.burn_rate, benchmarkQuarter);
  const note = reconciliationNote(component);
  const hasMonths = component.months.some((cell) => cell.amount !== null);
  return (
    <Card className="overflow-hidden">
      <div
        className="flex flex-wrap items-center justify-between gap-2 border-b border-border bg-muted/50 px-5 py-3"
        style={{ borderLeft: `4px solid ${color}` }}
      >
        <h3 className="text-base font-semibold text-foreground" style={FIGURE_FONT}>
          {component.label}
        </h3>
        <span className="text-xs text-muted-foreground tabular-nums">
          Approved: {formatNaira(component.approved_amount)}
        </span>
      </div>
      <div className="grid gap-0 md:grid-cols-[190px_1fr]">
        <div className="flex flex-col items-center justify-center gap-2 border-b border-border p-5 md:border-b-0 md:border-r">
          <p className="text-[11px] uppercase tracking-wide text-muted-foreground">
            Jan–Jun burn rate
          </p>
          <RingGauge
            ratio={component.burn_rate}
            color={color}
            caption={
              component.approved_amount > 0
                ? `of ${formatCompactNaira(component.approved_amount)} approved`
                : "no approved budget for this line"
            }
          />
          <PaceChip level={level} />
        </div>
        <div className="flex flex-col gap-4 p-5">
          <p className="text-sm leading-relaxed">
            {storyLine(component)}{" "}
            <VerdictChip verdict={component.verdict} />
          </p>
          {note ? (
            <p
              className={cn(
                "rounded-lg border px-3.5 py-2.5 text-xs leading-relaxed",
                component.verdict === "untracked_spend"
                  ? "border-status-rejected/40 bg-status-rejected/5"
                  : "border-status-pending/40 bg-status-pending/5",
              )}
            >
              {note}
            </p>
          ) : null}
          <div className="grid gap-4 sm:grid-cols-[auto_1fr] sm:items-end">
            <QuarterCompare
              q1={component.official_q1}
              q2={component.official_q2}
              color={color}
            />
            {hasMonths ? (
              <MonthTracker months={component.months} color={color} />
            ) : (
              <p className="pb-2 text-xs text-muted-foreground">
                No monthly returns exist for this component — it is only visible
                in the quarterly BPR.
              </p>
            )}
          </div>
        </div>
      </div>
    </Card>
  );
}

export function MdaAnalysis({ cards, selectedId, onSelect, benchmarkQuarter }: MdaAnalysisProps) {
  const index = Math.max(
    0,
    cards.findIndex((card) => card.mda_id === selectedId),
  );
  const card = cards[index];
  if (!card) {
    return (
      <p className="py-10 text-center text-sm text-muted-foreground">
        No MDA activity for the current filters.
      </p>
    );
  }
  const status = overallStatus(card);
  const activeComponents = card.components.filter(
    (component) => component.approved_amount > 0 || component.official_amount > 0 || component.tracked_amount > 0,
  );

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-center gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={index === 0}
          onClick={() => onSelect(cards[index - 1]!.mda_id)}
        >
          <ChevronLeftIcon className="size-4" /> Previous
        </Button>
        <select
          className="h-9 min-w-64 flex-1 rounded-md border border-input bg-background px-3 text-sm font-medium sm:max-w-md"
          value={card.mda_id}
          onChange={(event) => onSelect(event.target.value)}
          aria-label="Select MDA"
        >
          {cards.map((option) => (
            <option key={option.mda_id} value={option.mda_id}>
              {option.mda_name}
            </option>
          ))}
        </select>
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={index === cards.length - 1}
          onClick={() => onSelect(cards[index + 1]!.mda_id)}
        >
          Next <ChevronRightIcon className="size-4" />
        </Button>
        <span className="ml-auto text-xs font-medium text-muted-foreground">
          MDA {index + 1} of {cards.length} · ranked by execution
        </span>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-2xl font-bold" style={FIGURE_FONT}>
          {card.mda_name}
        </h2>
        <span className={cn("rounded-full px-4 py-1.5 text-xs font-semibold", status.className)}>
          {status.label}
        </span>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-xl border border-border bg-card p-4" style={{ borderTop: "3px solid hsl(var(--primary))" }}>
          <p className="text-[10.5px] uppercase tracking-wide text-muted-foreground">
            Total approved budget
          </p>
          <p className="mt-1 text-2xl font-bold leading-tight text-foreground" style={FIGURE_FONT}>
            {formatCompactNaira(card.approved_total)}
          </p>
          <p className="mt-1 text-[11.5px] text-muted-foreground">
            {formatCompactNaira(card.official_total)} recorded spent Jan–Jun
          </p>
        </div>
        {activeComponents.map((component) => (
          <div
            key={component.budget_class}
            className="rounded-xl border border-border bg-card p-4"
            style={{ borderTop: `3px solid ${CLASS_COLORS[component.budget_class]}` }}
          >
            <p className="text-[10.5px] uppercase tracking-wide text-muted-foreground">
              {component.label}, Jan–Jun
            </p>
            <p
              className="mt-1 text-2xl font-bold leading-tight"
              style={{ ...FIGURE_FONT, color: CLASS_COLORS[component.budget_class] }}
            >
              {component.burn_rate === null ? "—" : `${(component.burn_rate * 100).toFixed(1)}%`}
            </p>
            <p className="mt-1 text-[11.5px] text-muted-foreground">
              of {formatCompactNaira(component.approved_amount)} approved
            </p>
          </div>
        ))}
      </div>

      {activeComponents.map((component) => (
        <ComponentCard
          key={component.budget_class}
          component={component}
          benchmarkQuarter={benchmarkQuarter}
        />
      ))}
    </div>
  );
}
