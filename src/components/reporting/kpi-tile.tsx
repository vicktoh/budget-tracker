import * as React from "react";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

type KpiTileProps = {
  label: string;
  value: string;
  /** Subtext under the value, e.g. "FY 2026 · Q2". */
  helper?: string;
  /** 0..1 ratio rendered as a mini progress bar (clamped). Null hides the bar. */
  progress?: number | null;
  /** Caption next to the progress bar, e.g. "12.4% of budget". */
  progressLabel?: string;
  /** Small chip rendered beside the value, e.g. a quarter-over-quarter delta. */
  badge?: React.ReactNode;
};

/**
 * Large infographic stat tile for the reports page. A bolder sibling of
 * `StatCard` with an optional progress bar for rate-style KPIs.
 */
export function KpiTile({
  label,
  value,
  helper,
  progress,
  progressLabel,
  badge,
}: KpiTileProps) {
  const clamped =
    progress === null || progress === undefined
      ? null
      : Math.max(0, Math.min(1, progress));

  return (
    <Card>
      <CardContent className="flex flex-col gap-2 p-5">
        <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          {label}
        </span>
        <div className="flex items-baseline gap-2">
          <span className="text-3xl font-semibold leading-tight tabular-nums">
            {value}
          </span>
          {badge ? <span className="text-sm">{badge}</span> : null}
        </div>
        {helper ? <p className="text-xs text-muted-foreground">{helper}</p> : null}
        {clamped !== null ? (
          <div className="flex flex-col gap-1 pt-1">
            <div
              role="progressbar"
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={Math.round(clamped * 100)}
              className="h-1.5 w-full overflow-hidden rounded-full bg-muted"
            >
              <div
                className="h-full rounded-full bg-primary transition-[width]"
                style={{ width: `${clamped * 100}%` }}
              />
            </div>
            {progressLabel ? (
              <span className="text-xs text-muted-foreground">{progressLabel}</span>
            ) : null}
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}

/** Up/down delta chip for KPI tiles, e.g. quarter-over-quarter movement. */
export function DeltaBadge({ ratio }: { ratio: number | null }) {
  if (ratio === null || Number.isNaN(ratio)) return null;
  const up = ratio >= 0;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-0.5 rounded-full px-1.5 py-0.5 text-xs font-medium tabular-nums",
        up
          ? "bg-status-approved-bg text-status-approved"
          : "bg-status-rejected-bg text-status-rejected",
      )}
    >
      {up ? "▲" : "▼"} {Math.abs(ratio * 100).toFixed(1)}%
    </span>
  );
}
