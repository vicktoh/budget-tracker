"use client";

import * as React from "react";
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";
import { pickChartColor } from "@/components/reporting/charts/palette";
import { formatNaira } from "@/lib/format";

export type DonutShareDatum = {
  id: string;
  label: string;
  value: number;
  /** Optional explicit color. Falls back to the chart palette by index. */
  color?: string;
};

type DonutShareChartProps = {
  data: DonutShareDatum[];
  /** Large text rendered in the donut hole, e.g. "34.2%". */
  centerValue?: string;
  /** Small caption under the center value, e.g. "PHC share". */
  centerLabel?: string;
  height?: number;
  /** Hide the slice legend below the chart. */
  hideLegend?: boolean;
};

/**
 * Infographic donut with a headline figure in the hole and a compact
 * legend underneath. Used for share-of-total views (PHC share, category
 * share, budget composition).
 */
export function DonutShareChart({
  data,
  centerValue,
  centerLabel,
  height = 240,
  hideLegend,
}: DonutShareChartProps) {
  const visible = data.filter((datum) => datum.value > 0);
  if (visible.length === 0) {
    return (
      <p className="flex h-40 items-center justify-center text-sm text-muted-foreground">
        No data for the current filters.
      </p>
    );
  }
  const total = visible.reduce((sum, datum) => sum + datum.value, 0);

  return (
    <div className="flex flex-col gap-3">
      <div className="relative" style={{ width: "100%", height }}>
        <ResponsiveContainer width="100%" height="100%">
          <PieChart accessibilityLayer>
            <Tooltip
              contentStyle={{
                borderRadius: 8,
                border: "1px solid hsl(var(--border))",
                fontSize: 12,
                backgroundColor: "hsl(var(--card))",
                boxShadow: "0 12px 30px hsl(var(--foreground) / 0.12)",
              }}
              formatter={(value, name) => [formatNaira(Number(value)), String(name)]}
            />
            <Pie
              data={visible}
              dataKey="value"
              nameKey="label"
              innerRadius="62%"
              outerRadius="90%"
              paddingAngle={3}
              cornerRadius={4}
              stroke="hsl(var(--card))"
              strokeWidth={2}
              isAnimationActive={false}
            >
              {visible.map((datum, index) => (
                <Cell key={datum.id} fill={datum.color ?? pickChartColor(index)} />
              ))}
            </Pie>
          </PieChart>
        </ResponsiveContainer>
        {centerValue ? (
          <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
            <span className="text-2xl font-semibold tabular-nums leading-tight tracking-[-0.03em]">
              {centerValue}
            </span>
            {centerLabel ? (
              <span className="text-xs text-muted-foreground">{centerLabel}</span>
            ) : null}
          </div>
        ) : null}
      </div>

      {!hideLegend ? (
        <ul className="flex flex-wrap items-center justify-center gap-x-4 gap-y-2 border-t border-border/60 pt-3">
          {visible.map((datum, index) => (
            <li key={datum.id} className="flex items-center gap-1.5 text-xs">
              <span
                aria-hidden="true"
                className="size-2.5 rounded-full"
                style={{ backgroundColor: datum.color ?? pickChartColor(index) }}
              />
              <span className="text-muted-foreground">{datum.label}</span>
              <span className="font-medium tabular-nums">
                {total === 0 ? "—" : `${((datum.value / total) * 100).toFixed(1)}%`}
              </span>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
