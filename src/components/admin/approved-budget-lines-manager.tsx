"use client";

import * as React from "react";
import { PencilIcon, PlusIcon, SearchIcon, XIcon } from "lucide-react";
import { toast } from "sonner";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Combobox, type ComboboxOption } from "@/components/ui/combobox";
import { Dialog, DialogFooter } from "@/components/ui/dialog";
import { Empty } from "@/components/ui/empty";
import {
  Field,
  FieldDescription,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Pagination } from "@/components/ui/pagination";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import {
  createApprovedBudgetLine,
  listApprovedBudgetLinesPage,
  setApprovedBudgetLineActive,
  updateApprovedBudgetLine,
  type ApprovedBudgetLineRow,
  type ApprovedBudgetLineStatus,
} from "@/lib/db/planning";
import type { Tables } from "@/lib/db/types";
import {
  BUDGET_LINE_CLASSES,
  emptyApprovedBudgetLineDraft,
  mapBudgetLineWriteError,
  validateApprovedBudgetLine,
  type ApprovedBudgetLineDraft,
  type ApprovedBudgetLineFieldErrors,
} from "@/lib/planning/validation";
import type { TypedSupabaseClient } from "@/lib/supabase/client";

type MdaRow = Tables<"mdas"> & {
  mda_types?: { id: string; name: string; slug: string } | null;
};

type EditingState = {
  row: ApprovedBudgetLineRow | null;
  draft: ApprovedBudgetLineDraft;
  errors: ApprovedBudgetLineFieldErrors;
  saving: boolean;
  formError: string | null;
};

const PAGE_SIZE = 25;

const naira = new Intl.NumberFormat("en-NG", {
  style: "currency",
  currency: "NGN",
  maximumFractionDigits: 2,
});

const classLabels = {
  personnel: "Personnel",
  overhead: "Overhead",
  capital: "Capital",
} as const;

function draftFromRow(row: ApprovedBudgetLineRow): ApprovedBudgetLineDraft {
  return {
    fiscal_year: String(row.fiscal_year),
    mda_id: row.mda_id,
    budget_class: row.budget_class,
    economic_code: row.economic_code,
    economic_description: row.economic_description,
    project_description: row.project_description ?? "",
    function_code: row.function_code ?? "",
    location_code: row.location_code ?? "",
    fund_code: row.fund_code ?? "",
    programme_code: row.programme_code ?? "",
    approved_amount: String(row.approved_amount),
    source_label: row.source_label ?? "",
    source_row_number:
      row.source_row_number === null ? "" : String(row.source_row_number),
  };
}

function useDebouncedValue(value: string, delay = 300) {
  const [debounced, setDebounced] = React.useState(value);

  React.useEffect(() => {
    const timeout = window.setTimeout(() => setDebounced(value), delay);
    return () => window.clearTimeout(timeout);
  }, [delay, value]);

  return debounced;
}

