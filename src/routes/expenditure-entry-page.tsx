"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowLeftIcon, LockIcon } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/components/auth/auth-provider";
import { ExpenditureEntryForm } from "@/components/expenditure/expenditure-entry-form";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ReasonedEditBanner } from "@/components/entries/reasoned-edit-banner";
import {
  assignedFacilityIds,
  expenditureSubmittableMdaIds,
  facilityUserMdaId,
  isAdmin,
  isFacilityUser,
} from "@/lib/access";
import {
  getApprovedBudgetLineBalance,
  getExpenditureEntry,
  insertExpenditureEntry,
  updateExpenditureEntry,
  type ExpenditureEntryRow,
} from "@/lib/db/expenditure-entries";
import { listApprovedBudgetLines } from "@/lib/db/planning";
import {
  amendPublishedExpenditureEntry,
  correctUnpublishedExpenditureEntry,
  isPublishedPeriod,
  listBirPublications,
} from "@/lib/db/bir-publications";
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
  STATE_BUDGET_FUNDING_SOURCE_SLUG,
  UNSPECIFIED_FUNDING_SOURCE_SLUG,
} from "@/lib/expenditure/funding-allocations";
import {
  canEditExpenditureEntry,
  mapExpenditureEntryError,
  type ExpenditureEntryDraft,
  type ExpenditureEntryFieldErrors,
  type ValidatedExpenditureEntry,
} from "@/lib/expenditure/validation";
import { hasSupabaseConfig, supabase } from "@/lib/supabase";
import { getReference, putReference } from "@/lib/offline/idb";
import { classifySyncError } from "@/lib/offline/queue";
import { enqueueOperation, processQueue } from "@/lib/offline/sync-engine";
import type { Tables } from "@/lib/db/types";

const EXPENDITURE_REFERENCE_CACHE_KEY = "expenditure-reference";

type ReferenceData = {
  mdas: Pick<Tables<"mdas">, "id" | "name" | "abbreviation">[];
  programmeAreas: { id: string; name: string }[];
  expenditureCategories: { id: string; name: string }[];
  expenditureItems: {
    id: string;
    name: string;
    expenditure_category_id: string | null;
  }[];
  paymentMethods: { id: string; name: string }[];
  fundingSources: { id: string; name: string; slug: string }[];
  unspecifiedFundingSourceId: string | null;
  stateBudgetFundingSourceId: string | null;
  approvedBudgetLines: {
    id: string;
    mda_id: string;
    fiscal_year: number;
    budget_class: "personnel" | "overhead" | "capital";
    economic_code: string;
    economic_description: string;
    project_description: string | null;
    approved_amount: number;
  }[];
  lgas: { id: string; name: string }[];
  facilities: {
    id: string;
    name: string;
    lga_id: string;
    facility_type: string;
  }[];
  aopActivities: {
    id: string;
    activity_code: string;
    description: string;
    mda_id: string;
    fiscal_year: number;
  }[];
};

type Mode = { kind: "new" } | { kind: "edit"; entryId: string };

