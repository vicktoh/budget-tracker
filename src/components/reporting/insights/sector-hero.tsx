"use client";

/**
 * Sector banner summarising the health envelope in one figure. Structure comes
 * from the IBP validation walkthrough (big donut + headline sentence + fact
 * chips); the surface itself uses the app's own tokens so it sits naturally in
 * both light and dark themes.
 */
import * as React from "react";
import { FIGURE_FONT } from "@/components/reporting/insights/primitives";
import { formatCompactNaira } from "@/lib/format";

type SectorHeroProps = {
  approvedTotal: number;
  officialTotal: number;
  mdaCount: number;
  monthsCovered: number;
  reportingMdaCount: number;
  fiscalYear: number | null;
};

const MONTH_SHORT = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

export function SectorHero({
  approvedTotal,
  officialTotal,
  mdaCount,
  monthsCovered,
  reportingMdaCount,
  fiscalYear,
}: SectorHeroProps) {
  const burn = approvedTotal > 0 ? officialTotal / approvedTotal : null;
  const radius = 66;
  const circumference = 2 * Math.PI * radius;
  const filled = circumference * Math.min(burn ?? 0, 1);
  const monthLabel = MONTH_SHORT[monthsCovered - 1] ?? "Jun";

  return (
    <section
      className="overflow-hidden rounded-xl border border-border bg-card px-6 py-6 sm:px-8"
      style={{
        backgroundImage:
          "radial-gradient(ellipse 70% 120% at 90% -20%, hsl(var(--primary) / 0.08), transparent 55%)",
      }}
    >
      <div className="flex flex-wrap items-center gap-6 sm:gap-10">
        <svg
          width="176"
          height="176"
          viewBox="0 0 176 176"
          className="shrink-0"
          role="img"
          aria-label={
            burn === null ? "No approved budget" : `${(burn * 100).toFixed(1)}% of budget spent`
          }
        >
          <circle cx="88" cy="88" r={radius} fill="none" className="stroke-muted" strokeWidth="24" />
          <circle
            cx="88"
            cy="88"
            r={radius}
            fill="none"
            stroke="hsl(var(--primary))"
            strokeWidth="24"
            strokeDasharray={`${filled} ${circumference - filled}`}
            transform="rotate(-90 88 88)"
            style={{ transition: "stroke-dasharray 1100ms cubic-bezier(.4,0,.2,1)" }}
          />
          <text
            x="88"
            y="84"
            textAnchor="middle"
            className="fill-foreground"
            style={{ ...FIGURE_FONT, fontSize: 30, fontWeight: 700 }}
          >
            {burn === null ? "—" : `${(burn * 100).toFixed(1)}%`}
          </text>
          <text x="88" y="103" textAnchor="middle" className="fill-muted-foreground" style={{ fontSize: 11 }}>
            of budget, Jan–{monthLabel}
          </text>
        </svg>

        <div className="min-w-[16rem] flex-1">
          <p className="mb-2 text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
            Sector-wide snapshot · {mdaCount} health MDAs{fiscalYear ? ` · FY ${fiscalYear}` : ""}
          </p>
          <p
            className="max-w-2xl text-lg font-semibold leading-relaxed text-foreground sm:text-xl"
            style={FIGURE_FONT}
          >
            <span className="text-primary">
              {burn === null ? "—" : `${(burn * 100).toFixed(1)}%`}
            </span>{" "}
            of the {formatCompactNaira(approvedTotal)} approved health budget is recorded spent
            in the published reports — {formatCompactNaira(officialTotal)} so far.
          </p>
          <div className="mt-3 flex flex-wrap gap-2 text-[11.5px] text-muted-foreground">
            <span className="rounded-full bg-muted px-3 py-1">
              Monthly returns from {reportingMdaCount} of {mdaCount} MDAs
            </span>
            <span className="rounded-full bg-muted px-3 py-1">
              Tracking covers Jan–{monthLabel}
            </span>
            <span className="rounded-full bg-muted px-3 py-1">
              Official BPR figures are authoritative; monthly tracking shown for reconciliation
            </span>
          </div>
        </div>
      </div>
    </section>
  );
}
