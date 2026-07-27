"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import type { Tables } from "@/lib/db/types";
import type { LedgerEntryListFilters } from "@/lib/ledger/entry-list-filters";
import { cn } from "@/lib/utils";

const QUARTER_OPTIONS: {
  value: LedgerEntryListFilters["quarter"];
  label: string;
}[] = [
  { value: "all", label: "All" },
  { value: "1", label: "Q1" },
  { value: "2", label: "Q2" },
  { value: "3", label: "Q3" },
  { value: "4", label: "Q4" },
];

export type QuarterFilterValue = LedgerEntryListFilters["quarter"];

export function QuarterFilterPills({
  value,
  onChange,
}: {
  value: QuarterFilterValue;
  onChange: (value: QuarterFilterValue) => void;
}) {
  return (
    <div className="flex flex-wrap items-center gap-2" role="group" aria-label="Quarter">
      <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
        Quarter
      </span>
      {QUARTER_OPTIONS.map((option) => (
        <QuarterPill
          key={option.value}
          label={option.label}
          active={value === option.value}
          onClick={() => onChange(option.value)}
        />
      ))}
    </div>
  );
}

type MdaOption = Pick<Tables<"mdas">, "id" | "name" | "abbreviation">;

export function LedgerEntryFilters({
  filters,
  mdas,
  searchPlaceholder,
  onChange,
}: {
  filters: LedgerEntryListFilters;
  mdas: MdaOption[];
  searchPlaceholder: string;
  onChange: (next: LedgerEntryListFilters) => void;
}) {
  function update<K extends keyof LedgerEntryListFilters>(
    key: K,
    value: LedgerEntryListFilters[K],
  ) {
    onChange({ ...filters, [key]: value });
  }

  return (
    <div className="flex flex-col gap-3 rounded-lg border bg-card p-3">
      <div className="grid gap-3 md:grid-cols-5">
        <label className="flex flex-col gap-1 text-xs font-medium text-muted-foreground md:col-span-2">
          Search
          <Input
            placeholder={searchPlaceholder}
            value={filters.search}
            onChange={(event) => update("search", event.target.value)}
          />
        </label>
        <label className="flex flex-col gap-1 text-xs font-medium text-muted-foreground">
          MDA
          <Select
            value={filters.mdaId}
            onChange={(event) => update("mdaId", event.target.value)}
          >
            <option value="all">All assigned MDAs</option>
            {mdas.map((mda) => (
              <option key={mda.id} value={mda.id}>
                {mda.abbreviation ?? mda.name}
              </option>
            ))}
          </Select>
        </label>
        <label className="flex flex-col gap-1 text-xs font-medium text-muted-foreground">
          Fiscal year
          <Input
            inputMode="numeric"
            placeholder="2026"
            value={filters.fiscalYear}
            onChange={(event) =>
              update("fiscalYear", event.target.value.replace(/[^0-9]/g, ""))
            }
          />
        </label>
      </div>

      <QuarterFilterPills
        value={filters.quarter}
        onChange={(quarter) => update("quarter", quarter)}
      />
    </div>
  );
}

function QuarterPill({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <Button
      type="button"
      size="sm"
      variant={active ? "default" : "outline"}
      aria-pressed={active}
      onClick={onClick}
      className={cn("rounded-full px-3", !active && "text-muted-foreground")}
    >
      {label}
    </Button>
  );
}
