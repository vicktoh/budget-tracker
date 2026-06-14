import * as React from "react";
import { cn } from "@/lib/utils";
import { Card, CardContent, CardDescription, CardHeader } from "@/components/ui/card";

export type StatTone = "default" | "pending" | "approved" | "processed" | "rejected" | "brown";

const toneClass: Record<StatTone, string> = {
  default: "text-foreground",
  pending: "text-status-pending",
  approved: "text-status-approved",
  processed: "text-status-processed",
  rejected: "text-status-rejected",
  brown: "text-secondary-foreground",
};

type StatCardProps = {
  label: string;
  value: string;
  helper?: string;
  tone?: StatTone;
  /** Optional small chip rendered next to the value, e.g. a percentage. */
  trailing?: React.ReactNode;
};

export function StatCard({ label, value, helper, tone = "default", trailing }: StatCardProps) {
  return (
    <Card>
      <CardHeader className="gap-1.5 pb-2">
        <CardDescription className="text-xs uppercase tracking-wide text-muted-foreground">
          {label}
        </CardDescription>
        <div className="flex items-baseline justify-between gap-3">
          <span
            className={cn(
              "text-2xl font-semibold leading-tight tabular-nums",
              toneClass[tone],
            )}
          >
            {value}
          </span>
          {trailing ? <span className="text-sm text-muted-foreground">{trailing}</span> : null}
        </div>
      </CardHeader>
      {helper ? (
        <CardContent className="pt-0">
          <p className="text-xs text-muted-foreground">{helper}</p>
        </CardContent>
      ) : null}
    </Card>
  );
}
