"use client";

import * as React from "react";
import {
  EyeIcon,
  EyeOffIcon,
  PencilIcon,
  PlusIcon,
} from "lucide-react";
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
  FieldLabel,
} from "@/components/ui/form";
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  createReferenceValue,
  setReferenceActive,
  updateReferenceValue,
} from "@/lib/db/reference-management";
import {
  listExpenditureCategories,
  listExpenditureItems,
  listFacilities,
  listFundingSources,
  listLgas,
  listMdas,
  listPaymentMethods,
  listProgrammeAreas,
} from "@/lib/db/reference-data";
import type { Tables } from "@/lib/db/types";
import {
  REFERENCE_KIND_ORDER,
  REFERENCE_REGISTRY,
  type ReferenceKind,
} from "@/lib/reference/types";
import {
  mapReferenceWriteError,
  validateReferenceDraft,
  type ReferenceDraft,
  type ReferenceFieldErrors,
} from "@/lib/reference/validation";
import type { TypedSupabaseClient } from "@/lib/supabase/client";

type AnyRow = {
  id: string;
  name: string;
  active: boolean;
  // optional shape members
  slug?: string;
  code?: string;
  abbreviation?: string | null;
  mda_type_id?: string | null;
  expenditure_category_id?: string | null;
  lga_id?: string;
  facility_type?: string;
  // joined helpers (selected when needed)
  mda_types?: { id: string; name: string } | null;
  expenditure_categories?: { id: string; name: string } | null;
  lgas?: { id: string; name: string } | null;
};

type Loaders = Record<ReferenceKind, () => Promise<AnyRow[]>>;

function loadersFor(client: TypedSupabaseClient): Loaders {
  return {
    mda_type: async () => {
      const { data, error } = await client
        .from("mda_types")
        .select("*")
        .order("name", { ascending: true });
      if (error) throw error;
      return (data ?? []) as unknown as AnyRow[];
    },
    mda: async () =>
      (await listMdas(client, { includeInactive: true })) as unknown as AnyRow[],
    programme_area: async () =>
      (await listProgrammeAreas(client, {
        includeInactive: true,
      })) as unknown as AnyRow[],
    funding_source: async () =>
      (await listFundingSources(client, {
        includeInactive: true,
      })) as unknown as AnyRow[],
    expenditure_category: async () =>
      (await listExpenditureCategories(client, {
        includeInactive: true,
      })) as unknown as AnyRow[],
    expenditure_item: async () =>
      (await listExpenditureItems(client, {
        includeInactive: true,
      })) as unknown as AnyRow[],
    payment_method: async () =>
      (await listPaymentMethods(client, {
        includeInactive: true,
      })) as unknown as AnyRow[],
    lga: async () =>
      (await listLgas(client, { includeInactive: true })) as unknown as AnyRow[],
    facility: async () =>
      (await listFacilities(client, {
        includeInactive: true,
      })) as unknown as AnyRow[],
  };
}

type RowsByKind = Partial<Record<ReferenceKind, AnyRow[]>>;

type EditingState = {
  kind: ReferenceKind;
  row: AnyRow | null;
  draft: ReferenceDraft;
  errors: ReferenceFieldErrors;
  saving: boolean;
  formError: string | null;
};

function blankDraft(): ReferenceDraft {
  return {
    name: "",
    code: "",
    abbreviation: "",
    mda_type_id: null,
    expenditure_category_id: null,
    lga_id: null,
    facility_type: "primary_health_centre",
  };
}

function draftFromRow(row: AnyRow): ReferenceDraft {
  return {
    name: row.name ?? "",
    code: row.code ?? "",
    abbreviation: row.abbreviation ?? "",
    mda_type_id: row.mda_type_id ?? null,
    expenditure_category_id: row.expenditure_category_id ?? null,
    lga_id: row.lga_id ?? null,
    facility_type: row.facility_type ?? "primary_health_centre",
  };
}

