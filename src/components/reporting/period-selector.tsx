"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import { Combobox, type ComboboxOption } from "@/components/ui/combobox";
import type { ReportFilters, ReportQuarter } from "@/lib/reporting/types";
import { cn } from "@/lib/utils";

const QUARTERS: ReportQuarter[] = [1, 2, 3, 4];

const PHC_FOCUS_OPTIONS: Array<{ value: ReportFilters["phc"]; label: string }> = [
  { value: "any", label: "All spending" },
  { value: "yes", label: "PHC only" },
  { value: "no", label: "Non-PHC" },
];

export type PeriodSelectorProps = {
  fiscalYears: number[];
  fiscalYear: number | null;
  quarter: ReportQuarter | null;
  phc: ReportFilters["phc"];
  lgaId: string | null;
  lgaOptions: ComboboxOption[];
  loading: boolean;
  /** Hide the PHC + LGA controls (report documents that don't use them). */
  compact?: boolean;
  onFiscalYearChange: (year: number | null) => void;
  onQuarterChange: (quarter: ReportQuarter | null) => void;
  onPhcChange: (phc: ReportFilters["phc"]) => void;
  onLgaChange: (lgaId: string | null) => void;
};

export function PeriodSelector({
  fiscalYears,
  fiscalYear,
  quarter,
  phc,
  lgaId,
  lgaOptions,
  loading,
  compact = false,
  onFiscalYearChange,
  onQuarterChange,
  onPhcChange,
  onLgaChange,
}: PeriodSelectorProps) {
  const yearOptions: ComboboxOption[] = fiscalYears.map((year) => ({
    value: String(year),
    label: `FY ${year}`,
  }));

  return (
    <section
      aria-label="Report period"
      className="flex flex-wrap items-center gap-3 rounded-lg border bg-card p-4"
    >
      <div className="flex items-center gap-2">
        <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          Fiscal year
        </span>
        <Combobox
          id="report-period-fy"
          options={yearOptions}
          value={fiscalYear === null ? "" : String(fiscalYear)}
          onValueChange={(value) =>
            onFiscalYearChange(value ? Number.parseInt(value, 10) : null)
          }
          placeholder="Fiscal year"
          disabled={loading || yearOptions.length === 0}
          className="w-36"
        />
      </div>

      <div className="flex items-center gap-2" role="group" aria-label="Quarter">
        <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          Quarter
        </span>
        <div className="flex items-center gap-1">
          <QuarterPill
            label="Full year"
            active={quarter === null}
            disabled={loading}
            onClick={() => onQuarterChange(null)}
          />
          {QUARTERS.map((value) => (
            <QuarterPill
              key={value}
              label={`Q${value}`}
              active={quarter === value}
              disabled={loading}
              onClick={() => onQuarterChange(quarter === value ? null : value)}
            />
          ))}
        </div>
      </div>

      {compact ? null : (
        <>
          <div className="flex items-center gap-2" role="group" aria-label="PHC focus">
            <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Focus
            </span>
            <div className="flex items-center gap-1">
              {PHC_FOCUS_OPTIONS.map((option) => (
                <QuarterPill
                  key={option.value}
                  label={option.label}
                  active={phc === option.value}
                  disabled={loading}
                  onClick={() => onPhcChange(option.value)}
                />
              ))}
            </div>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              LGA
            </span>
            <Combobox
              id="report-period-lga"
              options={lgaOptions}
              value={lgaId ?? ""}
              onValueChange={(value) => onLgaChange(value || null)}
              placeholder="All LGAs"
              disabled={loading || lgaOptions.length === 0}
              className="w-44"
            />
          </div>
        </>
      )}
    </section>
  );
}

function QuarterPill({
  label,
  active,
  disabled,
  onClick,
}: {
  label: string;
  active: boolean;
  disabled?: boolean;
  onClick: () => void;
}) {
  return (
    <Button
      type="button"
      size="sm"
      variant={active ? "default" : "outline"}
      disabled={disabled}
      aria-pressed={active}
      onClick={onClick}
      className={cn("rounded-full px-3", !active && "text-muted-foreground")}
    >
      {label}
    </Button>
  );
}
