"use client";

import * as React from "react";
import Link from "next/link";
import { LockIcon, MessageSquareIcon } from "lucide-react";
import { useAuth } from "@/components/auth/auth-provider";
import { PageHeader } from "@/components/layout/page-header";
import { QuarterFilterPills, type QuarterFilterValue } from "@/components/ledger/ledger-entry-filters";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { isAdmin, isReviewer, viewableMdaIds } from "@/lib/access";
import { listBirPublications } from "@/lib/db/bir-publications";
import { listExpenditureEntries, type ExpenditureEntryRow } from "@/lib/db/expenditure-entries";
import { listFundingEntries, type FundingEntryRow } from "@/lib/db/funding-entries";
import { filterExpenditureBySearch, filterFundingBySearch } from "@/lib/ledger/entry-list-filters";
import { formatNaira } from "@/lib/format";
import { hasSupabaseConfig, supabase } from "@/lib/supabase";

type Filters = { search: string; fiscalYear: string; quarter: QuarterFilterValue };
const defaults: Filters = { search: "", fiscalYear: "", quarter: "all" };

export function EntriesRoute() {
  const { profile } = useAuth();
  const [filters, setFilters] = React.useState(defaults);
  const [funding, setFunding] = React.useState<FundingEntryRow[]>([]);
  const [expenditure, setExpenditure] = React.useState<ExpenditureEntryRow[]>([]);
  const [published, setPublished] = React.useState(new Set<string>());
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (!profile || !supabase) { setLoading(false); return; }
    let active = true;
    setLoading(true);
    const statewide = isAdmin(profile) || isReviewer(profile);
    const mdaIds = statewide ? undefined : viewableMdaIds(profile);
    const fiscalYear = filters.fiscalYear ? Number(filters.fiscalYear) : undefined;
    const quarter = filters.quarter === "all" ? undefined : Number(filters.quarter);
    Promise.all([
      listFundingEntries(supabase, { mdaIds, fiscalYear, quarter, limit: 250 }),
      listExpenditureEntries(supabase, { mdaIds, fiscalYear, quarter, limit: 250 }),
      listBirPublications(supabase, fiscalYear),
    ]).then(([fundingRows, expenditureRows, publications]) => {
      if (!active) return;
      setFunding(fundingRows);
      setExpenditure(expenditureRows);
      setPublished(new Set(publications.map((row) => `${row.fiscal_year}:${row.quarter}`)));
      setError(null);
    }).catch((cause: { message?: string }) => {
      if (active) setError(cause.message ?? "Could not load the entry register.");
    }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [profile, filters.fiscalYear, filters.quarter]);

  const fundingRows = filterFundingBySearch(funding, filters.search);
  const expenditureRows = filterExpenditureBySearch(expenditure, filters.search);
  const lockedCount = [...fundingRows, ...expenditureRows].filter(
    (row) => published.has(`${row.fiscal_year}:${row.quarter}`),
  ).length;
  const financialTotal = [...fundingRows, ...expenditureRows].reduce((sum, row) => sum + Number(row.amount), 0);

  if (!hasSupabaseConfig || !supabase) {
    return <Alert variant="warning"><AlertTitle>Supabase is not configured</AlertTitle><AlertDescription>Configure Supabase to load entries.</AlertDescription></Alert>;
  }

  return (
    <div className="flex flex-col gap-5">
      <PageHeader title="Entry Register" description="View recorded funding and expenditure, open entry details, and participate in comments." />
      {error ? <Alert variant="destructive"><AlertTitle>Could not load entries</AlertTitle><AlertDescription>{error}</AlertDescription></Alert> : null}
      <section className="grid gap-4 md:grid-cols-3">
        <Card><CardHeader><CardDescription>Total entries</CardDescription><CardTitle>{fundingRows.length + expenditureRows.length}</CardTitle></CardHeader></Card>
        <Card><CardHeader><CardDescription>Published-quarter locks</CardDescription><CardTitle>{lockedCount}</CardTitle></CardHeader></Card>
        <Card><CardHeader><CardDescription>Combined financial value</CardDescription><CardTitle>{formatNaira(financialTotal)}</CardTitle></CardHeader></Card>
      </section>
      <section className="flex flex-wrap items-end gap-3 rounded-lg border bg-card p-4">
        <label className="grid gap-1 text-sm">Search<Input value={filters.search} onChange={(e) => setFilters((v) => ({ ...v, search: e.target.value }))} placeholder="ID, reference, MDA…" /></label>
        <label className="grid gap-1 text-sm">Fiscal year<Select value={filters.fiscalYear} onChange={(e) => setFilters((v) => ({ ...v, fiscalYear: e.target.value }))}><option value="">All years</option>{Array.from(new Set([...funding, ...expenditure].map((row) => row.fiscal_year))).sort((a,b) => b-a).map((year) => <option key={year} value={year}>FY {year}</option>)}</Select></label>
        <QuarterFilterPills value={filters.quarter} onChange={(quarter) => setFilters((v) => ({ ...v, quarter }))} />
      </section>
      <Tabs defaultValue="funding">
        <TabsList><TabsTrigger value="funding">Funding ({fundingRows.length})</TabsTrigger><TabsTrigger value="expenditure">Expenditure ({expenditureRows.length})</TabsTrigger></TabsList>
        <TabsContent value="funding"><EntryTable loading={loading} rows={fundingRows.map((row) => ({ id: row.id, kind: "funding", publicId: row.public_id, reference: row.reference_no, date: row.transaction_date, mda: row.mdas?.name ?? "—", amount: Number(row.amount), locked: published.has(`${row.fiscal_year}:${row.quarter}`) }))} /></TabsContent>
        <TabsContent value="expenditure"><EntryTable loading={loading} rows={expenditureRows.map((row) => ({ id: row.id, kind: "expenditure", publicId: row.public_id, reference: row.voucher_ref_no, date: row.transaction_date, mda: row.mdas?.name ?? "—", amount: Number(row.amount), locked: published.has(`${row.fiscal_year}:${row.quarter}`) }))} /></TabsContent>
      </Tabs>
    </div>
  );
}

type RegisterRow = { id: string; kind: "funding" | "expenditure"; publicId: string | null; reference: string; date: string; mda: string; amount: number; locked: boolean };
function EntryTable({ rows, loading }: { rows: RegisterRow[]; loading: boolean }) {
  return <Table><TableHeader><TableRow><TableHead>Entry</TableHead><TableHead>Date</TableHead><TableHead>MDA</TableHead><TableHead>Reference</TableHead><TableHead className="text-right">Amount</TableHead><TableHead>Publication</TableHead><TableHead /></TableRow></TableHeader><TableBody>{rows.map((row) => <TableRow key={row.id}><TableCell className="font-mono text-xs">{row.publicId ?? row.id.slice(0, 8)}</TableCell><TableCell>{row.date}</TableCell><TableCell>{row.mda}</TableCell><TableCell>{row.reference}</TableCell><TableCell className="text-right tabular-nums">{formatNaira(row.amount)}</TableCell><TableCell>{row.locked ? <Badge variant="outline"><LockIcon className="size-3" /> Locked</Badge> : <span className="text-sm text-muted-foreground">Open</span>}</TableCell><TableCell className="text-right"><Link className="inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline" href={`/entries/${row.kind}/${row.id}`}><MessageSquareIcon className="size-3" /> Details</Link></TableCell></TableRow>)}{!loading && rows.length === 0 ? <TableRow><TableCell colSpan={7} className="py-10 text-center text-muted-foreground">No entries match these filters.</TableCell></TableRow> : null}</TableBody></Table>;
}
