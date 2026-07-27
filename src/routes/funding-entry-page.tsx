"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowLeftIcon, LockIcon } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/components/auth/auth-provider";
import { FundingEntryForm } from "@/components/funding/funding-entry-form";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ReasonedEditBanner } from "@/components/entries/reasoned-edit-banner";
import {
  fundingSubmittableMdaIds,
  isAdmin,
} from "@/lib/access";
import {
  getFundingEntry,
  insertFundingEntry,
  updateFundingEntry,
  type FundingEntryRow,
} from "@/lib/db/funding-entries";
import {
  listFundingSources,
  listMdas,
  listProgrammeAreas,
} from "@/lib/db/reference-data";
import {
  amendPublishedFundingEntry,
  correctUnpublishedFundingEntry,
  isPublishedPeriod,
  listBirPublications,
} from "@/lib/db/bir-publications";
import {
  canEditFundingEntry,
  mapFundingEntryError,
  type FundingEntryDraft,
  type FundingEntryFieldErrors,
  type ValidatedFundingEntry,
} from "@/lib/funding/validation";
import { hasSupabaseConfig, supabase } from "@/lib/supabase";
import { getReference, putReference } from "@/lib/offline/idb";
import { classifySyncError } from "@/lib/offline/queue";
import { enqueueOperation, processQueue } from "@/lib/offline/sync-engine";
import type { Tables } from "@/lib/db/types";

const FUNDING_REFERENCE_CACHE_KEY = "funding-reference";

type ReferenceData = {
  mdas: Pick<Tables<"mdas">, "id" | "name" | "abbreviation">[];
  programmeAreas: { id: string; name: string }[];
  fundingSources: { id: string; name: string }[];
};

type Mode = { kind: "new" } | { kind: "edit"; entryId: string };

