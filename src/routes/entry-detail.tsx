"use client";

import * as React from "react";
import Link from "next/link";
import { ArrowLeftIcon } from "lucide-react";
import { useAuth } from "@/components/auth/auth-provider";
import { EntryDetail, type EntryDetailSection } from "@/components/entries/entry-detail";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Skeleton } from "@/components/ui/skeleton";
import { isAdmin } from "@/lib/access";
import { getLatestBirPublication, listBirAmendments } from "@/lib/db/bir-publications";
import { listEntryAttachments, listEntryAuditEvents, listEntryComments, type EntryAttachmentRow, type EntryAuditEventRow, type EntryCommentRow } from "@/lib/db/entries";
import { getExpenditureEntry, type ExpenditureEntryRow } from "@/lib/db/expenditure-entries";
import { getFundingEntry, type FundingEntryRow } from "@/lib/db/funding-entries";
import { listEntryDataQualityWarnings } from "@/lib/db/data-quality-warnings";
import type { BirAmendment, EntryType, FiscalQuarter } from "@/lib/db/types";
import { formatFundingSourceSummary } from "@/lib/expenditure/funding-allocations";
import { formatNaira } from "@/lib/format";
import { hasSupabaseConfig, supabase } from "@/lib/supabase";

type Mode = { kind: "funding" | "expenditure"; entryId: string };
export function EntryDetailRoute({ mode }: { mode: Mode }) {
  const { user, profile } = useAuth();
  const entryType: EntryType = mode.kind === "funding" ? "funding_entry" : "expenditure_entry";
  const [entry, setEntry] = React.useState<FundingEntryRow | ExpenditureEntryRow | null>(null);
  const [comments, setComments] = React.useState<EntryCommentRow[]>([]);
  const [attachments, setAttachments] = React.useState<EntryAttachmentRow[]>([]);
  const [audit, setAudit] = React.useState<EntryAuditEventRow[]>([]);
  const [amendments, setAmendments] = React.useState<BirAmendment[]>([]);
  const [publishedVersion, setPublishedVersion] = React.useState<number | null>(null);
  const [warnings, setWarnings] = React.useState<string[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [sidecarError, setSidecarError] = React.useState<string | null>(null);
  const [tick, setTick] = React.useState(0);
  React.useEffect(() => {
    if (!profile || !supabase) { setLoading(false); return; }
    let active = true; setLoading(true);
    (async () => {
      try {
        const loaded = mode.kind === "funding" ? await getFundingEntry(supabase!, mode.entryId) : await getExpenditureEntry(supabase!, mode.entryId);
        if (!loaded) throw new Error("Entry not found or not visible in your scope.");
        if (!active) return; setEntry(loaded);
        const results = await Promise.allSettled([
          listEntryComments(supabase!, entryType, mode.entryId), listEntryAttachments(supabase!, entryType, mode.entryId),
          listEntryAuditEvents(supabase!, entryType, mode.entryId), listEntryDataQualityWarnings(supabase!, entryType, mode.entryId),
          listBirAmendments(supabase!, entryType, mode.entryId),
          getLatestBirPublication(supabase!, { fiscalYear: loaded.fiscal_year, quarter: loaded.quarter as FiscalQuarter }),
        ]);
        if (!active) return;
        if (results[0].status === "fulfilled") setComments(results[0].value); else setSidecarError("Some related details could not load.");
        if (results[1].status === "fulfilled") setAttachments(results[1].value);
        if (results[2].status === "fulfilled") setAudit(results[2].value);
        if (results[3].status === "fulfilled") setWarnings(results[3].value.map((warning) => warning.message));
        if (results[4].status === "fulfilled") setAmendments(results[4].value);
        if (results[5].status === "fulfilled") setPublishedVersion(results[5].value?.version ?? null);
        setError(null);
      } catch (cause) { if (active) setError(cause instanceof Error ? cause.message : "Could not load entry."); }
      finally { if (active) setLoading(false); }
    })();
    return () => { active = false; };
  }, [profile, mode.kind, mode.entryId, entryType, tick]);
  const layout = (children: React.ReactNode) => <div className="flex flex-col gap-5"><Link href="/entries" className="inline-flex w-fit items-center gap-1 text-sm text-muted-foreground hover:text-foreground"><ArrowLeftIcon className="size-4" /> Back to Entry Register</Link>{children}</div>;
  if (!hasSupabaseConfig) return layout(<Alert variant="warning"><AlertTitle>Supabase is not configured</AlertTitle><AlertDescription>Configure Supabase to load entry details.</AlertDescription></Alert>);
  if (loading) return layout(<><Skeleton className="h-48" /><Skeleton className="h-48" /></>);
  if (error || !entry) return layout(<Alert variant="destructive"><AlertTitle>Could not load entry</AlertTitle><AlertDescription>{error}</AlertDescription></Alert>);
  const sections = mode.kind === "funding" ? fundingSections(entry as FundingEntryRow) : expenditureSections(entry as ExpenditureEntryRow);
  const editHref = mode.kind === "funding" ? `/funding/${entry.id}/edit` : `/expenditure/${entry.id}/edit`;
  return layout(<>{warnings.map((warning) => <Alert key={warning} variant="warning"><AlertTitle>Data quality warning</AlertTitle><AlertDescription>{warning}</AlertDescription></Alert>)}<EntryDetail entryType={entryType} entry={{ id: entry.id, publicId: entry.public_id, transactionDate: entry.transaction_date, fiscalYear: entry.fiscal_year, quarter: entry.quarter, mdaLabel: entry.mdas?.abbreviation ?? entry.mdas?.name ?? entry.mda_id, amount: Number(entry.amount) }} sections={sections} remarks={entry.remarks} currentUserId={user?.id ?? null} comments={comments} attachments={attachments} auditEvents={audit} amendments={amendments} publishedVersion={publishedVersion} canAmend={isAdmin(profile) && publishedVersion !== null} editHref={editHref} loadError={sidecarError} onRefresh={() => setTick((v) => v + 1)} /></>);
}

function fundingSections(row: FundingEntryRow): EntryDetailSection[] { return [
  { label: "MDA", value: row.mdas?.name }, { label: "Programme area", value: row.programme_areas?.name },
  { label: "Funding source", value: row.funding_sources?.name }, { label: "Reference", value: row.reference_no },
]; }
function expenditureSections(row: ExpenditureEntryRow): EntryDetailSection[] { return [
  { label: "MDA", value: row.mdas?.name }, { label: "Programme area", value: row.programme_areas?.name },
  { label: "Category", value: row.expenditure_categories?.name }, { label: "Item", value: row.expenditure_items?.name },
  { label: "Payment method", value: row.payment_methods?.name }, { label: "Voucher reference", value: row.voucher_ref_no },
  { label: "PHC", value: row.is_phc ? `${row.facilities?.name ?? "Facility"} · ${row.lgas?.name ?? "LGA"}` : "Non-PHC" },
  { label: "Funding sources", value: (row.expenditure_funding_allocations ?? []).length ? (row.expenditure_funding_allocations ?? []).map((a) => `${a.funding_sources?.name ?? "Source"} · ${formatNaira(Number(a.amount))}`).join("; ") : formatFundingSourceSummary([]), full: true },
]; }