export function ReferenceDataManager({
  client,
}: {
  client: TypedSupabaseClient;
}) {
  const loaders = React.useMemo(() => loadersFor(client), [client]);
  const [activeKind, setActiveKind] = React.useState<ReferenceKind>("mda");
  const [rows, setRows] = React.useState<RowsByKind>({});
  const [loading, setLoading] = React.useState<Partial<Record<ReferenceKind, boolean>>>(
    {},
  );
  const [showInactive, setShowInactive] = React.useState(false);
  const [editing, setEditing] = React.useState<EditingState | null>(null);

  const loadKind = React.useCallback(
    async (kind: ReferenceKind, force = false) => {
      if (!force && rows[kind]) return;
      setLoading((l) => ({ ...l, [kind]: true }));
      try {
        const data = await loaders[kind]();
        setRows((r) => ({ ...r, [kind]: data }));
      } catch (err) {
        toast.error(
          err instanceof Error ? err.message : "Failed to load reference data.",
        );
      } finally {
        setLoading((l) => ({ ...l, [kind]: false }));
      }
    },
    [loaders, rows],
  );

  React.useEffect(() => {
    void loadKind(activeKind);
  }, [activeKind, loadKind]);

  // Eagerly load related lookups used by edit dialog dropdowns. They're cheap
  // (small reference tables) and avoid empty pickers when the admin opens
  // the dialog before switching to those tabs.
  React.useEffect(() => {
    void loadKind("mda_type");
    void loadKind("expenditure_category");
    void loadKind("lga");
  }, [loadKind]);

  function openCreate(kind: ReferenceKind) {
    setEditing({
      kind,
      row: null,
      draft: blankDraft(),
      errors: {},
      saving: false,
      formError: null,
    });
  }

  function openEdit(kind: ReferenceKind, row: AnyRow) {
    setEditing({
      kind,
      row,
      draft: draftFromRow(row),
      errors: {},
      saving: false,
      formError: null,
    });
  }

  async function toggleActive(kind: ReferenceKind, row: AnyRow) {
    const next = !row.active;
    setRows((prev) => {
      const list = prev[kind];
      if (!list) return prev;
      return {
        ...prev,
        [kind]: list.map((r) =>
          r.id === row.id ? { ...r, active: next } : r,
        ),
      };
    });
    try {
      await setReferenceActive(client, kind, row.id, next);
      toast.success(
        `${next ? "Reactivated" : "Deactivated"} ${REFERENCE_REGISTRY[kind].singular}.`,
      );
    } catch (err) {
      // Roll back the optimistic flip and explain.
      setRows((prev) => {
        const list = prev[kind];
        if (!list) return prev;
        return {
          ...prev,
          [kind]: list.map((r) =>
            r.id === row.id ? { ...r, active: row.active } : r,
          ),
        };
      });
      toast.error(
        err instanceof Error ? err.message : "Couldn't change active state.",
      );
    }
  }

  async function saveDraft() {
    if (!editing) return;
    const result = validateReferenceDraft(editing.kind, editing.draft);
    if (!result.ok) {
      setEditing({ ...editing, errors: result.errors });
      return;
    }
    setEditing({ ...editing, saving: true, errors: {}, formError: null });
    try {
      if (editing.row) {
        await updateReferenceValue(
          client,
          editing.kind,
          editing.row.id,
          result.values,
        );
        toast.success(`Updated ${REFERENCE_REGISTRY[editing.kind].singular}.`);
      } else {
        await createReferenceValue(client, editing.kind, result.values);
        toast.success(`Added ${REFERENCE_REGISTRY[editing.kind].singular}.`);
      }
      setEditing(null);
      await loadKind(editing.kind, true);
    } catch (err) {
      const mapped = mapReferenceWriteError(
        editing.kind,
        err as { code?: string; message?: string },
      );
      if (mapped?.field) {
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
          formError: mapped?.message ?? "Failed to save value.",
        });
      }
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <Tabs
        value={activeKind}
        defaultValue={activeKind}
        onValueChange={(value) => setActiveKind(value as ReferenceKind)}
      >
        <div className="flex flex-wrap items-center justify-between gap-3">
          <TabsList className="flex-wrap">
            {REFERENCE_KIND_ORDER.map((kind) => (
              <TabsTrigger key={kind} value={kind}>
                {REFERENCE_REGISTRY[kind].plural}
              </TabsTrigger>
            ))}
          </TabsList>
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
            <Button
              size="sm"
              type="button"
              onClick={() => openCreate(activeKind)}
            >
              <PlusIcon aria-hidden="true" data-icon="inline-start" />
              Add {REFERENCE_REGISTRY[activeKind].singular}
            </Button>
          </div>
        </div>

        {REFERENCE_KIND_ORDER.map((kind) => (
          <TabsContent key={kind} value={kind} className="flex flex-col gap-3">
            <p className="text-sm text-muted-foreground">
              {REFERENCE_REGISTRY[kind].description}
            </p>
            <ReferenceTable
              kind={kind}
              rows={(rows[kind] ?? []).filter(
                (row) => showInactive || row.active,
              )}
              loading={Boolean(loading[kind])}
              onEdit={(row) => openEdit(kind, row)}
              onToggleActive={(row) => toggleActive(kind, row)}
            />
          </TabsContent>
        ))}
      </Tabs>

      {editing ? (
        <ReferenceEditDialog
          editing={editing}
          rows={rows}
          onChange={setEditing}
          onClose={() => setEditing(null)}
          onSave={saveDraft}
        />
      ) : null}
    </div>
  );
}

