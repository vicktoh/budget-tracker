"use client";

import * as React from "react";
import Link from "next/link";
import { InfoIcon, SparklesIcon } from "lucide-react";
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
  FlowBar,
  FlowLegend,
  Kpi,
  MissingData,
  SectionCard,
  useExecutiveData,
  utilisationTone,
} from "@/components/executive/primitives";
import { formatCompactNaira, formatNaira, formatPercent } from "@/lib/format";
import { programmeDetail, UNMAPPED_PROGRAMME } from "@/lib/reporting/executive";

export function ProgrammeDetailRoute({ slug }: { slug: string }) {
  const { dataset, overview, loading, cachedAt } = useExecutiveData();
  const { ask } = useAsk();
  const detail = React.useMemo(
    () => (dataset && overview ? programmeDetail(dataset, slug, overview.fiscal_year) : null),
    [dataset, overview, slug],
  );

  if (loading && !detail) return <Skeleton className="h-96 rounded-xl" />;
  if (!detail || !overview) {
    return (
      <Alert>
        <AlertTitle>Programme not found</AlertTitle>
        <AlertDescription>
          <Link href="/admin" className="underline">
            Back to the overview
          </Link>
        </AlertDescription>
      </Alert>
    );
  }

  const { programme, activities, spending, releases } = detail;
  const unmapped = programme.name === UNMAPPED_PROGRAMME;

  return (
    <div className="flex flex-col gap-5">
      <Breadcrumbs items={[{ label: "Overview", href: "/admin" }, { label: "Programmes" }, { label: programme.name }]} />
      <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div className="flex flex-col gap-1">
          <h1 className="text-2xl font-bold tracking-normal">{programme.name}</h1>
          <p className="text-sm text-muted-foreground">
            FY {overview.fiscal_year} · {programme.activities} AOP activities across{" "}
            {programme.mdas.length} MDA{programme.mdas.length === 1 ? "" : "s"}
          </p>
        </div>
        <div className="flex flex-col items-start gap-2 md:items-end">
          <ConnectionStatus cachedAt={cachedAt} />
          {!unmapped ? (
            <Button
              variant="outline"
              size="sm"
              onClick={() => ask(`How is the ${programme.name} programme performing? Show actual spending versus budget.`)}
            >
              <SparklesIcon className="size-4" /> Ask about this programme
            </Button>
          ) : null}
        </div>
      </div>

      <div className="flex gap-2.5 rounded-lg border border-status-processed/30 bg-status-processed-bg px-4 py-3 text-sm text-status-processed">
        <InfoIcon className="mt-0.5 size-4 shrink-0" />
        <span>
          The state budget is appropriated by MDA and economic class, not by programme. The
          programme budget here is the <strong>AOP planned cost</strong> of activities whose
          description matches this programme. Actuals are releases and spending recorded against
          the programme area. Q2 actuals were reported as MDA totals only, so Q2 programme
          spending is not visible.
        </span>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Kpi
          label="AOP planned cost"
          value={programme.planned > 0 ? formatCompactNaira(programme.planned) : "Not planned"}
          tone={programme.planned > 0 ? "default" : "warn"}
        />
        <Kpi
          label="Released"
          value={formatCompactNaira(programme.funded)}
          tone={programme.funded === 0 ? "bad" : "default"}
        />
        <Kpi
          label="Actual spend"
          value={formatCompactNaira(programme.spent)}
          tone={programme.spent === 0 ? "bad" : "default"}
        />
        <Kpi
          label="Spent / planned"
          value={programme.planned > 0 ? formatPercent(programme.utilisation) : "—"}
          tone={utilisationTone(programme.utilisation)}
        />
      </div>

      <SectionCard title="By MDA" action={<FlowLegend />}>
        {programme.mdas.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No MDA has AOP activities, releases or spending for this programme in FY {overview.fiscal_year}.
          </p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>MDA</TableHead>
                <TableHead className="text-right">AOP planned</TableHead>
                <TableHead className="text-right">Released</TableHead>
                <TableHead className="text-right">Spent</TableHead>
                <TableHead className="w-[22%]">Actual vs plan</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {programme.mdas.map((m) => (
                <TableRow key={m.mda_id}>
                  <TableCell>
                    <Link href={`/admin/mdas/${m.mda_id}`} className="font-medium text-primary hover:underline">
                      {m.mda_name}
                    </Link>
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {m.planned > 0 ? formatCompactNaira(m.planned) : <MissingData>no AOP</MissingData>}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">{formatCompactNaira(m.funded)}</TableCell>
                  <TableCell className="text-right tabular-nums">{formatCompactNaira(m.spent)}</TableCell>
                  <TableCell>
                    <FlowBar budget={m.planned} released={m.funded} spent={m.spent} />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </SectionCard>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <SectionCard title="Releases and spending recorded" description="Official actuals tagged to this programme area.">
          {spending.length === 0 && releases.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No release or spending has been recorded against this programme area yet.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Item</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {spending.map((e) => (
                  <TableRow key={e.id}>
                    <TableCell className="text-sm">
                      {e.remarks || e.voucher_ref_no}
                      <span className="block text-xs text-muted-foreground">
                        {e.mda_name} · Q{e.quarter}
                      </span>
                    </TableCell>
                    <TableCell className="text-sm">Spent</TableCell>
                    <TableCell className="text-right tabular-nums">{formatNaira(e.amount)}</TableCell>
                  </TableRow>
                ))}
                {releases.map((f) => (
                  <TableRow key={f.id}>
                    <TableCell className="text-sm">
                      {f.reference_no}
                      <span className="block text-xs text-muted-foreground">
                        {f.mda_name} · {f.funding_source_name} · Q{f.quarter}
                      </span>
                    </TableCell>
                    <TableCell className="text-sm">Released</TableCell>
                    <TableCell className="text-right tabular-nums">{formatNaira(f.amount)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </SectionCard>

        <SectionCard
          title="Planned AOP activities"
          description={`${activities.length} activities, largest first.`}
        >
          {activities.length === 0 ? (
            <p className="text-sm text-muted-foreground">No AOP activities are mapped to this programme.</p>
          ) : (
            <div className="max-h-[32rem] overflow-y-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Activity</TableHead>
                    <TableHead className="text-right">Planned</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {activities.map((a) => (
                    <TableRow key={a.id}>
                      <TableCell className="text-sm">
                        {a.description}
                        <span className="block text-xs text-muted-foreground">
                          {a.activity_code} · {a.mda_name}
                        </span>
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {a.budgeted_cost > 0 ? formatCompactNaira(a.budgeted_cost) : <MissingData>₦0 planned</MissingData>}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </SectionCard>
      </div>
    </div>
  );
}
