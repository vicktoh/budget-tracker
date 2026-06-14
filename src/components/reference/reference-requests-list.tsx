"use client";

import * as React from "react";
import { CheckIcon, MessageSquareXIcon } from "lucide-react";
import { toast } from "sonner";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogFooter } from "@/components/ui/dialog";
import { Empty } from "@/components/ui/empty";
import {
  Field,
  FieldDescription,
  FieldLabel,
} from "@/components/ui/form";
import { Combobox, type ComboboxOption } from "@/components/ui/combobox";
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
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import {
  approveReferenceRequest,
  listReferenceRequests,
  rejectReferenceRequest,
  type ReferenceRequestRow,
} from "@/lib/db/reference-requests";
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
import {
  REFERENCE_REGISTRY,
  type ReferenceKind,
} from "@/lib/reference/types";
import { validateReferenceRequestDecision } from "@/lib/reference/requests";
import type { TypedSupabaseClient } from "@/lib/supabase/client";

type StatusFilter = "all" | "pending" | "approved" | "rejected";

type ReviewDialogState = {
  request: ReferenceRequestRow;
  mode: "approve" | "reject";
  createNew: boolean;
  existingId: string;
  comment: string;
  submitting: boolean;
  error: string | null;
};

const STATUS_VARIANT: Record<
  "pending" | "approved" | "rejected",
  "pending" | "approved" | "rejected"
> = {
  pending: "pending",
  approved: "approved",
  rejected: "rejected",
};

