"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

type TooltipProps = {
  label: string;
  children: React.ReactNode;
  side?: "top" | "bottom" | "right" | "left";
  className?: string;
};

const sideClassName: Record<NonNullable<TooltipProps["side"]>, string> = {
  top: "bottom-full left-1/2 mb-1.5 -translate-x-1/2",
  bottom: "top-full left-1/2 mt-1.5 -translate-x-1/2",
  right: "left-full top-1/2 ml-1.5 -translate-y-1/2",
  left: "right-full top-1/2 mr-1.5 -translate-y-1/2",
};

/**
 * Lightweight tooltip — rendered on hover/focus via CSS visibility.
 * Use for icon-only buttons, collapsed sidebar items, and short
 * affordance hints. Always pair with an accessible label.
 */
export function Tooltip({ label, children, side = "right", className }: TooltipProps) {
  return (
    <span className={cn("group/tooltip relative inline-flex", className)}>
      {children}
      <span
        role="tooltip"
        className={cn(
          "pointer-events-none absolute z-40 whitespace-nowrap rounded-md border bg-popover px-2 py-1 text-xs font-medium text-popover-foreground opacity-0 shadow-sm transition-opacity duration-100 group-hover/tooltip:opacity-100 group-focus-within/tooltip:opacity-100",
          sideClassName[side],
        )}
      >
        {label}
      </span>
    </span>
  );
}
