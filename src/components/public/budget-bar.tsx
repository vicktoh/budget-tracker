"use client";

import { useRef } from "react";
import { motion, useInView } from "motion/react";
import { formatShare } from "@/lib/public/model";
import { cn } from "@/lib/utils";

/**
 * The site's one core mark: a track whose length is the budget (relative to
 * the largest budget shown) with the spent part filled. Magnitude and
 * performance read at once; the numbers are always printed beside it.
 */
export function BudgetBar({
  budget,
  spent,
  maxBudget,
  color = "var(--pub-green)",
  trackColor = "var(--pub-track)",
  height = 12,
  label,
}: {
  budget: number | null;
  spent: number | null;
  maxBudget: number;
  color?: string;
  trackColor?: string;
  height?: number;
  label: string;
}) {
  const b = Math.max(0, budget ?? 0);
  const s = Math.max(0, spent ?? 0);
  const scale = maxBudget > 0 ? maxBudget : Math.max(b, s, 1);
  const trackFrac = Math.max(b / scale, b > 0 ? 0.012 : 0);
  const fillFrac = b > 0 ? Math.min(s / b, 1) : 0;
  const over = b > 0 && s > b;
  const spentOnly = b === 0 && s > 0;
  const ref = useRef<HTMLDivElement>(null);
  const seen = useInView(ref, { once: true, margin: "-4% 0px" });
  const track = (spentOnly ? Math.min(s / scale, 1) : trackFrac) * 100;
  const fill = (spentOnly ? 1 : fillFrac) * 100;
  return (
    <div
      ref={ref}
      role="img"
      aria-label={label}
      className="relative w-full"
      style={{ height }}
      title={label}
    >
      <motion.div
        className="absolute inset-y-0 left-0 overflow-hidden rounded-[4px]"
        style={{ background: trackColor }}
        initial={{ width: 0 }}
        animate={{ width: seen ? `${track}%` : 0 }}
        transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
      >
        <motion.div
          className="absolute inset-y-0 left-0 rounded-[4px]"
          style={{ background: color }}
          initial={{ width: 0 }}
          animate={{ width: seen ? `${fill}%` : 0 }}
          transition={{ duration: 0.9, delay: 0.15, ease: [0.16, 1, 0.3, 1] }}
        />
      </motion.div>
      {over ? (
        <span
          className="absolute -top-0.5 h-[calc(100%+4px)] w-[2px] rounded bg-[var(--pub-ink)]"
          style={{ left: `calc(${trackFrac * 100}% - 1px)` }}
          aria-hidden
        />
      ) : null}
    </div>
  );
}

export function SharePill({ share, flag }: { share: number | null; flag?: boolean }) {
  return (
    <span
      className={cn(
        "inline-flex min-w-[3.6rem] justify-center rounded-full px-2 py-0.5 text-xs font-semibold tabular-nums",
        flag ? "bg-[var(--pub-flag-bg)] text-[var(--pub-flag)]" : "bg-[var(--pub-mint)] text-[var(--pub-green-deep)]",
      )}
    >
      {formatShare(share)}
    </span>
  );
}
