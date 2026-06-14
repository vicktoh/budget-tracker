"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeftIcon } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/components/auth/auth-provider";
import { ExpenditureEntryForm } from "@/components/expenditure/expenditure-entry-form";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { StatusBadge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ReviewedEditBanner } from "@/components/review/reviewed-edit-banner";
import {
  assignedFacilityIds,
  canReviewMda,
  facilityUserMdaId,
  isAdmin,
  isFacilityUser,
  submittableMdaIds,
} from "@/lib/access";
import {
  getExpenditureEntry,
  insertExpenditureEntry,
  updatePendingExpenditureEntry,
  type ExpenditureEntryRow,
} from "@/lib/db/expenditure-entries";
import { updateReviewedExpenditureEntry } from "@/lib/db/review";
import {
  listExpenditureCategories,
  listExpenditureItems,
  listFacilities,
  listLgas,
  listMdas,
  listPaymentMethods,
  listProgrammeAreas,
} from "@/lib/db/reference-data";
import {
  canEditExpenditureEntry,
  mapExpenditureEntryError,
  type ExpenditureEntryDraft,
  type ExpenditureEntryFieldErrors,
  type ValidatedExpenditureEntry,
} from "@/lib/expenditure/validation";
import { hasSupabaseConfig, supabase } from "@/lib/supabase";
import type { Tables } from "@/lib/db/types";

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
  const { user, profile } = useAuth();

  const [reference, setReference] = React.useState<ReferenceData | null>(null);
  const [entry, setEntry] = React.useState<ExpenditureEntryRow | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [loadError, setLoadError] = React.useState<string | null>(null);

  const [submitting, setSubmitting] = React.useState(false);
  const [serverErrors, setServerErrors] =
    React.useState<ExpenditureEntryFieldErrors>({});
  const [serverError, setServerError] = React.useState<string | null>(null);

  const admin = isAdmin(profile);
  const facilityUser = isFacilityUser(profile);
  const submittableIds = React.useMemo(
    () => submittableMdaIds(profile),
    [profile],
  );
  const assignedFacilityIdSet = React.useMemo(
    () => assignedFacilityIds(profile),
    [profile],
  );
  const facilityMdaId = facilityUserMdaId(profile);

  React.useEffect(() => {
    if (!profile) return;
    if (!supabase || !hasSupabaseConfig) {
      setLoading(false);
      return;
    }
    let active = true;
    setLoading(true);
    setLoadError(null);
    (async () => {
      try {
        const [
          mdas,
          programmeAreas,
          expenditureCategories,
          expenditureItems,
          paymentMethods,
          lgas,
          facilities,
          fetchedEntry,
        ] = await Promise.all([
          listMdas(supabase!),
          listProgrammeAreas(supabase!),
          listExpenditureCategories(supabase!),
          listExpenditureItems(supabase!),
          listPaymentMethods(supabase!),
          listLgas(supabase!),
          listFacilities(supabase!),
          mode.kind === "edit"
            ? getExpenditureEntry(supabase!, mode.entryId)
            : Promise.resolve(null),
        ]);

        // AOP activities are loaded for any MDA the user can submit for.
        // We include every assigned MDA so toggling MDA in the form works
        // without an extra round-trip; activities are filtered client-side
        // by selected MDA + derived fiscal year.
        const allowedMdaIds = admin
          ? mdas.map((m) => m.id)
          : submittableIds;
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

        if (!active) return;
        setReference({
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
          lgas: lgas.map((l) => ({ id: l.id, name: l.name })),
          facilities: facilities.map((f) => ({
            id: f.id,
            name: f.name,
            lga_id: f.lga_id,
            facility_type: f.facility_type,
          })),
          aopActivities: aopActivities as ReferenceData["aopActivities"],
        });
        setEntry(fetchedEntry);
      } catch (error) {
        if (!active) return;
        setLoadError(
          error instanceof Error ? error.message : "Failed to load form data.",
        );
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, [admin, mode, profile, submittableIds]);

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
  const facilityUserWithoutAssignments =
    facilityUser && assignedFacilityIdSet.length === 0;

  const pendingEditable =
    mode.kind === "new" ||
    (entry
      ? canEditExpenditureEntry(
          {
            status: entry.status,
            entered_by: entry.entered_by,
            mda_id: entry.mda_id,
          },
          {
            user_id: user?.id ?? null,
            submittable_mda_ids: submittableIds,
            is_admin: admin,
          },
        )
      : true);

  // Reviewer/admin edit path: non-pending, non-processed entries that the
  // current user can review.
  const reviewedEditMode =
    mode.kind === "edit" &&
    entry !== null &&
    (entry.status === "approved" || entry.status === "rejected") &&
    (admin || canReviewMda(profile, entry.mda_id));

  const editable = pendingEditable || reviewedEditMode;
  const [reviewReason, setReviewReason] = React.useState("");

  async function handleSubmit(values: ValidatedExpenditureEntry) {
    if (!supabase || !user) return;
    setSubmitting(true);
    setServerErrors({});
    setServerError(null);
    try {
      if (mode.kind === "edit" && reviewedEditMode) {
        const trimmed = reviewReason.trim();
        if (trimmed.length === 0) {
          setServerError("An audit reason is required for reviewed-entry edits.");
          setSubmitting(false);
          return;
        }
        await updateReviewedExpenditureEntry(supabase, {
          entryId: mode.entryId,
          reason: trimmed,
          values,
        });
        toast.success(
          `Updated reviewed expenditure entry ${entry?.public_id ?? mode.entryId.slice(0, 8)}.`,
        );
      } else if (mode.kind === "edit") {
        const saved = await updatePendingExpenditureEntry(
          supabase,
          mode.entryId,
          values,
        );
        toast.success(
          `Updated expenditure entry ${saved.public_id ?? saved.id.slice(0, 8)}.`,
        );
      } else {
        const saved = await insertExpenditureEntry(supabase, values, user.id);
        toast.success(
          `Submitted expenditure entry ${saved.public_id ?? saved.id.slice(0, 8)}.`,
          {
            description:
              "It is pending reviewer approval. You can still edit while pending.",
          },
        );
      }
      router.push("/expenditure");
    } catch (error) {
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
        aop_activity_id: entry.aop_activity_id ?? "",
        is_phc: entry.is_phc,
        lga_id: entry.lga_id ?? "",
        facility_id: entry.facility_id ?? "",
        amount: entry.amount.toString(),
        voucher_ref_no: entry.voucher_ref_no,
        payment_method_id: entry.payment_method_id,
        remarks: entry.remarks ?? "",
      }
    : undefined;

  const isEdit = mode.kind === "edit";
  const title = isEdit ? "Edit expenditure entry" : "New expenditure entry";
  const subtitle = isEdit
    ? "Updates apply only while the entry is pending. After review, edits require an audit reason."
    : "Capture an expenditure paid by an assigned MDA. Reviewers see it in the pending queue.";

  return (
    <div className="-m-4 flex flex-col bg-background md:-m-6">
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
                <StatusBadge status={entry.status} />
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
                {entry?.status === "pending"
                  ? "Only the original submitter on an assigned MDA can edit a pending expenditure entry."
                  : entry?.status === "processed"
                    ? "Processed entries are terminal and cannot be edited."
                    : `This entry is ${entry?.status}. Only reviewers or admins on this MDA can edit it.`}
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
                Ask an admin to add a submitter membership for the MDA you report on
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
            {reviewedEditMode && entry ? (
              <ReviewedEditBanner
                status={entry.status as "approved" | "rejected"}
                reason={reviewReason}
                onReasonChange={setReviewReason}
              />
            ) : null}
            <ExpenditureEntryForm
              mdas={visibleMdas}
              programmeAreas={reference.programmeAreas}
              expenditureCategories={reference.expenditureCategories}
              expenditureItems={reference.expenditureItems}
              paymentMethods={reference.paymentMethods}
              lgas={reference.lgas}
              facilities={formFacilities}
              aopActivities={reference.aopActivities}
              initial={initial}
              serverErrors={serverErrors}
              serverError={serverError}
              submitting={submitting}
              submitLabel={
                reviewedEditMode
                  ? "Save with audit reason"
                  : isEdit
                    ? "Save changes"
                    : "Submit expenditure entry"
              }
              facilityScope={facilityScope}
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