export function ApprovedBudgetLinesManager({
  client,
  mdas,
  fiscalYears,
}: {
  client: TypedSupabaseClient;
  mdas: MdaRow[];
  fiscalYears: number[];
}) {
  const [rows, setRows] = React.useState<ApprovedBudgetLineRow[]>([]);
  const [count, setCount] = React.useState(0);
  const [loading, setLoading] = React.useState(true);
  const [page, setPage] = React.useState(1);
  const [search, setSearch] = React.useState("");
  const [filterYear, setFilterYear] = React.useState("all");
  const [filterMda, setFilterMda] = React.useState("all");
  const [filterClass, setFilterClass] = React.useState("all");
  const [filterStatus, setFilterStatus] =
    React.useState<ApprovedBudgetLineStatus>("all");
  const [editing, setEditing] = React.useState<EditingState | null>(null);
  const [togglingId, setTogglingId] = React.useState<string | null>(null);
  const debouncedSearch = useDebouncedValue(search);

  React.useEffect(() => {
    setPage(1);
  }, [debouncedSearch, filterYear, filterMda, filterClass, filterStatus]);

  const refresh = React.useCallback(async () => {
    setLoading(true);
    try {
      const result = await listApprovedBudgetLinesPage(client, {
        page,
        pageSize: PAGE_SIZE,
        fiscalYear: filterYear === "all" ? undefined : Number(filterYear),
        mdaId: filterMda === "all" ? undefined : filterMda,
        budgetClass:
          filterClass === "all"
            ? undefined
            : (filterClass as "personnel" | "overhead" | "capital"),
        status: filterStatus,
        search: debouncedSearch,
      });
      setRows(result.rows);
      setCount(result.count);
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "Couldn't load approved budget lines.",
      );
    } finally {
      setLoading(false);
    }
  }, [
    client,
    debouncedSearch,
    filterClass,
    filterMda,
    filterStatus,
    filterYear,
    page,
  ]);

  React.useEffect(() => {
    void refresh();
  }, [refresh]);

  const pageCount = Math.max(1, Math.ceil(count / PAGE_SIZE));
  const rangeStart = count === 0 ? 0 : (page - 1) * PAGE_SIZE + 1;
  const rangeEnd = Math.min(page * PAGE_SIZE, count);

  function openCreate() {
    setEditing({
      row: null,
      draft: emptyApprovedBudgetLineDraft(),
      errors: {},
      saving: false,
      formError: null,
    });
  }

  function openEdit(row: ApprovedBudgetLineRow) {
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
    const result = validateApprovedBudgetLine(editing.draft);
    if (!result.ok) {
      setEditing({ ...editing, errors: result.errors });
      return;
    }

    setEditing({ ...editing, saving: true, errors: {}, formError: null });
    try {
      if (editing.row) {
        await updateApprovedBudgetLine(client, editing.row.id, result.values);
        toast.success("Approved budget line updated.");
      } else {
        await createApprovedBudgetLine(client, result.values);
        toast.success("Approved budget line added.");
      }
      setEditing(null);
      await refresh();
    } catch (error) {
      const mapped = mapBudgetLineWriteError(
        error as { code?: string; message?: string },
      );
      setEditing({
        ...editing,
        saving: false,
        errors: mapped.field
          ? { ...editing.errors, [mapped.field]: mapped.message }
          : editing.errors,
        formError: mapped.field ? null : mapped.message,
      });
    }
  }

  async function toggleActive(row: ApprovedBudgetLineRow) {
    setTogglingId(row.id);
    try {
      await setApprovedBudgetLineActive(client, row.id, !row.active);
      toast.success(row.active ? "Budget line deactivated." : "Budget line activated.");
      await refresh();
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Couldn't update the line.",
      );
    } finally {
      setTogglingId(null);
    }
  }

  const mdaOptions: ComboboxOption[] = [
    { value: "all", label: "All MDAs" },
    ...mdas.map((mda) => ({
      value: mda.id,
      label: mda.name,
      description: mda.code,
    })),
  ];

  return (
    <div className="flex min-w-0 flex-col gap-4">
      <div className="flex flex-col gap-3 rounded-md border bg-card p-3">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <Field className="min-w-64 flex-1 lg:max-w-md">
            <FieldLabel htmlFor="budget-line-search">Search budget lines</FieldLabel>
            <div className="relative">
              <SearchIcon
                aria-hidden="true"
                className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
              />
              <Input
                id="budget-line-search"
                className="w-full pl-9 pr-9"
                placeholder="Code, title, project, function or programme"
                type="search"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
              />
              {search ? (
                <Button
                  aria-label="Clear search"
                  className="absolute right-0 top-0"
                  size="icon"
                  type="button"
                  variant="ghost"
                  onClick={() => setSearch("")}
                >
                  <XIcon aria-hidden="true" />
                </Button>
              ) : null}
            </div>
            <FieldDescription>
              Searches only the five high-value fields shown above for faster results.
            </FieldDescription>
          </Field>

          <Button size="sm" type="button" onClick={openCreate}>
            <PlusIcon aria-hidden="true" data-icon="inline-start" />
            Add budget line
          </Button>
        </div>

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <FilterField
            id="budget-line-year"
            label="Fiscal year"
            options={[
              { value: "all", label: "All fiscal years" },
              ...fiscalYears.map((year) => ({
                value: String(year),
                label: `FY ${year}`,
              })),
            ]}
            value={filterYear}
            onChange={setFilterYear}
          />
          <FilterField
            id="budget-line-mda"
            label="MDA"
            options={mdaOptions}
            value={filterMda}
            onChange={setFilterMda}
          />
          <FilterField
            id="budget-line-class"
            label="Budget class"
            options={[
              { value: "all", label: "All classes" },
              ...BUDGET_LINE_CLASSES.map((value) => ({
                value,
                label: classLabels[value],
              })),
            ]}
            value={filterClass}
            onChange={setFilterClass}
          />
          <FilterField
            id="budget-line-status"
            label="Status"
            options={[
              { value: "all", label: "All statuses" },
              { value: "active", label: "Active" },
              { value: "inactive", label: "Inactive" },
            ]}
            value={filterStatus}
            onChange={(value) => setFilterStatus(value as ApprovedBudgetLineStatus)}
          />
        </div>
      </div>

      <BudgetLinesTable
        loading={loading}
        rows={rows}
        togglingId={togglingId}
        onEdit={openEdit}
        onToggleActive={toggleActive}
      />

      {count > 0 ? (
        <div className="flex flex-col gap-3 text-sm text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
          <p>
            Showing {rangeStart.toLocaleString()}–{rangeEnd.toLocaleString()} of{" "}
            {count.toLocaleString()} lines
          </p>
          <Pagination
            page={page}
            pageCount={pageCount}
            siblingCount={1}
            onPageChange={setPage}
          />
        </div>
      ) : null}

      {editing ? (
        <BudgetLineEditDialog
          editing={editing}
          fiscalYears={fiscalYears}
          mdas={mdas}
          onChange={setEditing}
          onClose={() => setEditing(null)}
          onSave={saveDraft}
        />
      ) : null}
    </div>
  );
}

