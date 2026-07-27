"use client";

/**
 * Top vs least performing MDAs, ranked by burn rate against the pro-rata
 * benchmark. Each row is a compact bullet: serif percentage, budget-scaled
 * context, and a pace band chip.
 */
import * as React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { formatCompactNaira } from "@/lib/format";
import type { MdaScorecard } from "@/lib/reporting/aggregate";
import { proRataBand } from "@/lib/reporting/signals";
import {
  FIGURE_FONT,
  LEVEL_TEXT,
  PaceChip,
} from "@/components/reporting/insights/primitives";

type LeaderboardProps = {
  cards: MdaScorecard[];
  /** Quarter used for the pro-rata benchmark (2 = half-year target of 50%). */
  benchmarkQuarter: 1 | 2 | 3 | 4 | null;
  count?: number;
  onSelect?: (mdaId: string) => void;
};

function Row({
  card,
  benchmarkQuarter,
  rank,
  onSelect,
}: {
  card: MdaScorecard;
  benchmarkQuarter: LeaderboardProps["benchmarkQuarter"];
  rank: number;
  onSelect?: (mdaId: string) => void;
}) {
  const level = proRataBand(card.burn_rate, benchmarkQuarter);
  const width = Math.min(Math.max((card.burn_rate ?? 0) * 100, 1.5), 100);
  return (
    <button
      type="button"
      onClick={onSelect ? () => onSelect(card.mda_id) : undefined}
      className={cn(
        "w-full rounded-lg px-3 py-2.5 text-left transition-colors",
        onSelect && "cursor-pointer hover:bg-muted/60",
      )}
    >
      <div className="flex items-baseline justify-between gap-3">
        <span className="min-w-0 truncate text-sm font-medium">
          <span className="mr-2 inline-block w-5 text-right text-xs text-muted-foreground">
            {rank}.
          </span>
          {card.mda_name}
        </span>
        <span
          className={cn("shrink-0 text-lg font-bold tabular-nums", LEVEL_TEXT[level])}
          style={FIGURE_FONT}
        >
          {card.burn_rate === null ? "—" : `${(card.burn_rate * 100).toFixed(1)}%`}
        </span>
      </div>
      <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-muted">
        <div
          className={cn("h-full rounded-full", {
            "bg-status-approved": level === "strong",
            "bg-status-processed": level === "on_track",
            "bg-status-pending": level === "investigate",
            "bg-status-rejected": level === "critical",
          })}
          style={{ width: `${width}%`, transition: "width 800ms cubic-bezier(.4,0,.2,1)" }}
        />
      </div>
      <div className="mt-1 flex items-center justify-between gap-2 text-[11px] text-muted-foreground">
        <span className="tabular-nums">
          {formatCompactNaira(card.official_total)} of {formatCompactNaira(card.approved_total)}
        </span>
        <PaceChip level={level} />
      </div>
    </button>
  );
}

export function Leaderboard({ cards, benchmarkQuarter, count = 5, onSelect }: LeaderboardProps) {
  const ranked = cards.filter((card) => card.approved_total > 0);
  const top = ranked.slice(0, count);
  const bottom = ranked.slice(-count).reverse();
  return (
    <div className="grid gap-5 lg:grid-cols-2">
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Top performing MDAs</CardTitle>
          <p className="text-xs text-muted-foreground">
            Highest budget execution so far, judged against the pro-rata benchmark.
          </p>
        </CardHeader>
        <CardContent className="flex flex-col gap-1">
          {top.map((card, index) => (
            <Row key={card.mda_id} card={card} benchmarkQuarter={benchmarkQuarter}
              rank={index + 1} onSelect={onSelect} />
          ))}
        </CardContent>
      </Card>
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Least performing MDAs</CardTitle>
          <p className="text-xs text-muted-foreground">
            Lowest execution — untouched budgets and stalled lines surface here.
          </p>
        </CardHeader>
        <CardContent className="flex flex-col gap-1">
          {bottom.map((card, index) => (
            <Row key={card.mda_id} card={card} benchmarkQuarter={benchmarkQuarter}
              rank={ranked.length - index} onSelect={onSelect} />
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
