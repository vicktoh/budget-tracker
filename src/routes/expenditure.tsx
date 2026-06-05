"use client";

import * as React from "react";
import Link from "next/link";
import {
  AlertCircleIcon,
  PencilLineIcon,
  PlusIcon,
  ReceiptTextIcon,
} from "lucide-react";
import { useAuth } from "@/components/auth/auth-provider";
import { PageHeader } from "@/components/layout/page-header";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { StatusBadge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
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
import {
  isAdmin,
  submittableMdaIds,
  viewableMdaIds,
} from "@/lib/access";
import {
  listExpenditureEntries,
  type ExpenditureEntryRow,
} from "@/lib/db/expenditure-entries";
import { canEditExpenditureEntry } from "@/lib/expenditure/validation";
import { hasSupabaseConfig, supabase } from "@/lib/supabase";
import { cn } from "@/lib/utils";

type LoadState = "idle" | "loading" | "ready" | "error";

const naira = new Intl.NumberFormat("en-NG", {
  style: "currency",
  currency: "NGN",
  maximumFractionDigits: 2,
});

export function ExpenditureEntriesRoute() {
  const { user, profile } = useAuth();

  const [loadState, setLoadState] = React.useState<LoadState>("idle");
  const [loadError, setLoadError] = React.useState<string | null>(null);
  const [entries, setEntries] = React.useState<ExpenditureEntryRow[]>([]);

  const admin = isAdmin(profile);
  const submittableIds = React.useMemo(
    () => submittableMdaIds(profile),
    [profile],
  );
  const viewableIds = React.useMemo(() => viewableMdaIds(profile), [profile]);

  const canCreate = admin || submittableIds.length > 0;

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
        const entryList = await listExpenditureEntries(supabase!, {
          mdaIds: admin ? undefined : viewableIds,
          limit: 50,
        });
        if (!active) return;
        setEntries(entryList);
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
  }, [admin, profile, viewableIds]);

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        actions={
          <Link
            aria-disabled={!canCreate}
            href={canCreate ? "/expenditure/new" : "#"}
            tabIndex={canCreate ? undefined : -1}
            className={cn(
              buttonVariants(),
              !canCreate && "pointer-events-none opacity-50",
            )}
          >
            <PlusIcon aria-hidden="true" data-icon="inline-start" />
            New expenditure entry
          </Link>
        }
        description="Record expenditure paid against assigned MDAs. Entries enter the pending queue and remain editable until a reviewer acts."
        title="Expenditure Entries"
      />

      {!hasSupabaseConfig ? (
        <Alert variant="warning">
          <AlertTitle>Supabase is not configured</AlertTitle>
          <AlertDescription>
            Add `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`
            to `.env.local` to load expenditure data.
          </AlertDescription>
        </Alert>
      ) : null}

      {loadState === "error" ? (
        <Alert variant="destructive">
          <AlertTitle>We couldn&rsquo;t load expenditure entries</AlertTitle>
          <AlertDescription>{loadError}</AlertDescription>
        </Alert>
      ) : null}

      {!canCreate && profile?.role === "mda_user" ? (
        <Alert>
          <AlertTitle>No assigned MDAs yet</AlertTitle>
          <AlertDescription>
            Ask an admin to add a submitter membership for the MDA you report on.
            You can still view entries for any MDA you have membership in.
          </AlertDescription>
        </Alert>
      ) : null}

      <ExpenditureSummaryCards entries={entries} />

      <Card>
        <CardHeader className="flex-row items-end justify-between gap-4">
          <div className="flex flex-col gap-1">
            <CardTitle>Recent expenditure entries</CardTitle>
            <CardDescription>
              {admin
                ? "All submitted expenditure entries across the state."
                : "Entries for MDAs you can view. Pending entries you authored remain editable."}
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
          ) : entries.length === 0 ? (
            <Empty
              description={
                canCreate
                  ? "Expenditure entries you record will appear here. Use the new entry button to capture your first one."
                  : "There are no expenditure entries to display for the MDAs you can view."
              }
              icon={ReceiptTextIcon}
              title="No expenditure entries yet"
            />
          ) : (
            <ExpenditureEntriesTable
              entries={entries}
              isAdmin={admin}
              submittableMdaIds={submittableIds}
              userId={user?.id ?? null}
            />
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function ExpenditureSummaryCards({
  entries,
}: {
  entries: ExpenditureEntryRow[];
}) {
  const totals = React.useMemo(() => {
    let pending = 0;
    let approved = 0;
    let phc = 0;
    let totalAmount = 0;
    for (const entry of entries) {
      if (entry.status === "pending") pending += 1;
      if (entry.status === "approved" || entry.status === "processed") {
        approved += 1;
      }
      if (entry.is_phc) phc += 1;
      totalAmount += Number(entry.amount);
    }
    return { pending, approved, phc, totalAmount };
  }, [entries]);

  return (
    <section className="grid gap-4 md:grid-cols-4">
      <Card>
        <CardHeader>
          <CardDescription>Pending entries</CardDescription>
          <CardTitle className="text-2xl">{totals.pending}</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Awaiting reviewer action. Editable while pending.
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
          <CardDescription>PHC entries</CardDescription>
          <CardTitle className="text-2xl">{totals.phc}</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Routed through PHC LGA / facility reporting.
          </p>
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardDescription>Recorded total</CardDescription>
          <CardTitle className="text-2xl">
            {naira.format(totals.totalAmount)}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Across the most recent {entries.length} entries.
          </p>
        </CardContent>
      </Card>
    </section>
  );
}

function ExpenditureEntriesTable({
  entries,
  isAdmin: adminUser,
  submittableMdaIds: submittable,
  userId,
}: {
  entries: ExpenditureEntryRow[];
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
          <TableHead>Category</TableHead>
          <TableHead>PHC</TableHead>
          <TableHead>Voucher</TableHead>
          <TableHead className="text-right">Amount</TableHead>
          <TableHead>Status</TableHead>
          <TableHead className="text-right">Actions</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {entries.map((entry) => {
          const editable = canEditExpenditureEntry(
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
                      {entry.facilities?.name ?? "Unspecified facility"}
                    </span>
                  </div>
                ) : (
                  <span className="text-xs text-muted-foreground">—</span>
                )}
              </TableCell>
              <TableCell className="font-mono text-xs">
                {entry.voucher_ref_no}
              </TableCell>
              <TableCell className="text-right tabular-nums">
                {naira.format(Number(entry.amount))}
              </TableCell>
              <TableCell>
                <StatusBadge status={entry.status} />
              </TableCell>
              <TableCell className="text-right">
                {editable ? (
                  <Link
                    href={`/expenditure/${entry.id}/edit`}
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
