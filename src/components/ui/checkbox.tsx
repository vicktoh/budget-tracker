import * as React from "react";
import { CheckIcon } from "lucide-react";
import { cn } from "@/lib/utils";

export const Checkbox = React.forwardRef<
  HTMLInputElement,
  Omit<React.InputHTMLAttributes<HTMLInputElement>, "type">
>(({ className, checked, ...props }, ref) => (
  <span
    className={cn(
      "focus-ring relative inline-flex size-4 shrink-0 items-center justify-center rounded-sm border border-input bg-card text-primary-foreground transition-colors",
      checked && "border-primary bg-primary",
      className,
    )}
  >
    <input
      ref={ref}
      type="checkbox"
      checked={checked}
      className="absolute inset-0 m-0 size-full cursor-pointer appearance-none opacity-0 disabled:cursor-not-allowed"
      {...props}
    />
    {checked ? (
      <CheckIcon aria-hidden="true" className="size-3.5" />
    ) : null}
  </span>
));
Checkbox.displayName = "Checkbox";
