"use client";

import * as React from "react";
import Link from "next/link";
import {
  AlertCircleIcon,
  ChevronRightIcon,
  ClipboardCheckIcon,
} from "lucide-react";
import { useAuth } from "@/components/auth/auth-provider";
import { LedgerEntryTableFooter } from "@/components/ledger/ledger-entry-table-footer";
import {
  QuarterFilterPills,
  type QuarterFilterValue,
} from "@/components/ledger/ledger-entry-filters";
import { PageHeader } from "@/components/layout/page-header";
import { OfflineDataNotice } from "@/components/offline/offline-data-notice";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge, StatusBadge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Empty } from "@/components/ui/empty";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { isAdmin, isReviewer, reviewableMdaIds } from "@/lib/access";
import {
  listExpenditureEntries,
  type ExpenditureEntryRow,
} from "@/lib/db/expenditure-entries";
import {
  listFundingEntries,
  type FundingEntryRow,
} from "@/lib/db/funding-entries";
import { listMdas } from "@/lib/db/reference-data";
import type { EntryStatusSlug, Tables } from "@/lib/db/types";
import { hasSupabaseConfig, supabase } from "@/lib/supabase";
import { readThroughCache } from "@/lib/offline/data-cache";
import {
  filterExpenditureBySearch,
  filterFundingBySearch,
  paginateItems,
} from "@/lib/ledger/entry-list-filters";
import { formatNaira } from "@/lib/format";
import { cn } from "@/lib/utils";

type EntryTab = "funding" | "expenditure";
type LoadState = "idle" | "loading" | "ready" | "error";

type ReviewFilters = {
  status: "all" | EntryStatusSlug;
  mdaId: string;
  fiscalYear: string;
  quarter: QuarterFilterValue;
  dateFrom: string;
  dateTo: string;
  search: string;
};

const STATUS_OPTIONS: { value: ReviewFilters["status"]; label: string }[] = [
  { value: "all", label: "All statuses" },
  { value: "pending", label: "Pending" },
  { value: "approved", label: "Approved" },
  { value: "processed", label: "Processed" },
  { value: "rejected", label: "Rejected" },
];

const DEFAULT_FILTERS: ReviewFilters = {
  status: "pending",
  mdaId: "all",
  fiscalYear: "",
  quarter: "all",
  dateFrom: "",
  dateTo: "",
  search: "",
};