function ReferenceTable({
  kind,
  rows,
  loading,
  onEdit,
  onToggleActive,
}: {
  kind: ReferenceKind;
  rows: AnyRow[];
  loading: boolean;
  onEdit: (row: AnyRow) => void;
  onToggleActive: (row: AnyRow) => void;
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
        title={`No ${REFERENCE_REGISTRY[kind].plural} yet`}
        description="Add a new value to make it available in entry forms."
      />
    );
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Name</TableHead>
          {kind === "mda" ? (
            <>
              <TableHead className="w-24">Code</TableHead>
              <TableHead className="w-28">Abbrev.</TableHead>
              <TableHead>Type</TableHead>
            </>
          ) : null}
          {kind === "expenditure_item" ? (
            <TableHead>Category</TableHead>
          ) : null}
          {kind === "facility" ? (
            <>
              <TableHead>LGA</TableHead>
              <TableHead className="w-40">Type</TableHead>
            </>
          ) : null}
          <TableHead className="w-24">Status</TableHead>
          <TableHead className="w-44 text-right">Actions</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.map((row) => (
          <TableRow key={row.id} className={row.active ? "" : "opacity-70"}>
            <TableCell className="font-medium">{row.name}</TableCell>
            {kind === "mda" ? (
              <>
                <TableCell className="font-mono text-xs">
                  {row.code ?? "—"}
                </TableCell>
                <TableCell className="text-xs text-muted-foreground">
                  {row.abbreviation ?? "—"}
                </TableCell>
                <TableCell className="text-sm text-muted-foreground">
                  {row.mda_types?.name ?? "—"}
                </TableCell>
              </>
            ) : null}
            {kind === "expenditure_item" ? (
              <TableCell className="text-sm text-muted-foreground">
                {row.expenditure_categories?.name ?? "—"}
              </TableCell>
            ) : null}
            {kind === "facility" ? (
              <>
                <TableCell className="text-sm text-muted-foreground">
                  {row.lgas?.name ?? "—"}
                </TableCell>
                <TableCell className="text-xs text-muted-foreground">
                  {row.facility_type ?? "—"}
                </TableCell>
              </>
            ) : null}
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
  );
}

function ReferenceEditDialog({
  editing,
  rows,
  onChange,
  onClose,
  onSave,
}: {
  editing: EditingState;
  rows: RowsByKind;
  onChange: (next: EditingState) => void;
  onClose: () => void;
  onSave: () => void;
}) {
  const meta = REFERENCE_REGISTRY[editing.kind];
  const isCreate = !editing.row;

  function setField<K extends keyof ReferenceDraft>(
    key: K,
    value: ReferenceDraft[K],
  ) {
    onChange({
      ...editing,
      draft: { ...editing.draft, [key]: value },
      errors: { ...editing.errors, [key]: undefined },
    });
  }

  const mdaTypeOptions: ComboboxOption[] = (rows.mda_type ?? [])
    .filter((r) => r.active)
    .map((r) => ({ value: r.id, label: r.name }));
  const categoryOptions: ComboboxOption[] = (rows.expenditure_category ?? [])
    .filter((r) => r.active)
    .map((r) => ({ value: r.id, label: r.name }));
  const lgaOptions: ComboboxOption[] = (rows.lga ?? [])
    .filter((r) => r.active)
    .map((r) => ({ value: r.id, label: r.name }));

  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
      title={
        isCreate ? `Add ${meta.singular}` : `Edit ${meta.singular}`
      }
      description={
        isCreate
          ? "New active values are available in entry forms immediately."
          : "Updates are audited and surface through the audit history."
      }
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

        <Field>
          <FieldLabel htmlFor="ref-name">Name</FieldLabel>
          <Input
            id="ref-name"
            value={editing.draft.name}
            onChange={(e) => setField("name", e.target.value)}
            aria-invalid={Boolean(editing.errors.name)}
          />
          {editing.errors.name ? (
            <FieldDescription className="text-status-rejected">
              {editing.errors.name}
            </FieldDescription>
          ) : null}
        </Field>

        {meta.fields.includes("code") ? (
          <Field>
            <FieldLabel htmlFor="ref-code">Code</FieldLabel>
            <Input
              id="ref-code"
              value={editing.draft.code ?? ""}
              onChange={(e) => setField("code", e.target.value)}
              className="font-mono"
              aria-invalid={Boolean(editing.errors.code)}
            />
            <FieldDescription>
              Short unique identifier. Used in audit history and exports.
            </FieldDescription>
            {editing.errors.code ? (
              <FieldDescription className="text-status-rejected">
                {editing.errors.code}
              </FieldDescription>
            ) : null}
          </Field>
        ) : null}

        {meta.fields.includes("abbreviation") ? (
          <Field>
            <FieldLabel htmlFor="ref-abbr">Abbreviation</FieldLabel>
            <Input
              id="ref-abbr"
              value={editing.draft.abbreviation ?? ""}
              onChange={(e) => setField("abbreviation", e.target.value)}
            />
            <FieldDescription>
              Optional. Shown next to long MDA names in dense tables.
            </FieldDescription>
          </Field>
        ) : null}

        {meta.fields.includes("mda_type") ? (
          <Field>
            <FieldLabel htmlFor="ref-mda-type">MDA type</FieldLabel>
            <Combobox
              id="ref-mda-type"
              options={mdaTypeOptions}
              placeholder="Select type"
              value={editing.draft.mda_type_id ?? undefined}
              onValueChange={(value) => setField("mda_type_id", value)}
            />
          </Field>
        ) : null}

        {meta.fields.includes("expenditure_category") ? (
          <Field>
            <FieldLabel htmlFor="ref-category">Expenditure category</FieldLabel>
            <Combobox
              id="ref-category"
              options={categoryOptions}
              placeholder="Select category"
              value={editing.draft.expenditure_category_id ?? undefined}
              onValueChange={(value) =>
                setField("expenditure_category_id", value)
              }
            />
            {editing.errors.expenditure_category_id ? (
              <FieldDescription className="text-status-rejected">
                {editing.errors.expenditure_category_id}
              </FieldDescription>
            ) : null}
          </Field>
        ) : null}

        {meta.fields.includes("lga") ? (
          <Field>
            <FieldLabel htmlFor="ref-lga">LGA</FieldLabel>
            <Combobox
              id="ref-lga"
              options={lgaOptions}
              placeholder="Select LGA"
              value={editing.draft.lga_id ?? undefined}
              onValueChange={(value) => setField("lga_id", value)}
            />
            {editing.errors.lga_id ? (
              <FieldDescription className="text-status-rejected">
                {editing.errors.lga_id}
              </FieldDescription>
            ) : null}
          </Field>
        ) : null}

        {meta.fields.includes("facility_type") ? (
          <Field>
            <FieldLabel htmlFor="ref-facility-type">Facility type</FieldLabel>
            <Input
              id="ref-facility-type"
              value={editing.draft.facility_type ?? ""}
              onChange={(e) => setField("facility_type", e.target.value)}
            />
            <FieldDescription>
              For example, primary_health_centre, dispensary, model_clinic.
            </FieldDescription>
            {editing.errors.facility_type ? (
              <FieldDescription className="text-status-rejected">
                {editing.errors.facility_type}
              </FieldDescription>
            ) : null}
          </Field>
        ) : null}

        <DialogFooter>
          <Button type="button" variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" disabled={editing.saving}>
            {editing.saving
              ? "Saving…"
              : isCreate
                ? `Add ${meta.singular}`
                : `Save changes`}
          </Button>
        </DialogFooter>
      </form>
    </Dialog>
  );
}

// Re-export the row type for callers wiring custom views.
export type ReferenceRow = AnyRow;

// Re-export Tables for tests that want shape sanity-checks.
export type ProgrammeAreaRow = Tables<"programme_areas">;
