"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

type RadioGroupContextValue = {
  name: string;
  value: string | undefined;
  onChange: (value: string) => void;
};

const RadioGroupContext = React.createContext<RadioGroupContextValue | null>(
  null,
);

export function RadioGroup({
  name,
  value,
  onValueChange,
  className,
  children,
}: {
  name: string;
  value?: string;
  onValueChange?: (value: string) => void;
  className?: string;
  children: React.ReactNode;
}) {
  const handleChange = React.useCallback(
    (next: string) => onValueChange?.(next),
    [onValueChange],
  );

  return (
    <RadioGroupContext.Provider
      value={{ name, value, onChange: handleChange }}
    >
      <div className={cn("flex flex-col gap-2", className)} role="radiogroup">
        {children}
      </div>
    </RadioGroupContext.Provider>
  );
}

export function RadioGroupItem({
  value,
  label,
  description,
  className,
}: {
  value: string;
  label: string;
  description?: string;
  className?: string;
}) {
  const ctx = React.useContext(RadioGroupContext);
  if (!ctx) {
    throw new Error("RadioGroupItem must be rendered inside a RadioGroup");
  }
  const checked = ctx.value === value;
  const id = `${ctx.name}-${value}`;

  return (
    <label
      htmlFor={id}
      className={cn(
        "flex cursor-pointer items-start gap-3 rounded-md border border-input bg-card px-3 py-2 transition-colors hover:border-primary/40",
        checked && "border-primary bg-accent",
        className,
      )}
    >
      <span
        className={cn(
          "mt-0.5 inline-flex size-4 shrink-0 items-center justify-center rounded-full border border-input bg-card",
          checked && "border-primary",
        )}
      >
        {checked ? (
          <span aria-hidden="true" className="size-2 rounded-full bg-primary" />
        ) : null}
      </span>
      <span className="flex min-w-0 flex-col gap-0.5">
        <span className="text-sm font-medium text-foreground">{label}</span>
        {description ? (
          <span className="text-xs text-muted-foreground">{description}</span>
        ) : null}
      </span>
      <input
        id={id}
        type="radio"
        name={ctx.name}
        value={value}
        checked={checked}
        className="sr-only"
        onChange={() => ctx.onChange(value)}
      />
    </label>
  );
}
