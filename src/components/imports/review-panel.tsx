"use client";

import { Fragment, useMemo, useState } from "react";
import { AlertTriangleIcon, CircleSlashIcon, InfoIcon, PencilIcon } from "lucide-react";
import { DispositionBadge, ledgerLabel } from "@/components/imports/import-status";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { FIELD_DEFINITIONS, type ImportField } from "@/lib/imports/fields";
import { decimalToKobo, formatKobo } from "@/lib/imports/normalize";
import type { ImportBatchRow, ImportRowRecord } from "@/lib/imports/server";
import type { Disposition, RowIssue } from "@/lib/imports/validate";
import { cn } from "@/lib/utils";

const PAGE_SIZE = 50;

type Filter = Disposition | "all";

type Props = {
  batch: ImportBatchRow;
  rows: ImportRowRecord[];
  labels: Record<string, string>;
  busy: boolean;
  /** True only while a confirmation is in flight. */
  committing: boolean;
  online: boolean;
  isOwner: boolean;
  onUpdateRow: (rowId: string, change: { overrides?: Record<string, string>; user_excluded?: boolean }) => void;
  onConfirm: (planHash: string) => void;
};

function money(decimal: string | undefined): string {
  return decimal ? formatKobo(decimalToKobo(decimal)) : "—";
}

function IssueLine({ issue }: { issue: RowIssue }) {
  const Icon = issue.severity === "blocker" ? CircleSlashIcon : issue.severity === "warning" ? AlertTriangleIcon : InfoIcon;
  return (
    <li
      className={cn(
        "flex gap-1.5 text-xs",
        issue.severity === "blocker" && "text-status-rejected",
        issue.severity === "warning" && "text-status-pending",
        issue.severity === "info" && "text-muted-foreground",
      )}
    >
      <Icon aria-hidden="true" className="mt-0.5 size-3.5 shrink-0" />
      <span>{issue.message}</span>
    </li>
  );
}

function Stat({ label, value, detail, tone }: { label: string; value: string; detail?: string; tone?: "good" | "bad" | "muted" }) {
  return (
    <div className="flex flex-col gap-1 rounded-lg border bg-card p-4">
      <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</span>
      <span
        className={cn(
          "text-2xl font-semibold tabular-nums",
          tone === "good" && "text-status-approved",
          tone === "bad" && "text-status-rejected",
        )}
      >
        {value}
      </span>
      {detail ? <span className="text-xs text-muted-foreground">{detail}</span> : null}
    </div>
  );
}

