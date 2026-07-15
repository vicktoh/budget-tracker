import * as React from "react";
import { formatPercent } from "@/lib/format";
import { cn } from "@/lib/utils";

export type BulletPerformanceItem = {
  id: string;
  label: string;
  /** Pre-formatted plan figure shown on the right, e.g. "₦4.2B budget". */
  planLabel: string;
  /** Pre-formatted actual figure, e.g. "₦1.1B spent". */
  actualLabel: string;
  /** actual / plan. Null renders an em dash and an empty bar. */
  ratio: number | null;
};

type BulletPerformanceListProps = {
  items: BulletPerformanceItem[];
  /** 0..1 pro-rata benchmark rendered as a tick on every bar. */
  target?: number | null;
  targetLabel?: string;
  emptyMessage?: string;
  className?: string;
};

/**
 * Bullet-style execution bars: the muted track is the plan (budget), the
 * fill is actual delivery, and an optional tick marks the pro-rata target.
 * Overruns (>100%) switch the fill to the rejected status color and are
 * labeled, so the signal is never color-alone.
 */
export function BulletPerformanceList({
  items,
  target,
  targetLabel = "Pro-rata target",
  emptyMessage = "No data for the current filters.",
  className,
}: BulletPerformanceListProps) {
  if (items.length === 0) {
    return (
      <p className="flex h-24 items-center justify-center text-sm text-muted-foreground">
        {emptyMessage}
      </p>
    );
  }

  const clampedTarget =
    target === null || target === undefined
      ? null
      : Math.max(0, Math.min(1, target));

  return (
    <div className={cn("flex flex-col gap-3", className)}>
      <ul className="flex flex-col gap-3">
        {items.map((item) => {
          const overrun = item.ratio !== null && item.ratio > 1;
          const width =
            item.ratio === null ? 0 : Math.max(0, Math.min(1, item.ratio));
          return (
            <li key={item.id} className="flex flex-col gap-1">
              <div className="flex items-baseline justify-between gap-3 text-sm">
                <span className="min-w-0 truncate font-medium">{item.label}</span>
                <span className="flex shrink-0 items-baseline gap-2 tabular-nums">
                  <span
                    className={cn(
                      "text-xs font-semibold",
                      overrun ? "text-status-rejected" : "text-muted-foreground",
                    )}
                  >
                    {formatPercent(item.ratio)}
                    {overrun ? " over" : ""}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {item.actualLabel} of {item.planLabel}
                  </span>
                </span>
              </div>
              <div className="relative h-2.5 w-full overflow-hidden rounded-full bg-muted">
                <div
                  className="h-full rounded-full"
                  style={{
                    width: `${width * 100}%`,
                    backgroundColor: overrun
                      ? "hsl(var(--status-rejected))"
                      : "hsl(var(--chart-1))",
                  }}
                />
                {clampedTarget !== null ? (
                  <span
                    aria-hidden="true"
                    className="absolute inset-y-0 w-0.5 bg-foreground/50"
                    style={{ left: `${clampedTarget * 100}%` }}
                  />
                ) : null}
              </div>
            </li>
          );
        })}
      </ul>
      {clampedTarget !== null ? (
        <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <span aria-hidden="true" className="inline-block h-3 w-0.5 bg-foreground/50" />
          {targetLabel}: {formatPercent(clampedTarget)} of plan at this point in the year
        </p>
      ) : null}
    </div>
  );
}
