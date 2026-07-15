/**
 * Restrained operational palette. Indexes match `globals.css` `--chart-1..5`.
 * Recharts accepts CSS color values directly, so HSL strings keep the chart
 * theme in lockstep with the rest of the app.
 */
export const CHART_COLORS = [
  "hsl(var(--chart-1))",
  "hsl(var(--chart-2))",
  "hsl(var(--chart-3))",
  "hsl(var(--chart-4))",
  "hsl(var(--chart-5))",
] as const;

export const STATUS_COLORS = {
  pending: "hsl(var(--status-pending))",
  approved: "hsl(var(--status-approved))",
  processed: "hsl(var(--status-processed))",
  rejected: "hsl(var(--status-rejected))",
} as const;

export function pickChartColor(index: number): string {
  return CHART_COLORS[index % CHART_COLORS.length];
}
