import * as React from "react";
import { cn } from "@/lib/utils";

type ProgressProps = {
  value: number;
  max?: number;
  className?: string;
  tone?: "primary" | "amber" | "teal" | "brown";
  label?: string;
};

const toneClassName: Record<NonNullable<ProgressProps["tone"]>, string> = {
  primary: "bg-primary",
  amber: "bg-[hsl(var(--status-pending))]",
  teal: "bg-[hsl(var(--status-processed))]",
  brown: "bg-[hsl(29_53%_36%)]",
};

export function Progress({
  value,
  max = 100,
  className,
  tone = "primary",
  label,
}: ProgressProps) {
  const clamped = Math.max(0, Math.min(value, max));
  const ratio = max === 0 ? 0 : (clamped / max) * 100;

  return (
    <div
      role="progressbar"
      aria-valuenow={clamped}
      aria-valuemin={0}
      aria-valuemax={max}
      aria-label={label}
      className={cn(
        "relative h-1.5 w-full overflow-hidden rounded-full bg-muted",
        className,
      )}
    >
      <span
        aria-hidden="true"
        className={cn("block h-full rounded-full transition-all", toneClassName[tone])}
        style={{ width: `${ratio}%` }}
      />
    </div>
  );
}
