"use client";

import * as React from "react";
import Link from "next/link";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ConnectionStatus } from "@/components/executive/overview";
import {
  Breadcrumbs,
  FlowBar,
  MissingData,
  SectionCard,
  useExecutiveData,
} from "@/components/executive/primitives";
import { downloadCsv, toCsv } from "@/lib/reporting/export-csv";
import { formatCompactNaira, formatPercent } from "@/lib/format";
import { LOW_UTILISATION, MONTH_LABELS } from "@/lib/reporting/executive";
import { Button } from "@/components/ui/button";
import { DownloadIcon } from "lucide-react";

const VERDICT_TEXT: Record<string, string> = {
  differs: "Monthly tracking total differs from the BPR",
  untracked_spend: "BPR shows spend the MDA's tracking sheet doesn't",
  tracking_only: "Tracking sheet shows spend the BPR doesn't",
};

function MdaLink({ id, name }: { id: string; name: string }) {
  return (
    <Link href={`/admin/mdas/${id}`} className="font-medium text-primary hover:underline">
      {name}
    </Link>
  );
}

function Empty({ children }: { children: React.ReactNode }) {
  return <p className="text-sm text-status-approved">{children}</p>;
}

export function ExceptionsRoute() {
  const { overview, exceptions, loading, cachedAt } = useExecutiveData();

  if (loading && !exceptions) return <Skeleton className="h-96 rounded-xl" />;
  if (!overview || !exceptions) return null;
  const horizon = overview.coverage.tracking_horizon;

  const downloadAll = () => {
    const rows: Array<Record<string, string | number>> = [];
    for (const m of exceptions.notReporting)
      rows.push({ exception: "Not reporting", mda_or_programme: m.mda_name, detail: m.reporting_status === "never" ? "Never submitted" : `Missing ${m.missing_months.map((x) => MONTH_LABELS[x - 1]).join(" ")}` });
    for (const m of exceptions.noFundingMdas)
      rows.push({ exception: "MDA with no funding", mda_or_programme: m.mda_name, detail: `Budget ${m.budget}` });
    for (const m of exceptions.underfundedMdas)
      rows.push({ exception: "Underfunded MDA", mda_or_programme: m.mda_name, detail: `Released ${formatPercent(m.release_rate)} of budget` });
    for (const p of exceptions.noFundingProgrammes)
      rows.push({ exception: "Programme with no funding", mda_or_programme: p.name, detail: `AOP planned ${p.planned}` });
    for (const m of exceptions.lowUtilisationMdas)
      rows.push({ exception: "Low utilisation MDA", mda_or_programme: m.mda_name, detail: formatPercent(m.utilisation) });
    for (const p of exceptions.lowUtilisationProgrammes)
      rows.push({ exception: "Low utilisation programme", mda_or_programme: p.name, detail: formatPercent(p.utilisation) });
    for (const o of exceptions.overspend)
      rows.push({ exception: "Overspend", mda_or_programme: o.mda.mda_name, detail: `${o.component.label}: ${o.component.spent} vs ${o.component.budget}` });
    for (const l of exceptions.lopsided)
      rows.push({ exception: "Lopsided execution", mda_or_programme: l.mda.mda_name, detail: `${l.best.label} ${formatPercent(l.best.utilisation)} vs ${l.worst.label} ${formatPercent(l.worst.utilisation)}` });
    for (const s of exceptions.sourceMismatch)
      rows.push({ exception: "Source disagreement", mda_or_programme: s.mda.mda_name, detail: `${s.component.label}: BPR ${s.component.spent} vs tracking ${s.component.tracked}` });
    downloadCsv(
      `exceptions-fy${overview.fiscal_year}.csv`,
      toCsv(
        [
          { header: "Exception", value: (r) => r.exception },
          { header: "MDA or programme", value: (r) => r.mda_or_programme },
          { header: "Detail", value: (r) => r.detail },
        ],
        rows,
      ),
    );
  };

  return (
    <div className="flex flex-col gap-5">
      <Breadcrumbs items={[{ label: "Overview", href: "/admin" }, { label: "Exceptions" }]} />
      <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div className="flex flex-col gap-1">
          <h1 className="text-2xl font-bold tracking-normal">Reporting and funding exceptions</h1>
          <p className="text-sm text-muted-foreground">
            FY {overview.fiscal_year}. Low utilisation means less than {formatPercent(LOW_UTILISATION)} of the
            annual budget spent.
          </p>
        </div>
        <div className="flex flex-col items-start gap-2 md:items-end">
          <ConnectionStatus cachedAt={cachedAt} />
          <Button variant="outline" size="sm" onClick={downloadAll}>
            <DownloadIcon className="size-4" /> Download all (CSV)
          </Button>
        </div>
      </div>

      <section id="not-reporting" className="scroll-mt-20">
        <SectionCard
          title={`MDAs not submitting expenditure data (${exceptions.notReporting.length})`}
          description={`From monthly tracking returns${horizon ? ` up to ${MONTH_LABELS[horizon - 1]}` : ""}. A ₦0 return counts as submitted.`}
        >
          {exceptions.notReporting.length === 0 ? (
            <Empty>Every MDA has submitted its latest monthly return.</Empty>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>MDA</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Missing months</TableHead>
                  <TableHead className="text-right">Budget at stake</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {exceptions.notReporting.map((m) => (
                  <TableRow key={m.mda_id}>
                    <TableCell><MdaLink id={m.mda_id} name={m.mda_name} /></TableCell>
                    <TableCell>
                      {m.reporting_status === "never" ? (
                        <span className="text-sm text-status-rejected">Never submitted</span>
                      ) : (
                        <span className="text-sm text-status-pending">Behind</span>
                      )}
                    </TableCell>
                    <TableCell className="text-sm">
                      {m.missing_months.map((x) => MONTH_LABELS[x - 1]).join(", ")}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">{formatCompactNaira(m.budget)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </SectionCard>
      </section>

      <section id="no-funding" className="grid grid-cols-1 scroll-mt-20 gap-4 xl:grid-cols-2">
        <SectionCard
          title={`MDAs receiving no funding (${exceptions.noFundingMdas.length})`}
          description="Approved budget above zero, ₦0 released year to date."
        >
          {exceptions.noFundingMdas.length === 0 ? (
            <Empty>Every budgeted MDA has received at least one release.</Empty>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>MDA</TableHead>
                  <TableHead className="text-right">Budget</TableHead>
                  <TableHead className="text-right">Spent</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {exceptions.noFundingMdas.map((m) => (
                  <TableRow key={m.mda_id}>
                    <TableCell><MdaLink id={m.mda_id} name={m.mda_name} /></TableCell>
                    <TableCell className="text-right tabular-nums">{formatCompactNaira(m.budget)}</TableCell>
                    <TableCell className="text-right tabular-nums">{formatCompactNaira(m.spent)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
          {exceptions.underfundedMdas.length > 0 ? (
            <div className="mt-4 flex flex-col gap-2">
              <p className="text-sm font-medium">
                Underfunded — less than {formatPercent(LOW_UTILISATION)} released ({exceptions.underfundedMdas.length})
              </p>
              <ul className="flex flex-col gap-1.5 text-sm">
                {exceptions.underfundedMdas.map((m) => (
                  <li key={m.mda_id} className="flex items-center justify-between gap-3">
                    <MdaLink id={m.mda_id} name={m.mda_name} />
                    <span className="tabular-nums text-muted-foreground">
                      {formatCompactNaira(m.released)} of {formatCompactNaira(m.budget)} ({formatPercent(m.release_rate)})
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </SectionCard>

        <SectionCard
          title={`Programmes receiving no funding (${exceptions.noFundingProgrammes.length})`}
          description="AOP planned cost above zero, but no release or spending recorded against the programme."
        >
          {exceptions.noFundingProgrammes.length === 0 ? (
            <Empty>Every planned programme has some release or spending recorded.</Empty>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Programme</TableHead>
                  <TableHead className="text-right">AOP planned</TableHead>
                  <TableHead className="text-right">Activities</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {exceptions.noFundingProgrammes.map((p) => (
                  <TableRow key={p.slug}>
                    <TableCell>
                      <Link href={`/admin/programmes/${p.slug}`} className="font-medium text-primary hover:underline">
                        {p.name}
                      </Link>
                    </TableCell>
                    <TableCell className="text-right tabular-nums">{formatCompactNaira(p.planned)}</TableCell>
                    <TableCell className="text-right tabular-nums">{p.activities}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
          <p className="mt-3 text-xs text-muted-foreground">
            Q2 actuals carry no programme detail, so a programme can appear unfunded here while its MDA
            spent in Q2.
          </p>
        </SectionCard>
      </section>

      <section id="low-utilisation" className="grid grid-cols-1 scroll-mt-20 gap-4 xl:grid-cols-2">
        <SectionCard
          title={`MDAs with low utilisation (${exceptions.lowUtilisationMdas.length})`}
          description={`Less than ${formatPercent(LOW_UTILISATION)} of the annual budget spent.`}
        >
          {exceptions.lowUtilisationMdas.length === 0 ? (
            <Empty>No MDA is below the threshold.</Empty>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>MDA</TableHead>
                  <TableHead className="text-right">Budget</TableHead>
                  <TableHead className="text-right">Spent</TableHead>
                  <TableHead className="w-[25%]">Utilisation</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {exceptions.lowUtilisationMdas.map((m) => (
                  <TableRow key={m.mda_id}>
                    <TableCell><MdaLink id={m.mda_id} name={m.mda_name} /></TableCell>
                    <TableCell className="text-right tabular-nums">{formatCompactNaira(m.budget)}</TableCell>
                    <TableCell className="text-right tabular-nums">{formatCompactNaira(m.spent)}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <FlowBar budget={m.budget} released={m.released} spent={m.spent} />
                        <span className="w-12 text-right text-xs tabular-nums">{formatPercent(m.utilisation)}</span>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </SectionCard>

        <SectionCard
          title={`Programmes with low utilisation (${exceptions.lowUtilisationProgrammes.length})`}
          description="Spending less than 25% of AOP planned cost, where some spending exists."
        >
          {exceptions.lowUtilisationProgrammes.length === 0 ? (
            <Empty>No programme is below the threshold.</Empty>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Programme</TableHead>
                  <TableHead className="text-right">Planned</TableHead>
                  <TableHead className="text-right">Spent</TableHead>
                  <TableHead className="text-right">%</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {exceptions.lowUtilisationProgrammes.map((p) => (
                  <TableRow key={p.slug}>
                    <TableCell>
                      <Link href={`/admin/programmes/${p.slug}`} className="font-medium text-primary hover:underline">
                        {p.name}
                      </Link>
                    </TableCell>
                    <TableCell className="text-right tabular-nums">{formatCompactNaira(p.planned)}</TableCell>
                    <TableCell className="text-right tabular-nums">{formatCompactNaira(p.spent)}</TableCell>
                    <TableCell className="text-right tabular-nums">{formatPercent(p.utilisation)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </SectionCard>
      </section>

      <section id="variances" className="flex scroll-mt-20 flex-col gap-4">
        <SectionCard
          title={`Significant variances (${exceptions.overspend.length + exceptions.lopsided.length + exceptions.sourceMismatch.length})`}
          description="Overspending, uneven execution across categories, and disagreement between the BPR and monthly returns."
        >
          <div className="flex flex-col gap-5">
            <div className="flex flex-col gap-2">
              <h3 className="text-sm font-semibold">Overspend — actual above approved budget</h3>
              {exceptions.overspend.length === 0 ? (
                <Empty>No category has spent above its approved budget.</Empty>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>MDA</TableHead>
                      <TableHead>Category</TableHead>
                      <TableHead className="text-right">Budget</TableHead>
                      <TableHead className="text-right">Spent</TableHead>
                      <TableHead className="text-right">Over by</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {exceptions.overspend.map(({ mda, component }) => (
                      <TableRow key={`${mda.mda_id}-${component.budget_class}`}>
                        <TableCell><MdaLink id={mda.mda_id} name={mda.mda_name} /></TableCell>
                        <TableCell>{component.label}</TableCell>
                        <TableCell className="text-right tabular-nums">
                          {component.budget > 0 ? formatCompactNaira(component.budget) : <MissingData>not budgeted</MissingData>}
                        </TableCell>
                        <TableCell className="text-right tabular-nums">{formatCompactNaira(component.spent)}</TableCell>
                        <TableCell className="text-right tabular-nums text-status-rejected">
                          {formatCompactNaira(component.spent - component.budget)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </div>

            <div className="flex flex-col gap-2">
              <h3 className="text-sm font-semibold">Lopsided execution — more than 20 points between categories</h3>
              {exceptions.lopsided.length === 0 ? (
                <Empty>No MDA shows a large gap between categories.</Empty>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>MDA</TableHead>
                      <TableHead>Ahead</TableHead>
                      <TableHead>Behind</TableHead>
                      <TableHead className="text-right">Gap</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {exceptions.lopsided.map(({ mda, best, worst, gap }) => (
                      <TableRow key={mda.mda_id}>
                        <TableCell><MdaLink id={mda.mda_id} name={mda.mda_name} /></TableCell>
                        <TableCell>{best.label} {formatPercent(best.utilisation)}</TableCell>
                        <TableCell>{worst.label} {formatPercent(worst.utilisation)}</TableCell>
                        <TableCell className="text-right tabular-nums">{Math.round(gap * 100)} pts</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </div>

            <div className="flex flex-col gap-2">
              <h3 className="text-sm font-semibold">BPR and monthly returns disagree</h3>
              {exceptions.sourceMismatch.length === 0 ? (
                <Empty>The two sources agree.</Empty>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>MDA</TableHead>
                      <TableHead>Category</TableHead>
                      <TableHead className="text-right">BPR</TableHead>
                      <TableHead className="text-right">Monthly tracking</TableHead>
                      <TableHead>What differs</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {exceptions.sourceMismatch.map(({ mda, component }) => (
                      <TableRow key={`${mda.mda_id}-${component.budget_class}`}>
                        <TableCell><MdaLink id={mda.mda_id} name={mda.mda_name} /></TableCell>
                        <TableCell>{component.label}</TableCell>
                        <TableCell className="text-right tabular-nums">{formatCompactNaira(component.spent)}</TableCell>
                        <TableCell className="text-right tabular-nums">{formatCompactNaira(component.tracked)}</TableCell>
                        <TableCell className="text-xs text-muted-foreground">{VERDICT_TEXT[component.verdict]}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </div>
          </div>
        </SectionCard>
      </section>
    </div>
  );
}
