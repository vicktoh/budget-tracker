"use client";

import * as React from "react";
import Link from "next/link";
import { ArrowLeftIcon } from "lucide-react";
import { useAuth } from "@/components/auth/auth-provider";
import {
  EntryReviewDetail,
  type EntryReviewSection,
} from "@/components/review/entry-review-detail";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Skeleton } from "@/components/ui/skeleton";
import { canReviewMda, isAdmin } from "@/lib/access";
import {
  getExpenditureEntry,
  type ExpenditureEntryRow,
} from "@/lib/db/expenditure-entries";
import {
  getFundingEntry,
  type FundingEntryRow,
} from "@/lib/db/funding-entries";
import {
  listEntryAttachments,
  listEntryAuditEvents,
  listEntryComments,
  type EntryAttachmentRow,
  type EntryAuditEventRow,
  type EntryCommentRow,
} from "@/lib/db/review";
import type { EntryType } from "@/lib/db/types";
import { hasSupabaseConfig, supabase } from "@/lib/supabase";

type FundingMode = { kind: "funding"; entryId: string };
type ExpenditureMode = { kind: "expenditure"; entryId: string };
type Mode = FundingMode | ExpenditureMode;

const naira = new Intl.NumberFormat("en-NG", {
  style: "currency",
  currency: "NGN",
  maximumFractionDigits: 2,
});

