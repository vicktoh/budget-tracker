"use client";

import * as React from "react";
import {
  Building2Icon,
  ClipboardCheckIcon,
  LandmarkIcon,
  ReceiptIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Combobox, type ComboboxOption } from "@/components/ui/combobox";
import { Field, FieldDescription, FieldLabel } from "@/components/ui/form";
import { cn } from "@/lib/utils";

export type ReferenceLite = {
  id: string;
  name: string;
  abbreviation?: string | null;
};

export type FacilityLite = {
  id: string;
  name: string;
  lga_id: string;
};

export function toggleGrantId(
  ids: string[],
  id: string,
): string[] {
  return ids.includes(id) ? ids.filter((value) => value !== id) : [...ids, id];
}

type GrantPickerProps = {
  description: string;
  icon: React.ComponentType<{ className?: string }>;
  loading: boolean;
  mdas: ReferenceLite[];
  onSelectedIdsChange: (ids: string[]) => void;
  selectedIds: string[];
  title: string;
  tone?: "funding" | "expenditure" | "review";
};

const toneStyles = {
  funding: "border-status-approved/20 bg-status-approved-bg/40",
  expenditure: "border-[#8A5A2B]/20 bg-[#F3E9DC]/50",
  review: "border-status-pending/25 bg-status-pending-bg/50",
} as const;

export function MdaGrantPicker({
  description,
  icon: Icon,
  loading,
  mdas,
  onSelectedIdsChange,
  selectedIds,
  title,
  tone = "funding",
}: GrantPickerProps) {
  const allIds = React.useMemo(() => mdas.map((mda) => mda.id), [mdas]);
  const allSelected =
    allIds.length > 0 && allIds.every((id) => selectedIds.includes(id));
  const noneSelected = selectedIds.length === 0;

  return (
    <div
      className={cn(
        "flex flex-col gap-3 rounded-md border p-4",
        toneStyles[tone],
      )}
    >
      <div className="flex items-start gap-3">
        <span className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-md border bg-card text-muted-foreground">
          <Icon aria-hidden="true" className="size-4" />
        </span>
        <div className="flex min-w-0 flex-1 flex-col gap-2">
          <div className="flex flex-col gap-1">
            <span className="text-sm font-medium">{title}</span>
            <span className="text-xs text-muted-foreground">
              {selectedIds.length} selected. {description}
            </span>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              disabled={loading || allIds.length === 0 || allSelected}
              size="sm"
              type="button"
              variant="outline"
              onClick={() => onSelectedIdsChange(allIds)}
            >
              Select all
            </Button>
            <Button
              disabled={loading || noneSelected}
              size="sm"
              type="button"
              variant="ghost"
              onClick={() => onSelectedIdsChange([])}
            >
              Clear
            </Button>
          </div>
        </div>
      </div>
      <GrantList
        emptyLabel={loading ? "Loading MDAs…" : "No MDAs found."}
        items={mdas}
        onToggle={(id) =>
          onSelectedIdsChange(toggleGrantId(selectedIds, id))
        }
        selectedIds={selectedIds}
      />
    </div>
  );
}