function FilterField({
  id,
  label,
  options,
  value,
  onChange,
}: {
  id: string;
  label: string;
  options: ComboboxOption[];
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <Field>
      <FieldLabel htmlFor={id}>{label}</FieldLabel>
      <Combobox id={id} options={options} value={value} onValueChange={onChange} />
    </Field>
  );
}

function BudgetLinesTable({
  rows,
  loading,
  togglingId,
  onEdit,
  onToggleActive,
}: {
  rows: ApprovedBudgetLineRow[];
  loading: boolean;
  togglingId: string | null;
  onEdit: (row: ApprovedBudgetLineRow) => void;
  onToggleActive: (row: ApprovedBudgetLineRow) => void;
}) {
  if (loading && rows.length === 0) {
    return (
      <div className="flex flex-col gap-2">
        {Array.from({ length: 6 }, (_, index) => (
          <Skeleton key={index} className="h-11 w-full" />
        ))}
      </div>
    );
  }

  if (rows.length === 0) {
    return (
      <Empty
        title="No budget lines match these filters"
        description="Try a broader search or add a new approved budget line."
      />
    );
  }

  return (
    <div className="max-h-[34rem] w-full max-w-full overflow-auto rounded-md border bg-card">
      <Table>
        <TableHeader className="sticky top-0 bg-card">
          <TableRow>
            <TableHead className="w-20">Year</TableHead>
            <TableHead className="min-w-48">MDA</TableHead>
            <TableHead>Class</TableHead>
            <TableHead>Budget code</TableHead>
            <TableHead className="min-w-72">Title / project</TableHead>
            <TableHead>Function</TableHead>
            <TableHead>Programme</TableHead>
            <TableHead className="text-right">Approved amount</TableHead>
            <TableHead>Status</TableHead>
            <TableHead className="text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((row) => (
            <TableRow key={row.id} className={!row.active ? "opacity-65" : undefined}>
              <TableCell className="font-mono text-xs">FY {row.fiscal_year}</TableCell>
              <TableCell>
                <p className="font-medium">{row.mdas?.abbreviation ?? row.mdas?.name ?? "—"}</p>
                {row.mdas?.abbreviation ? (
                  <p className="max-w-56 truncate text-xs text-muted-foreground">
                    {row.mdas.name}
                  </p>
                ) : null}
              </TableCell>
              <TableCell>
                <Badge variant="secondary">{classLabels[row.budget_class]}</Badge>
              </TableCell>
              <TableCell className="font-mono text-xs">{row.economic_code}</TableCell>
              <TableCell>
                <p className="line-clamp-2 text-sm font-medium">
                  {row.project_description ?? row.economic_description}
                </p>
                {row.project_description ? (
                  <p className="mt-1 line-clamp-1 text-xs text-muted-foreground">
                    {row.economic_description}
                  </p>
                ) : null}
              </TableCell>
              <TableCell className="font-mono text-xs">{row.function_code ?? "—"}</TableCell>
              <TableCell className="font-mono text-xs">{row.programme_code ?? "—"}</TableCell>
              <TableCell className="text-right font-semibold tabular-nums">
                {naira.format(Number(row.approved_amount))}
              </TableCell>
              <TableCell>
                <div className="flex items-center gap-2">
                  <Switch
                    checked={row.active}
                    disabled={togglingId === row.id}
                    label={`${row.active ? "Deactivate" : "Activate"} ${row.economic_code}`}
                    onCheckedChange={() => onToggleActive(row)}
                  />
                  <span className="text-xs text-muted-foreground">
                    {row.active ? "Active" : "Inactive"}
                  </span>
                </div>
              </TableCell>
              <TableCell className="text-right">
                <Button size="sm" type="button" variant="ghost" onClick={() => onEdit(row)}>
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

function BudgetLineEditDialog({
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

  function setField<K extends keyof ApprovedBudgetLineDraft>(
    key: K,
    value: ApprovedBudgetLineDraft[K],
  ) {
    onChange({
      ...editing,
      draft: { ...editing.draft, [key]: value },
      errors: { ...editing.errors, [key]: undefined },
    });
  }

  const mdaOptions = mdas
    .filter((mda) => mda.active || mda.id === editing.draft.mda_id)
    .map((mda) => ({ value: mda.id, label: mda.name, description: mda.code }));

  return (
    <Dialog
      open
      contentClassName="max-w-4xl"
      title={isCreate ? "Add approved budget line" : "Edit approved budget line"}
      description="Capture the NCOA classification used to trace expenditure against this approved allocation. Aggregate MDA totals are not changed automatically."
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <form
        className="flex flex-col gap-5"
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

        <FieldGroup>
          <div className="grid gap-3 sm:grid-cols-3">
            <SelectDraftField
              error={editing.errors.fiscal_year}
              id="line-fiscal-year"
              label="Fiscal year"
              options={fiscalYears.map((year) => ({
                value: String(year),
                label: `FY ${year}`,
              }))}
              value={editing.draft.fiscal_year}
              onChange={(value) => setField("fiscal_year", value)}
            />
            <SelectDraftField
              error={editing.errors.mda_id}
              id="line-mda"
              label="MDA"
              options={mdaOptions}
              value={editing.draft.mda_id}
              onChange={(value) => setField("mda_id", value)}
            />
            <SelectDraftField
              error={editing.errors.budget_class}
              id="line-class"
              label="Budget class"
              options={BUDGET_LINE_CLASSES.map((value) => ({
                value,
                label: classLabels[value],
              }))}
              value={editing.draft.budget_class}
              onChange={(value) =>
                setField(
                  "budget_class",
                  value as ApprovedBudgetLineDraft["budget_class"],
                )
              }
            />
          </div>

          <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_minmax(0,2fr)]">
            <DraftInput
              error={editing.errors.economic_code}
              id="line-economic-code"
              label="Budget code"
              value={editing.draft.economic_code}
              onChange={(value) => setField("economic_code", value)}
            />
            <DraftInput
              error={editing.errors.economic_description}
              id="line-economic-description"
              label="Budget-line title"
              value={editing.draft.economic_description}
              onChange={(value) => setField("economic_description", value)}
            />
          </div>

          <Field data-invalid={Boolean(editing.errors.project_description)}>
            <FieldLabel htmlFor="line-project-description">Project title / description</FieldLabel>
            <Textarea
              id="line-project-description"
              aria-invalid={Boolean(editing.errors.project_description)}
              placeholder="Optional for recurrent lines; useful for capital projects"
              value={editing.draft.project_description}
              onChange={(event) => setField("project_description", event.target.value)}
            />
          </Field>

          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <DraftInput id="line-function-code" label="Function code" value={editing.draft.function_code} onChange={(value) => setField("function_code", value)} />
            <DraftInput id="line-programme-code" label="Programme code" value={editing.draft.programme_code} onChange={(value) => setField("programme_code", value)} />
            <DraftInput id="line-location-code" label="Location code" value={editing.draft.location_code} onChange={(value) => setField("location_code", value)} />
            <DraftInput id="line-fund-code" label="Fund code" value={editing.draft.fund_code} onChange={(value) => setField("fund_code", value)} />
          </div>

          <div className="grid gap-3 sm:grid-cols-3">
            <DraftInput
              error={editing.errors.approved_amount}
              id="line-approved-amount"
              inputMode="decimal"
              label="Approved amount (₦)"
              value={editing.draft.approved_amount}
              onChange={(value) => setField("approved_amount", value)}
            />
            <DraftInput
              error={editing.errors.source_row_number}
              id="line-source-row"
              inputMode="numeric"
              label="Source row"
              value={editing.draft.source_row_number}
              onChange={(value) => setField("source_row_number", value)}
            />
            <DraftInput id="line-source-label" label="Source label" value={editing.draft.source_label} onChange={(value) => setField("source_label", value)} />
          </div>
        </FieldGroup>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
          <Button type="submit" disabled={editing.saving}>
            {editing.saving ? "Saving…" : isCreate ? "Add budget line" : "Save changes"}
          </Button>
        </DialogFooter>
      </form>
    </Dialog>
  );
}

function SelectDraftField({
  id,
  label,
  value,
  options,
  error,
  onChange,
}: {
  id: string;
  label: string;
  value: string;
  options: ComboboxOption[];
  error?: string;
  onChange: (value: string) => void;
}) {
  return (
    <Field data-invalid={Boolean(error)}>
      <FieldLabel htmlFor={id}>{label}</FieldLabel>
      <Combobox id={id} options={options} value={value || undefined} onValueChange={onChange} />
      {error ? <FieldDescription className="text-status-rejected">{error}</FieldDescription> : null}
    </Field>
  );
}

function DraftInput({
  id,
  label,
  value,
  error,
  inputMode,
  onChange,
}: {
  id: string;
  label: string;
  value: string;
  error?: string;
  inputMode?: React.HTMLAttributes<HTMLInputElement>["inputMode"];
  onChange: (value: string) => void;
}) {
  return (
    <Field data-invalid={Boolean(error)}>
      <FieldLabel htmlFor={id}>{label}</FieldLabel>
      <Input
        id={id}
        aria-invalid={Boolean(error)}
        inputMode={inputMode}
        value={value}
        onChange={(event) => onChange(event.target.value)}
      />
      {error ? <FieldDescription className="text-status-rejected">{error}</FieldDescription> : null}
    </Field>
  );
}
