"use client";

import * as React from "react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { CHART_COLORS, pickChartColor } from "@/components/reporting/charts/palette";
import { formatCompactNaira, formatNaira } from "@/lib/format";
import type { AssistantChartInput } from "@/lib/assistant/tools";

type ValueFormat = AssistantChartInput["valueFormat"];

function formatValue(format: ValueFormat, value: number): string {
  switch (format) {
    case "naira":
      return formatNaira(value);
    case "percent":
      return `${value.toLocaleString("en-NG", { maximumFractionDigits: 1 })}%`;
    default:
      return value.toLocaleString("en-NG");
  }
}

function formatAxisValue(format: ValueFormat, value: number): string {
  switch (format) {
    case "naira":
      return formatCompactNaira(value);
    case "percent":
      return `${value}%`;
    default:
      return Math.abs(value) >= 1000
        ? Intl.NumberFormat("en-NG", { notation: "compact" }).format(value)
        : String(value);
  }
}

const tooltipContentStyle: React.CSSProperties = {
  borderRadius: 8,
  border: "1px solid hsl(var(--border))",
  background: "hsl(var(--popover))",
  color: "hsl(var(--popover-foreground))",
  fontSize: 12,
  boxShadow: "0 4px 16px rgb(0 0 0 / 0.08)",
};

const axisTickStyle = {
  fill: "hsl(var(--muted-foreground))",
  fontSize: 11,
} as const;

/** Renders the assistant's renderChart tool call with the app chart theme. */
export function AssistantChartCard({ spec }: { spec: AssistantChartInput }) {
  const { type, title, description, xKey, valueFormat } = spec;
  const series = spec.series.slice(0, CHART_COLORS.length);
  const data = spec.data;

  const isPieLike = type === "pie" || type === "donut";
  const isHorizontal = type === "horizontal-bar";
  const showLegend = !isPieLike && series.length > 1;
  const height = isPieLike
    ? 260
    : isHorizontal
      ? Math.min(420, Math.max(180, data.length * 34 + 40))
      : 280;

  const tooltipFormatter = (value: unknown, name: unknown) => [
    formatValue(valueFormat, Number(value)),
    String(name),
  ];

  const sharedAxes = isHorizontal ? (
    <>
      <XAxis
        axisLine={false}
        tick={axisTickStyle}
        tickFormatter={(value) => formatAxisValue(valueFormat, Number(value))}
        tickLine={false}
        type="number"
      />
      <YAxis
        axisLine={false}
        dataKey={xKey}
        interval={0}
        tick={{ ...axisTickStyle, fill: "hsl(var(--foreground))" }}
        tickLine={false}
        type="category"
        width={140}
      />
    </>
  ) : (
    <>
      <XAxis
        axisLine={false}
        dataKey={xKey}
        interval="preserveStartEnd"
        tick={{ ...axisTickStyle, fill: "hsl(var(--foreground))" }}
        tickLine={false}
      />
      <YAxis
        axisLine={false}
        tick={axisTickStyle}
        tickFormatter={(value) => formatAxisValue(valueFormat, Number(value))}
        tickLine={false}
        width={64}
      />
    </>
  );

  const grid = (
    <CartesianGrid
      horizontal={!isHorizontal}
      stroke="hsl(var(--border))"
      strokeOpacity={0.7}
      vertical={isHorizontal}
    />
  );

  const legend = showLegend ? (
    <Legend
      formatter={(value) => (
        <span className="text-xs text-foreground">{String(value)}</span>
      )}
      iconSize={9}
      iconType="circle"
      wrapperStyle={{ paddingTop: 8 }}
    />
  ) : null;

  let chart: React.ReactElement;

  if (isPieLike) {
    const valueKey = series[0]?.dataKey ?? "value";
    chart = (
      <PieChart>
        <Tooltip contentStyle={tooltipContentStyle} formatter={tooltipFormatter} />
        <Legend
          formatter={(value) => (
            <span className="text-xs text-foreground">{String(value)}</span>
          )}
          iconSize={9}
          iconType="circle"
        />
        <Pie
          data={data}
          dataKey={valueKey}
          innerRadius={type === "donut" ? "55%" : 0}
          nameKey={xKey}
          outerRadius="85%"
          paddingAngle={2}
          stroke="hsl(var(--card))"
          strokeWidth={2}
        >
          {data.map((entry, index) => (
            <Cell fill={pickChartColor(index)} key={`${entry[xKey]}-${index}`} />
          ))}
        </Pie>
      </PieChart>
    );
  } else if (type === "line") {
    chart = (
      <LineChart data={data} margin={{ top: 8, right: 12, left: 4, bottom: 4 }}>
        {grid}
        {sharedAxes}
        <Tooltip contentStyle={tooltipContentStyle} formatter={tooltipFormatter} />
        {legend}
        {series.map((s, index) => (
          <Line
            activeDot={{ r: 4 }}
            dataKey={s.dataKey}
            dot={false}
            key={s.dataKey}
            name={s.label ?? s.dataKey}
            stroke={pickChartColor(index)}
            strokeWidth={2}
            type="monotone"
          />
        ))}
      </LineChart>
    );
  } else if (type === "area") {
    chart = (
      <AreaChart data={data} margin={{ top: 8, right: 12, left: 4, bottom: 4 }}>
        {grid}
        {sharedAxes}
        <Tooltip contentStyle={tooltipContentStyle} formatter={tooltipFormatter} />
        {legend}
        {series.map((s, index) => (
          <Area
            dataKey={s.dataKey}
            fill={pickChartColor(index)}
            fillOpacity={0.14}
            key={s.dataKey}
            name={s.label ?? s.dataKey}
            stroke={pickChartColor(index)}
            strokeWidth={2}
            type="monotone"
          />
        ))}
      </AreaChart>
    );
  } else {
    const stacked = type === "stacked-bar";
    chart = (
      <BarChart
        barCategoryGap="28%"
        barGap={4}
        data={data}
        layout={isHorizontal ? "vertical" : "horizontal"}
        margin={{ top: 8, right: 12, left: 4, bottom: 4 }}
      >
        {grid}
        {sharedAxes}
        <Tooltip
          contentStyle={tooltipContentStyle}
          cursor={{ fill: "hsl(var(--muted))", fillOpacity: 0.5 }}
          formatter={tooltipFormatter}
        />
        {legend}
        {series.map((s, index) => (
          <Bar
            dataKey={s.dataKey}
            fill={pickChartColor(index)}
            key={s.dataKey}
            maxBarSize={isHorizontal ? 22 : 44}
            name={s.label ?? s.dataKey}
            radius={
              stacked
                ? 0
                : isHorizontal
                  ? [0, 3, 3, 0]
                  : [3, 3, 0, 0]
            }
            stackId={stacked ? "stack" : undefined}
          />
        ))}
      </BarChart>
    );
  }

  return (
    <figure className="not-prose my-1 w-full min-w-0 rounded-xl border bg-card p-4 shadow-sm">
      <figcaption className="mb-3 flex flex-col gap-0.5">
        <span className="text-sm font-semibold text-foreground">{title}</span>
        {description ? (
          <span className="text-xs text-muted-foreground">{description}</span>
        ) : null}
      </figcaption>
      <div style={{ width: "100%", height }}>
        <ResponsiveContainer height="100%" width="100%">
          {chart}
        </ResponsiveContainer>
      </div>
    </figure>
  );
}
