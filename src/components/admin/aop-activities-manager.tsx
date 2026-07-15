"use client";

import * as React from "react";
import { EyeIcon, EyeOffIcon, PencilIcon, PlusIcon } from "lucide-react";
import { toast } from "sonner";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
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
import { Textarea } from "@/components/ui/textarea";
import { listMdas } from "@/lib/db/reference-data";
import {
  createAopActivity,
  listAdminAopActivities,
  setAopActivityActive,
  updateAopActivity,
  type AopActivityRow,
} from "@/lib/db/planning";
import {
  emptyAopActivityDraft,
  mapAopActivityWriteError,
  validateAopActivity,
  type AopActivityDraft,
  type AopActivityFieldErrors,
} from "@/lib/planning/validation";
import { defaultFiscalYearOptions } from "@/lib/planning/types";
import type { TypedSupabaseClient } from "@/lib/supabase/client";
import type { Tables } from "@/lib/db/types";

type MdaRow = Tables<"mdas">;

const naira = new Intl.NumberFormat("en-NG", {
  style: "currency",
  currency: "NGN",
  maximumFractionDigits: 2,
});

type EditingState = {
  row: AopActivityRow | null;
  draft: AopActivityDraft;
  errors: AopActivityFieldErrors;
  saving: boolean;
  formError: string | null;
};

function draftFromRow(row: AopActivityRow): AopActivityDraft {
  return {
    fiscal_year: String(row.fiscal_year),
    mda_id: row.mda_id,
    activity_code: row.activity_code,
    description: row.description,
    budgeted_cost: String(row.budgeted_cost),
    source_row_number:
      row.source_row_number === null ? "" : String(row.source_row_number),
  };
}

