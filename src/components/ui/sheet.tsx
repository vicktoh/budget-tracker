"use client";

import * as React from "react";
import { XIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type SheetProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  side?: "right" | "left";
  children: React.ReactNode;
  footer?: React.ReactNode;
  className?: string;
};

export function Sheet({
  open,
  onOpenChange,
  title,
  description,
  side = "right",
  children,
  footer,
  className,
}: SheetProps) {
  React.useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onOpenChange(false);
    };
    document.addEventListener("keydown", onKeyDown);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = "";
    };
  }, [onOpenChange, open]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-40 flex">
      <div
        aria-hidden="true"
        className="absolute inset-0 bg-foreground/20"
        onClick={() => onOpenChange(false)}
      />
      <div
        aria-modal="true"
        aria-labelledby="sheet-title"
        role="dialog"
        className={cn(
          "relative ml-auto flex h-full w-full max-w-md flex-col bg-card text-card-foreground shadow-xl",
          side === "left" ? "mr-auto ml-0" : "",
          className,
        )}
      >
        <div className="flex items-start justify-between gap-4 border-b p-5">
          <div className="flex flex-col gap-1">
            <h2 id="sheet-title" className="font-semibold">
              {title}
            </h2>
            {description ? (
              <p className="text-sm text-muted-foreground">{description}</p>
            ) : null}
          </div>
          <Button
            aria-label="Close sheet"
            size="icon"
            type="button"
            variant="ghost"
            onClick={() => onOpenChange(false)}
          >
            <XIcon aria-hidden="true" />
          </Button>
        </div>
        <div className="flex-1 overflow-y-auto p-5">{children}</div>
        {footer ? <div className="border-t p-5">{footer}</div> : null}
      </div>
    </div>
  );
}