export function ReviewRoute() {
  const { profile } = useAuth();

  const admin = isAdmin(profile);
  // Reviewers review every MDA, so they bypass the per-MDA filter like admins.
  const isGlobalReviewer = admin || isReviewer(profile);
  const reviewableIds = React.useMemo(
    () => reviewableMdaIds(profile),
    [profile],
  );

  const [tab, setTab] = React.useState<EntryTab>("funding");
  const [filters, setFilters] = React.useState<ReviewFilters>(DEFAULT_FILTERS);
  const [fundingPage, setFundingPage] = React.useState(1);
  const [expenditurePage, setExpenditurePage] = React.useState(1);

  const [mdas, setMdas] = React.useState<
    Pick<Tables<"mdas">, "id" | "name" | "abbreviation">[]
  >([]);
  const [fundingEntries, setFundingEntries] = React.useState<FundingEntryRow[]>(
    [],
  );
  const [expenditureEntries, setExpenditureEntries] = React.useState<
    ExpenditureEntryRow[]
  >([]);
  const [loadState, setLoadState] = React.useState<LoadState>("idle");
  const [loadError, setLoadError] = React.useState<string | null>(null);
  const [cachedAt, setCachedAt] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (!profile) return;
    if (!hasSupabaseConfig || !supabase) {
      setLoadState("ready");
      return;
    }

    let active = true;
    setLoadState("loading");
    setLoadError(null);

    (async () => {
      try {
        // Admins and reviewers see every MDA (undefined bypasses the filter);
        // MDA-scoped viewers are limited to their explicit MDA ids.
        const mdaScope = isGlobalReviewer ? undefined : reviewableIds;
        const status = filters.status === "all" ? undefined : filters.status;
        const fiscalYear = filters.fiscalYear
          ? Number(filters.fiscalYear)
          : undefined;
        const quarter =
          filters.quarter === "all" ? undefined : Number(filters.quarter);
        const mdaIdFilter =
          filters.mdaId !== "all" ? [filters.mdaId] : mdaScope;

        const skipFetch =
          !isGlobalReviewer && reviewableIds.length === 0;

        const cacheKey = `review-queue:${isGlobalReviewer ? "global" : reviewableIds.slice().sort().join(",")}`;
        const { data, fromCache, cachedAt: snapshotAt } =
          await readThroughCache(cacheKey, async () => {
            const [mdaList, funding, expenditure] = await Promise.all([
              listMdas(supabase!),
              skipFetch
                ? Promise.resolve([] as FundingEntryRow[])
                : listFundingEntries(supabase!, {
                    mdaIds: mdaIdFilter,
                    status,
                    fiscalYear,
                    quarter,
                    dateFrom: filters.dateFrom || undefined,
                    dateTo: filters.dateTo || undefined,
                    limit: 100,
                  }),
              skipFetch
                ? Promise.resolve([] as ExpenditureEntryRow[])
                : listExpenditureEntries(supabase!, {
                    mdaIds: mdaIdFilter,
                    status,
                    fiscalYear,
                    quarter,
                    dateFrom: filters.dateFrom || undefined,
                    dateTo: filters.dateTo || undefined,
                    limit: 100,
                  }),
            ]);
            return {
              mdas: mdaList.map((m) => ({
                id: m.id,
                name: m.name,
                abbreviation: m.abbreviation,
              })),
              funding,
              expenditure,
            };
          });

        if (!active) return;
        setMdas(data.mdas);
        setFundingEntries(data.funding);
        setExpenditureEntries(data.expenditure);
        setCachedAt(fromCache ? snapshotAt : null);
        setLoadState("ready");
      } catch (error) {
        if (!active) return;
        setLoadError(
          error instanceof Error
            ? error.message
            : "Failed to load the review queue.",
        );
        setLoadState("error");
      }
    })();

    return () => {
      active = false;
    };
  }, [isGlobalReviewer, filters, profile, reviewableIds]);

  // The MDA filter dropdown shows only MDAs the user can act on.
  const visibleMdas = React.useMemo(() => {
    if (isGlobalReviewer) return mdas;
    const allowed = new Set(reviewableIds);
    return mdas.filter((m) => allowed.has(m.id));
  }, [isGlobalReviewer, mdas, reviewableIds]);

  const searchedFunding = React.useMemo(
    () => filterFundingBySearch(fundingEntries, filters.search),
    [fundingEntries, filters.search],
  );
  const searchedExpenditure = React.useMemo(
    () => filterExpenditureBySearch(expenditureEntries, filters.search),
    [expenditureEntries, filters.search],
  );

  const fundingPagination = React.useMemo(
    () => paginateItems(searchedFunding, fundingPage),
    [searchedFunding, fundingPage],
  );
  const expenditurePagination = React.useMemo(
    () => paginateItems(searchedExpenditure, expenditurePage),
    [searchedExpenditure, expenditurePage],
  );

  React.useEffect(() => {
    setFundingPage(1);
    setExpenditurePage(1);
  }, [
    filters.status,
    filters.mdaId,
    filters.fiscalYear,
    filters.quarter,
    filters.dateFrom,
    filters.dateTo,
  ]);

  React.useEffect(() => {
    if (fundingPage !== fundingPagination.page) {
      setFundingPage(fundingPagination.page);
    }
  }, [fundingPage, fundingPagination.page]);

  React.useEffect(() => {
    if (expenditurePage !== expenditurePagination.page) {
      setExpenditurePage(expenditurePagination.page);
    }
  }, [expenditurePage, expenditurePagination.page]);

  const noScope = !isGlobalReviewer && reviewableIds.length === 0;

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        description="Approve, reject, or process submitted Funding and Expenditure entries across every MDA in the state."
        title="Review Queue"
      />

      {!hasSupabaseConfig ? (
        <Alert variant="warning">
          <AlertTitle>Supabase is not configured</AlertTitle>
          <AlertDescription>
            Add Supabase environment variables to load the review queue.
          </AlertDescription>
        </Alert>
      ) : null}

      {noScope ? (
        <Alert>
          <AlertTitle>No viewer assignments yet</AlertTitle>
          <AlertDescription>
            Ask an admin to grant you the Viewer role to review entries.
          </AlertDescription>
        </Alert>
      ) : null}

      {loadState === "error" ? (
        <Alert variant="destructive">
          <AlertTitle>We couldn&rsquo;t load the queue</AlertTitle>
          <AlertDescription>{loadError}</AlertDescription>
        </Alert>
      ) : null}

      <OfflineDataNotice cachedAt={cachedAt} />

      <ReviewFiltersPanel
        filters={filters}
        mdas={visibleMdas}
        onChange={setFilters}
      />

      <Tabs
        value={tab}
        defaultValue="funding"
        onValueChange={(v) => setTab(v as EntryTab)}
      >
        <TabsList>
          <TabsTrigger value="funding">
            Funding
            <Badge className="ml-2" variant="secondary">
              {searchedFunding.length}
            </Badge>
          </TabsTrigger>
          <TabsTrigger value="expenditure">
            Expenditure
            <Badge className="ml-2" variant="secondary">
              {searchedExpenditure.length}
            </Badge>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="funding">
          <Card>
            <CardHeader>
              <CardTitle>Funding entries</CardTitle>
              <CardDescription>
                Click a row to open the entry, see comments and audit history,
                and act on it.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {loadState === "loading" ? (
                <QueueSkeleton />
              ) : searchedFunding.length === 0 ? (
                <Empty
                  description="No funding entries match the current filters."
                  icon={ClipboardCheckIcon}
                  title="Nothing to review"
                />
              ) : (
                <>
                  <FundingQueueTable entries={fundingPagination.items} />
                  <LedgerEntryTableFooter
                    page={fundingPagination.page}
                    pageCount={fundingPagination.pageCount}
                    rangeEnd={fundingPagination.rangeEnd}
                    rangeStart={fundingPagination.rangeStart}
                    total={fundingPagination.total}
                    onPageChange={setFundingPage}
                  />
                </>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="expenditure">
          <Card>
            <CardHeader>
              <CardTitle>Expenditure entries</CardTitle>
              <CardDescription>
                Click a row to open the entry, see comments and audit history,
                and act on it.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {loadState === "loading" ? (
                <QueueSkeleton />
              ) : searchedExpenditure.length === 0 ? (
                <Empty
                  description="No expenditure entries match the current filters."
                  icon={ClipboardCheckIcon}
                  title="Nothing to review"
                />
              ) : (
                <>
                  <ExpenditureQueueTable entries={expenditurePagination.items} />
                  <LedgerEntryTableFooter
                    page={expenditurePagination.page}
                    pageCount={expenditurePagination.pageCount}
                    rangeEnd={expenditurePagination.rangeEnd}
                    rangeStart={expenditurePagination.rangeStart}
                    total={expenditurePagination.total}
                    onPageChange={setExpenditurePage}
                  />
                </>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

function ReviewFiltersPanel({
  filters,
  mdas,
  onChange,
}: {
  filters: ReviewFilters;
  mdas: Pick<Tables<"mdas">, "id" | "name" | "abbreviation">[];
  onChange: (next: ReviewFilters) => void;
}) {
  function update<K extends keyof ReviewFilters>(
    key: K,
    value: ReviewFilters[K],
  ) {
    onChange({ ...filters, [key]: value });
  }

  return (
    <div className="flex flex-col gap-3 rounded-lg border bg-card p-3">
      <div className="grid gap-3 md:grid-cols-6">
      <label className="flex flex-col gap-1 text-xs font-medium text-muted-foreground md:col-span-2">
        Search
        <Input
          placeholder="Public ID, reference, voucher, remarks"
          value={filters.search}
          onChange={(event) => update("search", event.target.value)}
        />
      </label>
      <label className="flex flex-col gap-1 text-xs font-medium text-muted-foreground">
        Status
        <Select
          value={filters.status}
          onChange={(event) =>
            update("status", event.target.value as ReviewFilters["status"])
          }
        >
          {STATUS_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </Select>
      </label>
      <label className="flex flex-col gap-1 text-xs font-medium text-muted-foreground">
        MDA
        <Select
          value={filters.mdaId}
          onChange={(event) => update("mdaId", event.target.value)}
        >
          <option value="all">All MDAs</option>
          {mdas.map((mda) => (
            <option key={mda.id} value={mda.id}>
              {mda.abbreviation ?? mda.name}
            </option>
          ))}
        </Select>
      </label>
      <label className="flex flex-col gap-1 text-xs font-medium text-muted-foreground">
        Fiscal year
        <Input
          inputMode="numeric"
          placeholder="2026"
          value={filters.fiscalYear}
          onChange={(event) =>
            update("fiscalYear", event.target.value.replace(/[^0-9]/g, ""))
          }
        />
      </label>
      <div className="grid grid-cols-2 gap-2">
        <label className="flex flex-col gap-1 text-xs font-medium text-muted-foreground">
          From
          <Input
            type="date"
            value={filters.dateFrom}
            onChange={(event) => update("dateFrom", event.target.value)}
          />
        </label>
        <label className="flex flex-col gap-1 text-xs font-medium text-muted-foreground">
          To
          <Input
            type="date"
            value={filters.dateTo}
            onChange={(event) => update("dateTo", event.target.value)}
          />
        </label>
      </div>
      </div>
      <QuarterFilterPills
        value={filters.quarter}
        onChange={(quarter) => update("quarter", quarter)}
      />
    </div>
  );
}

function FundingQueueTable({ entries }: { entries: FundingEntryRow[] }) {
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
          <TableHead className="text-right">Open</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {entries.map((entry) => (
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
              <Link
                href={`/review/funding/${entry.id}`}
                className={cn(
                  buttonVariants({ variant: "outline", size: "sm" }),
                )}
              >
                Open
                <ChevronRightIcon
                  aria-hidden="true"
                  data-icon="inline-end"
                />
              </Link>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

function ExpenditureQueueTable({
  entries,
}: {
  entries: ExpenditureEntryRow[];
}) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Public ID</TableHead>
          <TableHead>Date · FY/Q</TableHead>
          <TableHead>MDA</TableHead>
          <TableHead>Programme Area</TableHead>
          <TableHead>Category</TableHead>
          <TableHead>PHC</TableHead>
          <TableHead>Voucher</TableHead>
          <TableHead className="text-right">Amount</TableHead>
          <TableHead>Status</TableHead>
          <TableHead className="text-right">Open</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {entries.map((entry) => (
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
            <TableCell>
              <div className="flex flex-col">
                <span>{entry.expenditure_categories?.name ?? "—"}</span>
                {entry.expenditure_items?.name ? (
                  <span className="text-xs text-muted-foreground">
                    {entry.expenditure_items.name}
                  </span>
                ) : null}
              </div>
            </TableCell>
            <TableCell>
              {entry.is_phc ? (
                <div className="flex flex-col">
                  <span className="text-xs font-semibold text-status-approved">
                    PHC
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {entry.facilities?.name ?? "Unspecified"}
                  </span>
                </div>
              ) : (
                <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                  <AlertCircleIcon aria-hidden="true" className="size-3.5" />
                  Non-PHC
                </span>
              )}
            </TableCell>
            <TableCell className="font-mono text-xs">
              {entry.voucher_ref_no}
            </TableCell>
            <TableCell className="text-right tabular-nums">
              {formatNaira(Number(entry.amount))}
            </TableCell>
            <TableCell>
              <StatusBadge status={entry.status} />
            </TableCell>
            <TableCell className="text-right">
              <Link
                href={`/review/expenditure/${entry.id}`}
                className={cn(
                  buttonVariants({ variant: "outline", size: "sm" }),
                )}
              >
                Open
                <ChevronRightIcon
                  aria-hidden="true"
                  data-icon="inline-end"
                />
              </Link>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

function QueueSkeleton() {
  return (
    <div className="flex flex-col gap-2">
      <Skeleton className="h-10" />
      <Skeleton className="h-10" />
      <Skeleton className="h-10" />
      <Skeleton className="h-10" />
    </div>
  );
}
