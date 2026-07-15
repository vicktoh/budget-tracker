"use client";

import * as React from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { STATUS_COLORS } from "@/components/reporting/charts/palette";
import { formatCompactNaira, formatNaira } from "@/lib/format";

export type DivergingVarianceDatum = {
  id: string;
  label: string;
  /** Positive = money left unspent; negative = allocated beyond receipts. */
  value: number;
};

type DivergingVarianceChartProps = {
  data: DivergingVarianceDatum[];
  /** Legend label for positive bars, e.g. "Unspent balance". */
  positiveName: string;
  /** Legend label for negative bars, e.g. "Over-allocated". */
  negativeName: string;
  emptyMessage?: string;
  labelWidth?: number;
};

/**
 * Horizontal diverging bars around a zero baseline. Sign carries meaning
 * (surplus vs shortfall), so bars use the semantic status pair and the
 * legend spells out both directions — identity is never color-alone.
 */
export function DivergingVarianceChart({
  data,
  positiveName,
  negativeName,
  emptyMessage = "No data for the current filters.",
  labelWidth = 170,
}: DivergingVarianceChartProps) {
  if (data.length === 0) {
    return (
      <p className="flex h-40 items-center justify-center text-sm text-muted-foreground">
        {emptyMessage}
      </p>
    );
  }

  const height = data.length * 40 + 48;
  const maxAbs = Math.max(...data.map((row) => Math.abs(row.value)), 1);

  return (
    <div className="flex flex-col gap-2">
      <div style={{ width: "100%", height }}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            accessibilityLayer
            data={data}
            layout="vertical"
            margin={{ top: 4, right: 16, left: 0, bottom: 4 }}
            barCategoryGap="32%"
          >
            <CartesianGrid horizontal={false} stroke="hsl(var(--border))" strokeOpacity={0.72} />
            <XAxis
              type="number"
              domain={[-maxAbs, maxAbs]}
              tickCount={5}
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
                value.length > 26 ? `${value.slice(0, 26)}…` : value
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
              formatter={(value) => {
                const amount = Number(value);
                return [
                  formatNaira(amount),
                  amount >= 0 ? positiveName : negativeName,
                ];
              }}
            />
            <ReferenceLine x={0} stroke="hsl(var(--foreground))" strokeOpacity={0.5} />
            <Bar
              dataKey="value"
              radius={[0, 5, 5, 0]}
              maxBarSize={16}
              isAnimationActive={false}
            >
              {data.map((row) => (
                <Cell
                  key={row.id}
                  fill={
                    row.value >= 0 ? STATUS_COLORS.approved : STATUS_COLORS.rejected
                  }
                />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
      <ul className="flex flex-wrap items-center justify-center gap-x-4 gap-y-1 text-xs">
        <li className="flex items-center gap-1.5">
          <span
            aria-hidden="true"
            className="size-2.5 rounded-sm"
            style={{ backgroundColor: STATUS_COLORS.approved }}
          />
          <span className="text-muted-foreground">{positiveName} (right)</span>
        </li>
        <li className="flex items-center gap-1.5">
          <span
            aria-hidden="true"
            className="size-2.5 rounded-sm"
            style={{ backgroundColor: STATUS_COLORS.rejected }}
          />
          <span className="text-muted-foreground">{negativeName} (left)</span>
        </li>
      </ul>
    </div>
  );
}
