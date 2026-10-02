"use client";

import * as React from "react";
import Link from "next/link";
import { SparklesIcon } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useAsk } from "@/components/executive/ask-panel";
import { ConnectionStatus } from "@/components/executive/overview";
import {
  Breadcrumbs,
  FlagBadge,
  FlowBar,
  FlowLegend,
  Kpi,
  MissingData,
  SectionCard,
  formatDataDate,
  useExecutiveData,
  utilisationTone,
} from "@/components/executive/primitives";
import { formatCompactNaira, formatNaira, formatPercent } from "@/lib/format";
import { classifyEntry, ECONOMIC_CLASS_LABEL } from "@/lib/reporting/economic-class";
import {
  computeProgrammePerformance,
  MONTH_LABELS,
  type ComponentPerformance,
} from "@/lib/reporting/executive";
import { cn } from "@/lib/utils";

const VERDICT_TEXT: Record<ComponentPerformance["verdict"], string> = {
  matches: "Tracking agrees with BPR",
  differs: "Tracking and BPR disagree",
  untracked_spend: "BPR spend not in monthly tracking",
  tracking_only: "Tracking shows spend the BPR doesn't",
  no_data: "No data in either source",
};

export function MdaDetailRoute({ mdaId }: { mdaId: string }) {
  const { overview, dataset, loading, cachedAt } = useExecutiveData();
  const { ask } = useAsk();
  const mda = overview?.mdas.find((m) => m.mda_id === mdaId) ?? null;

  const programmes = React.useMemo(() => {
    if (!dataset || !overview) return [];
    return computeProgrammePerformance(dataset, overview.fiscal_year)
      .map((p) => ({ ...p, row: p.mdas.find((m) => m.mda_id === mdaId) }))
      .filter((p) => p.row && (p.row.planned > 0 || p.row.spent > 0 || p.row.funded > 0));
  }, [dataset, overview, mdaId]);

  const lineItems = React.useMemo(() => {
    if (!dataset || !overview) return [];
    return dataset.expenditure
      .filter((e) => e.mda_id === mdaId && e.fiscal_year === overview.fiscal_year)
      .sort((a, b) => b.amount - a.amount);
  }, [dataset, overview, mdaId]);

  if (loading && !overview) return <Skeleton className="h-96 rounded-xl" />;
  if (!mda || !overview) {
    return (
      <Alert>
        <AlertTitle>MDA not found</AlertTitle>
        <AlertDescription>
          <Link href="/admin" className="underline">
            Back to the overview
          </Link>
        </AlertDescription>
      </Alert>
    );
  }

  const horizon = overview.coverage.tracking_horizon ?? 6;
  const trackedComponents = mda.components.filter((c) => c.budget_class !== "other" || c.spent > 0);

  return (
    <div className="flex flex-col gap-5">
      <Breadcrumbs items={[{ label: "Overview", href: "/admin" }, { label: mda.mda_name }]} />
      <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div className="flex flex-col gap-2">
          <h1 className="text-2xl font-bold tracking-normal">{mda.mda_name}</h1>
          <div className="flex flex-wrap items-center gap-1.5">
            {mda.flags.length ? (
              mda.flags.map((f) => <FlagBadge key={f} flag={f} />)
            ) : (
              <span className="text-sm text-status-approved">No issues flagged</span>
            )}
          </div>
        </div>
        <div className="flex flex-col items-start gap-2 md:items-end">
          <ConnectionStatus cachedAt={cachedAt} />
          <Button
            variant="outline"
            size="sm"
            onClick={() => ask(`Summarise budget performance for ${mda.mda_name} in FY ${overview.fiscal_year}.`)}
          >
            <SparklesIcon className="size-4" /> Ask about this MDA
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        <Kpi label="Approved budget" value={formatCompactNaira(mda.budget)} />
        <Kpi
          label="Released"
          value={mda.released > 0 ? formatCompactNaira(mda.released) : "₦0"}
          tone={mda.released === 0 ? "bad" : "default"}
          helper={`${formatPercent(mda.release_rate)} of budget`}
        />
        <Kpi label="Actual spend" value={formatCompactNaira(mda.spent)} helper={`Through ${formatDataDate(overview.coverage.data_through)}`} />
        <Kpi
          label="Utilisation"
          value={formatPercent(mda.utilisation)}
          tone={utilisationTone(mda.utilisation)}
          helper={`${formatCompactNaira(mda.balance)} unspent`}
        />
        <Kpi
          label="Monthly returns"
          value={`${mda.months_reported.length} / ${horizon}`}
          tone={mda.reporting_status === "up_to_date" ? "good" : "bad"}
          helper={
            mda.reporting_status === "never"
              ? "Never submitted"
              : mda.missing_months.length
                ? `Missing ${mda.missing_months.map((m) => MONTH_LABELS[m - 1]).join(", ")}`
                : "All months received"
          }
        />
      </div>

      <SectionCard
        title="By expenditure category"
        description="Actual (BPR) spend against the approved budget for each economic class, split by quarter."
        action={<FlowLegend />}
      >
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Category</TableHead>
              <TableHead className="text-right">Budget</TableHead>
              <TableHead className="text-right">Q1</TableHead>
              <TableHead className="text-right">Q2</TableHead>
              <TableHead className="text-right">Total spent</TableHead>
              <TableHead className="w-[20%]">Utilisation</TableHead>
              <TableHead>Monthly tracking check</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {trackedComponents.map((c) => (
              <TableRow key={c.budget_class}>
                <TableCell className="font-medium">{c.label}</TableCell>
                <TableCell className="text-right tabular-nums">
                  {c.budget > 0 ? formatCompactNaira(c.budget) : <MissingData>not budgeted</MissingData>}
                </TableCell>
                <TableCell className="text-right tabular-nums">{formatCompactNaira(c.spent_q1)}</TableCell>
                <TableCell className="text-right tabular-nums">{formatCompactNaira(c.spent_q2)}</TableCell>
                <TableCell className={cn("text-right tabular-nums", c.spent > c.budget && c.budget > 0 && "text-status-rejected")}>
                  {formatCompactNaira(c.spent)}
                </TableCell>
                <TableCell>
                  <div className="flex items-center gap-2">
                    <FlowBar budget={c.budget} spent={c.spent} />
                    <span className="w-12 text-right text-xs tabular-nums">{formatPercent(c.utilisation)}</span>
                  </div>
                </TableCell>
                <TableCell className="text-xs text-muted-foreground">{VERDICT_TEXT[c.verdict]}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </SectionCard>

      <SectionCard
        title="Monthly returns"
        description="From the MDA's monthly tracking sheet. ₦0 means the MDA reported zero; a blank cell means nothing was submitted."
      >
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-muted-foreground">
                <th className="py-1.5 pr-3 font-medium">Category</th>
                {Array.from({ length: horizon }).map((_, i) => (
                  <th key={i} className="px-1 py-1.5 text-center font-medium">
                    {MONTH_LABELS[i]}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {trackedComponents
                .filter((c) => c.budget_class !== "other")
                .map((c) => (
                  <tr key={c.budget_class} className="border-t">
                    <td className="py-2 pr-3 font-medium">{c.label}</td>
                    {c.months.slice(0, horizon).map((cell) => (
                      <td key={cell.month} className="px-1 py-2 text-center">
                        {cell.amount === null ? (
                          <span
                            className="inline-block w-full rounded border border-dashed px-1 py-0.5 text-[11px] text-status-rejected"
                            title="Not submitted"
                          >
                            Missing
                          </span>
                        ) : (
                          <span
                            className={cn(
                              "inline-block w-full rounded px-1 py-0.5 text-[11px] tabular-nums",
                              cell.amount === 0 ? "bg-muted text-muted-foreground" : "bg-status-approved-bg text-status-approved",
                            )}
                          >
                            {cell.amount === 0 ? "₦0" : formatCompactNaira(cell.amount)}
                          </span>
                        )}
                      </td>
                    ))}
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      </SectionCard>

      <SectionCard
        title="Programmes"
        description="AOP planned cost mapped to programmes, with releases and spend recorded against each programme area."
      >
        {programmes.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No AOP activities or programme-tagged spending for this MDA. Programme-level performance
            can't be shown until the MDA's AOP is loaded or spending is recorded by programme.
          </p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Programme</TableHead>
                <TableHead className="text-right">AOP planned</TableHead>
                <TableHead className="text-right">Released</TableHead>
                <TableHead className="text-right">Spent</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {programmes.map((p) => (
                <TableRow key={p.slug}>
                  <TableCell>
                    <Link href={`/admin/programmes/${p.slug}`} className="font-medium text-primary hover:underline">
                      {p.name}
                    </Link>
                  </TableCell>
                  <TableCell className="text-right tabular-nums">{formatCompactNaira(p.row!.planned)}</TableCell>
                  <TableCell className="text-right tabular-nums">{formatCompactNaira(p.row!.funded)}</TableCell>
                  <TableCell className="text-right tabular-nums">{formatCompactNaira(p.row!.spent)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </SectionCard>

      <SectionCard
        title="Spending line items"
        description="Official actuals as recorded, largest first."
      >
        {lineItems.length === 0 ? (
          <p className="text-sm text-muted-foreground">No actual spending recorded for this MDA yet.</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Description</TableHead>
                <TableHead>Category</TableHead>
                <TableHead>Programme</TableHead>
                <TableHead>Quarter</TableHead>
                <TableHead className="text-right">Amount</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {lineItems.slice(0, 40).map((e) => (
                <TableRow key={e.id}>
                  <TableCell className="max-w-[24rem] text-sm">{e.remarks || e.voucher_ref_no}</TableCell>
                  <TableCell className="text-sm">{ECONOMIC_CLASS_LABEL[classifyEntry(e)]}</TableCell>
                  <TableCell className="text-sm">{e.programme_area_name}</TableCell>
                  <TableCell className="text-sm">Q{e.quarter}</TableCell>
                  <TableCell className="text-right tabular-nums">{formatNaira(e.amount)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
        {lineItems.length > 40 ? (
          <p className="pt-2 text-xs text-muted-foreground">Showing the 40 largest of {lineItems.length} items.</p>
        ) : null}
      </SectionCard>
    </div>
  );
}
