"use client";

import * as React from "react";
import {
  CalendarRangeIcon,
  FileTextIcon,
  HashIcon,
  HospitalIcon,
  LandmarkIcon,
  LockIcon,
  PlusIcon,
  ReceiptTextIcon,
  SaveIcon,
  StickyNoteIcon,
  Trash2Icon,
  WalletIcon,
  type LucideIcon,
} from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Combobox, type ComboboxOption } from "@/components/ui/combobox";
import { FileUpload } from "@/components/ui/file-upload";
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
import {
  allocationRemainingAmount,
  emptyFundingAllocationDraft,
  type FundingAllocationDraft,
  type FundingOverAllocationWarning,
} from "@/lib/expenditure/funding-allocations";

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

type ApprovedBudgetLineLite = {
  id: string;
  mda_id: string;
  fiscal_year: number;
  budget_class: "personnel" | "overhead" | "capital";
  economic_code: string;
  economic_description: string;
  project_description: string | null;
  approved_amount: number;
};

/**
 * Maps a workbook budget class to the seeded expenditure-category name it rolls
 * up under. Selecting a budget line auto-fills and locks the category so the
 * line and category can never disagree.
 */
const BUDGET_CLASS_CATEGORY_NAME: Record<
  ApprovedBudgetLineLite["budget_class"],
  string