export function ReviewEntryDetailRoute({ mode }: { mode: Mode }) {
  const { user, profile } = useAuth();

  const [funding, setFunding] = React.useState<FundingEntryRow | null>(null);
  const [expenditure, setExpenditure] = React.useState<ExpenditureEntryRow | null>(
    null,
  );
  const [comments, setComments] = React.useState<EntryCommentRow[]>([]);
  const [auditEvents, setAuditEvents] = React.useState<EntryAuditEventRow[]>([]);
  const [attachments, setAttachments] = React.useState<EntryAttachmentRow[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [loadError, setLoadError] = React.useState<string | null>(null);
  const [sidecarError, setSidecarError] = React.useState<string | null>(null);
  const [refreshTick, setRefreshTick] = React.useState(0);

  const entryType: EntryType =
    mode.kind === "funding" ? "funding_entry" : "expenditure_entry";

  React.useEffect(() => {
    if (!profile) return;
    if (!hasSupabaseConfig || !supabase) {
      setLoading(false);
      return;
    }
    let active = true;
    setLoading(true);
    setLoadError(null);
    setSidecarError(null);

    (async () => {
      try {
        const [entryResult, commentsResult, attachmentsResult, auditResult] =
          await Promise.allSettled([
            mode.kind === "funding"
              ? getFundingEntry(supabase!, mode.entryId)
              : getExpenditureEntry(supabase!, mode.entryId),
            listEntryComments(supabase!, entryType, mode.entryId),
            listEntryAttachments(supabase!, entryType, mode.entryId),
            listEntryAuditEvents(supabase!, entryType, mode.entryId),
          ]);

        if (!active) return;

        if (entryResult.status === "rejected") {
          setLoadError(
            entryResult.reason instanceof Error
              ? entryResult.reason.message
              : "Failed to load the entry.",
          );
          setLoading(false);
          return;
        }
        const loadedEntry = entryResult.value;
        if (mode.kind === "funding") {
          setFunding(loadedEntry as FundingEntryRow | null);
          setExpenditure(null);
        } else {
          setExpenditure(loadedEntry as ExpenditureEntryRow | null);
          setFunding(null);
        }

        // Audit history is gated by a separate RLS policy (reviewer/admin
        // only). For a submitter viewing their own entry we still want the
        // comments + entry to render; surface a soft warning instead of
        // failing the whole page.
        const sidecarMessages: string[] = [];
        if (commentsResult.status === "fulfilled") {
          setComments(commentsResult.value);
        } else {
          sidecarMessages.push("comments");
        }
        if (attachmentsResult.status === "fulfilled") {
          setAttachments(attachmentsResult.value);
        } else {
          sidecarMessages.push("attachments");
        }
        if (auditResult.status === "fulfilled") {
          setAuditEvents(auditResult.value);
        } else {
          setAuditEvents([]);
        }

        if (sidecarMessages.length > 0) {
          setSidecarError(
            `Some related data couldn't load: ${sidecarMessages.join(", ")}.`,
          );
        }
      } catch (error) {
        if (!active) return;
        setLoadError(
          error instanceof Error
            ? error.message
            : "Failed to load the entry.",
        );
      } finally {
        if (active) setLoading(false);
      }
    })();

    return () => {
      active = false;
    };
  }, [entryType, mode, profile, refreshTick]);

  function handleRefresh() {
    setRefreshTick((tick) => tick + 1);
  }

  const entry = mode.kind === "funding" ? funding : expenditure;
  const backHref = "/review";

  if (!hasSupabaseConfig) {
    return (
      <DetailLayout backHref={backHref}>
        <Alert variant="warning">
          <AlertTitle>Supabase is not configured</AlertTitle>
          <AlertDescription>
            Add Supabase environment variables to load entry details.
          </AlertDescription>
        </Alert>
      </DetailLayout>
    );
  }

  if (loading) {
    return (
      <DetailLayout backHref={backHref}>
        <Skeleton className="h-48" />
        <Skeleton className="h-32" />
      </DetailLayout>
    );
  }

  if (loadError) {
    return (
      <DetailLayout backHref={backHref}>
        <Alert variant="destructive">
          <AlertTitle>We couldn&rsquo;t load the entry</AlertTitle>
          <AlertDescription>{loadError}</AlertDescription>
        </Alert>
      </DetailLayout>
    );
  }

  if (!entry) {
    return (
      <DetailLayout backHref={backHref}>
        <Alert variant="destructive">
          <AlertTitle>Entry not found</AlertTitle>
          <AlertDescription>
            This entry doesn&rsquo;t exist or you don&rsquo;t have permission to
            view it.
          </AlertDescription>
        </Alert>
      </DetailLayout>
    );
  }

  const admin = isAdmin(profile);
  const canReview = admin || canReviewMda(profile, entry.mda_id);
  const canEditReviewed =
    canReview && entry.status !== "pending" && entry.status !== "processed";

  const sections: EntryReviewSection[] =
    mode.kind === "funding"
      ? buildFundingSections(funding!)
      : buildExpenditureSections(expenditure!);

  const reviewedEditHref =
    mode.kind === "funding"
      ? `/funding/${entry.id}/edit`
      : `/expenditure/${entry.id}/edit`;

  return (
    <DetailLayout backHref={backHref}>
      {sidecarError ? (
        <Alert variant="warning">
          <AlertTitle>Some details are limited</AlertTitle>
          <AlertDescription>{sidecarError}</AlertDescription>
        </Alert>
      ) : null}

      <EntryReviewDetail
        entryType={entryType}
        entry={{
          id: entry.id,
          publicId: entry.public_id,
          status: entry.status,
          transactionDate: entry.transaction_date,
          fiscalYear: entry.fiscal_year,
          quarter: entry.quarter,
          mdaLabel:
            entry.mdas?.abbreviation ?? entry.mdas?.name ?? entry.mda_id,
          amount: Number(entry.amount),
          enteredBy: entry.entered_by,
        }}
        sections={sections}
        remarks={entry.remarks ?? null}
        canReview={canReview}
        canEditReviewed={canEditReviewed}
        reviewedEditHref={reviewedEditHref}
        currentUserId={user?.id ?? null}
        comments={comments}
        attachments={attachments}
        auditEvents={auditEvents}
        loading={false}
        loadError={null}
        onRefresh={handleRefresh}
      />
    </DetailLayout>
  );
}

function DetailLayout({
  backHref,
  children,
}: {
  backHref: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-5">
      <Link
        href={backHref}
        className="focus-ring inline-flex w-fit items-center gap-1.5 rounded-sm text-xs font-medium text-muted-foreground hover:text-foreground"
      >
        <ArrowLeftIcon aria-hidden="true" className="size-3.5" />
        Back to review queue
      </Link>
      {children}
    </div>
  );
}

function buildFundingSections(row: FundingEntryRow): EntryReviewSection[] {
  return [
    {
      label: "MDA",
      value: row.mdas?.name ?? row.mda_id,
    },
    {
      label: "Programme Area",
      value: row.programme_areas?.name ?? "—",
    },
    {
      label: "Funding Source",
      value: row.funding_sources?.name ?? "—",
    },
    {
      label: "Reference No.",
      value: <code className="font-mono text-xs">{row.reference_no}</code>,
    },
    {
      label: "Amount",
      value: naira.format(Number(row.amount)),
    },
    {
      label: "Approved by",
      value: row.approved_by
        ? `${row.approved_by.slice(0, 8)} · ${row.approved_at ?? ""}`
        : "—",
    },
  ];
}

function buildExpenditureSections(
  row: ExpenditureEntryRow,
): EntryReviewSection[] {
  return [
    {
      label: "MDA",
      value: row.mdas?.name ?? row.mda_id,
    },
    {
      label: "Programme Area",
      value: row.programme_areas?.name ?? "—",
    },
    {
      label: "Category",
      value: row.expenditure_categories?.name ?? "—",
    },
    {
      label: "Item",
      value: row.expenditure_items?.name ?? "—",
    },
    {
      label: "AOP Activity",
      value: row.aop_activities
        ? `${row.aop_activities.activity_code} · ${row.aop_activities.description}`
        : "—",
    },
    {
      label: "Payment Method",
      value: row.payment_methods?.name ?? "—",
    },
    {
      label: "PHC",
      value: row.is_phc
        ? `${row.facilities?.name ?? "Unspecified facility"} · ${row.lgas?.name ?? "Unknown LGA"}`
        : "Non-PHC",
    },
    {
      label: "Voucher Reference",
      value: <code className="font-mono text-xs">{row.voucher_ref_no}</code>,
    },
    {
      label: "Amount",
      value: naira.format(Number(row.amount)),
    },
    {
      label: "Approved by",
      value: row.approved_by
        ? `${row.approved_by.slice(0, 8)} · ${row.approved_at ?? ""}`
        : "—",
    },
  ];
}
