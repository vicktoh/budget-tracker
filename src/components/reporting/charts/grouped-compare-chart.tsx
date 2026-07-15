"use client";

import * as React from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { CHART_COLORS } from "@/components/reporting/charts/palette";
import { formatCompactNaira, formatNaira } from "@/lib/format";

export type GroupedCompareDatum = {
  id: string;
  label: string;
  /** First series value (e.g. funding received, planned cost, prior year). */
  primary: number;
  /** Second series value (e.g. spending, actual cost, current year). */
  secondary: number;
};

type GroupedCompareChartProps = {
  data: GroupedCompareDatum[];
  /** Legend name for the first series. */
  primaryName: string;
  /** Legend name for the second series. */
  secondaryName: string;
  primaryColor?: string;
  secondaryColor?: string;
  emptyMessage?: string;
  /** Width of the category label gutter. */
  labelWidth?: number;
};

/**
 * Horizontal two-series comparison bars — one row per category, both
 * series on a single shared naira axis. Used for funding-vs-spending,
 * planned-vs-actual, and prior-vs-current comparisons.
 */
export function GroupedCompareChart({
  data,
  primaryName,
  secondaryName,
  primaryColor = CHART_COLORS[0],
  secondaryColor = CHART_COLORS[1],
  emptyMessage = "No data for the current filters.",
  labelWidth = 150,
}: GroupedCompareChartProps) {
  if (data.length === 0) {
    return (
      <p className="flex h-40 items-center justify-center text-sm text-muted-foreground">
        {emptyMessage}
      </p>
    );
  }

  const height = data.length * 58 + 56;

  return (
    <div style={{ width: "100%", height }}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart
          accessibilityLayer
          data={data}
          layout="vertical"
          margin={{ top: 4, right: 16, left: 0, bottom: 4 }}
          barCategoryGap="28%"
          barGap={2}
        >
          <CartesianGrid horizontal={false} stroke="hsl(var(--border))" strokeOpacity={0.72} />
          <XAxis
            type="number"
            tickFormatter={(value) => formatCompactNaira(Number(value))}
            stroke="hsl(var(--muted-foreground))"
            fontSize={11}
            axisLine={false}
            tickLine={false}
          />
          <YAxis
            dataKey="label"
            type="category"
            stroke="hsl(var(--muted-foreground))"
            fontSize={11}
            width={labelWidth}
            tickLine={false}
            axisLine={false}
            tick={{ fill: "hsl(var(--foreground))", fontWeight: 500 }}
            tickFormatter={(value: string) =>
              value.length > 22 ? `${value.slice(0, 22)}…` : value
            }
          />
          <Tooltip
            cursor={{ fill: "hsl(var(--muted))" }}
            contentStyle={{
              borderRadius: 8,
              border: "1px solid hsl(var(--border))",
              fontSize: 12,
              backgroundColor: "hsl(var(--card))",
              boxShadow: "0 12px 30px hsl(var(--foreground) / 0.12)",
            }}
            formatter={(value, name) => [formatNaira(Number(value)), String(name)]}
          />
          <Legend wrapperStyle={{ fontSize: 12, paddingTop: 8 }} iconType="circle" iconSize={8} />
          <Bar
            dataKey="primary"
            name={primaryName}
            fill={primaryColor}
            radius={[0, 4, 4, 0]}
            maxBarSize={14}
            isAnimationActive={false}
          />
          <Bar
            dataKey="secondary"
            name={secondaryName}
            fill={secondaryColor}
            radius={[0, 4, 4, 0]}
            maxBarSize={14}
            isAnimationActive={false}
          />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
