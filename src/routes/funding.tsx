"use client";

import * as React from "react";
import Link from "next/link";
import {
  AlertCircleIcon,
  LandmarkIcon,
  PencilLineIcon,
  PlusIcon,
} from "lucide-react";
import { useAuth } from "@/components/auth/auth-provider";
import { LedgerEntryFilters } from "@/components/ledger/ledger-entry-filters";
import { LedgerEntryTableFooter } from "@/components/ledger/ledger-entry-table-footer";
import { PageHeader } from "@/components/layout/page-header";
import { OfflineDataNotice } from "@/components/offline/offline-data-notice";
import { PendingSyncCard } from "@/components/offline/pending-sync-card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { StatusBadge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Empty } from "@/components/ui/empty";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { fundingSubmittableMdaIds, isAdmin } from "@/lib/access";
import {
  listFundingEntries,
  type FundingEntryRow,
} from "@/lib/db/funding-entries";
import { listMdas } from "@/lib/db/reference-data";
import type { Tables } from "@/lib/db/types";
import { canEditFundingEntry } from "@/lib/funding/validation";
import {
  DEFAULT_LEDGER_ENTRY_FILTERS,
  filterFundingBySearch,
  paginateItems,
  toLedgerListQueryOptions,
  type LedgerEntryListFilters,
} from "@/lib/ledger/entry-list-filters";
import { formatCompactNaira, formatNaira } from "@/lib/format";
import { hasSupabaseConfig, supabase } from "@/lib/supabase";
import { readThroughCache } from "@/lib/offline/data-cache";
import { cn } from "@/lib/utils";

type CachedMda = Pick<Tables<"mdas">, "id" | "name" | "abbreviation">;

type LoadState = "idle" | "loading" | "ready" | "error";

