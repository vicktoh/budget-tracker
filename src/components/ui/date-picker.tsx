import * as React from "react";
import { cn } from "@/lib/utils";

export type DatePickerProps = Omit<
  React.InputHTMLAttributes<HTMLInputElement>,
  "type"
> & {
  value?: string;
  onValueChange?: (value: string) => void;
};

/**
 * Minimal accessible date picker that delegates to the browser's native
 * date input. Keeps the visual style consistent with `Input` and avoids
 * shipping a heavy calendar dependency until shadcn's `Calendar`/`Popover`
 * primitives are added in a later phase.
 */
export const DatePicker = React.forwardRef<HTMLInputElement, DatePickerProps>(
  ({ className, value, onValueChange, onChange, ...props }, ref) => (
    <input
      ref={ref}
      type="date"
      value={value}
      onChange={(event) => {
        onValueChange?.(event.target.value);
        onChange?.(event);
      }}
      className={cn(
        "focus-ring h-9 rounded-md border bg-card px-3 text-sm tabular-nums text-foreground disabled:cursor-not-allowed disabled:opacity-50",
        className,
      )}
      {...props}
    />
  ),
);
DatePicker.displayName = "DatePicker";
