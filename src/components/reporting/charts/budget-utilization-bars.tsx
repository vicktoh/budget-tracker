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

export type BudgetUtilizationDatum = {
  id: string;
  label: string;
  budget: number;
  funding: number;
  expenditure: number;
};

type BudgetUtilizationBarsProps = {
  data: BudgetUtilizationDatum[];
  height?: number;
  onSelect?: (id: string) => void;
  activeId?: string | null;
};

export function BudgetUtilizationBars({
  data,
  height = 420,
  onSelect,
  activeId,
}: BudgetUtilizationBarsProps) {
  if (data.length === 0) {
    return (
      <p className="flex h-40 items-center justify-center text-sm text-muted-foreground">
        No approved budgets match the current filters.
      </p>
    );
  }

  const perBarWidth = 56;
  const minChartWidth = Math.max(data.length * perBarWidth, 480);

  return (
    <div style={{ width: "100%", height, overflowX: "auto" }}>
      <div style={{ width: `${minChartWidth}px`, height: "100%", minWidth: "100%" }}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 8, right: 12, left: 0, bottom: 96 }}>
            <CartesianGrid vertical={false} stroke="hsl(var(--border))" />
            <XAxis
              dataKey="label"
              stroke="hsl(var(--muted-foreground))"
              fontSize={11}
              interval={0}
              angle={-35}
              textAnchor="end"
              height={96}
              tick={{ dy: 4 }}
              tickFormatter={(value: string) =>
                value.length > 24 ? `${value.slice(0, 24)}…` : value
              }
            />
            <YAxis
              stroke="hsl(var(--muted-foreground))"
              fontSize={11}
              tickFormatter={(value) => formatCompactNaira(Number(value))}
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
              labelFormatter={(label) => label}
            />
            <Legend wrapperStyle={{ fontSize: 12 }} iconType="rect" />
            <Bar
              dataKey="budget"
              name="Approved budget"
              fill={CHART_COLORS[2]}
              radius={[4, 4, 0, 0]}
              cursor={onSelect ? "pointer" : undefined}
              fillOpacity={activeId ? 0.55 : 1}
              onClick={(entry) => {
                const datum = entry as unknown as { payload?: BudgetUtilizationDatum };
                if (onSelect && datum.payload) onSelect(datum.payload.id);
              }}
            />
            <Bar
              dataKey="funding"
              name="Funding received"
              fill={CHART_COLORS[0]}
              radius={[4, 4, 0, 0]}
            />
            <Bar
              dataKey="expenditure"
              name="Expenditure"
              fill={CHART_COLORS[1]}
              radius={[4, 4, 0, 0]}
            />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
