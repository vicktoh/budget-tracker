"use client";

import * as React from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { CHART_COLORS } from "@/components/reporting/charts/palette";
import { formatCompactNaira, formatNaira } from "@/lib/format";

export type HorizontalBarDatum = {
  /** Unique row id (e.g. funding_source_id). Used by the click handler. */
  id: string;
  label: string;
  value: number;
};

type HorizontalBarReportProps = {
  data: HorizontalBarDatum[];
  emptyMessage?: string;
  height?: number;
  onSelect?: (id: string) => void;
  /** Marks one row as the active filter target (for visual emphasis). */
  activeId?: string | null;
};

export function HorizontalBarReport({
  data,
  emptyMessage = "No data for the current filters.",
  height = 280,
  onSelect,
  activeId,
}: HorizontalBarReportProps) {
  if (data.length === 0) {
    return (
      <p className="flex h-40 items-center justify-center text-sm text-muted-foreground">
        {emptyMessage}
      </p>
    );
  }

  return (
    <div style={{ width: "100%", height }}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} layout="vertical" margin={{ top: 4, right: 12, left: 0, bottom: 4 }}>
          <CartesianGrid horizontal={false} stroke="hsl(var(--border))" />
          <XAxis
            type="number"
            tickFormatter={(value) => formatCompactNaira(Number(value))}
            stroke="hsl(var(--muted-foreground))"
            fontSize={11}
          />
          <YAxis
            dataKey="label"
            type="category"
            stroke="hsl(var(--muted-foreground))"
            fontSize={11}
            width={140}
            tickLine={false}
          />
          <Tooltip
            cursor={{ fill: "hsl(var(--muted))" }}
            contentStyle={{
              borderRadius: 6,
              border: "1px solid hsl(var(--border))",
              fontSize: 12,
              backgroundColor: "hsl(var(--card))",
            }}
            formatter={(value) => [formatNaira(Number(value)), "Total"]}
          />
          <Bar
            dataKey="value"
            radius={[0, 4, 4, 0]}
            cursor={onSelect ? "pointer" : undefined}
            onClick={(entry) => {
              const datum = entry as unknown as { payload?: HorizontalBarDatum };
              if (onSelect && datum.payload) onSelect(datum.payload.id);
            }}
          >
            {data.map((entry, index) => {
              const isActive = activeId === entry.id;
              const baseColor = CHART_COLORS[index % CHART_COLORS.length];
              return (
                <Cell
                  key={entry.id}
                  fill={baseColor}
                  fillOpacity={activeId && !isActive ? 0.45 : 1}
                />
              );
            })}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