export function ReferenceRequestsList({
  client,
  mode,
  currentUserId,
}: {
  client: TypedSupabaseClient;
  /**
   * `admin` shows the queue with approve/reject actions and all requesters.
   * `mine` filters to requests submitted by `currentUserId` and hides the
   * review actions.
   */
  mode: "admin" | "mine";
  currentUserId: string;
}) {
  const [rows, setRows] = React.useState<ReferenceRequestRow[]>([]);
  const [status, setStatus] = React.useState<StatusFilter>(
    mode === "admin" ? "pending" : "all",
  );
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [dialog, setDialog] = React.useState<ReviewDialogState | null>(null);

  const load = React.useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await listReferenceRequests(client, {
        status,
        mineOnly: mode === "mine",
        userId: currentUserId,
      });
      setRows(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load requests.");
    } finally {
      setLoading(false);
    }
  }, [client, mode, currentUserId, status]);

  React.useEffect(() => {
    void load();
  }, [load]);

  const visible = rows;

  return (
    <div className="flex flex-col gap-4">
      <Tabs
        value={status}
        defaultValue={status}
        onValueChange={(value) => setStatus(value as StatusFilter)}
      >
        <TabsList>
          {(mode === "admin"
            ? ["pending", "approved", "rejected", "all"]
            : ["all", "pending", "approved", "rejected"]
          ).map((value) => (
            <TabsTrigger key={value} value={value}>
              {value === "all"
                ? "All"
                : value.charAt(0).toUpperCase() + value.slice(1)}
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>

      {error ? (
        <Alert variant="destructive">
          <AlertTitle>Couldn&rsquo;t load requests</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}

      {loading ? (
        <div className="flex flex-col gap-2">
          <Skeleton className="h-9 w-full" />
          <Skeleton className="h-9 w-full" />
          <Skeleton className="h-9 w-full" />
        </div>
      ) : visible.length === 0 ? (
        <Empty
          title="No requests here"
          description={
            mode === "admin"
              ? "When MDA users request a missing reference value, it shows up here for review."
              : "You haven't submitted any requests in this view."
          }
        />
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Requested value</TableHead>
              <TableHead className="w-40">Kind</TableHead>
              {mode === "admin" ? (
                <TableHead className="w-44">Requested by</TableHead>
              ) : null}
              <TableHead className="w-32">Status</TableHead>
              <TableHead className="w-36">Submitted</TableHead>
              <TableHead className="w-56 text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {visible.map((row) => (
              <TableRow key={row.id}>
                <TableCell>
                  <div className="flex flex-col">
                    <span className="font-medium">{row.requested_label}</span>
                    {row.description ? (
                      <span className="text-xs text-muted-foreground">
                        {row.description}
                      </span>
                    ) : null}
                    <ContextLine row={row} />
                  </div>
                </TableCell>
                <TableCell className="text-sm text-muted-foreground">
                  {REFERENCE_REGISTRY[row.reference_type as ReferenceKind]
                    ?.singular ?? row.reference_type}
                </TableCell>
                {mode === "admin" ? (
                  <TableCell className="text-sm text-muted-foreground">
                    {row.requester?.full_name ?? "—"}
                  </TableCell>
                ) : null}
                <TableCell>
                  <Badge variant={STATUS_VARIANT[row.status]}>
                    {row.status.charAt(0).toUpperCase() + row.status.slice(1)}
                  </Badge>
                </TableCell>
                <TableCell className="text-xs text-muted-foreground">
                  {new Date(row.created_at).toLocaleDateString()}
                </TableCell>
                <TableCell className="text-right">
                  {mode === "admin" && row.status === "pending" ? (
                    <div className="inline-flex gap-2">
                      <Button
                        size="sm"
                        type="button"
                        onClick={() =>
                          setDialog({
                            request: row,
                            mode: "approve",
                            createNew: true,
                            existingId: "",
                            comment: "",
                            submitting: false,
                            error: null,
                          })
                        }
                      >
                        <CheckIcon aria-hidden="true" data-icon="inline-start" />
                        Approve
                      </Button>
                      <Button
                        size="sm"
                        type="button"
                        variant="outline"
                        onClick={() =>
                          setDialog({
                            request: row,
                            mode: "reject",
                            createNew: false,
                            existingId: "",
                            comment: "",
                            submitting: false,
                            error: null,
                          })
                        }
                      >
                        <MessageSquareXIcon
                          aria-hidden="true"
                          data-icon="inline-start"
                        />
                        Reject
                      </Button>
                    </div>
                  ) : row.review_comment ? (
                    <span className="text-xs text-muted-foreground">
                      {row.review_comment}
                    </span>
                  ) : (
                    <span className="text-xs text-muted-foreground">—</span>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}

      {dialog ? (
        <ReviewDialog
          client={client}
          state={dialog}
          onChange={setDialog}
          onDone={() => {
            setDialog(null);
            void load();
          }}
          reviewerId={currentUserId}
        />
      ) : null}
    </div>
  );
}

function ContextLine({ row }: { row: ReferenceRequestRow }) {
  const parts: string[] = [];
  if (row.related_mda?.name) {
    parts.push(
      row.related_mda.abbreviation
        ? `${row.related_mda.abbreviation} — ${row.related_mda.name}`
        : row.related_mda.name,
    );
  }
  if (row.related_lga?.name) parts.push(`LGA: ${row.related_lga.name}`);
  if (row.related_category?.name) {
    parts.push(`Category: ${row.related_category.name}`);
  }
  if (parts.length === 0) return null;
  return (
    <span className="text-xs text-muted-foreground">{parts.join(" · ")}</span>
  );
}

function ReviewDialog({
  state,
  onChange,
  onDone,
  client,
  reviewerId,
}: {
  state: ReviewDialogState;
  onChange: (next: ReviewDialogState | null) => void;
  onDone: () => void;
  client: TypedSupabaseClient;
  reviewerId: string;
}) {
  const kind = state.request.reference_type as ReferenceKind;
  const meta = REFERENCE_REGISTRY[kind];

  const [existingOptions, setExistingOptions] = React.useState<
    ComboboxOption[]
  >([]);

  React.useEffect(() => {
    if (state.mode !== "approve") return;
    let alive = true;
    (async () => {
      try {
        const opts = await loadExistingOptions(client, kind);
        if (alive) setExistingOptions(opts);
      } catch {
        // Non-fatal: leave the existing picker empty; the admin can still
        // create a new value instead.
      }
    })();
    return () => {
      alive = false;
    };
  }, [client, kind, state.mode]);

  async function handleSubmit() {
    if (state.mode === "approve") {
      const input = state.createNew
        ? {
            action: "approve" as const,
            resolved_reference_id: "pending-create" /* validated separately */,
          }
        : {
            action: "approve" as const,
            resolved_reference_id: state.existingId || null,
          };
      // For "use existing", we still validate the picker. For "create new",
      // we skip validation here because the resolved ID is generated after
      // the underlying row is created server-side.
      if (!state.createNew) {
        const result = validateReferenceRequestDecision({
          action: "approve",
          resolved_reference_id: state.existingId || null,
        });
        if (!result.ok) {
          onChange({ ...state, error: result.error });
          return;
        }
      }
      onChange({ ...state, submitting: true, error: null });
      try {
        if (state.createNew) {
          await approveReferenceRequest(client, state.request.id, {
            kind: "create_new",
            reviewerId,
            referenceKind: kind,
            label: state.request.requested_label,
            relatedCategoryId: state.request.related_category_id,
            relatedLgaId: state.request.related_lga_id,
            reviewComment: state.comment || undefined,
          });
        } else {
          await approveReferenceRequest(client, state.request.id, {
            kind: "use_existing",
            reviewerId,
            resolvedReferenceId: state.existingId,
            reviewComment: state.comment || undefined,
          });
        }
        toast.success(`Approved ${meta.singular} request.`);
        onDone();
        void input; // ensure unused warning suppressed
      } catch (err) {
        onChange({
          ...state,
          submitting: false,
          error:
            err instanceof Error ? err.message : "Failed to approve request.",
        });
      }
      return;
    }

    const result = validateReferenceRequestDecision({
      action: "reject",
      review_comment: state.comment,
    });
    if (!result.ok) {
      onChange({ ...state, error: result.error });
      return;
    }
    onChange({ ...state, submitting: true, error: null });
    try {
      if (result.decision.action !== "reject") {
        // Shouldn't happen: we just validated with action "reject".
        throw new Error("Unexpected decision shape.");
      }
      await rejectReferenceRequest(client, state.request.id, {
        reviewerId,
        reviewComment: result.decision.review_comment,
      });
      toast.success("Request rejected.");
      onDone();
    } catch (err) {
      onChange({
        ...state,
        submitting: false,
        error:
          err instanceof Error ? err.message : "Failed to reject request.",
      });
    }
  }

  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open && !state.submitting) onChange(null);
      }}
      title={
        state.mode === "approve"
          ? `Approve ${meta.singular} request`
          : `Reject ${meta.singular} request`
      }
      description={`Requested: ${state.request.requested_label}`}
    >
      <form
        className="flex flex-col gap-4"
        onSubmit={(event) => {
          event.preventDefault();
          void handleSubmit();
        }}
      >
        {state.error ? (
          <Alert variant="destructive">
            <AlertTitle>Couldn&rsquo;t complete this review</AlertTitle>
            <AlertDescription>{state.error}</AlertDescription>
          </Alert>
        ) : null}

        {state.mode === "approve" ? (
          <>
            <div className="flex items-center justify-between rounded-md border bg-muted/30 px-3 py-2">
              <div className="flex flex-col">
                <span className="text-sm font-medium">
                  Create &ldquo;{state.request.requested_label}&rdquo; as a new
                  value
                </span>
                <span className="text-xs text-muted-foreground">
                  When this is a brand-new value the team should be able to use
                  going forward.
                </span>
              </div>
              <Switch
                checked={state.createNew}
                onCheckedChange={(checked) =>
                  onChange({ ...state, createNew: checked, error: null })
                }
              />
            </div>

            {!state.createNew ? (
              <Field>
                <FieldLabel htmlFor="review-existing">
                  Link to existing value
                </FieldLabel>
                <Combobox
                  id="review-existing"
                  options={existingOptions}
                  placeholder={`Pick a ${meta.singular}`}
                  value={state.existingId || undefined}
                  onValueChange={(value) =>
                    onChange({
                      ...state,
                      existingId: value,
                      error: null,
                    })
                  }
                />
                <FieldDescription>
                  Use this when the requested value already exists under a
                  different name.
                </FieldDescription>
              </Field>
            ) : null}

            <Field>
              <FieldLabel htmlFor="review-comment">
                Note to requester (optional)
              </FieldLabel>
              <Textarea
                id="review-comment"
                value={state.comment}
                onChange={(e) => onChange({ ...state, comment: e.target.value })}
                rows={2}
                placeholder="Any context they should know about this value."
              />
            </Field>
          </>
        ) : (
          <Field>
            <FieldLabel htmlFor="review-reject-comment">
              Why is this being rejected?
            </FieldLabel>
            <Textarea
              id="review-reject-comment"
              value={state.comment}
              onChange={(e) =>
                onChange({ ...state, comment: e.target.value, error: null })
              }
              rows={3}
              placeholder="Required. Sent to the requester."
              aria-invalid={Boolean(state.error)}
            />
            <FieldDescription>
              Rejection always needs a short comment so the requester can fix
              the request or use a different value.
            </FieldDescription>
          </Field>
        )}

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            disabled={state.submitting}
            onClick={() => onChange(null)}
          >
            Cancel
          </Button>
          <Button
            type="submit"
            variant={state.mode === "reject" ? "destructive" : "default"}
            disabled={state.submitting}
          >
            {state.submitting
              ? state.mode === "approve"
                ? "Approving…"
                : "Rejecting…"
              : state.mode === "approve"
                ? "Approve request"
                : "Reject request"}
          </Button>
        </DialogFooter>
      </form>
    </Dialog>
  );
}

async function loadExistingOptions(
  client: TypedSupabaseClient,
  kind: ReferenceKind,
): Promise<ComboboxOption[]> {
  switch (kind) {
    case "mda": {
      const rows = await listMdas(client, { includeInactive: true });
      return rows.map((r) => ({
        value: r.id,
        label: r.abbreviation ? `${r.abbreviation} — ${r.name}` : r.name,
      }));
    }
    case "mda_type": {
      const { data } = await client
        .from("mda_types")
        .select("id, name")
        .order("name");
      const rows = (data ?? []) as unknown as { id: string; name: string }[];
      return rows.map((r) => ({ value: r.id, label: r.name }));
    }
    case "programme_area": {
      const rows = await listProgrammeAreas(client, { includeInactive: true });
      return rows.map((r) => ({ value: r.id, label: r.name }));
    }
    case "funding_source": {
      const rows = await listFundingSources(client, { includeInactive: true });
      return rows.map((r) => ({ value: r.id, label: r.name }));
    }
    case "expenditure_category": {
      const rows = await listExpenditureCategories(client, {
        includeInactive: true,
      });
      return rows.map((r) => ({ value: r.id, label: r.name }));
    }
    case "expenditure_item": {
      const rows = await listExpenditureItems(client, {
        includeInactive: true,
      });
      return rows.map((r) => ({ value: r.id, label: r.name }));
    }
    case "payment_method": {
      const rows = await listPaymentMethods(client, { includeInactive: true });
      return rows.map((r) => ({ value: r.id, label: r.name }));
    }
    case "lga": {
      const rows = await listLgas(client, { includeInactive: true });
      return rows.map((r) => ({ value: r.id, label: r.name }));
    }
    case "facility": {
      const rows = await listFacilities(client, { includeInactive: true });
      return rows.map((r) => ({ value: r.id, label: r.name }));
    }
  }
}
