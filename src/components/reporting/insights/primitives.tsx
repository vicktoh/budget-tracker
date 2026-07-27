"use client";

/**
 * Editorial presentation primitives for the Admin Insights surface, adapted
 * from the IBP validation walkthrough: ring gauges, the Jan-Jun month tracker,
 * reconciliation verdict chips, and serif display numerals. All colors come
 * from the app's chart/status tokens so light and dark themes both hold.
 */
import * as React from "react";
import { cn } from "@/lib/utils";
import { formatCompactNaira, formatNaira } from "@/lib/format";
import type { MonthCell, TrackingVerdict } from "@/lib/reporting/aggregate";
import type { SignalLevel } from "@/lib/reporting/signals";

/** Serif stack for display figures — the report-document voice. */
export const FIGURE_FONT = { fontFamily: "Georgia, 'Times New Roman', serif" } as const;

export const CLASS_COLORS: Record<string, string> = {
  personnel: "hsl(var(--chart-1))",
  overhead: "hsl(var(--chart-2))",
  capital: "hsl(var(--chart-3))",
  other: "hsl(var(--chart-4))",
};

export const LEVEL_TEXT: Record<SignalLevel, string> = {
  strong: "text-status-approved",
  on_track: "text-status-processed",
  investigate: "text-status-pending",
  critical: "text-status-rejected",
};

export const LEVEL_BG: Record<SignalLevel, string> = {
  strong: "bg-status-approved/15 text-status-approved",
  on_track: "bg-status-processed/15 text-status-processed",
  investigate: "bg-status-pending/15 text-status-pending",
  critical: "bg-status-rejected/15 text-status-rejected",
};

export const LEVEL_LABEL: Record<SignalLevel, string> = {
  strong: "On pace",
  on_track: "Broadly on track",
  investigate: "Behind pace",
  critical: "Well behind pace",
};

export function PaceChip({ level }: { level: SignalLevel }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-semibold",
        LEVEL_BG[level],
      )}
    >
      {LEVEL_LABEL[level]}
    </span>
  );
}

const VERDICT_META: Record<TrackingVerdict, { label: string; className: string }> = {
  matches: { label: "Tracking agrees", className: "bg-status-approved/15 text-status-approved" },
  differs: { label: "Sources disagree", className: "bg-status-pending/15 text-status-pending" },
  untracked_spend: {
    label: "Not in monthly tracking",
    className: "bg-status-rejected/15 text-status-rejected",
  },
  tracking_only: {
    label: "Only in monthly tracking",
    className: "bg-status-processed/15 text-status-processed",
  },
  no_data: { label: "No activity", className: "bg-muted text-muted-foreground" },
};

export function VerdictChip({ verdict }: { verdict: TrackingVerdict }) {
  const meta = VERDICT_META[verdict];
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-semibold",
        meta.className,
      )}
    >
      {meta.label}
    </span>
  );
}

type RingGaugeProps = {
  /** 0..1 (values above 1 render as a full ring). */
  ratio: number | null;
  color: string;
  size?: number;
  /** Text under the percentage, e.g. "of ₦5.2bn". */
  caption?: string;
};

/** Static SVG ring gauge with the percentage set in serif, per the reference. */
export function RingGauge({ ratio, color, size = 120, caption }: RingGaugeProps) {
  const radius = 54;
  const circumference = 2 * Math.PI * radius;
  const safe = ratio === null ? 0 : Math.max(0, Math.min(ratio, 1));
  const offset = circumference * (1 - safe);
  return (
    <div className="flex flex-col items-center gap-1">
      <svg
        width={size}
        height={size}
        viewBox="0 0 120 120"
        role="img"
        aria-label={ratio === null ? "No budget" : `${(ratio * 100).toFixed(0)}% of budget`}
      >
        <circle cx="60" cy="60" r={radius} fill="none" strokeWidth="11" className="stroke-muted" />
        <circle
          cx="60"
          cy="60"
          r={radius}
          fill="none"
          strokeWidth="11"
          strokeLinecap="round"
          stroke={color}
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          transform="rotate(-90 60 60)"
          style={{ transition: "stroke-dashoffset 900ms cubic-bezier(.4,0,.2,1)" }}
        />
        <text
          x="60"
          y="66"
          textAnchor="middle"
          className="fill-foreground"
          style={{ ...FIGURE_FONT, fontSize: 24, fontWeight: 700 }}
        >
          {ratio === null ? "—" : `${(ratio * 100).toFixed(0)}%`}
        </text>
      </svg>
      {caption ? (
        <span className="text-center text-[11px] leading-tight text-muted-foreground">{caption}</span>
      ) : null}
    </div>
  );
}

const MONTH_LABELS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/**
 * The reference HTML's month boxes: solid = reported, "0" = explicit zero,
 * dashed = nothing submitted. The zero/blank distinction is the whole point —
 * a reported zero is discipline, a blank is a gap.
 */
export function MonthTracker({ months, color }: { months: MonthCell[]; color: string }) {
  return (
    <div>
      <div className="flex gap-1.5">
        {months.map((cell) => {
          const label = MONTH_LABELS[cell.month - 1] ?? String(cell.month);
          const state = cell.amount === null ? "blank" : cell.amount === 0 ? "zero" : "value";
          return (
            <div key={cell.month} className="flex min-w-0 flex-1 flex-col items-center gap-0.5">
              <div
                title={
                  state === "blank"
                    ? `${label}: nothing submitted`
                    : `${label}: ${formatNaira(cell.amount)}`
                }
                className={cn(
                  "flex aspect-square w-full max-w-11 items-center justify-center rounded-md text-xs font-semibold",
                  state === "value" && "text-white",
                  state === "zero" && "bg-muted text-muted-foreground",
                  state === "blank" &&
                    "border-2 border-dashed border-border text-transparent",
                )}
                style={state === "value" ? { backgroundColor: color } : undefined}
              >
                {state === "value" ? "✓" : state === "zero" ? "0" : "·"}
              </div>
              <span className="text-[10px] font-semibold text-muted-foreground">{label}</span>
              <span className="min-h-3 text-[10px] leading-none text-muted-foreground">
                {state === "value" ? formatCompactNaira(cell.amount ?? 0) : state === "zero" ? "₦0" : ""}
              </span>
            </div>
          );
        })}
      </div>
      <p className="mt-1.5 text-[11px] text-muted-foreground">
        Solid = reported · grey 0 = explicitly zero · dashed = nothing submitted
      </p>
    </div>
  );
}

/** Two-bar Q1 vs Q2 comparison, scaled to the larger quarter. */
export function QuarterCompare({
  q1,
  q2,
  color,
}: {
  q1: number;
  q2: number;
  color: string;
}) {
  const max = Math.max(q1, q2, 1);
  const bar = (value: number, label: string, faded: boolean) => (
    <div className="flex h-full flex-1 flex-col items-center justify-end gap-1">
      <span className="text-[11px] font-semibold tabular-nums">{formatCompactNaira(value)}</span>
      <div
        className="w-10 rounded-t"
        style={{
          height: `${Math.max((value / max) * 64, value > 0 ? 6 : 2)}px`,
          backgroundColor: color,
          opacity: faded ? 0.55 : 1,
          transition: "height 700ms cubic-bezier(.4,0,.2,1)",
        }}
      />
      <span className="text-[11px] text-muted-foreground">{label}</span>
    </div>
  );
  return (
    <div className="flex h-28 items-end gap-4 px-1">
      {bar(q1, "Q1 (Jan–Mar)", false)}
      {bar(q2, "Q2 (Apr–Jun)", true)}
    </div>
  );
}
