"use client";

import * as React from "react";
import { XIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

type DialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  children: React.ReactNode;
  contentClassName?: string;
};

export function Dialog({
  open,
  onOpenChange,
  title,
  description,
  children,
  contentClassName,
}: DialogProps) {
  React.useEffect(() => {
    if (!open) return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onOpenChange(false);
      }
    };

    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [onOpenChange, open]);

  if (!open) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-foreground/20 p-4">
      <div
        aria-describedby={description ? "dialog-description" : undefined}
        aria-labelledby="dialog-title"
        aria-modal="true"
        className={cn(
          "max-h-[calc(100vh-2rem)] w-full max-w-lg overflow-y-auto rounded-lg border bg-popover p-5 text-popover-foreground shadow-lg",
          contentClassName,
        )}
        role="dialog"
      >
        <div className="flex items-start justify-between gap-4">
          <div className="flex flex-col gap-1">
            <h2 id="dialog-title" className="font-semibold">
              {title}
            </h2>
            {description ? (
              <p id="dialog-description" className="text-sm text-muted-foreground">
                {description}
              </p>
            ) : null}
          </div>
          <Button
            aria-label="Close dialog"
            size="icon"
            type="button"
            variant="ghost"
            onClick={() => onOpenChange(false)}
          >
            <XIcon aria-hidden="true" />
          </Button>
        </div>
        <div className="mt-5">{children}</div>
      </div>
    </div>
  );
}

export function DialogFooter({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn("mt-5 flex justify-end gap-2 border-t pt-4", className)}
      {...props}
    />
  );
}