export function AopActivitiesManager({
  client,
}: {
  client: TypedSupabaseClient;
}) {
  const [rows, setRows] = React.useState<AopActivityRow[]>([]);
  const [mdas, setMdas] = React.useState<MdaRow[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [filterYear, setFilterYear] = React.useState<string>("all");
  const [filterMda, setFilterMda] = React.useState<string>("all");
  const [showInactive, setShowInactive] = React.useState(false);
  const [editing, setEditing] = React.useState<EditingState | null>(null);

  const refresh = React.useCallback(async () => {
    setLoading(true);
    try {
      const [activities, allMdas] = await Promise.all([
        listAdminAopActivities(client, { includeInactive: true }),
        listMdas(client, { includeInactive: true }),
      ]);
      setRows(activities);
      setMdas(allMdas as unknown as MdaRow[]);
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Couldn't load AOP activities.",
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
      if (!showInactive && !row.active) return false;
      return true;
    });
  }, [rows, filterYear, filterMda, showInactive]);

  function openCreate() {
    setEditing({
      row: null,
      draft: emptyAopActivityDraft(),
      errors: {},
      saving: false,
      formError: null,
    });
  }

  function openEdit(row: AopActivityRow) {
    setEditing({
      row,
      draft: draftFromRow(row),
      errors: {},
      saving: false,
      formError: null,
    });
  }

  async function toggleActive(row: AopActivityRow) {
    const next = !row.active;
    setRows((prev) =>
      prev.map((r) => (r.id === row.id ? { ...r, active: next } : r)),
    );
    try {
      await setAopActivityActive(client, row.id, next);
      toast.success(next ? "Activity reactivated." : "Activity deactivated.");
    } catch (err) {
      setRows((prev) =>
        prev.map((r) => (r.id === row.id ? { ...r, active: row.active } : r)),
      );
      toast.error(
        err instanceof Error ? err.message : "Couldn't change active state.",
      );
    }
  }

  async function saveDraft() {
    if (!editing) return;
    const result = validateAopActivity(editing.draft);
    if (!result.ok) {
      setEditing({ ...editing, errors: result.errors });
      return;
    }
    setEditing({ ...editing, saving: true, errors: {}, formError: null });
    try {
      if (editing.row) {
        await updateAopActivity(client, editing.row.id, result.values);
        toast.success("AOP activity updated.");
      } else {
        await createAopActivity(client, result.values);
        toast.success("AOP activity added.");
      }
      setEditing(null);
      await refresh();
    } catch (err) {
      const mapped = mapAopActivityWriteError(
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
            <FieldLabel htmlFor="aop-filter-year">Fiscal year</FieldLabel>
            <Combobox
              id="aop-filter-year"
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
            <FieldLabel htmlFor="aop-filter-mda">MDA</FieldLabel>
            <Combobox
              id="aop-filter-mda"
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
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            type="button"
            variant="outline"
            onClick={() => setShowInactive((v) => !v)}
          >
            {showInactive ? (
              <EyeOffIcon aria-hidden="true" data-icon="inline-start" />
            ) : (
              <EyeIcon aria-hidden="true" data-icon="inline-start" />
            )}
            {showInactive ? "Hide inactive" : "Show inactive"}
          </Button>
          <Button size="sm" type="button" onClick={openCreate}>
            <PlusIcon aria-hidden="true" data-icon="inline-start" />
            Add AOP activity
          </Button>
        </div>
      </div>

      <ActivitiesTable
        rows={filtered}
        loading={loading}
        onEdit={openEdit}
        onToggleActive={toggleActive}
      />

      {editing ? (
        <ActivityEditDialog
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

function ActivitiesTable({
  rows,
  loading,
  onEdit,
  onToggleActive,
}: {
  rows: AopActivityRow[];
  loading: boolean;
  onEdit: (row: AopActivityRow) => void;
  onToggleActive: (row: AopActivityRow) => void;
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
        title="No AOP activities yet"
        description="Add an Annual Operational Plan activity for an MDA and fiscal year. Workbook duplicates can be preserved by giving each row a distinct source row number."
      />
    );
  }

  return (
    <div className="overflow-x-auto rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-20">Year</TableHead>
            <TableHead className="w-40">Code</TableHead>
            <TableHead>Description</TableHead>
            <TableHead className="w-56">MDA</TableHead>
            <TableHead className="w-36 text-right">Budgeted</TableHead>
            <TableHead className="w-20 text-right">Row</TableHead>
            <TableHead className="w-24">Status</TableHead>
            <TableHead className="w-44 text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((row) => (
            <TableRow key={row.id} className={row.active ? "" : "opacity-70"}>
              <TableCell className="font-mono text-xs">
                FY {row.fiscal_year}
              </TableCell>
              <TableCell className="font-mono text-xs font-medium">
                {row.activity_code}
              </TableCell>
              <TableCell className="max-w-xl text-sm">
                <span className="line-clamp-2">{row.description}</span>
              </TableCell>
              <TableCell className="text-sm text-muted-foreground">
                {row.mdas?.abbreviation ?? row.mdas?.name ?? "—"}
              </TableCell>
              <TableCell className="text-right tabular-nums">
                {naira.format(Number(row.budgeted_cost))}
              </TableCell>
              <TableCell className="text-right text-xs text-muted-foreground tabular-nums">
                {row.source_row_number ?? "—"}
              </TableCell>
              <TableCell>
                {row.active ? (
                  <Badge variant="approved">Active</Badge>
                ) : (
                  <Badge variant="outline">Inactive</Badge>
                )}
              </TableCell>
              <TableCell className="text-right">
                <div className="inline-flex gap-2">
                  <Button
                    size="sm"
                    type="button"
                    variant="ghost"
                    onClick={() => onEdit(row)}
                  >
                    <PencilIcon aria-hidden="true" data-icon="inline-start" />
                    Edit
                  </Button>
                  <Button
                    size="sm"
                    type="button"
                    variant="outline"
                    onClick={() => onToggleActive(row)}
                  >
                    {row.active ? "Deactivate" : "Reactivate"}
                  </Button>
                </div>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

function ActivityEditDialog({
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

  function setField<K extends keyof AopActivityDraft>(
    key: K,
    value: AopActivityDraft[K],
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
      title={isCreate ? "Add AOP activity" : "Edit AOP activity"}
      description="AOP activities are scoped to a fiscal year and MDA. When two workbook rows share the same activity code under the same MDA, set distinct source row numbers so both stay searchable."
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
            <FieldLabel htmlFor="aop-fy">Fiscal year</FieldLabel>
            <Combobox
              id="aop-fy"
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
            <FieldLabel htmlFor="aop-mda">MDA</FieldLabel>
            <Combobox
              id="aop-mda"
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

        <Field>
          <FieldLabel htmlFor="aop-code">Activity code</FieldLabel>
          <Input
            id="aop-code"
            className="font-mono"
            value={editing.draft.activity_code}
            onChange={(e) => setField("activity_code", e.target.value)}
            aria-invalid={Boolean(editing.errors.activity_code)}
          />
          <FieldDescription>
            Matches the workbook activity code, e.g. <code>RH-001</code>.
          </FieldDescription>
          {editing.errors.activity_code ? (
            <FieldDescription className="text-status-rejected">
              {editing.errors.activity_code}
            </FieldDescription>
          ) : null}
        </Field>

        <Field>
          <FieldLabel htmlFor="aop-description">Description</FieldLabel>
          <Textarea
            id="aop-description"
            rows={3}
            value={editing.draft.description}
            onChange={(e) => setField("description", e.target.value)}
            aria-invalid={Boolean(editing.errors.description)}
          />
          {editing.errors.description ? (
            <FieldDescription className="text-status-rejected">
              {editing.errors.description}
            </FieldDescription>
          ) : null}
        </Field>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Field>
            <FieldLabel htmlFor="aop-cost">Budgeted cost</FieldLabel>
            <div className="relative">
              <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-sm text-muted-foreground">
                ₦
              </span>
              <Input
                id="aop-cost"
                inputMode="decimal"
                className="pl-7 tabular-nums"
                value={editing.draft.budgeted_cost}
                onChange={(e) => setField("budgeted_cost", e.target.value)}
                aria-invalid={Boolean(editing.errors.budgeted_cost)}
              />
            </div>
            {editing.errors.budgeted_cost ? (
              <FieldDescription className="text-status-rejected">
                {editing.errors.budgeted_cost}
              </FieldDescription>
            ) : null}
          </Field>
          <Field>
            <FieldLabel htmlFor="aop-source-row">
              Source row <span className="text-muted-foreground">(optional)</span>
            </FieldLabel>
            <Input
              id="aop-source-row"
              inputMode="numeric"
              className="tabular-nums"
              value={editing.draft.source_row_number}
              onChange={(e) => setField("source_row_number", e.target.value)}
              placeholder="e.g. 12"
              aria-invalid={Boolean(editing.errors.source_row_number)}
            />
            <FieldDescription>
              Use only when the same activity code repeats for an MDA in the
              workbook. Set distinct row numbers to keep both rows.
            </FieldDescription>
            {editing.errors.source_row_number ? (
              <FieldDescription className="text-status-rejected">
                {editing.errors.source_row_number}
              </FieldDescription>
            ) : null}
          </Field>
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" disabled={editing.saving}>
            {editing.saving
              ? "Saving…"
              : isCreate
                ? "Add activity"
                : "Save changes"}
          </Button>
        </DialogFooter>
      </form>
    </Dialog>
  );
}
