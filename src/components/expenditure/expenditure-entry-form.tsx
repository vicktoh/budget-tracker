"use client";

import * as React from "react";
import {
  CalendarRangeIcon,
  HashIcon,
  HospitalIcon,
  LandmarkIcon,
  LockIcon,
  ReceiptTextIcon,
  SaveIcon,
  StickyNoteIcon,
  WalletIcon,
  type LucideIcon,
} from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Combobox, type ComboboxOption } from "@/components/ui/combobox";
import { Field, FieldDescription, FieldLabel } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import type { Tables } from "@/lib/db/types";
import {
  deriveFiscalPeriod,
  emptyExpenditureDraft,
  type ExpenditureEntryDraft,
  type ExpenditureEntryFieldErrors,
  type ExpenditureValidationReference,
  type ValidatedExpenditureEntry,
  validateExpenditureEntry,
} from "@/lib/expenditure/validation";

type ReferenceLite = { id: string; name: string };

type FacilityLite = {
  id: string;
  name: string;
  lga_id: string;
  facility_type: string;
};

type ExpenditureItemLite = {
  id: string;
  name: string;
  expenditure_category_id: string | null;
};

type AopActivityLite = {
  id: string;
  activity_code: string;
  description: string;
  mda_id: string;
  fiscal_year: number;
};

/**
 * When set, the form runs in facility-user mode: PHC is forced on and the MDA,
 * LGA, and Facility are locked to the user's assignment. `facilities` should
 * already be narrowed to the user's assigned facilities. A single facility is
 * fully locked; multiple facilities present a constrained picker. The server
 * (RLS + trigger) is the real authority — these locks are just the matching UI.
 */
export type ExpenditureFacilityScope = {
  mdaId: string;
};

export type ExpenditureEntryFormProps = {
  mdas: Pick<Tables<"mdas">, "id" | "name" | "abbreviation">[];
  programmeAreas: ReferenceLite[];
  expenditureCategories: ReferenceLite[];
  expenditureItems: ExpenditureItemLite[];
  paymentMethods: ReferenceLite[];
  lgas: ReferenceLite[];
  facilities: FacilityLite[];
  aopActivities: AopActivityLite[];
  initial?: Partial<ExpenditureEntryDraft>;
  serverErrors?: ExpenditureEntryFieldErrors;
  serverError?: string | null;
  submitting?: boolean;
  submitLabel?: string;
  facilityScope?: ExpenditureFacilityScope;
  onCancel?: () => void;
  onSubmit: (values: ValidatedExpenditureEntry) => void;
};