export function ExpenditureEntryPage({ mode }: { mode: Mode }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user, profile } = useAuth();

  const [reference, setReference] = React.useState<ReferenceData | null>(null);
  const [entry, setEntry] = React.useState<ExpenditureEntryRow | null>(null);
  const [publications, setPublications] = React.useState<Awaited<ReturnType<typeof listBirPublications>>>([]);
  const [loading, setLoading] = React.useState(true);
  const [loadError, setLoadError] = React.useState<string | null>(null);
  const [cachedReferenceAt, setCachedReferenceAt] = React.useState<
    string | null
  >(null);

  const [submitting, setSubmitting] = React.useState(false);
  const [serverErrors, setServerErrors] =
    React.useState<ExpenditureEntryFieldErrors>({});
  const [serverError, setServerError] = React.useState<string | null>(null);
  const admin = isAdmin(profile);
  const facilityUser = isFacilityUser(profile);
  const submittableIds = React.useMemo(
    () => expenditureSubmittableMdaIds(profile),
    [profile],
  );
  const assignedFacilityIdSet = React.useMemo(
    () => assignedFacilityIds(profile),
    [profile],
  );
  const facilityMdaId = facilityUserMdaId(profile);
  const profileId = profile?.id ?? null;
  const editEntryId = mode.kind === "edit" ? mode.entryId : null;
  const submittableIdsKey = React.useMemo(
    () => [...submittableIds].sort().join(","),
    [submittableIds],
  );
  // Avoid swapping the form for a skeleton on background reloads (e.g. after
  // an auth event) — that unmounts ExpenditureEntryForm and drops draft state.
  const hasLoadedReferenceRef = React.useRef(false);

  React.useEffect(() => {
    if (!profileId) return;
    if (!supabase || !hasSupabaseConfig) {
      setLoading(false);
      return;
    }
    let active = true;
    if (!hasLoadedReferenceRef.current) {
      setLoading(true);
    }
    setLoadError(null);
    (async () => {
      try {
        const [
          mdas,
          programmeAreas,
          expenditureCategories,
          expenditureItems,
          paymentMethods,
          fundingSources,
          lgas,
          facilities,
          fetchedEntry,
          fetchedPublications,
        ] = await Promise.all([
          listMdas(supabase!),
          listProgrammeAreas(supabase!),
          listExpenditureCategories(supabase!),
          listExpenditureItems(supabase!),
          listPaymentMethods(supabase!),
          listFundingSources(supabase!),
          listLgas(supabase!),
          listFacilities(supabase!),
          editEntryId
            ? getExpenditureEntry(supabase!, editEntryId)
            : Promise.resolve(null),
          listBirPublications(supabase!),
        ]);

        // AOP activities are loaded for any MDA the user can submit for.
        // We include every assigned MDA so toggling MDA in the form works
        // without an extra round-trip; activities are filtered client-side
        // by selected MDA + derived fiscal year.
        const allowedMdaIds = admin
          ? mdas.map((m) => m.id)
          : submittableIdsKey
            ? submittableIdsKey.split(",")
            : [];
        const aopActivities =
          allowedMdaIds.length > 0
            ? (
                await supabase!
                  .from("aop_activities")
                  .select("id, activity_code, description, mda_id, fiscal_year")
                  .eq("active", true)
                  .in("mda_id", allowedMdaIds)
                  .order("activity_code", { ascending: true })
              ).data ?? []
            : [];

        // Approved budget lines for the MDAs this user can act on. The form
        // filters them by the entry's MDA + fiscal year + budget class. This is
        // an optional enhancement (the state-budget item picker), so if the
        // table isn't present yet — e.g. the migration hasn't been applied to
        // this environment — degrade gracefully instead of failing the whole
        // form load.
        let approvedBudgetLines: Awaited<
          ReturnType<typeof listApprovedBudgetLines>
        > = [];
        if (allowedMdaIds.length > 0) {
          try {
            approvedBudgetLines = await listApprovedBudgetLines(supabase!, {
              mdaIds: allowedMdaIds,
            });
          } catch (budgetLinesError) {
            console.warn(
              "Approved budget lines unavailable; the state-budget item picker will be hidden.",
              budgetLinesError,
            );
          }
        }

        if (!active) return;
        const unspecifiedFundingSourceId =
          fundingSources.find(
            (source) => source.slug === UNSPECIFIED_FUNDING_SOURCE_SLUG,
          )?.id ?? null;
        const stateBudgetFundingSourceId =
          fundingSources.find(
            (source) => source.slug === STATE_BUDGET_FUNDING_SOURCE_SLUG,
          )?.id ?? null;
        const nextReference: ReferenceData = {
          mdas: mdas.map((m) => ({
            id: m.id,
            name: m.name,
            abbreviation: m.abbreviation,
          })),
          programmeAreas: programmeAreas.map((p) => ({ id: p.id, name: p.name })),
          expenditureCategories: expenditureCategories.map((c) => ({
            id: c.id,
            name: c.name,
          })),
          expenditureItems: expenditureItems.map((i) => ({
            id: i.id,
            name: i.name,
            expenditure_category_id: i.expenditure_category_id,
          })),
          paymentMethods: paymentMethods.map((p) => ({ id: p.id, name: p.name })),
          fundingSources: fundingSources.map((source) => ({
            id: source.id,
            name: source.name,
            slug: source.slug,
          })),
          unspecifiedFundingSourceId,
          stateBudgetFundingSourceId,
          approvedBudgetLines: approvedBudgetLines.map((line) => ({
            id: line.id,
            mda_id: line.mda_id,
            fiscal_year: line.fiscal_year,
            budget_class: line.budget_class,
            economic_code: line.economic_code,
            economic_description: line.economic_description,
            project_description: line.project_description,
            approved_amount: Number(line.approved_amount),
          })),
          lgas: lgas.map((l) => ({ id: l.id, name: l.name })),
          facilities: facilities.map((f) => ({
            id: f.id,
            name: f.name,
            lga_id: f.lga_id,
            facility_type: f.facility_type,
          })),
          aopActivities: aopActivities as ReferenceData["aopActivities"],
        };
        setReference(nextReference);
        setCachedReferenceAt(null);
        setEntry(fetchedEntry);
        setPublications(fetchedPublications);
        hasLoadedReferenceRef.current = true;
        // Mirror reference data so the form can still render offline.
        void putReference(EXPENDITURE_REFERENCE_CACHE_KEY, nextReference);
      } catch (error) {
        if (!active) return;
        // Offline (or transient) load: fall back to the cached reference
        // snapshot so a new entry can still be captured for later sync.
        const cached =
          !editEntryId
            ? await getReference<ReferenceData>(
                EXPENDITURE_REFERENCE_CACHE_KEY,
              ).catch(() => null)
            : null;
        if (!active) return;
        if (cached) {
          setReference(cached.data);
          setCachedReferenceAt(cached.cachedAt);
          hasLoadedReferenceRef.current = true;
        } else if (!hasLoadedReferenceRef.current) {
          setLoadError(
            error instanceof Error
              ? error.message
              : "Failed to load form data.",
          );
        }
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, [admin, editEntryId, profileId, submittableIdsKey]);

  const visibleMdas = React.useMemo(() => {
    if (!reference) return [];
    if (admin) return reference.mdas;
    const allowed = new Set(submittableIds);
    return reference.mdas.filter((mda) => allowed.has(mda.id));
  }, [admin, reference, submittableIds]);

  // Facility users only ever see (and submit against) their assigned facilities.
  const formFacilities = React.useMemo(() => {
    if (!reference) return [];
    if (!facilityUser) return reference.facilities;
    const allowed = new Set(assignedFacilityIdSet);
    return reference.facilities.filter((f) => allowed.has(f.id));
  }, [reference, facilityUser, assignedFacilityIdSet]);

  const facilityScope =
    facilityUser && facilityMdaId ? { mdaId: facilityMdaId } : undefined;
  const showPhcLocation =
    facilityUser && assignedFacilityIdSet.length > 0;
  const facilityUserWithoutAssignments =
    facilityUser && assignedFacilityIdSet.length === 0;

  const publishedPeriods = React.useMemo(() => publications.map((row) => ({ fiscalYear: row.fiscal_year, quarter: row.quarter })), [publications]);
  const quarterPublished = !!entry && isPublishedPeriod(publications, entry.transaction_date);
  const amendmentMode = mode.kind === "edit" && admin && quarterPublished && searchParams.get("amend") === "1";
  const routineEditable =
    mode.kind === "new" ||
    (entry
      ? canEditExpenditureEntry(
          {
            entered_by: entry.entered_by,
            mda_id: entry.mda_id,
            fiscal_year: entry.fiscal_year,
            quarter: entry.quarter,
          },
          {
            user_id: user?.id ?? null,
            submittable_mda_ids: submittableIds,
            is_admin: admin,
            published_periods: amendmentMode ? [] : publishedPeriods,
          },
        )
      : true);

  const adminReasonedEdit = mode.kind === "edit" && admin && entry !== null;
  const editable = routineEditable || amendmentMode;
  const [editReason, setEditReason] = React.useState("");

  // Capture a create/pending-update to the offline outbox so it syncs on
  // reconnect. Returns true when queued.
  async function queueOffline(
    values: ValidatedExpenditureEntry,
  ): Promise<boolean> {
    if (!user) return false;
    await enqueueOperation({
      kind: mode.kind === "edit" ? "expenditure.update" : "expenditure.create",
      payload: values,
      enteredBy: user.id,
      targetEntryId: mode.kind === "edit" ? mode.entryId : undefined,
    });
    void processQueue(supabase);
    return true;
  }

  async function handleSubmit(values: ValidatedExpenditureEntry) {
    if (!user) return;
    setSubmitting(true);
    setServerErrors({});
    setServerError(null);

    if (isPublishedPeriod(publications, values.transaction_date) && !amendmentMode) {
      setServerError("This quarter's Budget Implementation Report has been published, so new submissions and routine edits are locked.");
      setSubmitting(false);
      return;
    }

    if (mode.kind === "edit" && adminReasonedEdit) {
      if (!supabase) {
        setServerError(
          "Admin corrections and amendments need an internet connection. Reconnect and try again.",
        );
        setSubmitting(false);
        return;
      }
      try {
        const trimmed = editReason.trim();
        if (trimmed.length === 0) {
          setServerError(
            amendmentMode ? "An amendment reason is required." : "An audit reason is required for Admin corrections.",
          );
          setSubmitting(false);
          return;
        }
        if (amendmentMode) await amendPublishedExpenditureEntry(supabase, mode.entryId, trimmed, values);
        else await correctUnpublishedExpenditureEntry(supabase, mode.entryId, trimmed, values);
        toast.success(
          amendmentMode ? "Amended expenditure entry and created the next BIR version." : `Corrected expenditure entry ${entry?.public_id ?? mode.entryId.slice(0, 8)}.`,
        );
        router.push("/expenditure");
      } catch (error) {
        // Reviewed edits can't be queued (they need server-side rules), so a
        // genuine network failure surfaces the reconnect prompt rather than a
        // generic error.
        if (classifySyncError(error) === "retry") {
          setServerError(
            "Admin corrections and amendments need an internet connection. Reconnect and try again.",
          );
          setSubmitting(false);
          return;
        }
        const mapped = mapExpenditureEntryError(
          error as { code?: string; message?: string },
        );
        if (mapped.field) setServerErrors({ [mapped.field]: mapped.message });
        else setServerError(mapped.message);
      } finally {
        setSubmitting(false);
      }
      return;
    }

    // Unconfigured path: no server to reach, so queue locally. When Supabase
    // IS configured we do NOT pre-block on navigator.onLine — we attempt the
    // real insert below and only fall back to the outbox if it actually fails
    // with a network error, so a false-negative "offline" flag can't divert a
    // genuinely-online submit.
    if (!supabase) {
      try {
        await queueOffline(values);
        toast.success("Saved offline. It will sync when you reconnect.", {
          description:
            "The entry is stored on this device and submitted automatically once you're back online.",
        });
        router.push("/expenditure");
      } catch {
        setServerError(
          "We couldn't save this entry offline on this device. Try again.",
        );
      } finally {
        setSubmitting(false);
      }
      return;
    }

    try {
      if (mode.kind === "edit") {
        const saved = await updateExpenditureEntry(
          supabase,
          mode.entryId,
          values,
        );
        toast.success(
          `Updated expenditure entry ${saved.public_id ?? saved.id.slice(0, 8)}.`,
        );
      } else {
        const saved = await insertExpenditureEntry(supabase, values, user.id);
        toast.success(`Recorded expenditure entry ${saved.public_id ?? saved.id.slice(0, 8)}.`);
      }
      router.push("/expenditure");
    } catch (error) {
      // A network failure mid-submit shouldn't lose the entry — fall back to
      // the offline outbox instead of surfacing a hard error.
      if (classifySyncError(error) === "retry") {
        try {
          await queueOffline(values);
          toast.success(
            "Connection dropped — saved offline. It will sync automatically.",
          );
          router.push("/expenditure");
          return;
        } catch {
          // fall through to the mapped error below
        }
      }
      const mapped = mapExpenditureEntryError(
        error as { code?: string; message?: string },
      );
      if (mapped.field) {
        setServerErrors({ [mapped.field]: mapped.message });
      } else {
        setServerError(mapped.message);
      }
    } finally {
      setSubmitting(false);
    }
  }

  function handleCancel() {
    router.push("/expenditure");
  }

  const initial: Partial<ExpenditureEntryDraft> | undefined = entry
    ? {
        transaction_date: entry.transaction_date,
        mda_id: entry.mda_id,
        programme_area_id: entry.programme_area_id,
        expenditure_category_id: entry.expenditure_category_id,
        expenditure_item_id: entry.expenditure_item_id ?? "",
        approved_budget_line_id: entry.approved_budget_line_id ?? "",
        aop_activity_id: entry.aop_activity_id ?? "",
        is_phc: entry.is_phc,
        lga_id: entry.lga_id ?? "",
        facility_id: entry.facility_id ?? "",
        amount: entry.amount.toString(),
        funding_allocations: (entry.expenditure_funding_allocations ?? []).map(
          (allocation) => ({
            funding_source_id: allocation.funding_source_id,
            amount: allocation.amount.toString(),
          }),
        ),
        voucher_ref_no: entry.voucher_ref_no,
        payment_method_id: entry.payment_method_id,
        remarks: entry.remarks ?? "",
      }
    : undefined;

  const evaluateBudgetLineBalance = React.useCallback(
    async (lineId: string) => {
      if (!supabase) return { approved_amount: 0, spent_amount: 0 };
      return getApprovedBudgetLineBalance(
        supabase,
        lineId,
        mode.kind === "edit" ? mode.entryId : null,
      );
    },
    [mode],
  );

  const isEdit = mode.kind === "edit";
  const title = isEdit ? "Edit expenditure entry" : "New expenditure entry";
  const subtitle = isEdit
    ? quarterPublished ? "This published-quarter entry can only be changed through an Admin amendment." : "Updates are allowed until this quarter's BIR is published."
    : "Capture expenditure paid by an assigned MDA. Valid entries are reportable immediately.";

  return (
    <div className="-mx-4 -mb-4 flex flex-col bg-background md:-mx-6 md:-mb-6">
      <header className="border-b bg-card/60">
        <div className="flex flex-col gap-6 px-6 pb-8 pt-6 md:px-10 md:pb-10 md:pt-8">
          <div>
            <Link
              href="/expenditure"
              className="focus-ring inline-flex items-center gap-1.5 rounded-sm text-xs font-medium text-muted-foreground hover:text-foreground"
            >
              <ArrowLeftIcon aria-hidden="true" className="size-3.5" />
              Back to Expenditure Entries
            </Link>
          </div>
          <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
            <div className="flex max-w-2xl flex-col gap-2">
              <span className="font-mono text-[11px] font-semibold uppercase tracking-[0.18em] text-status-approved">
                Expenditure ledger
              </span>
              <h1 className="text-3xl font-bold tracking-tight text-foreground">
                {title}
              </h1>
              <p className="text-sm leading-relaxed text-muted-foreground">
                {subtitle}
              </p>
            </div>
            {isEdit && entry ? (
              <div className="flex flex-col items-start gap-2 md:items-end">
                <span className="font-mono text-xs text-muted-foreground">
                  {entry.public_id ?? entry.id.slice(0, 8)}
                </span>
                {quarterPublished ? <Badge variant="outline"><LockIcon className="size-3" /> Published quarter</Badge> : <Badge variant="secondary">Open quarter</Badge>}
              </div>
            ) : null}
          </div>
        </div>
      </header>

      <div className="mx-auto w-full max-w-5xl flex-1 px-0">
        {!hasSupabaseConfig ? (
          <div className="px-6 py-10 md:px-10">
            <Alert variant="warning">
              <AlertTitle>Supabase is not configured</AlertTitle>
              <AlertDescription>
                Add Supabase environment variables to load the form&rsquo;s reference data.
              </AlertDescription>
            </Alert>
          </div>
        ) : loading ? (
          <FormSkeleton />
        ) : loadError ? (
          <div className="px-6 py-10 md:px-10">
            <Alert variant="destructive">
              <AlertTitle>We couldn&rsquo;t load the form</AlertTitle>
              <AlertDescription>{loadError}</AlertDescription>
            </Alert>
          </div>
        ) : isEdit && !entry ? (
          <div className="px-6 py-10 md:px-10">
            <Alert variant="destructive">
              <AlertTitle>Entry not found</AlertTitle>
              <AlertDescription>
                This expenditure entry doesn&rsquo;t exist or you don&rsquo;t have permission to view it.
              </AlertDescription>
            </Alert>
          </div>
        ) : !editable ? (
          <div className="px-6 py-10 md:px-10">
            <Alert variant="warning">
              <AlertTitle>Locked from editing</AlertTitle>
              <AlertDescription>
                {quarterPublished
                  ? "This quarter has been published. Only an Admin can open an amendment from the Entry Detail page."
                  : "Only the original submitter on an assigned MDA, or an Admin with a reason, can edit this entry."}
              </AlertDescription>
            </Alert>
            <div className="mt-4 flex justify-end">
              <Button variant="outline" onClick={handleCancel}>
                Back to entries
              </Button>
            </div>
          </div>
        ) : facilityUserWithoutAssignments ? (
          <div className="px-6 py-10 md:px-10">
            <Alert>
              <AlertTitle>No facilities assigned yet</AlertTitle>
              <AlertDescription>
                Ask an admin to assign you to a PHC facility before recording
                expenditure entries.
              </AlertDescription>
            </Alert>
            <div className="mt-4 flex justify-end">
              <Button variant="outline" onClick={handleCancel}>
                Back to entries
              </Button>
            </div>
          </div>
        ) : !visibleMdas.length && !admin ? (
          <div className="px-6 py-10 md:px-10">
            <Alert>
              <AlertTitle>No assigned MDAs yet</AlertTitle>
              <AlertDescription>
                Ask an admin to add expenditure-entry access for the MDA you report on
                before recording expenditure entries.
              </AlertDescription>
            </Alert>
            <div className="mt-4 flex justify-end">
              <Button variant="outline" onClick={handleCancel}>
                Back to entries
              </Button>
            </div>
          </div>
        ) : reference ? (
          <>
            {cachedReferenceAt ? (
              <div className="px-6 pt-6 md:px-10">
                <Alert variant="warning">
                  <AlertTitle>Working from cached reference data</AlertTitle>
                  <AlertDescription>
                    You appear to be offline. This form is using reference data
                    saved on {new Date(cachedReferenceAt).toLocaleString()}.
                    Your entry will be saved on this device and synced when you
                    reconnect.
                  </AlertDescription>
                </Alert>
              </div>
            ) : null}
            {adminReasonedEdit && entry ? (
              <ReasonedEditBanner
                published={amendmentMode}
                reason={editReason}
                onReasonChange={setEditReason}
              />
            ) : null}
            <ExpenditureEntryForm
              mdas={visibleMdas}
              programmeAreas={reference.programmeAreas}
              expenditureCategories={reference.expenditureCategories}
              expenditureItems={reference.expenditureItems}
              paymentMethods={reference.paymentMethods}
              fundingSources={reference.fundingSources}
              unspecifiedFundingSourceId={reference.unspecifiedFundingSourceId}
              lgas={reference.lgas}
              facilities={formFacilities}
              aopActivities={reference.aopActivities}
              approvedBudgetLines={reference.approvedBudgetLines}
              stateBudgetFundingSourceId={reference.stateBudgetFundingSourceId}
              evaluateBudgetLineBalance={evaluateBudgetLineBalance}
              initial={initial}
              serverErrors={serverErrors}
              serverError={serverError}
              submitting={submitting}
              submitLabel={
                adminReasonedEdit
                  ? amendmentMode ? "Create BIR amendment" : "Save with audit reason"
                  : isEdit
                    ? "Save changes"
                    : "Submit expenditure entry"
              }
              facilityScope={facilityScope}
              showPhcLocation={showPhcLocation}
              onCancel={handleCancel}
              onSubmit={handleSubmit}
            />
          </>
        ) : null}
      </div>
    </div>
  );
}

function FormSkeleton() {
  return (
    <div className="flex flex-col">
      {[0, 1, 2, 3, 4].map((index) => (
        <section
          key={index}
          className="grid gap-8 border-b px-6 py-10 last:border-b-0 md:px-10 lg:grid-cols-[18rem_minmax(0,1fr)] lg:gap-14"
        >
          <div className="flex flex-col gap-3">
            <Skeleton className="size-9 rounded-md" />
            <Skeleton className="h-4 w-32" />
            <Skeleton className="h-3 w-48" />
            <Skeleton className="h-3 w-40" />
          </div>
          <div className="flex flex-col gap-6">
            <Skeleton className="h-11" />
            <Skeleton className="h-11" />
          </div>
        </section>
      ))}
    </div>
  );
}
