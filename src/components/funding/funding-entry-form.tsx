"use client";

import * as React from "react";
import {
  CalendarRangeIcon,
  HashIcon,
  LandmarkIcon,
  ReceiptTextIcon,
  SaveIcon,
  StickyNoteIcon,
  type LucideIcon,
} from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Combobox, type ComboboxOption } from "@/components/ui/combobox";
import { Field, FieldDescription, FieldLabel } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import type { Tables } from "@/lib/db/types";
import {
  deriveFiscalPeriod,
  emptyFundingDraft,
  type FundingEntryDraft,
  type FundingEntryFieldErrors,
  type ValidatedFundingEntry,
  validateFundingEntry,
} from "@/lib/funding/validation";

type ReferenceLite = { id: string; name: string };

export type FundingEntryFormProps = {
  mdas: Pick<Tables<"mdas">, "id" | "name" | "abbreviation">[];
  programmeAreas: ReferenceLite[];
  fundingSources: ReferenceLite[];
  initial?: Partial<FundingEntryDraft>;
  /** Server-driven errors mapped to fields after a failed save. */
  serverErrors?: FundingEntryFieldErrors;
  /** Server-level fallback message that doesn't map to a field. */
  serverError?: string | null;
  submitting?: boolean;
  submitLabel?: string;
  cancelHref?: string;
  onCancel?: () => void;
  onSubmit: (values: ValidatedFundingEntry) => void;
};