export function ExpenditureEntryForm({
  mdas,
  programmeAreas,
  expenditureCategories,
  expenditureItems,
  paymentMethods,
  lgas,
  facilities,
  aopActivities,
  initial,
  serverErrors,
  serverError,
  submitting,
  submitLabel = "Submit expenditure entry",
  facilityScope,
  onCancel,
  onSubmit,
}: ExpenditureEntryFormProps) {
  const facilityLocked = Boolean(facilityScope);
  const [draft, setDraft] = React.useState<ExpenditureEntryDraft>(() => {
    const base = { ...emptyExpenditureDraft(), ...initial };
    if (facilityScope) {
      base.is_phc = true;
      base.mda_id = facilityScope.mdaId;
      // With a single assigned facility, lock both facility and its LGA up front.
      if (facilities.length === 1 && !base.facility_id) {
        base.facility_id = facilities[0].id;
        base.lga_id = facilities[0].lga_id;
      }
    }
    return base;
  });
  const [errors, setErrors] = React.useState<ExpenditureEntryFieldErrors>({});
  const [touched, setTouched] = React.useState<
    Partial<Record<keyof ExpenditureEntryDraft, boolean>>
  >({});

  React.useEffect(() => {
    if (serverErrors) setErrors((prev) => ({ ...prev, ...serverErrors }));
  }, [serverErrors]);

  const reference: ExpenditureValidationReference = React.useMemo(
    () => ({
      programmeAreas,
      expenditureCategories,
      expenditureItems: expenditureItems.map((item) => ({
        id: item.id,
        expenditure_category_id: item.expenditure_category_id,
      })),
      paymentMethods,
      facilities: facilities.map((f) => ({
        id: f.id,
        lga_id: f.lga_id,
        facility_type: f.facility_type,
      })),
      aopActivities: aopActivities.map((a) => ({
        id: a.id,
        mda_id: a.mda_id,
        fiscal_year: a.fiscal_year,
      })),
    }),
    [
      programmeAreas,
      expenditureCategories,
      expenditureItems,
      paymentMethods,
      facilities,
      aopActivities,
    ],
  );

  const period = deriveFiscalPeriod(draft.transaction_date);

  const programmeArea = programmeAreas.find(
    (item) => item.id === draft.programme_area_id,
  );
  const category = expenditureCategories.find(
    (item) => item.id === draft.expenditure_category_id,
  );
  const paymentMethod = paymentMethods.find(
    (item) => item.id === draft.payment_method_id,
  );
  const otherSelected =
    programmeArea?.name?.toLowerCase() === "other" ||
    category?.name?.toLowerCase() === "other" ||
    paymentMethod?.name?.toLowerCase() === "other";

  // Filter Expenditure Items by selected category.
  const filteredItems = React.useMemo(() => {
    if (!draft.expenditure_category_id) return expenditureItems;
    return expenditureItems.filter(
      (item) =>
        !item.expenditure_category_id ||
        item.expenditure_category_id === draft.expenditure_category_id,
    );
  }, [expenditureItems, draft.expenditure_category_id]);

  // Filter Facilities by selected LGA.
  const filteredFacilities = React.useMemo(() => {
    if (!draft.lga_id) return facilities;
    return facilities.filter((f) => f.lga_id === draft.lga_id);
  }, [facilities, draft.lga_id]);

  // Filter AOP Activities by MDA + fiscal year.
  const filteredAopActivities = React.useMemo(() => {
    return aopActivities.filter((a) => {
      if (draft.mda_id && a.mda_id !== draft.mda_id) return false;
      if (period && a.fiscal_year !== period.fiscal_year) return false;
      return true;
    });
  }, [aopActivities, draft.mda_id, period]);

  function setField<K extends keyof ExpenditureEntryDraft>(
    key: K,
    value: ExpenditureEntryDraft[K],
  ) {
    setDraft((prev) => {
      const next = { ...prev, [key]: value };
      // Conditional cascades.
      if (key === "is_phc" && value === false) {
        next.lga_id = "";
        next.facility_id = "";
      }
      if (key === "lga_id") {
        const facility = facilities.find((f) => f.id === next.facility_id);
        if (facility && facility.lga_id !== value) {
          next.facility_id = "";
        }
      }
      // Facility-user mode: choosing a facility auto-derives its LGA, and PHC
      // can never be turned off.
      if (facilityLocked && key === "facility_id") {
        const facility = facilities.find((f) => f.id === value);
        next.lga_id = facility?.lga_id ?? "";
      }
      if (facilityLocked && key === "is_phc") {
        next.is_phc = true;
      }
      if (key === "expenditure_category_id") {
        const item = expenditureItems.find(
          (i) => i.id === next.expenditure_item_id,
        );
        if (
          item &&
          item.expenditure_category_id &&
          item.expenditure_category_id !== value
        ) {
          next.expenditure_item_id = "";
        }
      }
      if (key === "mda_id" || key === "transaction_date") {
        const activity = aopActivities.find(
          (a) => a.id === next.aop_activity_id,
        );
        if (activity) {
          const nextPeriod = deriveFiscalPeriod(next.transaction_date);
          if (
            (next.mda_id && activity.mda_id !== next.mda_id) ||
            (nextPeriod && activity.fiscal_year !== nextPeriod.fiscal_year)
          ) {
            next.aop_activity_id = "";
          }
        }
      }
      return next;
    });
    if (touched[key] || errors[key]) {
      const next = { ...draft, [key]: value };
      const result = validateExpenditureEntry(next, reference);
      setErrors(result.ok ? {} : result.errors);
    }
  }

  function markTouched(key: keyof ExpenditureEntryDraft) {
    setTouched((prev) => ({ ...prev, [key]: true }));
  }

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const result = validateExpenditureEntry(draft, reference);
    if (!result.ok) {
      setErrors(result.errors);
      const allTouched = Object.fromEntries(
        Object.keys(result.errors).map((key) => [key, true]),
      ) as Record<keyof ExpenditureEntryDraft, boolean>;
      setTouched((prev) => ({ ...prev, ...allTouched }));
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
  const categoryOptions: ComboboxOption[] = expenditureCategories.map((item) => ({
    value: item.id,
    label: item.name,
  }));
  const itemOptions: ComboboxOption[] = filteredItems.map((item) => ({
    value: item.id,
    label: item.name,
  }));
  const paymentMethodOptions: ComboboxOption[] = paymentMethods.map((item) => ({
    value: item.id,
    label: item.name,
  }));
  const lgaOptions: ComboboxOption[] = lgas.map((item) => ({
    value: item.id,
    label: item.name,
  }));
  const facilityOptions: ComboboxOption[] = filteredFacilities.map((item) => ({
    value: item.id,
    label: `${item.name} · ${item.facility_type}`,
  }));
  const aopOptions: ComboboxOption[] = filteredAopActivities.map((a) => ({
    value: a.id,
    label: `${a.activity_code} — ${a.description}`,
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
                The day the expenditure was paid by the MDA.
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
          {facilityLocked ? (
            <LockedValue
              label={
                mdas.find((m) => m.id === draft.mda_id)?.name ?? "Assigned MDA"
              }
            />
          ) : (
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
          )}
          {errors.mda_id ? (
            <FieldDescription className="text-status-rejected">
              {errors.mda_id}
            </FieldDescription>
          ) : (
            <FieldDescription>
              {facilityLocked
                ? "Locked to the MDA your facility reports under."
                : "Submitters can only pick MDAs they hold a submitter membership for. Admins see every MDA."}
            </FieldDescription>
          )}
        </Field>
      </FormSection>

      <FormSection
        eyebrow="02"
        icon={LandmarkIcon}
        title="Classification"
        description="Programme area and expenditure category determine how this spend rolls up into sector reporting and budget-vs-actual views. Optional AOP linkage and Expenditure Item add further detail."
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
                Health-sector programme this spend belongs to.
              </FieldDescription>
            )}
          </Field>

          <Field>
            <FieldLabel htmlFor="expenditure-category">
              Expenditure Category
            </FieldLabel>
            <Combobox
              id="expenditure-category"
              options={categoryOptions}
              placeholder="Select Expenditure Category"
              value={draft.expenditure_category_id || undefined}
              onValueChange={(value) => {
                markTouched("expenditure_category_id");
                setField("expenditure_category_id", value);
              }}
            />
            {errors.expenditure_category_id ? (
              <FieldDescription className="text-status-rejected">
                {errors.expenditure_category_id}
              </FieldDescription>
            ) : (
              <FieldDescription>
                Personnel, drugs, capital works, training, or another approved category.
              </FieldDescription>
            )}
          </Field>
        </div>

        <div className="grid gap-6 md:grid-cols-2">
          <Field>
            <FieldLabel htmlFor="expenditure-item" className="flex items-center gap-2">
              Expenditure Item
              <span className="text-xs font-normal text-muted-foreground">
                Optional
              </span>
            </FieldLabel>
            <Combobox
              id="expenditure-item"
              options={itemOptions}
              placeholder={
                draft.expenditure_category_id
                  ? "Select expenditure item"
                  : "Pick a category first"
              }
              value={draft.expenditure_item_id || undefined}
              onValueChange={(value) => {
                markTouched("expenditure_item_id");
                setField("expenditure_item_id", value);
              }}
              disabled={!draft.expenditure_category_id}
            />
            {errors.expenditure_item_id ? (
              <FieldDescription className="text-status-rejected">
                {errors.expenditure_item_id}
              </FieldDescription>
            ) : (
              <FieldDescription>
                Filtered by selected expenditure category.
              </FieldDescription>
            )}
          </Field>

          <Field>
            <FieldLabel htmlFor="aop-activity" className="flex items-center gap-2">
              AOP Activity
              <span className="text-xs font-normal text-muted-foreground">
                Optional
              </span>
            </FieldLabel>
            <Combobox
              id="aop-activity"
              options={aopOptions}
              placeholder={
                draft.mda_id && period
                  ? aopOptions.length
                    ? "Link to AOP activity"
                    : "No AOP activities for this MDA / FY"
                  : "Pick MDA and date first"
              }
              value={draft.aop_activity_id || undefined}
              onValueChange={(value) => {
                markTouched("aop_activity_id");
                setField("aop_activity_id", value);
              }}
              disabled={
                !draft.mda_id || !period || aopOptions.length === 0
              }
            />
            {errors.aop_activity_id ? (
              <FieldDescription className="text-status-rejected">
                {errors.aop_activity_id}
              </FieldDescription>
            ) : (
              <FieldDescription>
                Filtered by selected MDA and fiscal year.
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
        icon={HospitalIcon}
        title="PHC location"
        description={
          facilityLocked
            ? "This entry is locked to your assigned facility. The LGA is derived from the facility and cannot be changed."
            : "Toggle PHC on for primary health care expenditure. PHC entries require both an LGA and a PHC-classified facility — non-PHC entries clear them automatically."
        }
      >
        {facilityLocked ? (
          <div className="flex flex-col gap-6">
            <div className="flex items-center gap-2.5 rounded-md border border-status-approved/30 bg-status-approved-bg/60 px-4 py-3 text-sm text-status-approved">
              <LockIcon aria-hidden="true" className="size-4 shrink-0" />
              <span className="font-medium">
                PHC expenditure — locked on for facility users.
              </span>
            </div>
            <div className="grid gap-6 md:grid-cols-2">
              <Field>
                <FieldLabel htmlFor="facility">PHC Facility</FieldLabel>
                {facilities.length === 1 ? (
                  <LockedValue
                    label={facilities[0]?.name ?? "Assigned facility"}
                  />
                ) : (
                  <Combobox
                    id="facility"
                    options={facilityOptions}
                    placeholder="Select your facility"
                    value={draft.facility_id || undefined}
                    onValueChange={(value) => {
                      markTouched("facility_id");
                      setField("facility_id", value);
                    }}
                  />
                )}
                {errors.facility_id ? (
                  <FieldDescription className="text-status-rejected">
                    {errors.facility_id}
                  </FieldDescription>
                ) : (
                  <FieldDescription>
                    {facilities.length === 1
                      ? "Locked to your assigned facility."
                      : "Choose from the facilities assigned to you."}
                  </FieldDescription>
                )}
              </Field>
              <Field>
                <FieldLabel>LGA</FieldLabel>
                <LockedValue
                  label={
                    lgas.find((l) => l.id === draft.lga_id)?.name ??
                    "Derived from facility"
                  }
                />
                <FieldDescription>
                  Derived from the selected facility. Read-only.
                </FieldDescription>
              </Field>
            </div>
          </div>
        ) : (
        <>
        <div className="flex items-start justify-between gap-6 rounded-md border bg-muted/30 px-4 py-3">
          <div className="flex flex-col gap-1">
            <span className="text-sm font-medium text-foreground">
              This is PHC expenditure
            </span>
            <span className="text-xs text-muted-foreground">
              Routes the entry through the PHC LGA / facility validation chain.
            </span>
          </div>
          <Switch
            checked={draft.is_phc}
            onCheckedChange={(checked) => {
              markTouched("is_phc");
              setField("is_phc", checked);
            }}
            label="PHC expenditure"
          />
        </div>

        {draft.is_phc ? (
          <div className="grid gap-6 md:grid-cols-2">
            <Field>
              <FieldLabel htmlFor="lga">LGA</FieldLabel>
              <Combobox
                id="lga"
                options={lgaOptions}
                placeholder="Select LGA"
                value={draft.lga_id || undefined}
                onValueChange={(value) => {
                  markTouched("lga_id");
                  setField("lga_id", value);
                }}
              />
              {errors.lga_id ? (
                <FieldDescription className="text-status-rejected">
                  {errors.lga_id}
                </FieldDescription>
              ) : (
                <FieldDescription>
                  Local Government Area where the facility operates.
                </FieldDescription>
              )}
            </Field>
            <Field>
              <FieldLabel htmlFor="facility">PHC Facility</FieldLabel>
              <Combobox
                id="facility"
                options={facilityOptions}
                placeholder={
                  draft.lga_id
                    ? "Select PHC facility"
                    : "Pick an LGA first"
                }
                value={draft.facility_id || undefined}
                onValueChange={(value) => {
                  markTouched("facility_id");
                  setField("facility_id", value);
                }}
                disabled={!draft.lga_id}
              />
              {errors.facility_id ? (
                <FieldDescription className="text-status-rejected">
                  {errors.facility_id}
                </FieldDescription>
              ) : (
                <FieldDescription>
                  Filtered by LGA. Must be a PHC-classified facility.
                </FieldDescription>
              )}
            </Field>
          </div>
        ) : (
          <p className="text-xs text-muted-foreground">
            Non-PHC entry — LGA and facility are not required.
          </p>
        )}
        </>
        )}
      </FormSection>

      <FormSection
        eyebrow="04"
        icon={ReceiptTextIcon}
        title="Financial traceability"
        description="The voucher reference number must be unique within this MDA and fiscal year so the same voucher can never be counted twice."
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
            <FieldLabel htmlFor="voucher-ref-no">
              Voucher Reference Number
            </FieldLabel>
            <div className="relative">
              <HashIcon
                aria-hidden="true"
                className="pointer-events-none absolute inset-y-0 left-3 my-auto size-4 text-muted-foreground"
              />
              <Input
                id="voucher-ref-no"
                placeholder="VCH-2026-001"
                value={draft.voucher_ref_no}
                onBlur={() => markTouched("voucher_ref_no")}
                onChange={(event) =>
                  setField("voucher_ref_no", event.target.value)
                }
                aria-invalid={Boolean(errors.voucher_ref_no) || undefined}
                className="h-11 pl-9 font-mono"
              />
            </div>
            {errors.voucher_ref_no ? (
              <FieldDescription className="text-status-rejected">
                {errors.voucher_ref_no}
              </FieldDescription>
            ) : (
              <FieldDescription>
                Unique per fiscal year and MDA. Use your internal voucher number.
              </FieldDescription>
            )}
          </Field>
        </div>

        <Field>
          <FieldLabel htmlFor="payment-method" className="flex items-center gap-2">
            <WalletIcon aria-hidden="true" className="size-4" /> Payment Method
          </FieldLabel>
          <Combobox
            id="payment-method"
            options={paymentMethodOptions}
            placeholder="Select payment method"
            value={draft.payment_method_id || undefined}
            onValueChange={(value) => {
              markTouched("payment_method_id");
              setField("payment_method_id", value);
            }}
          />
          {errors.payment_method_id ? (
            <FieldDescription className="text-status-rejected">
              {errors.payment_method_id}
            </FieldDescription>
          ) : (
            <FieldDescription>
              Bank transfer, cheque, cash advance, or another approved method.
            </FieldDescription>
          )}
        </Field>
      </FormSection>

      <FormSection
        eyebrow="05"
        icon={StickyNoteIcon}
        title="Notes & remarks"
        description="Required when Programme Area, Expenditure Category, or Payment Method is set to Other. Otherwise optional context for reviewers."
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
                : "Anything a reviewer should know — voucher details, conditions, supplier specifics, etc."
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
          Submitted entries enter the{" "}
          <span className="font-medium text-status-pending">pending</span>{" "}
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

function LockedValue({ label }: { label: string }) {
  return (
    <div className="flex h-11 items-center gap-2.5 rounded-md border border-dashed bg-muted/40 px-3.5 text-sm text-foreground">
      <LockIcon aria-hidden="true" className="size-4 shrink-0 text-muted-foreground" />
      <span className="font-medium">{label}</span>
    </div>
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