export function FundingEntryPage({ mode }: { mode: Mode }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user, profile } = useAuth();

  const [reference, setReference] = React.useState<ReferenceData | null>(null);
  const [entry, setEntry] = React.useState<FundingEntryRow | null>(null);
  const [publications, setPublications] = React.useState<Awaited<ReturnType<typeof listBirPublications>>>([]);
  const [loading, setLoading] = React.useState(true);
  const [loadError, setLoadError] = React.useState<string | null>(null);
  const [cachedReferenceAt, setCachedReferenceAt] = React.useState<
    string | null
  >(null);

  const [submitting, setSubmitting] = React.useState(false);
  const [serverErrors, setServerErrors] =
    React.useState<FundingEntryFieldErrors>({});
  const [serverError, setServerError] = React.useState<string | null>(null);

  const admin = isAdmin(profile);
  const submittableIds = React.useMemo(
    () => fundingSubmittableMdaIds(profile),
    [profile],
  );
  const profileId = profile?.id ?? null;
  const editEntryId = mode.kind === "edit" ? mode.entryId : null;
  // Avoid swapping the form for a skeleton on background reloads — that
  // unmounts FundingEntryForm and drops in-progress draft state.
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
        const [mdas, programmeAreas, fundingSources, fetchedEntry, fetchedPublications] =
          await Promise.all([
            listMdas(supabase!),
            listProgrammeAreas(supabase!),
            listFundingSources(supabase!),
            editEntryId
              ? getFundingEntry(supabase!, editEntryId)
              : Promise.resolve(null),
            listBirPublications(supabase!),
          ]);
        if (!active) return;
        const nextReference: ReferenceData = {
          mdas: mdas.map((m) => ({
            id: m.id,
            name: m.name,
            abbreviation: m.abbreviation,
          })),
          programmeAreas: programmeAreas.map((p) => ({
            id: p.id,
            name: p.name,
          })),
          fundingSources: fundingSources.map((s) => ({
            id: s.id,
            name: s.name,
          })),
        };
        setReference(nextReference);
        setCachedReferenceAt(null);
        setEntry(fetchedEntry);
        setPublications(fetchedPublications);
        hasLoadedReferenceRef.current = true;
        // Mirror reference data so the form can still render offline.
        void putReference(FUNDING_REFERENCE_CACHE_KEY, nextReference);
      } catch (error) {
        if (!active) return;
        // Offline (or transient) load: fall back to the cached reference
        // snapshot so a new entry can still be captured for later sync.
        const cached =
          !editEntryId
            ? await getReference<ReferenceData>(
                FUNDING_REFERENCE_CACHE_KEY,
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
  }, [editEntryId, profileId]);

  const visibleMdas = React.useMemo(() => {
    if (!reference) return [];
    if (admin) return reference.mdas;
    const allowed = new Set(submittableIds);
    return reference.mdas.filter((mda) => allowed.has(mda.id));
  }, [admin, reference, submittableIds]);

  const publishedPeriods = React.useMemo(() => publications.map((row) => ({ fiscalYear: row.fiscal_year, quarter: row.quarter })), [publications]);
  const quarterPublished = !!entry && isPublishedPeriod(publications, entry.transaction_date);
  const amendmentMode = mode.kind === "edit" && admin && quarterPublished && searchParams.get("amend") === "1";
  const routineEditable =
    mode.kind === "new" ||
    (entry
      ? canEditFundingEntry(
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
  async function queueOffline(values: ValidatedFundingEntry): Promise<boolean> {
    if (!user) return false;
    await enqueueOperation({
      kind: mode.kind === "edit" ? "funding.update" : "funding.create",
      payload: values,
      enteredBy: user.id,
      targetEntryId: mode.kind === "edit" ? mode.entryId : undefined,
    });
    // Nudge the engine in case connectivity just returned.
    void processQueue(supabase);
    return true;
  }

  async function handleSubmit(values: ValidatedFundingEntry) {
    if (!user) return;
    setSubmitting(true);
    setServerErrors({});
    setServerError(null);

    if (isPublishedPeriod(publications, values.transaction_date) && !amendmentMode) {
      setServerError("This quarter's Budget Implementation Report has been published, so new submissions and routine edits are locked.");
      setSubmitting(false);
      return;
    }

    // Admin corrections and published amendments are online-only and require a reason.
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
        if (amendmentMode) await amendPublishedFundingEntry(supabase, mode.entryId, trimmed, values);
        else await correctUnpublishedFundingEntry(supabase, mode.entryId, trimmed, values);
        toast.success(
          amendmentMode ? `Amended funding entry and created the next BIR version.` : `Corrected funding entry ${entry?.public_id ?? mode.entryId.slice(0, 8)}.`,
        );
        router.push("/funding");
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
        const mapped = mapFundingEntryError(
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
        router.push("/funding");
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
        const saved = await updateFundingEntry(
          supabase,
          mode.entryId,
          values,
        );
        toast.success(
          `Updated funding entry ${saved.public_id ?? saved.id.slice(0, 8)}.`,
        );
      } else {
        const saved = await insertFundingEntry(supabase, values, user.id);
        toast.success(`Recorded funding entry ${saved.public_id ?? saved.id.slice(0, 8)}.`);
      }
      router.push("/funding");
    } catch (error) {
      // A network failure mid-submit shouldn't lose the entry — fall back to
      // the offline outbox instead of surfacing a hard error.
      if (classifySyncError(error) === "retry") {
        try {
          await queueOffline(values);
          toast.success(
            "Connection dropped — saved offline. It will sync automatically.",
          );
          router.push("/funding");
          return;
        } catch {
          // fall through to the mapped error below
        }
      }
      const mapped = mapFundingEntryError(
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
    router.push("/funding");
  }

  const initial: Partial<FundingEntryDraft> | undefined = entry
    ? {
        transaction_date: entry.transaction_date,
        mda_id: entry.mda_id,
        programme_area_id: entry.programme_area_id,
        funding_source_id: entry.funding_source_id,
        amount: entry.amount.toString(),
        reference_no: entry.reference_no,
        remarks: entry.remarks ?? "",
      }
    : undefined;

  const isEdit = mode.kind === "edit";
  const title = isEdit ? "Edit funding entry" : "New funding entry";
  const subtitle = isEdit
    ? quarterPublished ? "This published-quarter entry can only be changed through an Admin amendment." : "Updates are allowed until this quarter's BIR is published."
    : "Capture a funding receipt for an assigned MDA. Valid entries are reportable immediately.";

  return (
    <div className="-mx-4 -mb-4 flex flex-col bg-background md:-mx-6 md:-mb-6">
      <header className="border-b bg-card/60">
        <div className="flex flex-col gap-6 px-6 pb-8 pt-6 md:px-10 md:pb-10 md:pt-8">
          <div>
            <Link
              href="/funding"
              className="focus-ring inline-flex items-center gap-1.5 rounded-sm text-xs font-medium text-muted-foreground hover:text-foreground"
            >
              <ArrowLeftIcon aria-hidden="true" className="size-3.5" />
              Back to Funding Entries
            </Link>
          </div>
          <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
            <div className="flex max-w-2xl flex-col gap-2">
              <span className="font-mono text-[11px] font-semibold uppercase tracking-[0.18em] text-status-approved">
                Funding ledger
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
                This funding entry doesn&rsquo;t exist or you don&rsquo;t have permission to view it.
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
        ) : !visibleMdas.length && !admin ? (
          <div className="px-6 py-10 md:px-10">
            <Alert>
              <AlertTitle>No assigned MDAs yet</AlertTitle>
              <AlertDescription>
                Ask an admin to add funding-entry access for the MDA you report on
                before recording funding entries.
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
            <FundingEntryForm
              mdas={visibleMdas}
              programmeAreas={reference.programmeAreas}
              fundingSources={reference.fundingSources}
              initial={initial}
              serverErrors={serverErrors}
              serverError={serverError}
              submitting={submitting}
              submitLabel={
                adminReasonedEdit
                  ? amendmentMode ? "Create BIR amendment" : "Save with audit reason"
                  : isEdit
                    ? "Save changes"
                    : "Submit funding entry"
              }
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
      {[0, 1, 2, 3].map((index) => (
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
