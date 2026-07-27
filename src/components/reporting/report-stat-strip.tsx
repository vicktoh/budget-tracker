import * as React from "react";
import {
  BadgeCheckIcon,
  CircleAlertIcon,
  GaugeIcon,
  LandmarkIcon,
  TriangleAlertIcon,
} from "lucide-react";
import { Badge, type BadgeProps } from "@/components/ui/badge";
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

const panelTone: Record<ReportStatTone, string> = {
  default: "bg-card",
  strong: "bg-status-approved-bg/55",
  on_track: "bg-status-processed-bg/55",
  investigate: "bg-status-pending-bg/65",
  critical: "bg-status-rejected-bg/60",
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

const iconTone: Record<ReportStatTone, string> = {
  default: "bg-muted text-muted-foreground",
  strong: "bg-status-approved-bg text-status-approved",
  on_track: "bg-status-processed-bg text-status-processed",
  investigate: "bg-status-pending-bg text-status-pending",
  critical: "bg-status-rejected-bg text-status-rejected",
};

const toneIcon = {
  default: LandmarkIcon,
  strong: BadgeCheckIcon,
  on_track: GaugeIcon,
  investigate: TriangleAlertIcon,
  critical: CircleAlertIcon,
} satisfies Record<ReportStatTone, React.ComponentType<{ className?: string; "aria-hidden"?: boolean }>>;

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
      <div className="grid overflow-hidden rounded-lg border bg-card sm:grid-cols-2 lg:grid-cols-4">
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
  const ToneIcon = toneIcon[tone];

  return (
    <div
      className={cn(
        "flex min-w-0 flex-col border-b p-4 last:border-b-0 sm:odd:border-r lg:border-b-0 lg:border-r lg:last:border-r-0",
        panelTone[tone],
      )}
    >
      <div className="flex items-center gap-2">
        <span className={cn("grid size-7 shrink-0 place-items-center rounded-md", iconTone[tone])}>
          <ToneIcon aria-hidden className="size-3.5" />
        </span>
        <span className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
          {stat.label}
        </span>
      </div>
      <div className="mt-3 flex flex-wrap items-baseline justify-between gap-2">
        <strong className={cn("text-2xl font-semibold leading-none tabular-nums", valueTone[tone])}>
          {stat.value}
        </strong>
        {stat.badge ? <Badge variant={badgeTone[tone]}>{stat.badge}</Badge> : null}
      </div>
      <p className="mt-2 text-xs leading-relaxed text-muted-foreground">{stat.helper}</p>
      {hasProgress ? (
        <div className="mt-auto flex flex-col gap-1.5 pt-3">
          <Progress
            value={stat.progress ?? 0}
            max={1}
            tone={progressTone[tone]}
            label={stat.progressLabel ?? stat.label}
          />
          {stat.progressLabel ? (
            <span className="text-[11px] text-muted-foreground">{stat.progressLabel}</span>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
