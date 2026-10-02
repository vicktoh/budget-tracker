"use client";

import * as React from "react";
import Link from "next/link";
import { ChevronRightIcon, CloudOffIcon, WifiIcon } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useReportingData } from "@/components/reporting/use-reporting-data";
import { supabase } from "@/lib/supabase";
import { formatCompactNaira, formatPercent } from "@/lib/format";
import {
  computeExceptions,
  computeExecutiveOverview,
  computeProgrammePerformance,
  LOW_UTILISATION,
  MDA_FLAG_LABEL,
  type MdaFlag,
} from "@/lib/reporting/executive";
import { cn } from "@/lib/utils";

/** Loads the reporting dataset once and derives every executive view from it. */
export function useExecutiveData() {
  const state = useReportingData(supabase, {});
  const derived = React.useMemo(() => {
    if (!state.dataset) return null;
    const overview = computeExecutiveOverview(state.dataset);
    const programmes = computeProgrammePerformance(state.dataset, overview.fiscal_year);
    const exceptions = computeExceptions(overview, programmes);
    return { overview, programmes, exceptions };
  }, [state.dataset]);
  return { ...state, ...derived };
}

export function formatDataDate(iso: string | null): string {
  if (!iso) return "no actuals yet";
  return new Date(`${iso}T00:00:00`).toLocaleDateString("en-NG", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export function Kpi({
  label,
  value,
  helper,
  tone = "default",
}: {
  label: string;
  value: string;
  helper?: React.ReactNode;
  tone?: "default" | "good" | "warn" | "bad";
}) {
  return (
    <div className="flex flex-col gap-1 rounded-xl border bg-card px-4 py-3.5">
      <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
        {label}
      </span>
      <span
        className={cn(
          "text-2xl font-semibold tabular-nums leading-tight",
          tone === "good" && "text-status-approved",
          tone === "warn" && "text-status-pending",
          tone === "bad" && "text-status-rejected",
        )}
      >
        {value}
      </span>
      {helper ? <span className="text-xs text-muted-foreground">{helper}</span> : null}
    </div>
  );
}

export function utilisationTone(u: number | null): "good" | "warn" | "bad" | "default" {
  if (u === null) return "default";
  if (u === 0) return "bad";
  if (u < LOW_UTILISATION) return "warn";
  if (u > 1) return "bad";
  return "good";
}

/**
 * Budget → Released → Spent on one track. Released and spent are drawn as
 * shares of the budget; overspend saturates the bar and is called out in text.
 */
export function FlowBar({
  budget,
  released,
  spent,
  className,
}: {
  budget: number;
  released?: number | null;
  spent: number;
  className?: string;
}) {
  const pct = (v: number) => (budget > 0 ? Math.min(100, (v / budget) * 100) : 0);
  return (
    <div
      className={cn("relative h-2.5 w-full overflow-hidden rounded-full bg-muted", className)}
      role="img"
      aria-label={`Spent ${formatPercent(budget > 0 ? spent / budget : null)} of budget${
        released != null ? `, released ${formatPercent(budget > 0 ? released / budget : null)}` : ""
      }`}
    >
      {released != null ? (
        <div
          className="absolute inset-y-0 left-0 rounded-full bg-chart-2/35"
          style={{ width: `${pct(released)}%` }}
        />
      ) : null}
      <div
        className={cn(
          "absolute inset-y-0 left-0 rounded-full",
          spent > budget && budget > 0 ? "bg-status-rejected" : "bg-primary",
        )}
        style={{ width: `${pct(spent)}%` }}
      />
    </div>
  );
}

export function FlowLegend() {
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
      <span className="flex items-center gap-1.5">
        <span className="size-2.5 rounded-full bg-primary" /> Spent
      </span>
      <span className="flex items-center gap-1.5">
        <span className="size-2.5 rounded-full bg-chart-2/35" /> Released
      </span>
      <span className="flex items-center gap-1.5">
        <span className="size-2.5 rounded-full bg-muted ring-1 ring-border" /> Approved budget
      </span>
    </div>
  );
}

const FLAG_VARIANT: Record<MdaFlag, "rejected" | "pending" | "processed"> = {
  no_spend: "rejected",
  low_utilisation: "pending",
  no_release: "rejected",
  low_release: "pending",
  not_reporting: "rejected",
  overspend: "rejected",
  lopsided: "pending",
  source_mismatch: "processed",
};

export function FlagBadge({ flag }: { flag: MdaFlag }) {
  return (
    <Badge variant={FLAG_VARIANT[flag]} className="whitespace-nowrap font-medium">
      {MDA_FLAG_LABEL[flag]}
    </Badge>
  );
}

/** Explicit "data not available" state — never render a missing figure as ₦0. */
export function MissingData({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-md border border-dashed px-1.5 py-0.5 text-xs text-muted-foreground">
      {children}
    </span>
  );
}

export function Money({ value, missing }: { value: number; missing?: string }) {
  if (missing) return <MissingData>{missing}</MissingData>;
  return <span className="tabular-nums">{formatCompactNaira(value)}</span>;
}

export function SectionCard({
  title,
  description,
  action,
  children,
  className,
}: {
  title: string;
  description?: React.ReactNode;
  action?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <Card className={className}>
      <CardHeader className="flex flex-row items-start justify-between gap-3 space-y-0 pb-3">
        <div className="flex flex-col gap-1">
          <CardTitle className="text-base">{title}</CardTitle>
          {description ? <CardDescription>{description}</CardDescription> : null}
        </div>
        {action}
      </CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  );
}

export function DrillLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      className="focus-ring inline-flex items-center gap-0.5 text-sm font-medium text-primary hover:underline"
    >
      {children}
      <ChevronRightIcon className="size-3.5" />
    </Link>
  );
}

/** Small tag telling the Commissioner whether a capability works offline. */
export function AvailabilityTag({ offline }: { offline: boolean }) {
  return offline ? (
    <span className="inline-flex items-center gap-1 text-[11px] text-muted-foreground">
      <CloudOffIcon className="size-3" /> Works offline
    </span>
  ) : (
    <span className="inline-flex items-center gap-1 text-[11px] text-muted-foreground">
      <WifiIcon className="size-3" /> Needs connection
    </span>
  );
}

export function Breadcrumbs({ items }: { items: Array<{ label: string; href?: string }> }) {
  return (
    <nav aria-label="Breadcrumb" className="flex flex-wrap items-center gap-1 text-sm text-muted-foreground">
      {items.map((item, i) => (
        <React.Fragment key={item.label}>
          {i > 0 ? <ChevronRightIcon className="size-3.5" /> : null}
          {item.href ? (
            <Link href={item.href} className="hover:text-foreground hover:underline">
              {item.label}
            </Link>
          ) : (
            <span className="text-foreground">{item.label}</span>
          )}
        </React.Fragment>
      ))}
    </nav>
  );
}
