"use client";

import * as React from "react";
import { PencilIcon, PlusIcon } from "lucide-react";
import { toast } from "sonner";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Combobox, type ComboboxOption } from "@/components/ui/combobox";
import { Dialog, DialogFooter } from "@/components/ui/dialog";
import { Empty } from "@/components/ui/empty";
import { Field, FieldDescription, FieldLabel } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { listMdas } from "@/lib/db/reference-data";
import {
  createApprovedBudget,
  listApprovedBudgets,
  updateApprovedBudget,
  type ApprovedBudgetRow,
} from "@/lib/db/planning";
import {
  emptyApprovedBudgetDraft,
  mapBudgetWriteError,
  previewBudgetTotals,
  validateApprovedBudget,
  type ApprovedBudgetDraft,
  type ApprovedBudgetFieldErrors,
} from "@/lib/planning/validation";
import { defaultFiscalYearOptions } from "@/lib/planning/types";
import type { TypedSupabaseClient } from "@/lib/supabase/client";
import type { Tables } from "@/lib/db/types";

type MdaRow = Tables<"mdas"> & {
  mda_types?: { id: string; name: string; slug: string } | null;
};

const naira = new Intl.NumberFormat("en-NG", {
  style: "currency",
  currency: "NGN",
  maximumFractionDigits: 2,
});

type EditingState = {
  row: ApprovedBudgetRow | null;
  draft: ApprovedBudgetDraft;
  errors: ApprovedBudgetFieldErrors;
  saving: boolean;
  formError: string | null;
};

function draftFromRow(row: ApprovedBudgetRow): ApprovedBudgetDraft {
  return {
    fiscal_year: String(row.fiscal_year),
    mda_id: row.mda_id,
    personnel_amount: String(row.personnel_amount),
    other_recurrent_amount: String(row.other_recurrent_amount),
    capital_amount: String(row.capital_amount),
    source_label: row.source_label ?? "",
  };
}

