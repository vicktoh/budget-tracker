"use client";

import * as React from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { CHART_COLORS } from "@/components/reporting/charts/palette";
import { formatCompactNaira, formatNaira } from "@/lib/format";
import type { QuarterlyTrendRow } from "@/lib/reporting/aggregate";

type QuarterlyTrendChartProps = {
  data: QuarterlyTrendRow[];
  /** Quarter highlighted as the current selection; other quarters are dimmed. */
  activeQuarter?: 1 | 2 | 3 | 4 | null;
  height?: number;
  onSelectQuarter?: (quarter: 1 | 2 | 3 | 4) => void;
};

/**
 * Grouped funding-vs-expenditure bars per quarter. Clicking a quarter
 * toggles the report's quarter selection.
 */
export function QuarterlyTrendChart({
  data,
  activeQuarter,
  height = 280,
  onSelectQuarter,
}: QuarterlyTrendChartProps) {
  const chartData = data.map((row) => ({
    ...row,
    label: `Q${row.quarter}`,
  }));

  const handleClick = (entry: unknown) => {
    const datum = entry as { payload?: QuarterlyTrendRow };
    if (onSelectQuarter && datum.payload) onSelectQuarter(datum.payload.quarter);
  };

  const opacityFor = (quarter: number) =>
    activeQuarter && activeQuarter !== quarter ? 0.4 : 1;

  return (
    <div style={{ width: "100%", height }}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={chartData} margin={{ top: 4, right: 12, left: 8, bottom: 4 }}>
          <CartesianGrid vertical={false} stroke="hsl(var(--border))" />
          <XAxis
            dataKey="label"
            stroke="hsl(var(--muted-foreground))"
            fontSize={12}
            tickLine={false}
          />
          <YAxis
            tickFormatter={(value) => formatCompactNaira(Number(value))}
            stroke="hsl(var(--muted-foreground))"
            fontSize={11}
            width={72}
          />
          <Tooltip
            cursor={{ fill: "hsl(var(--muted))" }}
            contentStyle={{
              borderRadius: 6,
              border: "1px solid hsl(var(--border))",
              fontSize: 12,
              backgroundColor: "hsl(var(--card))",
            }}
            formatter={(value, name) => [formatNaira(Number(value)), String(name)]}
          />
          <Legend wrapperStyle={{ fontSize: 12 }} />
          <Bar
            dataKey="total_funding_amount"
            name="Funding"
            radius={[4, 4, 0, 0]}
            cursor={onSelectQuarter ? "pointer" : undefined}
            onClick={handleClick}
            fill={CHART_COLORS[0]}
          >
            {chartData.map((row) => (
              <Cell
                key={`funding-${row.quarter}`}
                fillOpacity={opacityFor(row.quarter)}
              />
            ))}
          </Bar>
          <Bar
            dataKey="total_expenditure_amount"
            name="Expenditure"
            radius={[4, 4, 0, 0]}
            cursor={onSelectQuarter ? "pointer" : undefined}
            onClick={handleClick}
            fill={CHART_COLORS[1]}
          >
            {chartData.map((row) => (
              <Cell
                key={`expenditure-${row.quarter}`}
                fillOpacity={opacityFor(row.quarter)}
              />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