export function ReviewPanel({ batch, rows, labels, busy, committing, online, isOwner, onUpdateRow, onConfirm }: Props) {
  const summary = batch.summary;
  const counts = summary.counts ?? { total: rows.length, eligible: 0, blocked: 0, duplicate: 0, excluded: 0 };
  const [filter, setFilter] = useState<Filter>(counts.blocked > 0 ? "blocked" : "eligible");
  const [page, setPage] = useState(0);
  const [editing, setEditing] = useState<string | null>(null);
  const [draft, setDraft] = useState<Record<string, string>>({});
  const [acknowledged, setAcknowledged] = useState<string | null>(null);

  const definitions = FIELD_DEFINITIONS[batch.ledger_type];
  const mapped = definitions.filter((def) => batch.mapping[def.field]);
  const referenceField: ImportField = batch.ledger_type === "funding" ? "reference_no" : "voucher_ref_no";
  const columns: ImportField[] = (["transaction_date", "mda", "amount", referenceField] as ImportField[]).filter(
    (field) => batch.mapping[field] || field === "mda",
  );

  const filtered = useMemo(
    () => (filter === "all" ? rows : rows.filter((row) => row.disposition === filter)),
    [filter, rows],
  );
  const pageRows = filtered.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);
  const pages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const warningsAcknowledged = !summary.eligible_with_warnings || acknowledged === batch.plan_hash;
  const canConfirm =
    isOwner && online && !busy && batch.status === "ready_for_review" && Boolean(batch.plan_hash) && counts.eligible > 0 && warningsAcknowledged;
  const noun = batch.ledger_type === "funding" ? "funding" : "expenditure";

  function cellText(row: ImportRowRecord, field: ImportField): { text: string; edited: boolean } {
    const header = batch.mapping[field];
    if (!header) return { text: "", edited: false };
    const edited = row.overrides[header] !== undefined;
    return { text: edited ? row.overrides[header] : row.raw[header] ?? "", edited };
  }

  function resolved(row: ImportRowRecord, field: ImportField): string | null {
    const p = row.proposed as Record<string, unknown> | null;
    if (!p) return null;
    if (field === "mda") return labels[p.mda_id as string] ?? null;
    if (field === "transaction_date") return p.transaction_date as string;
    if (field === "amount") return money(p.amount as string);
    return null;
  }

  function startEdit(row: ImportRowRecord) {
    setEditing(row.id);
    const values: Record<string, string> = {};
    for (const def of mapped) {
      const header = batch.mapping[def.field]!;
      values[header] = row.overrides[header] ?? row.raw[header] ?? "";
    }
    setDraft(values);
  }

  function saveEdit(row: ImportRowRecord) {
    const overrides: Record<string, string> = { ...row.overrides };
    for (const [header, value] of Object.entries(draft)) {
      if (value === (row.raw[header] ?? "")) delete overrides[header];
      else overrides[header] = value;
    }
    onUpdateRow(row.id, { overrides });
    setEditing(null);
  }

  return (
    <div className="flex flex-col gap-5">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Ready to insert" value={String(counts.eligible)} detail={money(summary.eligible_total)} tone="good" />
        <Stat
          label="Blocked"
          value={String(counts.blocked)}
          detail="Need a fix or exclusion"
          tone={counts.blocked ? "bad" : undefined}
        />
        <Stat label="Skipped" value={String(counts.duplicate)} detail="Repeats or already recorded" />
        <Stat
          label="Excluded"
          value={String(counts.excluded)}
          detail={[
            `${counts.total} source rows`,
            batch.extraction?.blank_rows_skipped ? `${batch.extraction.blank_rows_skipped} blank` : null,
            batch.extraction?.formula_only_rows_skipped
              ? `${batch.extraction.formula_only_rows_skipped} empty template rows (unevaluated formulas only) not staged`
              : null,
          ]
            .filter(Boolean)
            .join(", ")}
        />
      </div>

      {summary.by_period?.length || summary.by_mda?.length ? (
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Ready rows by quarter</CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableBody>
                  {summary.by_period?.map((p) => (
                    <TableRow key={p.period}>
                      <TableCell>{p.period.replace("-", " ")}</TableCell>
                      <TableCell className="text-right tabular-nums">{p.count}</TableCell>
                      <TableCell className="text-right tabular-nums">{money(p.total)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Ready rows by MDA</CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableBody>
                  {summary.by_mda?.map((m) => (
                    <TableRow key={m.mda_id}>
                      <TableCell>{labels[m.mda_id] ?? m.mda_id}</TableCell>
                      <TableCell className="text-right tabular-nums">{m.count}</TableCell>
                      <TableCell className="text-right tabular-nums">{money(m.total)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </div>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle>Rows</CardTitle>
          <CardDescription>
            Original cell text is shown as uploaded; the resolved value appears beneath it. Fix a blocked row by correcting
            its cells here (the source file is kept unchanged), or exclude it.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <Tabs
            defaultValue={filter}
            value={filter}
            onValueChange={(value) => {
              setFilter(value as Filter);
              setPage(0);
            }}
          >
            <TabsList>
              <TabsTrigger value="eligible">Ready ({counts.eligible})</TabsTrigger>
              <TabsTrigger value="blocked">Blocked ({counts.blocked})</TabsTrigger>
              <TabsTrigger value="duplicate">Skipped ({counts.duplicate})</TabsTrigger>
              <TabsTrigger value="excluded">Excluded ({counts.excluded})</TabsTrigger>
              <TabsTrigger value="all">All ({counts.total})</TabsTrigger>
            </TabsList>
          </Tabs>

          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-14">Row</TableHead>
                {columns.map((field) => (
                  <TableHead key={field} className={field === "amount" ? "text-right" : undefined}>
                    {definitions.find((def) => def.field === field)?.label}
                  </TableHead>
                ))}
                <TableHead>Status</TableHead>
                <TableHead className="min-w-72">Issues</TableHead>
                {isOwner && batch.status !== "completed" && batch.status !== "cancelled" ? <TableHead /> : null}
              </TableRow>
            </TableHeader>
            <TableBody>
              {pageRows.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={columns.length + 4} className="py-8 text-center text-muted-foreground">
                    No rows in this view.
                  </TableCell>
                </TableRow>
              ) : null}
              {pageRows.map((row) => (
                <Fragment key={row.id}>
                  <TableRow className="align-top">
                    <TableCell className="tabular-nums text-muted-foreground">{row.source_row_number}</TableCell>
                    {columns.map((field) => {
                      const { text, edited } = cellText(row, field);
                      const value = resolved(row, field);
                      const fallbackMda = field === "mda" && !batch.mapping.mda && batch.options.default_mda_id;
                      return (
                        <TableCell key={field} className={cn("max-w-56", field === "amount" && "text-right tabular-nums")}>
                          <div className="truncate">
                            {fallbackMda ? <span className="text-muted-foreground">(chosen for all rows)</span> : text || <span className="text-muted-foreground">—</span>}
                            {edited ? <span className="ml-1 text-xs text-status-pending">edited</span> : null}
                          </div>
                          {value && value !== text ? <div className="truncate text-xs text-muted-foreground">→ {value}</div> : null}
                        </TableCell>
                      );
                    })}
                    <TableCell>
                      <DispositionBadge disposition={row.disposition} />
                    </TableCell>
                    <TableCell>
                      {row.issues.length ? (
                        <ul className="flex flex-col gap-1">
                          {row.issues.map((issue, index) => (
                            <IssueLine key={`${issue.code}-${index}`} issue={issue} />
                          ))}
                        </ul>
                      ) : (
                        <span className="text-xs text-muted-foreground">No issues</span>
                      )}
                    </TableCell>
                    {isOwner && batch.status !== "completed" && batch.status !== "cancelled" ? (
                      <TableCell className="whitespace-nowrap text-right">
                        <div className="flex justify-end gap-1">
                          {!row.user_excluded ? (
                            <Button type="button" size="sm" variant="ghost" disabled={busy} onClick={() => startEdit(row)}>
                              <PencilIcon aria-hidden="true" />
                              Fix
                            </Button>
                          ) : null}
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            disabled={busy}
                            onClick={() => onUpdateRow(row.id, { user_excluded: !row.user_excluded })}
                          >
                            {row.user_excluded ? "Include" : "Exclude"}
                          </Button>
                        </div>
                      </TableCell>
                    ) : null}
                  </TableRow>
                  {editing === row.id ? (
                    <TableRow>
                      <TableCell colSpan={columns.length + 4} className="bg-muted/30">
                        <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
                          {mapped.map((def) => {
                            const header = batch.mapping[def.field]!;
                            const original = row.raw[header] ?? "";
                            return (
                              <label key={def.field} className="flex flex-col gap-1 text-xs">
                                <span className="font-medium">
                                  {def.label} <span className="font-normal text-muted-foreground">({header})</span>
                                </span>
                                <Input
                                  value={draft[header] ?? ""}
                                  onChange={(event) => setDraft((d) => ({ ...d, [header]: event.target.value }))}
                                />
                                <span className="text-muted-foreground">Original: {original || "(empty)"}</span>
                              </label>
                            );
                          })}
                        </div>
                        <div className="mt-3 flex gap-2">
                          <Button type="button" size="sm" disabled={busy} onClick={() => saveEdit(row)}>
                            Save and re-check
                          </Button>
                          <Button type="button" size="sm" variant="ghost" onClick={() => setEditing(null)}>
                            Cancel
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ) : null}
                </Fragment>
              ))}
            </TableBody>
          </Table>
          {pages > 1 ? (
            <div className="flex items-center justify-end gap-2 text-sm">
              <Button type="button" size="sm" variant="outline" disabled={page === 0} onClick={() => setPage(page - 1)}>
                Previous
              </Button>
              <span className="tabular-nums text-muted-foreground">
                Page {page + 1} of {pages}
              </span>
              <Button type="button" size="sm" variant="outline" disabled={page + 1 >= pages} onClick={() => setPage(page + 1)}>
                Next
              </Button>
            </div>
          ) : null}
        </CardContent>
      </Card>

      {isOwner && batch.status === "ready_for_review" ? (
        <Card className="border-primary/30">
          <CardHeader>
            <CardTitle>Confirm</CardTitle>
            <CardDescription>
              Zero records have been inserted so far. Confirming inserts only the {counts.eligible} ready{" "}
              {counts.eligible === 1 ? "row" : "rows"}, in one transaction, as {ledgerLabel(batch.ledger_type).toLowerCase()} entered by you. They become reportable
              immediately, like manual entries. Blocked, skipped and excluded rows stay in this batch and are listed in the
              issue report.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            {counts.eligible === 0 ? (
              <Alert variant="warning">
                <AlertTitle>Nothing is ready yet</AlertTitle>
                <AlertDescription>Fix or exclude blocked rows, or adjust the column mapping.</AlertDescription>
              </Alert>
            ) : null}
            {summary.eligible_with_warnings ? (
              <label className="flex items-start gap-2 text-sm">
                <Checkbox
                  checked={acknowledged === batch.plan_hash}
                  onChange={(event) => setAcknowledged(event.target.checked ? batch.plan_hash : null)}
                />
                <span>
                  I've reviewed the {summary.warning_count} warning{summary.warning_count === 1 ? "" : "s"} on{" "}
                  {summary.eligible_with_warnings} ready row{summary.eligible_with_warnings === 1 ? "" : "s"} and the
                  values are correct.
                </span>
              </label>
            ) : null}
            <div>
              <Button type="button" disabled={!canConfirm} onClick={() => batch.plan_hash && onConfirm(batch.plan_hash)}>
                {committing
                  ? "Inserting…"
                  : busy
                    ? "Re-checking rows…"
                    : `Insert ${counts.eligible} ${noun} ${counts.eligible === 1 ? "entry" : "entries"} totalling ${money(summary.eligible_total)}`}
              </Button>
            </div>
            {!online ? <p className="text-xs text-muted-foreground">Reconnect to confirm.</p> : null}
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