export function FundingEntriesRoute() {
  const { user, profile } = useAuth();

  const [loadState, setLoadState] = React.useState<LoadState>("idle");
  const [loadError, setLoadError] = React.useState<string | null>(null);
  const [entries, setEntries] = React.useState<FundingEntryRow[]>([]);
  const [filters, setFilters] = React.useState<LedgerEntryListFilters>(
    DEFAULT_LEDGER_ENTRY_FILTERS,
  );
  const [page, setPage] = React.useState(1);
  const [mdas, setMdas] = React.useState<CachedMda[]>([]);
  const [cachedAt, setCachedAt] = React.useState<string | null>(null);

  const admin = isAdmin(profile);
  const assignedMdaIds = React.useMemo(
    () => fundingSubmittableMdaIds(profile),
    [profile],
  );

  const canCreate = admin || assignedMdaIds.length > 0;
  const noScope = !admin && assignedMdaIds.length === 0;
  const scopedMdaIds = admin ? undefined : assignedMdaIds;

  const visibleMdas = React.useMemo(() => {
    if (admin) return mdas;
    const allowed = new Set(assignedMdaIds);
    return mdas.filter((mda) => allowed.has(mda.id));
  }, [admin, assignedMdaIds, mdas]);

  const filteredEntries = React.useMemo(
    () => filterFundingBySearch(entries, filters.search),
    [entries, filters.search],
  );

  const pagination = React.useMemo(
    () => paginateItems(filteredEntries, page),
    [filteredEntries, page],
  );

  React.useEffect(() => {
    if (page !== pagination.page) {
      setPage(pagination.page);
    }
  }, [page, pagination.page]);

  React.useEffect(() => {
    setPage(1);
  }, [filters.status, filters.mdaId, filters.fiscalYear, filters.quarter]);

  React.useEffect(() => {
    if (!profile) return;
    if (!hasSupabaseConfig || !supabase) {
      setLoadState("ready");
      return;
    }
    if (noScope) {
      setEntries([]);
      setMdas([]);
      setLoadState("ready");
      return;
    }

    let active = true;
    setLoadState("loading");
    setLoadError(null);
    const cacheKey = `funding-entries:${admin ? "admin" : assignedMdaIds.slice().sort().join(",")}`;
    (async () => {
      try {
        const { data, fromCache, cachedAt: snapshotAt } =
          await readThroughCache(cacheKey, async () => {
            const [mdaList, entryList] = await Promise.all([
              listMdas(supabase!),
              listFundingEntries(
                supabase!,
                toLedgerListQueryOptions(filters, scopedMdaIds),
              ),
            ]);
            return {
              mdas: mdaList.map((mda) => ({
                id: mda.id,
                name: mda.name,
                abbreviation: mda.abbreviation,
              })) as CachedMda[],
              entries: entryList,
            };
          });
        if (!active) return;
        setMdas(data.mdas);
        setEntries(data.entries);
        setCachedAt(fromCache ? snapshotAt : null);
        setLoadState("ready");
      } catch (error) {
        if (!active) return;
        setLoadError(
          error instanceof Error ? error.message : "Failed to load entries.",
        );
        setLoadState("error");
      }
    })();
    return () => {
      active = false;
    };
  }, [admin, assignedMdaIds, filters, noScope, profile, scopedMdaIds]);

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        actions={
          <Link
            aria-disabled={!canCreate}
            href={canCreate ? "/funding/new" : "#"}
            tabIndex={canCreate ? undefined : -1}
            className={cn(
              buttonVariants(),
              !canCreate && "pointer-events-none opacity-50",
            )}
          >
            <PlusIcon aria-hidden="true" data-icon="inline-start" />
            New funding entry
          </Link>
        }
        description="Record funding received against assigned MDAs. Entries enter the pending queue and remain editable until a viewer acts."
        title="Funding Entries"
      />

      {!hasSupabaseConfig ? (
        <Alert variant="warning">
          <AlertTitle>Supabase is not configured</AlertTitle>
          <AlertDescription>
            Add `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`
            to `.env.local` to load funding data.
          </AlertDescription>
        </Alert>
      ) : null}

      {loadState === "error" ? (
        <Alert variant="destructive">
          <AlertTitle>We couldn&rsquo;t load funding entries</AlertTitle>
          <AlertDescription>{loadError}</AlertDescription>
        </Alert>
      ) : null}

      {noScope ? (
        <Alert>
          <AlertTitle>No assigned MDAs yet</AlertTitle>
          <AlertDescription>
            Ask an admin to add funding-entry access for the MDA you report on.
          </AlertDescription>
        </Alert>
      ) : null}

      {!noScope ? (
        <LedgerEntryFilters
          filters={filters}
          mdas={visibleMdas}
          searchPlaceholder="Public ID, reference, remarks, programme area"
          onChange={setFilters}
        />
      ) : null}

      <OfflineDataNotice cachedAt={cachedAt} />

      <FundingSummaryCards entries={filteredEntries} />

      <PendingSyncCard domain="funding" />

      <Card>
        <CardHeader className="flex-row items-end justify-between gap-4">
          <div className="flex flex-col gap-1">
            <CardTitle>Funding entries</CardTitle>
            <CardDescription>
              {admin
                ? "All submitted funding entries across the state."
                : "Entries for MDAs you are assigned to. Pending entries you authored remain editable."}
            </CardDescription>
          </div>
        </CardHeader>
        <CardContent>
          {loadState === "loading" ? (
            <div className="flex flex-col gap-2">
              <Skeleton className="h-10" />
              <Skeleton className="h-10" />
              <Skeleton className="h-10" />
            </div>
          ) : filteredEntries.length === 0 ? (
            <Empty
              description={
                canCreate
                  ? "Funding entries you record will appear here. Adjust filters or use the new entry button to capture your first one."
                  : "There are no funding entries to display for your assigned MDAs."
              }
              icon={LandmarkIcon}
              title="No funding entries yet"
            />
          ) : (
            <>
              <FundingEntriesTable
                entries={pagination.items}
                isAdmin={admin}
                submittableMdaIds={assignedMdaIds}
                userId={user?.id ?? null}
              />
              <LedgerEntryTableFooter
                page={pagination.page}
                pageCount={pagination.pageCount}
                rangeEnd={pagination.rangeEnd}
                rangeStart={pagination.rangeStart}
                total={pagination.total}
                onPageChange={setPage}
              />
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function FundingSummaryCards({ entries }: { entries: FundingEntryRow[] }) {
  const totals = React.useMemo(() => {
    let pending = 0;
    let approved = 0;
    let totalAmount = 0;
    for (const entry of entries) {
      if (entry.status === "pending") pending += 1;
      if (entry.status === "approved" || entry.status === "processed") {
        approved += 1;
      }
      totalAmount += Number(entry.amount);
    }
    return { pending, approved, totalAmount };
  }, [entries]);

  return (
    <section className="grid gap-4 md:grid-cols-3">
      <Card>
        <CardHeader>
          <CardDescription>Pending entries</CardDescription>
          <CardTitle className="text-2xl">{totals.pending}</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Awaiting viewer action. Editable while pending.
          </p>
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardDescription>Approved or processed</CardDescription>
          <CardTitle className="text-2xl">{totals.approved}</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Locked from normal editing once reviewed.
          </p>
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardDescription>Recorded total</CardDescription>
          <CardTitle className="text-2xl">
            {formatCompactNaira(totals.totalAmount)}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Across {entries.length} matching {entries.length === 1 ? "entry" : "entries"}.
          </p>
        </CardContent>
      </Card>
    </section>
  );
}

function FundingEntriesTable({
  entries,
  isAdmin: adminUser,
  submittableMdaIds: submittable,
  userId,
}: {
  entries: FundingEntryRow[];
  isAdmin: boolean;
  submittableMdaIds: string[];
  userId: string | null;
}) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Public ID</TableHead>
          <TableHead>Date · FY/Q</TableHead>
          <TableHead>MDA</TableHead>
          <TableHead>Programme Area</TableHead>
          <TableHead>Funding Source</TableHead>
          <TableHead>Reference</TableHead>
          <TableHead className="text-right">Amount</TableHead>
          <TableHead>Status</TableHead>
          <TableHead className="text-right">Actions</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {entries.map((entry) => {
          const editable = canEditFundingEntry(
            {
              status: entry.status,
              entered_by: entry.entered_by,
              mda_id: entry.mda_id,
            },
            {
              user_id: userId,
              submittable_mda_ids: submittable,
              is_admin: adminUser,
            },
          );
          return (
            <TableRow key={entry.id}>
              <TableCell className="font-medium">
                {entry.public_id ?? entry.id.slice(0, 8)}
              </TableCell>
              <TableCell className="whitespace-nowrap text-muted-foreground">
                <div className="flex flex-col">
                  <span>{entry.transaction_date}</span>
                  <span className="text-xs">
                    FY {entry.fiscal_year} · Q{entry.quarter}
                  </span>
                </div>
              </TableCell>
              <TableCell>
                {entry.mdas?.abbreviation ?? entry.mdas?.name ?? "—"}
              </TableCell>
              <TableCell>{entry.programme_areas?.name ?? "—"}</TableCell>
              <TableCell>{entry.funding_sources?.name ?? "—"}</TableCell>
              <TableCell className="font-mono text-xs">
                {entry.reference_no}
              </TableCell>
              <TableCell className="text-right tabular-nums">
                {formatNaira(Number(entry.amount))}
              </TableCell>
              <TableCell>
                <StatusBadge status={entry.status} />
              </TableCell>
              <TableCell className="text-right">
                {editable ? (
                  <Link
                    href={`/funding/${entry.id}/edit`}
                    className={cn(
                      buttonVariants({ variant: "outline", size: "sm" }),
                    )}
                  >
                    <PencilLineIcon
                      aria-hidden="true"
                      data-icon="inline-start"
                    />
                    Edit
                  </Link>
                ) : (
                  <span
                    className="inline-flex items-center gap-1 text-xs text-muted-foreground"
                    title={
                      entry.status === "pending"
                        ? "You can only edit your own pending entries on assigned MDAs."
                        : "Reviewed entries are locked from normal editing."
                    }
                  >
                    <AlertCircleIcon aria-hidden="true" className="size-3.5" />
                    Locked
                  </span>
                )}
              </TableCell>
            </TableRow>
          );
        })}
      </TableBody>
    </Table>
  );
}
