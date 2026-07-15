import * as React from "react";
import { Badge, type BadgeProps } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";

export type ReportStatTone =
  | "default"
  | "strong"
  | "on_track"
  | "investigate"
  | "critical";

export type ReportStat = {
  label: string;
  value: string;
  helper: string;
  tone?: ReportStatTone;
  badge?: string;
  progress?: number | null;
  progressLabel?: string;
};

const cardTone: Record<ReportStatTone, string> = {
  default: "border-l-foreground/20",
  strong: "border-l-status-approved",
  on_track: "border-l-status-processed",
  investigate: "border-l-status-pending",
  critical: "border-l-status-rejected",
};

const valueTone: Record<ReportStatTone, string> = {
  default: "text-foreground",
  strong: "text-status-approved",
  on_track: "text-status-processed",
  investigate: "text-status-pending",
  critical: "text-status-rejected",
};

const badgeTone: Record<ReportStatTone, BadgeProps["variant"]> = {
  default: "outline",
  strong: "approved",
  on_track: "processed",
  investigate: "pending",
  critical: "rejected",
};

const progressTone: Record<
  ReportStatTone,
  React.ComponentProps<typeof Progress>["tone"]
> = {
  default: "primary",
  strong: "primary",
  on_track: "teal",
  investigate: "amber",
  critical: "red",
};

export function ReportStatStrip({
  eyebrow = "At a glance",
  title,
  stats,
}: {
  eyebrow?: string;
  title?: string;
  stats: ReportStat[];
}) {
  return (
    <section aria-label={title ?? eyebrow} className="flex flex-col gap-3">
      <div className="flex items-end justify-between gap-3">
        <div className="flex flex-col gap-0.5">
          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
            {eyebrow}
          </p>
          {title ? (
            <h2 className="text-lg font-semibold tracking-tight">{title}</h2>
          ) : null}
        </div>
      </div>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {stats.map((stat) => (
          <ReportStatCard key={stat.label} stat={stat} />
        ))}
      </div>
    </section>
  );
}

function ReportStatCard({ stat }: { stat: ReportStat }) {
  const tone = stat.tone ?? "default";
  const hasProgress = stat.progress !== null && stat.progress !== undefined;

  return (
    <Card className={cn("border-l-4 shadow-sm", cardTone[tone])}>
      <CardHeader className="gap-2 pb-3">
        <CardDescription className="text-[11px] font-semibold uppercase tracking-[0.12em]">
          {stat.label}
        </CardDescription>
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <CardTitle
            className={cn(
              "text-2xl font-semibold leading-none tabular-nums",
              valueTone[tone],
            )}
          >
            {stat.value}
          </CardTitle>
          {stat.badge ? (
            <Badge variant={badgeTone[tone]}>{stat.badge}</Badge>
          ) : null}
        </div>
      </CardHeader>
      <CardContent className="flex flex-col gap-2.5">
        <p className="text-xs leading-relaxed text-muted-foreground">{stat.helper}</p>
        {hasProgress ? (
          <div className="flex flex-col gap-1.5">
            <Progress
              value={stat.progress ?? 0}
              max={1}
              tone={progressTone[tone]}
              label={stat.progressLabel ?? stat.label}
            />
            {stat.progressLabel ? (
              <span className="text-[11px] text-muted-foreground">
                {stat.progressLabel}
              </span>
            ) : null}
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}