export function ApprovedBudgetsManager({
  client,
}: {
  client: TypedSupabaseClient;
}) {
  const [rows, setRows] = React.useState<ApprovedBudgetRow[]>([]);
  const [mdas, setMdas] = React.useState<MdaRow[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [filterYear, setFilterYear] = React.useState<string>("all");
  const [filterMda, setFilterMda] = React.useState<string>("all");
  const [editing, setEditing] = React.useState<EditingState | null>(null);

  const refresh = React.useCallback(async () => {
    setLoading(true);
    try {
      const [budgets, allMdas] = await Promise.all([
        listApprovedBudgets(client),
        listMdas(client, { includeInactive: true }),
      ]);
      setRows(budgets);
      setMdas(allMdas as unknown as MdaRow[]);
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Couldn't load approved budgets.",
      );
    } finally {
      setLoading(false);
    }
  }, [client]);

  React.useEffect(() => {
    void refresh();
  }, [refresh]);

  const yearOptions = React.useMemo(() => {
    const years = new Set<number>(rows.map((row) => row.fiscal_year));
    for (const year of defaultFiscalYearOptions()) years.add(year);
    return Array.from(years).sort((a, b) => b - a);
  }, [rows]);

  const filtered = React.useMemo(() => {
    return rows.filter((row) => {
      if (filterYear !== "all" && String(row.fiscal_year) !== filterYear) {
        return false;
      }
      if (filterMda !== "all" && row.mda_id !== filterMda) return false;
      return true;
    });
  }, [rows, filterYear, filterMda]);

  function openCreate() {
    setEditing({
      row: null,
      draft: emptyApprovedBudgetDraft(),
      errors: {},
      saving: false,
      formError: null,
    });
  }

  function openEdit(row: ApprovedBudgetRow) {
    setEditing({
      row,
      draft: draftFromRow(row),
      errors: {},
      saving: false,
      formError: null,
    });
  }

  async function saveDraft() {
    if (!editing) return;
    const result = validateApprovedBudget(editing.draft);
    if (!result.ok) {
      setEditing({ ...editing, errors: result.errors });
      return;
    }
    setEditing({ ...editing, saving: true, errors: {}, formError: null });
    try {
      if (editing.row) {
        await updateApprovedBudget(client, editing.row.id, result.values);
        toast.success("Approved budget updated.");
      } else {
        await createApprovedBudget(client, result.values);
        toast.success("Approved budget added.");
      }
      setEditing(null);
      await refresh();
    } catch (err) {
      const mapped = mapBudgetWriteError(
        err as { code?: string; message?: string },
      );
      if (mapped.field) {
        setEditing({
          ...editing,
          saving: false,
          errors: { ...editing.errors, [mapped.field]: mapped.message },
          formError: null,
        });
      } else {
        setEditing({
          ...editing,
          saving: false,
          formError: mapped.message,
        });
      }
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="flex flex-wrap items-end gap-3">
          <Field className="w-44">
            <FieldLabel htmlFor="budget-filter-year">Fiscal year</FieldLabel>
            <Combobox
              id="budget-filter-year"
              options={[
                { value: "all", label: "All fiscal years" },
                ...yearOptions.map((year) => ({
                  value: String(year),
                  label: `FY ${year}`,
                })),
              ]}
              value={filterYear}
              onValueChange={setFilterYear}
            />
          </Field>
          <Field className="w-72">
            <FieldLabel htmlFor="budget-filter-mda">MDA</FieldLabel>
            <Combobox
              id="budget-filter-mda"
              options={[
                { value: "all", label: "All MDAs" },
                ...mdas.map((mda) => ({
                  value: mda.id,
                  label: mda.name,
                  description: mda.code,
                })),
              ]}
              value={filterMda}
              onValueChange={setFilterMda}
            />
          </Field>
        </div>
        <Button size="sm" type="button" onClick={openCreate}>
          <PlusIcon aria-hidden="true" data-icon="inline-start" />
          Add approved budget
        </Button>
      </div>

      <BudgetsTable
        rows={filtered}
        loading={loading}
        onEdit={openEdit}
      />

      {editing ? (
        <BudgetEditDialog
          editing={editing}
          mdas={mdas}
          fiscalYears={yearOptions}
          onChange={setEditing}
          onClose={() => setEditing(null)}
          onSave={saveDraft}
        />
      ) : null}
    </div>
  );
}

function BudgetsTable({
  rows,
  loading,
  onEdit,
}: {
  rows: ApprovedBudgetRow[];
  loading: boolean;
  onEdit: (row: ApprovedBudgetRow) => void;
}) {
  if (loading && rows.length === 0) {
    return (
      <div className="flex flex-col gap-2">
        <Skeleton className="h-9 w-full" />
        <Skeleton className="h-9 w-full" />
        <Skeleton className="h-9 w-full" />
      </div>
    );
  }

  if (rows.length === 0) {
    return (
      <Empty
        title="No approved budgets yet"
        description="Add a budget for an MDA and fiscal year. Personnel + other recurrent must equal total recurrent, and total recurrent + capital must equal total budget."
      />
    );
  }

  return (
    <div className="overflow-x-auto rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-24">Year</TableHead>
            <TableHead>MDA</TableHead>
            <TableHead className="text-right">Personnel</TableHead>
            <TableHead className="text-right">Other recurrent</TableHead>
            <TableHead className="text-right">Total recurrent</TableHead>
            <TableHead className="text-right">Capital</TableHead>
            <TableHead className="text-right">Total budget</TableHead>
            <TableHead>Source</TableHead>
            <TableHead className="w-24 text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((row) => (
            <TableRow key={row.id}>
              <TableCell className="font-mono text-xs">
                FY {row.fiscal_year}
              </TableCell>
              <TableCell className="font-medium">
                {row.mdas?.name ?? "—"}
                {row.mdas?.abbreviation ? (
                  <span className="ml-2 text-xs text-muted-foreground">
                    {row.mdas.abbreviation}
                  </span>
                ) : null}
              </TableCell>
              <TableCell className="text-right tabular-nums">
                {naira.format(Number(row.personnel_amount))}
              </TableCell>
              <TableCell className="text-right tabular-nums">
                {naira.format(Number(row.other_recurrent_amount))}
              </TableCell>
              <TableCell className="text-right tabular-nums text-muted-foreground">
                {naira.format(Number(row.total_recurrent_amount))}
              </TableCell>
              <TableCell className="text-right tabular-nums">
                {naira.format(Number(row.capital_amount))}
              </TableCell>
              <TableCell className="text-right tabular-nums font-semibold">
                {naira.format(Number(row.total_budget_amount))}
              </TableCell>
              <TableCell className="text-xs text-muted-foreground">
                {row.source_label ?? "—"}
              </TableCell>
              <TableCell className="text-right">
                <Button
                  size="sm"
                  type="button"
                  variant="ghost"
                  onClick={() => onEdit(row)}
                >
                  <PencilIcon aria-hidden="true" data-icon="inline-start" />
                  Edit
                </Button>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

function BudgetEditDialog({
  editing,
  mdas,
  fiscalYears,
  onChange,
  onClose,
  onSave,
}: {
  editing: EditingState;
  mdas: MdaRow[];
  fiscalYears: number[];
  onChange: (next: EditingState) => void;
  onClose: () => void;
  onSave: () => void;
}) {
  const isCreate = !editing.row;
  const totals = React.useMemo(
    () => previewBudgetTotals(editing.draft),
    [editing.draft],
  );

  function setField<K extends keyof ApprovedBudgetDraft>(
    key: K,
    value: ApprovedBudgetDraft[K],
  ) {
    onChange({
      ...editing,
      draft: { ...editing.draft, [key]: value },
      errors: { ...editing.errors, [key]: undefined },
    });
  }

  const mdaOptions: ComboboxOption[] = mdas
    .filter((mda) => mda.active)
    .map((mda) => ({
      value: mda.id,
      label: mda.name,
      description: mda.code,
    }));
  const yearOptions: ComboboxOption[] = fiscalYears.map((year) => ({
    value: String(year),
    label: `FY ${year}`,
  }));

  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
      title={isCreate ? "Add approved budget" : "Edit approved budget"}
      description="Personnel + other recurrent must equal total recurrent, and total recurrent + capital must equal total budget. Totals update as you type."
    >
      <form
        className="flex flex-col gap-4"
        onSubmit={(event) => {
          event.preventDefault();
          onSave();
        }}
      >
        {editing.formError ? (
          <Alert variant="destructive">
            <AlertTitle>Couldn&rsquo;t save</AlertTitle>
            <AlertDescription>{editing.formError}</AlertDescription>
          </Alert>
        ) : null}

        <div className="grid grid-cols-2 gap-3">
          <Field>
            <FieldLabel htmlFor="budget-fy">Fiscal year</FieldLabel>
            <Combobox
              id="budget-fy"
              options={yearOptions}
              value={editing.draft.fiscal_year}
              onValueChange={(value) => setField("fiscal_year", value)}
              placeholder="Select"
            />
            {editing.errors.fiscal_year ? (
              <FieldDescription className="text-status-rejected">
                {editing.errors.fiscal_year}
              </FieldDescription>
            ) : null}
          </Field>
          <Field>
            <FieldLabel htmlFor="budget-mda">MDA</FieldLabel>
            <Combobox
              id="budget-mda"
              options={mdaOptions}
              value={editing.draft.mda_id || undefined}
              onValueChange={(value) => setField("mda_id", value)}
              placeholder="Select MDA"
            />
            {editing.errors.mda_id ? (
              <FieldDescription className="text-status-rejected">
                {editing.errors.mda_id}
              </FieldDescription>
            ) : null}
          </Field>
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <MoneyField
            id="budget-personnel"
            label="Personnel"
            value={editing.draft.personnel_amount}
            error={editing.errors.personnel_amount}
            onChange={(v) => setField("personnel_amount", v)}
          />
          <MoneyField
            id="budget-other"
            label="Other recurrent"
            value={editing.draft.other_recurrent_amount}
            error={editing.errors.other_recurrent_amount}
            onChange={(v) => setField("other_recurrent_amount", v)}
          />
          <MoneyField
            id="budget-capital"
            label="Capital"
            value={editing.draft.capital_amount}
            error={editing.errors.capital_amount}
            onChange={(v) => setField("capital_amount", v)}
          />
        </div>

        <div className="rounded-md border bg-secondary/40 px-4 py-3 text-sm">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Totals preview
          </p>
          <dl className="mt-2 grid grid-cols-2 gap-x-6 gap-y-1.5 sm:grid-cols-4">
            <div>
              <dt className="text-xs text-muted-foreground">Personnel</dt>
              <dd className="tabular-nums">
                {totals.personnel === null
                  ? "—"
                  : naira.format(totals.personnel)}
              </dd>
            </div>
            <div>
              <dt className="text-xs text-muted-foreground">Other recurrent</dt>
              <dd className="tabular-nums">
                {totals.other_recurrent === null
                  ? "—"
                  : naira.format(totals.other_recurrent)}
              </dd>
            </div>
            <div>
              <dt className="text-xs text-muted-foreground">Total recurrent</dt>
              <dd className="tabular-nums font-semibold">
                {totals.total_recurrent === null
                  ? "—"
                  : naira.format(totals.total_recurrent)}
              </dd>
            </div>
            <div>
              <dt className="text-xs text-muted-foreground">Total budget</dt>
              <dd className="tabular-nums font-semibold text-status-approved">
                {totals.total_budget === null
                  ? "—"
                  : naira.format(totals.total_budget)}
              </dd>
            </div>
          </dl>
        </div>

        <Field>
          <FieldLabel htmlFor="budget-source">Source label</FieldLabel>
          <Input
            id="budget-source"
            value={editing.draft.source_label}
            onChange={(e) => setField("source_label", e.target.value)}
            placeholder="e.g. Approved Budget Workbook 2026"
          />
          <FieldDescription>
            Optional. Shown in audit history and helps reconcile against the
            workbook this row came from.
          </FieldDescription>
        </Field>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" disabled={editing.saving}>
            {editing.saving
              ? "Saving…"
              : isCreate
                ? "Add budget"
                : "Save changes"}
          </Button>
        </DialogFooter>
      </form>
    </Dialog>
  );
}

function MoneyField({
  id,
  label,
  value,
  error,
  onChange,
}: {
  id: string;
  label: string;
  value: string;
  error?: string;
  onChange: (next: string) => void;
}) {
  return (
    <Field>
      <FieldLabel htmlFor={id}>{label}</FieldLabel>
      <div className="relative">
        <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-sm text-muted-foreground">
          ₦
        </span>
        <Input
          id={id}
          inputMode="decimal"
          className="pl-7 tabular-nums"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          aria-invalid={Boolean(error)}
        />
      </div>
      {error ? (
        <FieldDescription className="text-status-rejected">
          {error}
        </FieldDescription>
      ) : null}
    </Field>
  );
}
