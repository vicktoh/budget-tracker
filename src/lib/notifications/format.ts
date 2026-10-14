import { formatNaira } from "@/lib/format";
import { MONTH_LABELS } from "@/lib/reporting/executive";

/** Kano is UTC+1 all year (no daylight saving). */
export const KANO_TIME_ZONE = "Africa/Lagos";

export const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

/** ₦214.84bn / ₦674.5m / ₦2,075,632 — the compact style used in summaries. */
export function formatNairaShort(value: number): string {
  const abs = Math.abs(value);
  if (abs >= 1e9) return `₦${(value / 1e9).toFixed(2)}bn`;
  if (abs >= 1e6) return `₦${(value / 1e6).toFixed(1)}m`;
  return formatNaira(value);
}

export function formatPct(value: number | null | undefined): string {
  if (value === null || value === undefined || Number.isNaN(value)) return "—";
  return `${(value * 100).toFixed(1)}%`;
}

/** Calendar parts of an instant as seen in Kano. */
export function kanoDateParts(date: Date): { year: number; month: number; day: number } {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: KANO_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const get = (type: string) => Number(parts.find((part) => part.type === type)?.value);
  return { year: get("year"), month: get("month"), day: get("day") };
}

/** "26 Jan 2026" from an ISO date (yyyy-mm-dd) or timestamp. */
export function formatDay(value: string): string {
  const date = value.length === 10 ? new Date(`${value}T12:00:00Z`) : new Date(value);
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: KANO_TIME_ZONE,
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(date);
}

/** "14 Oct" — day and month only, for recent sign-ins. */
export function formatDayMonth(value: string): string {
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: KANO_TIME_ZONE,
    day: "numeric",
    month: "short",
  }).format(new Date(value));
}

/** "16 Jul 2026, 3:48 PM" in Kano time. */
export function formatDateTime(value: string): string {
  const date = new Date(value);
  const day = formatDay(value);
  const time = new Intl.DateTimeFormat("en-US", {
    timeZone: KANO_TIME_ZONE,
    hour: "numeric",
    minute: "2-digit",
  }).format(date);
  return `${day}, ${time}`;
}

/** [4,5,6] → "Apr–Jun"; [4,6] → "Apr, Jun"; [1,2,6] → "Jan–Feb, Jun". */
export function formatMonthRuns(months: number[]): string {
  const sorted = [...new Set(months)].sort((a, b) => a - b);
  const runs: Array<[number, number]> = [];
  for (const month of sorted) {
    const last = runs[runs.length - 1];
    if (last && month === last[1] + 1) last[1] = month;
    else runs.push([month, month]);
  }
  return runs
    .map(([from, to]) =>
      from === to ? MONTH_LABELS[from - 1] : `${MONTH_LABELS[from - 1]}–${MONTH_LABELS[to - 1]}`,
    )
    .join(", ");
}

/**
 * Short MDA label for dense tables: the stored abbreviation, else the trailing
 * "(ABBR)" in the name, else the full name.
 */
export function shortMdaName(name: string, abbreviation?: string | null): string {
  if (abbreviation?.trim()) return abbreviation.trim();
  const match = name.match(/\(([A-Z][A-Za-z&]{1,12})\)\s*$/);
  if (!match) return name;
  // "(HQ)" qualifies the name rather than abbreviating it.
  if (match[1] === "HQ") return name.replace(/\s*\(HQ\)\s*$/, " HQ");
  return match[1];
}

/** "A", "A and B", "A, B and C". */
export function joinList(items: string[]): string {
  if (items.length <= 1) return items.join("");
  return `${items.slice(0, -1).join(", ")} and ${items[items.length - 1]}`;
}

export function quarterOfMonth(month: number): 1 | 2 | 3 | 4 {
  return (Math.floor((month - 1) / 3) + 1) as 1 | 2 | 3 | 4;
}

/** The month before the Kano calendar month containing `runDate`. */
export function previousKanoMonth(runDate: Date): { year: number; month: number } {
  const { year, month } = kanoDateParts(runDate);
  return month === 1 ? { year: year - 1, month: 12 } : { year, month: month - 1 };
}

export function monthKey(year: number, month: number): string {
  return `${year}-${String(month).padStart(2, "0")}`;
}
