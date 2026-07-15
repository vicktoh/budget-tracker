"use client";

import * as React from "react";
import { SendIcon } from "lucide-react";
import { toast } from "sonner";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Combobox, type ComboboxOption } from "@/components/ui/combobox";
import {
  Field,
  FieldDescription,
  FieldLabel,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { insertReferenceRequest } from "@/lib/db/reference-requests";
import {
  listExpenditureCategories,
  listLgas,
  listMdas,
} from "@/lib/db/reference-data";
import {
  REFERENCE_KIND_ORDER,
  REFERENCE_REGISTRY,
  type ReferenceKind,
} from "@/lib/reference/types";
import {
  validateReferenceRequestDraft,
  type ReferenceRequestDraft,
  type ReferenceRequestFieldErrors,
} from "@/lib/reference/requests";
import type { TypedSupabaseClient } from "@/lib/supabase/client";

const KIND_OPTIONS: ComboboxOption[] = REFERENCE_KIND_ORDER.map((kind) => ({
  value: kind,
  label: REFERENCE_REGISTRY[kind].singular,
  description: REFERENCE_REGISTRY[kind].description,
}));

export function ReferenceRequestForm({
  client,
  requesterId,
  onCreated,
}: {
  client: TypedSupabaseClient;
  requesterId: string;
  onCreated?: () => void;
}) {
  const [draft, setDraft] = React.useState<ReferenceRequestDraft>({
    reference_type: "",
    requested_label: "",
    description: "",
    related_mda_id: null,
    related_lga_id: null,
    related_category_id: null,
  });
  const [errors, setErrors] = React.useState<ReferenceRequestFieldErrors>({});
  const [submitting, setSubmitting] = React.useState(false);
  const [serverError, setServerError] = React.useState<string | null>(null);

  const [mdas, setMdas] = React.useState<ComboboxOption[]>([]);
  const [lgas, setLgas] = React.useState<ComboboxOption[]>([]);
  const [categories, setCategories] = React.useState<ComboboxOption[]>([]);

  React.useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const [m, l, c] = await Promise.all([
          listMdas(client),
          listLgas(client),
          listExpenditureCategories(client),
        ]);
        if (!alive) return;
        setMdas(
          m.map((row) => ({
            value: row.id,
            label: row.abbreviation
              ? `${row.abbreviation} — ${row.name}`
              : row.name,
          })),
        );
        setLgas(l.map((row) => ({ value: row.id, label: row.name })));
        setCategories(
          c.map((row) => ({ value: row.id, label: row.name })),
        );
      } catch {
        // Non-fatal: optional context dropdowns simply stay empty.
      }
    })();
    return () => {
      alive = false;
    };
  }, [client]);

  const kind = draft.reference_type as ReferenceKind | "";
  const showCategory = kind === "expenditure_item";
  const showLga = kind === "facility";

  function setField<K extends keyof ReferenceRequestDraft>(
    key: K,
    value: ReferenceRequestDraft[K],
  ) {
    setDraft((d) => ({ ...d, [key]: value }));
    setErrors((e) => ({ ...e, [key]: undefined }));
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setServerError(null);
    const result = validateReferenceRequestDraft(draft);
    if (!result.ok) {
      setErrors(result.errors);
      return;
    }
    setSubmitting(true);
    try {
      await insertReferenceRequest(client, {
        requestedBy: requesterId,
        values: result.values,
      });
      toast.success(
        "Request submitted. An admin will review it and let you know.",
      );
      setDraft({
        reference_type: "",
        requested_label: "",
        description: "",
        related_mda_id: null,
        related_lga_id: null,
        related_category_id: null,
      });
      onCreated?.();
    } catch (err) {
      setServerError(
        err instanceof Error ? err.message : "Failed to submit request.",
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Request a reference value</CardTitle>
        <CardDescription>
          Don&rsquo;t see the value you need in a dropdown? Tell an admin what
          should be added. They&rsquo;ll either approve and add it, or reply
          with why it wasn&rsquo;t added.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form className="flex flex-col gap-5" onSubmit={handleSubmit}>
          {serverError ? (
            <Alert variant="destructive">
              <AlertTitle>We couldn&rsquo;t submit this request</AlertTitle>
              <AlertDescription>{serverError}</AlertDescription>
            </Alert>
          ) : null}

          <div className="grid gap-5 md:grid-cols-2">
            <Field>
              <FieldLabel htmlFor="ref-req-type">What needs adding?</FieldLabel>
              <Combobox
                id="ref-req-type"
                options={KIND_OPTIONS}
                placeholder="Select a kind"
                value={draft.reference_type || undefined}
                onValueChange={(value) =>
                  setField("reference_type", value as ReferenceKind)
                }
              />
              {errors.reference_type ? (
                <FieldDescription className="text-status-rejected">
                  {errors.reference_type}
                </FieldDescription>
              ) : null}
            </Field>

            <Field>
              <FieldLabel htmlFor="ref-req-label">Value</FieldLabel>
              <Input
                id="ref-req-label"
                value={draft.requested_label}
                onChange={(e) => setField("requested_label", e.target.value)}
                placeholder="e.g. Mobile Money Voucher"
                aria-invalid={Boolean(errors.requested_label)}
              />
              {errors.requested_label ? (
                <FieldDescription className="text-status-rejected">
                  {errors.requested_label}
                </FieldDescription>
              ) : null}
            </Field>
          </div>

          {showCategory ? (
            <Field>
              <FieldLabel htmlFor="ref-req-category">
                Expenditure category
              </FieldLabel>
              <Combobox
                id="ref-req-category"
                options={categories}
                placeholder="Pick the parent category"
                value={draft.related_category_id ?? undefined}
                onValueChange={(value) => setField("related_category_id", value)}
              />
              {errors.related_category_id ? (
                <FieldDescription className="text-status-rejected">
                  {errors.related_category_id}
                </FieldDescription>
              ) : null}
            </Field>
          ) : null}

          {showLga ? (
            <Field>
              <FieldLabel htmlFor="ref-req-lga">LGA</FieldLabel>
              <Combobox
                id="ref-req-lga"
                options={lgas}
                placeholder="Pick the LGA this facility belongs to"
                value={draft.related_lga_id ?? undefined}
                onValueChange={(value) => setField("related_lga_id", value)}
              />
              {errors.related_lga_id ? (
                <FieldDescription className="text-status-rejected">
                  {errors.related_lga_id}
                </FieldDescription>
              ) : null}
            </Field>
          ) : null}

          <Field>
            <FieldLabel htmlFor="ref-req-mda">Related MDA (optional)</FieldLabel>
            <Combobox
              id="ref-req-mda"
              options={mdas}
              placeholder="If this is for a specific MDA"
              value={draft.related_mda_id ?? undefined}
              onValueChange={(value) => setField("related_mda_id", value)}
            />
          </Field>

          <Field>
            <FieldLabel htmlFor="ref-req-desc">Why is it needed?</FieldLabel>
            <Textarea
              id="ref-req-desc"
              value={draft.description ?? ""}
              onChange={(e) => setField("description", e.target.value)}
              placeholder="A short note helps viewers approve faster."
              rows={3}
            />
          </Field>

          <div className="flex justify-end">
            <Button type="submit" disabled={submitting}>
              <SendIcon aria-hidden="true" data-icon="inline-start" />
              {submitting ? "Submitting…" : "Submit request"}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
