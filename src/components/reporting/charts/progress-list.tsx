import * as React from "react";
import { pickChartColor } from "@/components/reporting/charts/palette";
import { cn } from "@/lib/utils";

export type ProgressListItem = {
  id: string;
  label: string;
  /** Pre-formatted value shown on the right, e.g. "₦1.2B". */
  valueLabel: string;
  /** 0..1 width of the bar (clamped). */
  ratio: number;
  /** Optional pre-formatted share/rate caption, e.g. "34.2%". */
  shareLabel?: string;
  /** Optional explicit bar color. Falls back to the chart palette. */
  color?: string;
  /** When set, the row renders as a button (e.g. click-to-filter). */
  onClick?: () => void;
  /** Marks the row as the active selection when it is clickable. */
  active?: boolean;
};

type ProgressListProps = {
  items: ProgressListItem[];
  emptyMessage?: string;
  className?: string;
};

/**
 * Ranked horizontal progress bars — an infographic alternative to a bar
 * chart for share-of-total and leaderboard style breakdowns.
 */
export function ProgressList({
  items,
  emptyMessage = "No data for the current filters.",
  className,
}: ProgressListProps) {
  if (items.length === 0) {
    return (
      <p className="flex h-24 items-center justify-center text-sm text-muted-foreground">
        {emptyMessage}
      </p>
    );
  }

  return (
    <ul className={cn("flex flex-col gap-3", className)}>
      {items.map((item, index) => {
        const ratio = Math.max(0, Math.min(1, item.ratio));
        const row = (
          <>
            <div className="flex items-baseline justify-between gap-3 text-sm">
              <span className="min-w-0 truncate font-medium">{item.label}</span>
              <span className="flex shrink-0 items-baseline gap-2 tabular-nums">
                {item.shareLabel ? (
                  <span className="text-xs text-muted-foreground">
                    {item.shareLabel}
                  </span>
                ) : null}
                <span>{item.valueLabel}</span>
              </span>
            </div>
            <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
              <div
                className="h-full rounded-full"
                style={{
                  width: `${ratio * 100}%`,
                  backgroundColor: item.color ?? pickChartColor(index),
                }}
              />
            </div>
          </>
        );
        return (
          <li key={item.id}>
            {item.onClick ? (
              <button
                type="button"
                onClick={item.onClick}
                aria-pressed={item.active}
                className={cn(
                  "-mx-2 flex w-[calc(100%+1rem)] flex-col gap-1 rounded-md px-2 py-1 text-left",
                  "transition-colors hover:bg-muted/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                  item.active && "bg-muted/60",
                )}
              >
                {row}
              </button>
            ) : (
              <div className="flex flex-col gap-1">{row}</div>
            )}
          </li>
        );
      })}
    </ul>
  );
}
