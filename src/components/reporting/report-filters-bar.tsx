"use client";

import * as React from "react";
import { XIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Combobox, type ComboboxOption } from "@/components/ui/combobox";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { cn } from "@/lib/utils";
import type { ReportFilters } from "@/lib/reporting/types";
import { hasActiveFilter } from "@/lib/reporting/url-state";

export type ReportFilterOptions = {
  mdas: ComboboxOption[];
  programmeAreas: ComboboxOption[];
  fundingSources: ComboboxOption[];
  expenditureCategories: ComboboxOption[];
  lgas: ComboboxOption[];
  facilities: ComboboxOption[];
  fiscalYears: number[];
};

type Mode = "admin" | "mda";

type ReportFiltersBarProps = {
  filters: ReportFilters;
  options: ReportFilterOptions;
  /** "admin" exposes the MDA filter; "mda" hides it (scoped by capability). */
  mode: Mode;
  loading?: boolean;
  onChange: (next: ReportFilters) => void;
  onClear: () => void;
};

export function ReportFiltersBar({
  filters,
  options,
  mode,
  loading,
  onChange,
  onClear,
}: ReportFiltersBarProps) {
  const fiscalYearOptions: ComboboxOption[] = React.useMemo(
    () => [
      { value: "all", label: "All fiscal years" },
      ...options.fiscalYears.map((year) => ({
        value: String(year),
        label: `FY ${year}`,
      })),
    ],
    [options.fiscalYears],
  );

  const facilityOptions = React.useMemo(() => {
    if (!filters.lgaId) return options.facilities;
    return options.facilities.filter((option) =>
      option.description ? option.description.includes(filters.lgaId ?? "") : true,
    );
  }, [filters.lgaId, options.facilities]);

  const update = <K extends keyof ReportFilters>(key: K, value: ReportFilters[K]) => {
    onChange({ ...filters, [key]: value });
  };

  const isFiltered = hasActiveFilter(filters);

  return (
    <section
      aria-label="Report filters"
      className={cn(
        "flex flex-col gap-3 rounded-lg border bg-card p-4",
        loading && "opacity-70",
      )}
    >
      <div className="flex flex-wrap items-end gap-3">
        <FilterField label="Status" htmlFor="reporting-status">
          <Select
            id="reporting-status"
            value={filters.status}
            onChange={(event) =>
              update("status", event.target.value as ReportFilters["status"])
            }
            disabled={loading}
          >
            <option value="all">All submitted</option>
            <option value="pending">Pending</option>
            <option value="approved">Approved</option>
            <option value="processed">Processed</option>
            <option value="rejected">Rejected</option>
          </Select>
        </FilterField>

        <FilterField label="Fiscal year" htmlFor="reporting-fy">
          <Combobox
            id="reporting-fy"
            options={fiscalYearOptions}
            value={filters.fiscalYear === null ? "all" : String(filters.fiscalYear)}
            onValueChange={(value) =>
              update("fiscalYear", value === "all" ? null : Number.parseInt(value, 10))
            }
            placeholder="All fiscal years"
            disabled={loading}
            className="w-44"
          />
        </FilterField>

        <FilterField label="Quarter" htmlFor="reporting-quarter">
          <Select
            id="reporting-quarter"
            value={filters.quarter === null ? "all" : String(filters.quarter)}
            disabled={loading}
            onChange={(event) =>
              update(
                "quarter",
                event.target.value === "all"
                  ? null
                  : (Number.parseInt(event.target.value, 10) as ReportFilters["quarter"]),
              )
            }
          >
            <option value="all">All quarters</option>
            <option value="1">Q1</option>
            <option value="2">Q2</option>
            <option value="3">Q3</option>
            <option value="4">Q4</option>
          </Select>
        </FilterField>

        <FilterField label="From" htmlFor="reporting-from">
          <Input
            id="reporting-from"
            type="date"
            value={filters.dateFrom ?? ""}
            disabled={loading}
            onChange={(event) => update("dateFrom", event.target.value || null)}
            className="w-40"
          />
        </FilterField>

        <FilterField label="To" htmlFor="reporting-to">
          <Input
            id="reporting-to"
            type="date"
            value={filters.dateTo ?? ""}
            disabled={loading}
            onChange={(event) => update("dateTo", event.target.value || null)}
            className="w-40"
          />
        </FilterField>

        {mode === "admin" ? (
          <FilterField label="MDA" htmlFor="reporting-mda">
            <Combobox
              id="reporting-mda"
              options={prepend(options.mdas, { value: "all", label: "All MDAs" })}
              value={filters.mdaId ?? "all"}
              onValueChange={(value) => update("mdaId", value === "all" ? null : value)}
              placeholder="All MDAs"
              disabled={loading}
              className="w-56"
            />
          </FilterField>
        ) : null}

        <FilterField label="Programme area" htmlFor="reporting-pa">
          <Combobox
            id="reporting-pa"
            options={prepend(options.programmeAreas, { value: "all", label: "All programme areas" })}
            value={filters.programmeAreaId ?? "all"}
            onValueChange={(value) =>
              update("programmeAreaId", value === "all" ? null : value)
            }
            placeholder="All programme areas"
            disabled={loading}
            className="w-56"
          />
        </FilterField>

        <FilterField label="Funding source" htmlFor="reporting-fs">
          <Combobox
            id="reporting-fs"
            options={prepend(options.fundingSources, { value: "all", label: "All funding sources" })}
            value={filters.fundingSourceId ?? "all"}
            onValueChange={(value) =>
              update("fundingSourceId", value === "all" ? null : value)
            }
            placeholder="All funding sources"
            disabled={loading}
            className="w-56"
          />
        </FilterField>

        <FilterField label="Expenditure category" htmlFor="reporting-ec">
          <Combobox
            id="reporting-ec"
            options={prepend(options.expenditureCategories, {
              value: "all",
              label: "All expenditure categories",
            })}
            value={filters.expenditureCategoryId ?? "all"}
            onValueChange={(value) =>
              update("expenditureCategoryId", value === "all" ? null : value)
            }
            placeholder="All expenditure categories"
            disabled={loading}
            className="w-60"
          />
        </FilterField>

        <FilterField label="PHC" htmlFor="reporting-phc">
          <Select
            id="reporting-phc"
            value={filters.phc}
            disabled={loading}
            onChange={(event) =>
              update("phc", event.target.value as ReportFilters["phc"])
            }
          >
            <option value="any">Any</option>
            <option value="yes">PHC only</option>
            <option value="no">Non-PHC only</option>
          </Select>
        </FilterField>

        <FilterField label="LGA" htmlFor="reporting-lga">
          <Combobox
            id="reporting-lga"
            options={prepend(options.lgas, { value: "all", label: "All LGAs" })}
            value={filters.lgaId ?? "all"}
            onValueChange={(value) => update("lgaId", value === "all" ? null : value)}
            placeholder="All LGAs"
            disabled={loading}
            className="w-48"
          />
        </FilterField>

        <FilterField label="Facility" htmlFor="reporting-facility">
          <Combobox
            id="reporting-facility"
            options={prepend(facilityOptions, { value: "all", label: "All facilities" })}
            value={filters.facilityId ?? "all"}
            onValueChange={(value) => update("facilityId", value === "all" ? null : value)}
            placeholder="All facilities"
            disabled={loading}
            className="w-56"
          />
        </FilterField>

        {isFiltered ? (
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={onClear}
            disabled={loading}
            className="ml-auto"
          >
            <XIcon aria-hidden="true" className="size-3.5" data-icon="inline-start" />
            Reset filters
          </Button>
        ) : null}
      </div>
    </section>
  );
}

function FilterField({
  label,
  htmlFor,
  children,
}: {
  label: string;
  htmlFor: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1">
      <label className="text-xs font-medium text-muted-foreground" htmlFor={htmlFor}>
        {label}
      </label>
      {children}
    </div>
  );
}

function prepend(options: ComboboxOption[], head: ComboboxOption): ComboboxOption[] {
  return [head, ...options];
}
