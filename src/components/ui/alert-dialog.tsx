"use client";

import * as React from "react";
import { Button, type ButtonProps } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type AlertDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  confirmVariant?: ButtonProps["variant"];
  onConfirm: () => void;
  loading?: boolean;
  className?: string;
};

export function AlertDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  confirmVariant = "destructive",
  onConfirm,
  loading,
  className,
}: AlertDialogProps) {
  React.useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onOpenChange(false);
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [onOpenChange, open]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-foreground/20 p-4">
      <div
        aria-modal="true"
        aria-labelledby="alert-dialog-title"
        aria-describedby={description ? "alert-dialog-description" : undefined}
        role="alertdialog"
        className={cn(
          "w-full max-w-md rounded-lg border bg-popover p-5 text-popover-foreground shadow-lg",
          className,
        )}
      >
        <h2 id="alert-dialog-title" className="font-semibold">
          {title}
        </h2>
        {description ? (
          <p
            id="alert-dialog-description"
            className="mt-2 text-sm text-muted-foreground"
          >
            {description}
          </p>
        ) : null}
        <div className="mt-5 flex justify-end gap-2">
          <Button
            disabled={loading}
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
          >
            {cancelLabel}
          </Button>
          <Button
            disabled={loading}
            type="button"
            variant={confirmVariant}
            onClick={onConfirm}
          >
            {loading ? "Working" : confirmLabel}
          </Button>
        </div>
      </div>
    </div>
  );
}