> = {
  personnel: "personnel costs",
  overhead: "overhead / running costs",
  capital: "capital expenditure",
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

export type ExpenditureVoucherAttachment = {
  file: File;
};

export type ExpenditureEntryFormProps = {
  mdas: Pick<Tables<"mdas">, "id" | "name" | "abbreviation">[];
  programmeAreas: ReferenceLite[];
  expenditureCategories: ReferenceLite[];
  expenditureItems: ExpenditureItemLite[];
  paymentMethods: ReferenceLite[];
  fundingSources: ReferenceLite[];
  unspecifiedFundingSourceId?: string | null;
  lgas: ReferenceLite[];
  facilities: FacilityLite[];
  aopActivities: AopActivityLite[];
  approvedBudgetLines?: ApprovedBudgetLineLite[];
  /** Funding source that represents the state appropriation (Kano State Govt
   * Budget Release). When any allocation uses it, the Expenditure Item field
   * becomes a picker over that MDA/year's approved budget lines. */
  stateBudgetFundingSourceId?: string | null;
  /** Resolves committed spend against a budget line so the form can warn when an
   * entry would push the line over its approved amount. Soft, non-blocking. */
  evaluateBudgetLineBalance?: (
    lineId: string,
  ) => Promise<{ approved_amount: number; spent_amount: number }>;
  initial?: Partial<ExpenditureEntryDraft>;
  fundingWarnings?: FundingOverAllocationWarning[];
  evaluateFundingWarnings?: (
    values: Pick<
      ValidatedExpenditureEntry,
      "mda_id" | "fiscal_year" | "programme_area_id" | "funding_allocations"
    >,
  ) => Promise<FundingOverAllocationWarning[]>;
  onFundingWarningsChange?: (
    warnings: FundingOverAllocationWarning[],
  ) => void;
  serverErrors?: ExpenditureEntryFieldErrors;
  serverError?: string | null;
  submitting?: boolean;
  submitLabel?: string;
  enableVoucherUpload?: boolean;
  /** When false, PHC location fields are hidden and non-PHC submission is assumed. */
  showPhcLocation?: boolean;
  facilityScope?: ExpenditureFacilityScope;
  onCancel?: () => void;
  onSubmit: (
    values: ValidatedExpenditureEntry,
    attachment?: ExpenditureVoucherAttachment,
  ) => void;
};

export function ExpenditureEntryForm({
  mdas,
  programmeAreas,
  expenditureCategories,
  expenditureItems,
  paymentMethods,
  fundingSources,
  unspecifiedFundingSourceId = null,
  lgas,
  facilities,
  aopActivities,
  approvedBudgetLines = [],
  stateBudgetFundingSourceId = null,
  evaluateBudgetLineBalance,
  initial,
  fundingWarnings = [],
  evaluateFundingWarnings,
  onFundingWarningsChange,
  serverErrors,
  serverError,
  submitting,
  submitLabel = "Submit expenditure entry",
  enableVoucherUpload = true,
  showPhcLocation = false,
  facilityScope,
  onCancel,
  onSubmit,
}: ExpenditureEntryFormProps) {
  const facilityLocked = Boolean(facilityScope);
  const notesSectionEyebrow = showPhcLocation ? "05" : "04";
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
  const [voucherFile, setVoucherFile] = React.useState<File | null>(null);
  const [voucherFileError, setVoucherFileError] = React.useState<string | null>(
    null,
  );
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
      fundingSources,
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
      approvedBudgetLines: approvedBudgetLines.map((l) => ({
        id: l.id,
        mda_id: l.mda_id,
        fiscal_year: l.fiscal_year,
      })),
      unspecifiedFundingSourceId,
    }),
    [
      programmeAreas,
      expenditureCategories,
      expenditureItems,
      paymentMethods,
      fundingSources,
      facilities,
      aopActivities,
      approvedBudgetLines,
      unspecifiedFundingSourceId,
    ],
  );

  const selectableFundingSources = React.useMemo(
    () =>
      fundingSources.filter((source) => source.id !== unspecifiedFundingSourceId),
    [fundingSources, unspecifiedFundingSourceId],
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

  // Map each seeded expenditure category to the budget class it rolls up under,
  // so selecting a budget line can auto-fill the category (and vice versa).
  const categoryIdByClass = React.useMemo(() => {
    const byName = new Map(
      expenditureCategories.map((c) => [c.name.trim().toLowerCase(), c.id]),
    );
    return {
      personnel: byName.get(BUDGET_CLASS_CATEGORY_NAME.personnel) ?? null,
      overhead: byName.get(BUDGET_CLASS_CATEGORY_NAME.overhead) ?? null,
      capital: byName.get(BUDGET_CLASS_CATEGORY_NAME.capital) ?? null,
    } satisfies Record<ApprovedBudgetLineLite["budget_class"], string | null>;
  }, [expenditureCategories]);

  const classByCategoryId = React.useMemo(() => {
    const map = new Map<string, ApprovedBudgetLineLite["budget_class"]>();
    (
      Object.entries(categoryIdByClass) as Array<
        [ApprovedBudgetLineLite["budget_class"], string | null]
      >
    ).forEach(([cls, id]) => {
      if (id) map.set(id, cls);
    });
    return map;
  }, [categoryIdByClass]);

  // The Expenditure Item field turns into an approved-budget-line picker whenever
  // any funding allocation draws on the state budget.
  const stateBudgetInUse =
    Boolean(stateBudgetFundingSourceId) &&
    draft.funding_allocations.some(
      (allocation) => allocation.funding_source_id === stateBudgetFundingSourceId,
    );

  // Budget lines for the entry's MDA + fiscal year, narrowed to the selected
  // category's class once one is chosen.
  const filteredBudgetLines = React.useMemo(() => {
    const selectedClass = draft.expenditure_category_id
      ? classByCategoryId.get(draft.expenditure_category_id) ?? null
      : null;
    return approvedBudgetLines.filter((line) => {
      if (draft.mda_id && line.mda_id !== draft.mda_id) return false;
      if (period && line.fiscal_year !== period.fiscal_year) return false;
      if (selectedClass && line.budget_class !== selectedClass) return false;
      return true;
    });
  }, [
    approvedBudgetLines,
    draft.mda_id,
    draft.expenditure_category_id,
    period,
    classByCategoryId,
  ]);

  const selectedBudgetLine = React.useMemo(
    () =>
      approvedBudgetLines.find(
        (line) => line.id === draft.approved_budget_line_id,
      ) ?? null,
    [approvedBudgetLines, draft.approved_budget_line_id],
  );

  // Mutual exclusivity: state-budget entries classify via the budget line (clear
  // the free-text item); non-state-budget entries can't keep a stale line.
  React.useEffect(() => {
    if (stateBudgetInUse) {
      if (draft.expenditure_item_id) {
        setDraft((prev) => ({ ...prev, expenditure_item_id: "" }));
      }
    } else if (draft.approved_budget_line_id) {
      setDraft((prev) => ({ ...prev, approved_budget_line_id: "" }));
    }
  }, [stateBudgetInUse, draft.expenditure_item_id, draft.approved_budget_line_id]);

  // Soft remaining-balance lookup for the selected line.
  const [lineBalance, setLineBalance] = React.useState<{
    approved_amount: number;
    spent_amount: number;
  } | null>(null);

  React.useEffect(() => {
    if (!evaluateBudgetLineBalance || !draft.approved_budget_line_id) {
      setLineBalance(null);
      return;
    }
    let cancelled = false;
    void evaluateBudgetLineBalance(draft.approved_budget_line_id).then(
      (result) => {
        if (!cancelled) setLineBalance(result);
      },
    );
    return () => {
      cancelled = true;
    };
  }, [evaluateBudgetLineBalance, draft.approved_budget_line_id]);

  const enteredAmount = parseFloat(draft.amount.replace(/[\s,]/g, ""));
  const lineRemaining = lineBalance
    ? lineBalance.approved_amount - lineBalance.spent_amount
    : selectedBudgetLine
      ? selectedBudgetLine.approved_amount
      : null;
  const lineWouldOverspend =
    lineRemaining !== null &&
    Number.isFinite(enteredAmount) &&
    enteredAmount > lineRemaining + 0.009;

  const allocationRemaining = allocationRemainingAmount(
    draft.amount,
    draft.funding_allocations,
  );

  const fundingSourceOptions: ComboboxOption[] = selectableFundingSources.map(
    (source) => ({
      value: source.id,
      label: source.name,
    }),
  );

  function syncSingleAllocationAmount(
    allocations: FundingAllocationDraft[],
    amount: string,
  ): FundingAllocationDraft[] {
    if (allocations.length !== 1) return allocations;
    return [{ ...allocations[0]!, amount }];
  }

  function setAllocationField(
    index: number,
    key: keyof FundingAllocationDraft,
    value: string,
  ) {
    setDraft((prev) => {
      const allocations = prev.funding_allocations.map((row, rowIndex) =>
        rowIndex === index ? { ...row, [key]: value } : row,
      );
      return { ...prev, funding_allocations: allocations };
    });
    const nextDraft = {
      ...draft,
      funding_allocations: draft.funding_allocations.map((row, rowIndex) =>
        rowIndex === index ? { ...row, [key]: value } : row,
      ),
    };
    const result = validateExpenditureEntry(nextDraft, reference);
    setErrors(result.ok ? {} : result.errors);
  }

  function addAllocationRow() {
    setDraft((prev) => {
      const nextAllocations = [...prev.funding_allocations];
      if (nextAllocations.length === 1) {
        nextAllocations[0] = {
          ...nextAllocations[0]!,
          amount: "",
        };
      }
      nextAllocations.push(emptyFundingAllocationDraft());
      return { ...prev, funding_allocations: nextAllocations };
    });
  }

  function removeAllocationRow(index: number) {
    setDraft((prev) => {
      const nextAllocations = prev.funding_allocations.filter(
        (_, rowIndex) => rowIndex !== index,
      );
      const normalized =
        nextAllocations.length === 0
          ? [emptyFundingAllocationDraft()]
          : syncSingleAllocationAmount(nextAllocations, prev.amount);
      return { ...prev, funding_allocations: normalized };
    });
  }

  const fundingWarningsRef = React.useRef(fundingWarnings);
  fundingWarningsRef.current = fundingWarnings;

  React.useEffect(() => {
    if (!evaluateFundingWarnings || !onFundingWarningsChange) return;

    const currentPeriod = deriveFiscalPeriod(draft.transaction_date);
    const clearWarnings = () => {
      if (fundingWarningsRef.current.length > 0) onFundingWarningsChange([]);
    };

    if (!draft.mda_id || !draft.programme_area_id || !currentPeriod) {
      clearWarnings();
      return;
    }

    const result = validateExpenditureEntry(draft, reference);
    if (!result.ok) {
      clearWarnings();
      return;
    }

    let cancelled = false;
    const timer = window.setTimeout(() => {
      void evaluateFundingWarnings({
        mda_id: result.values.mda_id,
        fiscal_year: result.values.fiscal_year,
        programme_area_id: result.values.programme_area_id,
        funding_allocations: result.values.funding_allocations,
      }).then((warnings) => {
        if (!cancelled) onFundingWarningsChange(warnings);
      });
    }, 250);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [
    draft,
    evaluateFundingWarnings,
    onFundingWarningsChange,
    reference,
  ]);

  function setField<K extends keyof ExpenditureEntryDraft>(
    key: K,
    value: ExpenditureEntryDraft[K],
  ) {
    setDraft((prev) => {
      const next = { ...prev, [key]: value };
      if (key === "amount") {
        next.funding_allocations = syncSingleAllocationAmount(
          prev.funding_allocations,
          String(value),
        );
      }
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
        const line = approvedBudgetLines.find(
          (l) => l.id === next.approved_budget_line_id,
        );
        if (line) {
          const nextPeriod = deriveFiscalPeriod(next.transaction_date);
          if (
            (next.mda_id && line.mda_id !== next.mda_id) ||
            (nextPeriod && line.fiscal_year !== nextPeriod.fiscal_year)
          ) {
            next.approved_budget_line_id = "";
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

  // Selecting a budget line auto-fills and locks the expenditure category to the
  // line's class so the two can never disagree.
  function handleSelectBudgetLine(value: string) {
    markTouched("approved_budget_line_id");
    const line = approvedBudgetLines.find((l) => l.id === value);
    setDraft((prev) => {
      const next = { ...prev, approved_budget_line_id: value };
      const categoryId = line ? categoryIdByClass[line.budget_class] : null;
      if (categoryId) next.expenditure_category_id = categoryId;
      next.expenditure_item_id = "";
      return next;
    });
    setErrors((prev) => ({
      ...prev,
      approved_budget_line_id: undefined,
      expenditure_category_id: undefined,
    }));
  }

  function validateVoucherFile(file: File | null): string | null {
    if (!file) return null;
    const allowedTypes = ["application/pdf"];
    const isAllowedImage = file.type.startsWith("image/");
    const isAllowedPdf =
      allowedTypes.includes(file.type) || file.name.toLowerCase().endsWith(".pdf");
    if (!isAllowedImage && !isAllowedPdf) {
      return "Upload an image or PDF voucher only.";
    }
    if (file.size > 10 * 1024 * 1024) {
      return "Voucher file must be 10 MB or smaller.";
    }
    return null;
  }

  function handleVoucherFileChange(files: FileList | null) {
    const file = files?.item(0) ?? null;
    setVoucherFile(file);
    setVoucherFileError(validateVoucherFile(file));
  }

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const fileError = validateVoucherFile(voucherFile);
    setVoucherFileError(fileError);
    if (fileError) {
      requestAnimationFrame(() => {
        const upload = document.getElementById("voucher-upload");
        upload?.scrollIntoView({ behavior: "smooth", block: "center" });
        upload?.focus?.({ preventScroll: true });
      });
      return;
    }
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
    onSubmit(
      result.values,
      voucherFile ? { file: voucherFile } : undefined,
    );
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
  const budgetLineOptions: ComboboxOption[] = filteredBudgetLines.map((line) => {
    const label =
      line.budget_class === "capital" && line.project_description
        ? line.project_description
        : `${line.economic_code} — ${line.economic_description}`;
    return {
      value: line.id,
      label,
      searchTerms: [
        line.economic_code,
        line.economic_description,
        line.project_description ?? "",
      ],
    };
  });
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
                : "Submitters can only pick MDAs they hold expenditure-entry access for. Admins see every MDA."}
            </FieldDescription>
          )}
        </Field>
      </FormSection>

      <FormSection
        eyebrow="02"
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

        <div className="flex flex-col gap-4 rounded-md border bg-muted/20 p-4">
          <div className="flex flex-col gap-1">
            <h3 className="text-sm font-semibold text-foreground">
              Funding source breakdown
            </h3>
            <p className="text-xs text-muted-foreground">
              Split this expenditure across one or more funding sources. Allocations
              must sum exactly to the money amount.
            </p>
          </div>

          {errors.funding_allocations ? (
            <FieldDescription className="text-status-rejected">
              {errors.funding_allocations}
            </FieldDescription>
          ) : null}

          <div className="flex flex-col gap-3">
            {draft.funding_allocations.map((row, index) => {
              const rowErrors = errors.allocationRows?.[index];
              const usedElsewhere = new Set(
                draft.funding_allocations
                  .filter((_, rowIndex) => rowIndex !== index)
                  .map((allocation) => allocation.funding_source_id)
                  .filter(Boolean),
              );
              const rowOptions = fundingSourceOptions.filter(
                (option) =>
                  option.value === row.funding_source_id ||
                  !usedElsewhere.has(option.value),
              );
              const singleRow = draft.funding_allocations.length === 1;

              return (
                <div
                  key={`allocation-${index}`}
                  className="grid gap-4 rounded-md border bg-background p-4 md:grid-cols-[minmax(0,1fr)_12rem_auto]"
                >
                  <Field>
                    <FieldLabel>Funding source</FieldLabel>
                    <Combobox
                      options={rowOptions}
                      placeholder="Select funding source"
                      value={row.funding_source_id || undefined}
                      onValueChange={(value) => {
                        setAllocationField(index, "funding_source_id", value);
                      }}
                    />
                    {rowErrors?.funding_source_id ? (
                      <FieldDescription className="text-status-rejected">
                        {rowErrors.funding_source_id}
                      </FieldDescription>
                    ) : null}
                  </Field>

                  <Field>
                    <FieldLabel>Allocated amount</FieldLabel>
                    <div className="relative">
                      <span
                        aria-hidden="true"
                        className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-sm font-medium text-muted-foreground"
                      >
                        ₦
                      </span>
                      <Input
                        inputMode="decimal"
                        placeholder="0.00"
                        value={row.amount}
                        disabled={singleRow}
                        onChange={(event) => {
                          setAllocationField(index, "amount", event.target.value);
                        }}
                        className="h-11 pl-7 tabular-nums"
                      />
                    </div>
                    {singleRow ? (
                      <FieldDescription>
                        Mirrors the expenditure amount for single-source entries.
                      </FieldDescription>
                    ) : null}
                    {rowErrors?.amount ? (
                      <FieldDescription className="text-status-rejected">
                        {rowErrors.amount}
                      </FieldDescription>
                    ) : null}
                  </Field>

                  <div className="flex items-end justify-end">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      disabled={draft.funding_allocations.length === 1}
                      onClick={() => removeAllocationRow(index)}
                    >
                      <Trash2Icon aria-hidden="true" data-icon="inline-start" />
                      Remove
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <Button type="button" variant="outline" size="sm" onClick={addAllocationRow}>
              <PlusIcon aria-hidden="true" data-icon="inline-start" />
              Add funding source
            </Button>
            {allocationRemaining !== null ? (
              <p
                className={cn(
                  "text-sm font-medium tabular-nums",
                  Math.abs(allocationRemaining) < 0.01
                    ? "text-status-approved"
                    : allocationRemaining > 0
                      ? "text-status-pending"
                      : "text-status-rejected",
                )}
              >
                {Math.abs(allocationRemaining) < 0.01
                  ? "Fully allocated"
                  : allocationRemaining > 0
                    ? `₦${allocationRemaining.toLocaleString("en-NG", {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2,
                      })} remaining to allocate`
                    : `₦${Math.abs(allocationRemaining).toLocaleString("en-NG", {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2,
                      })} over-allocated`}
              </p>
            ) : null}
          </div>

          {fundingWarnings.length > 0 ? (
            <div className="flex flex-col gap-2">
              {fundingWarnings.map((warning) => (
                <Alert key={warning.funding_source_id} variant="warning">
                  <AlertTitle>Funding exceeds recorded receipts</AlertTitle>
                  <AlertDescription>{warning.message}</AlertDescription>
                </Alert>
              ))}
            </div>
          ) : null}
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

        {enableVoucherUpload ? (
          <div className="rounded-md border bg-muted/20 p-4">
            <FileUpload
              id="voucher-upload"
              label="Voucher attachment"
              accept="image/*,application/pdf,.pdf"
              description="Optional. Upload one image or PDF voucher, up to 10 MB."
              disabled={submitting}
              error={voucherFileError}
              selectedFile={voucherFile}
              onChange={handleVoucherFileChange}
              onClear={() => {
                setVoucherFile(null);
                setVoucherFileError(null);
              }}
            />
          </div>
        ) : (
          <div className="flex items-start gap-3 rounded-md border border-dashed bg-muted/30 px-4 py-3 text-sm text-muted-foreground">
            <FileTextIcon aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
            <p>
              Voucher uploads are available while creating or editing pending
              entries. Reviewed-entry corrections keep attachments unchanged.
            </p>
          </div>
        )}
      </FormSection>

      <FormSection
        eyebrow="03"
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
              disabled={stateBudgetInUse && Boolean(selectedBudgetLine)}
            />
            {errors.expenditure_category_id ? (
              <FieldDescription className="text-status-rejected">
                {errors.expenditure_category_id}
              </FieldDescription>
            ) : stateBudgetInUse && selectedBudgetLine ? (
              <FieldDescription>
                Set automatically from the selected budget line.
              </FieldDescription>
            ) : (
              <FieldDescription>
                Personnel, drugs, capital works, training, or another approved category.
              </FieldDescription>
            )}
          </Field>
        </div>

        <div className="grid gap-6 md:grid-cols-2">
          {stateBudgetInUse ? (
            <Field>
              <FieldLabel
                htmlFor="approved-budget-line"
                className="flex items-center gap-2"
              >
                Approved Budget Item
                <span className="rounded-full border border-status-approved/30 bg-status-approved-bg px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-status-approved">
                  State budget
                </span>
              </FieldLabel>
              <Combobox
                id="approved-budget-line"
                options={budgetLineOptions}
                placeholder={
                  !draft.mda_id || !period
                    ? "Pick MDA and date first"
                    : budgetLineOptions.length
                      ? "Select approved budget line"
                      : "No approved budget lines for this MDA / FY"
                }
                value={draft.approved_budget_line_id || undefined}
                onValueChange={handleSelectBudgetLine}
                disabled={
                  !draft.mda_id || !period || budgetLineOptions.length === 0
                }
              />
              {errors.approved_budget_line_id ? (
                <FieldDescription className="text-status-rejected">
                  {errors.approved_budget_line_id}
                </FieldDescription>
              ) : selectedBudgetLine ? (
                <FieldDescription
                  className={
                    lineWouldOverspend ? "text-status-pending" : undefined
                  }
                >
                  {`Approved: ₦${selectedBudgetLine.approved_amount.toLocaleString(
                    "en-NG",
                    { minimumFractionDigits: 2, maximumFractionDigits: 2 },
                  )}`}
                  {lineRemaining !== null
                    ? ` · Remaining: ₦${lineRemaining.toLocaleString("en-NG", {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2,
                      })}`
                    : ""}
                  {lineWouldOverspend
                    ? " — this entry exceeds the remaining balance."
                    : ""}
                </FieldDescription>
              ) : (
                <FieldDescription>
                  Choose the approved budget line this state-funded spend draws
                  down. Sets the expenditure category automatically.
                </FieldDescription>
              )}
            </Field>
          ) : (
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
          )}

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
            Viewers will need a remark below to interpret this entry.
          </div>
        ) : null}
      </FormSection>

      {showPhcLocation ? (
      <FormSection
        eyebrow="04"
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
      ) : null}

      <FormSection
        eyebrow={notesSectionEyebrow}
        icon={StickyNoteIcon}
        title="Notes & remarks"
        description="Required when Programme Area, Expenditure Category, or Payment Method is set to Other. Otherwise optional context for viewers."
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
                ? "Explain the Other selection so viewers can interpret this entry."
                : "Anything a viewer should know — voucher details, conditions, supplier specifics, etc."
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
          queue and remain editable until a viewer acts.
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