export function FundingEntryForm({
  mdas,
  programmeAreas,
  fundingSources,
  initial,
  serverErrors,
  serverError,
  submitting,
  submitLabel = "Submit funding entry",
  onCancel,
  onSubmit,
}: FundingEntryFormProps) {
  const [draft, setDraft] = React.useState<FundingEntryDraft>(() => ({
    ...emptyFundingDraft(),
    ...initial,
  }));
  const [errors, setErrors] = React.useState<FundingEntryFieldErrors>({});
  const [touched, setTouched] = React.useState<
    Partial<Record<keyof FundingEntryDraft, boolean>>
  >({});

  React.useEffect(() => {
    if (serverErrors) setErrors((prev) => ({ ...prev, ...serverErrors }));
  }, [serverErrors]);

  const reference = React.useMemo(
    () => ({ programmeAreas, fundingSources }),
    [programmeAreas, fundingSources],
  );

  const period = deriveFiscalPeriod(draft.transaction_date);

  const programmeArea = programmeAreas.find(
    (item) => item.id === draft.programme_area_id,
  );
  const fundingSource = fundingSources.find(
    (item) => item.id === draft.funding_source_id,
  );
  const otherSelected =
    programmeArea?.name?.toLowerCase() === "other" ||
    fundingSource?.name?.toLowerCase() === "other";

  function setField<K extends keyof FundingEntryDraft>(
    key: K,
    value: FundingEntryDraft[K],
  ) {
    setDraft((prev) => ({ ...prev, [key]: value }));
    if (touched[key] || errors[key]) {
      const next = { ...draft, [key]: value };
      const result = validateFundingEntry(next, reference);
      setErrors(result.ok ? {} : result.errors);
    }
  }

  function markTouched(key: keyof FundingEntryDraft) {
    setTouched((prev) => ({ ...prev, [key]: true }));
  }

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const result = validateFundingEntry(draft, reference);
    if (!result.ok) {
      setErrors(result.errors);
      const allTouched = Object.fromEntries(
        Object.keys(result.errors).map((key) => [key, true]),
      ) as Record<keyof FundingEntryDraft, boolean>;
      setTouched((prev) => ({ ...prev, ...allTouched }));
      // Scroll first invalid field into view for long forms.
      requestAnimationFrame(() => {
        const firstInvalid = document.querySelector<HTMLElement>(
          "[aria-invalid='true']",
        );
        firstInvalid?.scrollIntoView({ behavior: "smooth", block: "center" });
        firstInvalid?.focus?.({ preventScroll: true });
      });
      return;
    }
    setErrors({});
    onSubmit(result.values);
  }

  const mdaOptions: ComboboxOption[] = mdas.map((mda) => ({
    value: mda.id,
    label: mda.abbreviation ? `${mda.abbreviation} — ${mda.name}` : mda.name,
  }));
  const programmeOptions: ComboboxOption[] = programmeAreas.map((item) => ({
    value: item.id,
    label: item.name,
  }));
  const fundingOptions: ComboboxOption[] = fundingSources.map((item) => ({
    value: item.id,
    label: item.name,
  }));

  return (
    <form className="flex flex-col gap-0" noValidate onSubmit={handleSubmit}>
      {serverError ? (
        <div className="px-6 pt-6 md:px-10">
          <Alert variant="destructive">
            <AlertTitle>We couldn&rsquo;t save this entry</AlertTitle>
            <AlertDescription>{serverError}</AlertDescription>
          </Alert>
        </div>
      ) : null}

      <FormSection
        eyebrow="01"
        icon={CalendarRangeIcon}
        title="Period & MDA"
        description="The transaction date drives the fiscal year and quarter automatically — submitters never pick the reporting period by hand."
      >
        <div className="grid gap-6 md:grid-cols-2">
          <Field>
            <FieldLabel htmlFor="transaction-date">Transaction date</FieldLabel>
            <Input
              id="transaction-date"
              type="date"
              value={draft.transaction_date}
              onBlur={() => markTouched("transaction_date")}
              onChange={(event) =>
                setField("transaction_date", event.target.value)
              }
              aria-invalid={Boolean(errors.transaction_date) || undefined}
              className="h-11"
            />
            {errors.transaction_date ? (
              <FieldDescription className="text-status-rejected">
                {errors.transaction_date}
              </FieldDescription>
            ) : (
              <FieldDescription>
                The day the funds were received by the MDA.
              </FieldDescription>
            )}
          </Field>

          <Field>
            <FieldLabel>Fiscal period</FieldLabel>
            <div
              className={cn(
                "flex h-11 items-center gap-2.5 rounded-md border px-3.5 text-sm",
                period
                  ? "border-status-approved/30 bg-status-approved-bg/60 text-status-approved"
                  : "border-dashed bg-muted/40 text-muted-foreground",
              )}
            >
              <CalendarRangeIcon
                aria-hidden="true"
                className="size-4 shrink-0"
              />
              {period ? (
                <span className="flex items-baseline gap-2 font-medium tabular-nums">
                  <span>FY {period.fiscal_year}</span>
                  <span className="text-status-approved/60">·</span>
                  <span>Q{period.quarter}</span>
                </span>
              ) : (
                <span>Pick a transaction date.</span>
              )}
            </div>
            <FieldDescription>
              Derived from transaction date. Read-only.
            </FieldDescription>
          </Field>
        </div>

        <Field>
          <FieldLabel htmlFor="mda">MDA</FieldLabel>
          <Combobox
            id="mda"
            options={mdaOptions}
            placeholder={
              mdaOptions.length === 0
                ? "No assigned MDAs available"
                : "Select MDA"
            }
            value={draft.mda_id || undefined}
            onValueChange={(value) => {
              markTouched("mda_id");
              setField("mda_id", value);
            }}
            disabled={mdaOptions.length === 0}
          />
          {errors.mda_id ? (
            <FieldDescription className="text-status-rejected">
              {errors.mda_id}
            </FieldDescription>
          ) : (
            <FieldDescription>
              Submitters can only pick MDAs they hold a submitter membership for.
              Admins see every MDA.
            </FieldDescription>
          )}
        </Field>
      </FormSection>

      <FormSection
        eyebrow="02"
        icon={LandmarkIcon}
        title="Classification"
        description="Programme area and funding source determine how this receipt rolls up into sector reporting and budget-vs-actual views."
      >
        <div className="grid gap-6 md:grid-cols-2">
          <Field>
            <FieldLabel htmlFor="programme-area">Programme Area</FieldLabel>
            <Combobox
              id="programme-area"
              options={programmeOptions}
              placeholder="Select Programme Area"
              value={draft.programme_area_id || undefined}
              onValueChange={(value) => {
                markTouched("programme_area_id");
                setField("programme_area_id", value);
              }}
            />
            {errors.programme_area_id ? (
              <FieldDescription className="text-status-rejected">
                {errors.programme_area_id}
              </FieldDescription>
            ) : (
              <FieldDescription>
                Choose the closest health-sector programme this funding belongs to.
              </FieldDescription>
            )}
          </Field>

          <Field>
            <FieldLabel htmlFor="funding-source">Funding Source</FieldLabel>
            <Combobox
              id="funding-source"
              options={fundingOptions}
              placeholder="Select Funding Source"
              value={draft.funding_source_id || undefined}
              onValueChange={(value) => {
                markTouched("funding_source_id");
                setField("funding_source_id", value);
              }}
            />
            {errors.funding_source_id ? (
              <FieldDescription className="text-status-rejected">
                {errors.funding_source_id}
              </FieldDescription>
            ) : (
              <FieldDescription>
                BHCPF, donor, IGR, federal grant, or another approved source.
              </FieldDescription>
            )}
          </Field>
        </div>
        {otherSelected ? (
          <div className="rounded-md border border-status-pending/30 bg-status-pending-bg px-4 py-3 text-sm text-status-pending">
            <strong className="font-semibold">Other selected.</strong>{" "}
            Reviewers will need a remark below to interpret this entry.
          </div>
        ) : null}
      </FormSection>

      <FormSection
        eyebrow="03"
        icon={ReceiptTextIcon}
        title="Financial traceability"
        description="The reference number must be unique within this MDA and fiscal year so the same receipt can never be counted twice."
      >
        <div className="grid gap-6 md:grid-cols-2">
          <Field>
            <FieldLabel htmlFor="amount">Money Amount</FieldLabel>
            <div className="relative">
              <span
                aria-hidden="true"
                className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-sm font-medium text-muted-foreground"
              >
                ₦
              </span>
              <Input
                id="amount"
                inputMode="decimal"
                placeholder="0.00"
                value={draft.amount}
                onBlur={() => markTouched("amount")}
                onChange={(event) => setField("amount", event.target.value)}
                aria-invalid={Boolean(errors.amount) || undefined}
                className="h-11 pl-7 tabular-nums"
              />
            </div>
            {errors.amount ? (
              <FieldDescription className="text-status-rejected">
                {errors.amount}
              </FieldDescription>
            ) : (
              <FieldDescription>
                Positive Nigerian naira amount. No currency symbol or commas.
              </FieldDescription>
            )}
          </Field>

          <Field>
            <FieldLabel htmlFor="reference-no">Reference Number</FieldLabel>
            <div className="relative">
              <HashIcon
                aria-hidden="true"
                className="pointer-events-none absolute inset-y-0 left-3 my-auto size-4 text-muted-foreground"
              />
              <Input
                id="reference-no"
                placeholder="REF-2026-001"
                value={draft.reference_no}
                onBlur={() => markTouched("reference_no")}
                onChange={(event) =>
                  setField("reference_no", event.target.value)
                }
                aria-invalid={Boolean(errors.reference_no) || undefined}
                className="h-11 pl-9 font-mono"
              />
            </div>
            {errors.reference_no ? (
              <FieldDescription className="text-status-rejected">
                {errors.reference_no}
              </FieldDescription>
            ) : (
              <FieldDescription>
                Unique per fiscal year and MDA. Use your internal release or
                deposit reference.
              </FieldDescription>
            )}
          </Field>
        </div>
      </FormSection>

      <FormSection
        eyebrow="04"
        icon={StickyNoteIcon}
        title="Notes & remarks"
        description="Required when Programme Area or Funding Source is set to Other. Otherwise optional context for reviewers."
        last
      >
        <Field>
          <FieldLabel htmlFor="remarks" className="flex items-center gap-2">
            Remarks
            {otherSelected ? (
              <span className="rounded-full border border-status-pending/30 bg-status-pending-bg px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-status-pending">
                Required for Other
              </span>
            ) : (
              <span className="text-xs font-normal text-muted-foreground">
                Optional
              </span>
            )}
          </FieldLabel>
          <Textarea
            id="remarks"
            placeholder={
              otherSelected
                ? "Explain the Other selection so reviewers can interpret this entry."
                : "Anything a reviewer should know — release memo, conditions, donor specifics, etc."
            }
            value={draft.remarks}
            onBlur={() => markTouched("remarks")}
            onChange={(event) => setField("remarks", event.target.value)}
            aria-invalid={Boolean(errors.remarks) || undefined}
            className="min-h-32"
          />
          {errors.remarks ? (
            <FieldDescription className="text-status-rejected">
              {errors.remarks}
            </FieldDescription>
          ) : null}
        </Field>
      </FormSection>

      <div className="sticky bottom-0 z-10 flex flex-col gap-3 border-t bg-background/95 px-6 py-4 backdrop-blur md:flex-row md:items-center md:justify-between md:px-10 supports-[backdrop-filter]:bg-background/85">
        <p className="text-xs text-muted-foreground">
          Submitted entries enter the <span className="font-medium text-status-pending">pending</span>{" "}
          queue and remain editable until a reviewer acts.
        </p>
        <div className="flex items-center justify-end gap-2">
          {onCancel ? (
            <Button
              disabled={submitting}
              type="button"
              variant="outline"
              onClick={onCancel}
            >
              Cancel
            </Button>
          ) : null}
          <Button disabled={submitting} type="submit">
            <SaveIcon aria-hidden="true" data-icon="inline-start" />
            {submitting ? "Saving…" : submitLabel}
          </Button>
        </div>
      </div>
    </form>
  );
}

function FormSection({
  eyebrow,
  icon: Icon,
  title,
  description,
  children,
  last,
}: {
  eyebrow: string;
  icon: LucideIcon;
  title: string;
  description: string;
  children: React.ReactNode;
  last?: boolean;
}) {
  return (
    <section
      className={cn(
        "grid gap-8 px-6 py-10 md:px-10 lg:grid-cols-[18rem_minmax(0,1fr)] lg:gap-14",
        !last && "border-b",
      )}
    >
      <header className="flex flex-col gap-3">
        <div className="flex items-center gap-3">
          <span className="flex size-9 items-center justify-center rounded-md bg-status-approved-bg text-status-approved ring-1 ring-status-approved/15">
            <Icon aria-hidden="true" className="size-4" />
          </span>
          <span className="font-mono text-[11px] font-semibold uppercase tracking-[0.18em] text-status-approved">
            {eyebrow}
          </span>
        </div>
        <h2 className="text-base font-semibold leading-tight text-foreground">
          {title}
        </h2>
        <p className="text-sm leading-relaxed text-muted-foreground">
          {description}
        </p>
      </header>
      <div className="flex flex-col gap-7">{children}</div>
    </section>
  );
}