function GrantList({
  emptyLabel,
  items,
  onToggle,
  selectedIds,
}: {
  emptyLabel: string;
  items: ReferenceLite[];
  onToggle: (id: string) => void;
  selectedIds: string[];
}) {
  return (
    <div className="max-h-56 overflow-auto rounded-md border bg-card">
      {items.length === 0 ? (
        <p className="p-3 text-sm text-muted-foreground">{emptyLabel}</p>
      ) : (
        <ul className="divide-y">
          {items.map((item) => {
            const checked = selectedIds.includes(item.id);
            const label = item.abbreviation
              ? `${item.abbreviation} — ${item.name}`
              : item.name;
            return (
              <li key={item.id}>
                <label className="flex cursor-pointer items-center gap-3 px-3 py-2 text-sm hover:bg-muted/40">
                  <Checkbox
                    checked={checked}
                    onChange={() => onToggle(item.id)}
                  />
                  <span>{label}</span>
                </label>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

export function FacilityGrantPicker({
  facilities,
  lgaOptions,
  lgaFilter,
  loading,
  onLgaFilterChange,
  onToggleFacility,
  selectedFacilityIds,
}: {
  facilities: FacilityLite[];
  lgaOptions: ComboboxOption[];
  lgaFilter: string;
  loading: boolean;
  onLgaFilterChange: (value: string) => void;
  onToggleFacility: (id: string) => void;
  selectedFacilityIds: string[];
}) {
  const visibleFacilities = React.useMemo(() => {
    if (!lgaFilter) return facilities;
    return facilities.filter((facility) => facility.lga_id === lgaFilter);
  }, [facilities, lgaFilter]);

  return (
    <div className="flex flex-col gap-3 rounded-md border border-soft-boundary bg-muted/20 p-4">
      <div className="flex items-start gap-3">
        <span className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-md border bg-card text-muted-foreground">
          <Building2Icon aria-hidden="true" className="size-4" />
        </span>
        <div className="flex min-w-0 flex-col gap-1">
          <span className="text-sm font-medium">Assigned facilities</span>
          <span className="text-xs text-muted-foreground">
            {selectedFacilityIds.length} selected. Filter by LGA to find
            facilities faster.
          </span>
        </div>
      </div>
      <div className="max-w-xs">
        <Combobox
          options={lgaOptions}
          placeholder="Filter by LGA"
          value={lgaFilter || undefined}
          onValueChange={onLgaFilterChange}
        />
      </div>
      <div className="max-h-56 overflow-auto rounded-md border bg-card">
        {visibleFacilities.length === 0 ? (
          <p className="p-3 text-sm text-muted-foreground">
            {loading ? "Loading facilities…" : "No facilities found."}
          </p>
        ) : (
          <ul className="divide-y">
            {visibleFacilities.map((facility) => {
              const checked = selectedFacilityIds.includes(facility.id);
              return (
                <li key={facility.id}>
                  <label className="flex cursor-pointer items-center gap-3 px-3 py-2 text-sm hover:bg-muted/40">
                    <Checkbox
                      checked={checked}
                      onChange={() => onToggleFacility(facility.id)}
                    />
                    <span>{facility.name}</span>
                  </label>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}

export function ReportingMdaField({
  loading,
  mdaId,
  mdaOptions,
  onMdaChange,
}: {
  loading: boolean;
  mdaId: string;
  mdaOptions: ComboboxOption[];
  onMdaChange: (value: string) => void;
}) {
  return (
    <Field>
      <FieldLabel htmlFor="reporting-mda">Reporting MDA</FieldLabel>
      <Combobox
        id="reporting-mda"
        options={mdaOptions}
        placeholder={loading ? "Loading MDAs…" : "Select MDA"}
        value={mdaId || undefined}
        onValueChange={onMdaChange}
        disabled={loading || mdaOptions.length === 0}
      />
      <FieldDescription>
        Facility users report under a single MDA (e.g. PHCMB).
      </FieldDescription>
    </Field>
  );
}

export const GRANT_PICKER_ICONS = {
  funding: LandmarkIcon,
  expenditure: ReceiptIcon,
  review: ClipboardCheckIcon,
} as const;

export function MdaScopedAccessGrants({
  expenditureMdaIds,
  fundingMdaIds,
  loading,
  mdas,
  onExpenditureIdsChange,
  onFundingIdsChange,
}: {
  expenditureMdaIds: string[];
  fundingMdaIds: string[];
  loading: boolean;
  mdas: ReferenceLite[];
  onExpenditureIdsChange: (ids: string[]) => void;
  onFundingIdsChange: (ids: string[]) => void;
}) {
  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm text-muted-foreground">
        Mix funding and expenditure grants independently. A user can submit
        entries for some MDAs and not others.
      </p>
      <div className="grid gap-4 md:grid-cols-2">
        <MdaGrantPicker
          description="Add and edit pending funding entries for selected MDAs."
          icon={GRANT_PICKER_ICONS.funding}
          loading={loading}
          mdas={mdas}
          onSelectedIdsChange={onFundingIdsChange}
          selectedIds={fundingMdaIds}
          title="Funding-entry access"
          tone="funding"
        />
        <MdaGrantPicker
          description="Add and edit pending expenditure entries for selected MDAs."
          icon={GRANT_PICKER_ICONS.expenditure}
          loading={loading}
          mdas={mdas}
          onSelectedIdsChange={onExpenditureIdsChange}
          selectedIds={expenditureMdaIds}
          title="Expenditure-entry access"
          tone="expenditure"
        />
      </div>
    </div>
  );
}
