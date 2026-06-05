"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

type PopoverProps = {
  trigger: React.ReactNode;
  children: React.ReactNode;
  align?: "start" | "end" | "center";
  className?: string;
};

export function Popover({
  trigger,
  children,
  align = "start",
  className,
}: PopoverProps) {
  const [open, setOpen] = React.useState(false);
  const ref = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    if (!open) return;
    const onClick = (event: MouseEvent) => {
      if (!ref.current?.contains(event.target as Node)) setOpen(false);
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div ref={ref} className={cn("relative inline-flex", className)}>
      <button
        type="button"
        aria-expanded={open}
        aria-haspopup="dialog"
        className="focus-ring inline-flex items-center"
        onClick={() => setOpen((current) => !current)}
      >
        {trigger}
      </button>
      {open ? (
        <div
          role="dialog"
          className={cn(
            "absolute top-full z-30 mt-1 min-w-56 rounded-md border bg-popover p-3 text-popover-foreground shadow-md",
            align === "end" && "right-0",
            align === "center" && "left-1/2 -translate-x-1/2",
          )}
        >
          {children}
        </div>
      ) : null}
    </div>
  );
}
