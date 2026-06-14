/**
 * Shared formatters for finance values, dates, and percentages.
 * Naira/date formatting was previously inlined in several routes — this
 * module makes the convention explicit so dashboards, exports, and
 * detail views stay consistent.
 */

const naira = new Intl.NumberFormat("en-NG", {
  style: "currency",
  currency: "NGN",
  maximumFractionDigits: 2,
});

const compactNaira = new Intl.NumberFormat("en-NG", {
  style: "currency",
  currency: "NGN",
  notation: "compact",
  maximumFractionDigits: 1,
});

const percent = new Intl.NumberFormat("en-NG", {
  style: "percent",
  maximumFractionDigits: 1,
});

const integer = new Intl.NumberFormat("en-NG", { maximumFractionDigits: 0 });

export function formatNaira(value: number | null | undefined): string {
  if (value === null || value === undefined || Number.isNaN(value)) return "—";
  return naira.format(value);
}

export function formatCompactNaira(value: number | null | undefined): string {
  if (value === null || value === undefined || Number.isNaN(value)) return "—";
  return compactNaira.format(value);
}

export function formatPercent(value: number | null | undefined): string {
  if (value === null || value === undefined || Number.isNaN(value)) return "—";
  return percent.format(value);
}

export function formatInteger(value: number | null | undefined): string {
  if (value === null || value === undefined || Number.isNaN(value)) return "—";
  return integer.format(value);
}
