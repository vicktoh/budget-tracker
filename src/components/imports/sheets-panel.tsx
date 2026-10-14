"use client";

import { AlertTriangleIcon, SparklesIcon } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  SHEET_KIND_DESTINATIONS,
  SHEET_KIND_LABELS,
  kindMatchesLedger,
  type SheetKind,
} from "@/lib/imports/ai/kinds";
import type { SheetClassification } from "@/lib/imports/ai/assist";
import type { ImportBatchRow } from "@/lib/imports/server";

export type BatchAiView = {
  configured: boolean;
  model: string;
  calls_used: number;
  calls_limit: number;
  heuristics: Array<{ sheet_name: string; kind: SheetKind; reason: string }> | null;
  classification: { sheets: SheetClassification[]; workbook_notes: string[]; model: string; at: string } | null;
  classification_error: string | null;
  mapping_suggestions: {
    suggestions: Array<{ field: string; header: string | null; confidence: number; reason: string }>;
    model: string;
    at: string;
    sheet: string | null;
  } | null;
};

type Props = {
  batch: ImportBatchRow;
  ai: BatchAiView;
  isOwner: boolean;
  busy: boolean;
  onAnalyze: () => void;
  onSelect: (sheetName: string) => void;
};

/**
 * Workbook sheets with what each one appears to contain. The keyword reading
 * is always available; the AI reading appears after the user asks for it.
 * Either way the user chooses the sheet: a non-transaction sheet can still be
 * selected, but the page says plainly where that kind of data belongs.
 */
export function SheetsPanel({ batch, ai, isOwner, busy, onAnalyze, onSelect }: Props) {
  const aiBySheet = new Map((ai.classification?.sheets ?? []).map((s) => [s.sheet_name, s]));
  const keywordBySheet = new Map((ai.heuristics ?? []).map((h) => [h.sheet_name, h]));
  const analyzed = Boolean(ai.heuristics);
  const ledgerKind = batch.ledger_type === "funding" ? "funding receipts" : "expenditure payments";

  return (
    <Card>
      <CardHeader>
        <CardTitle>{batch.status === "needs_sheet" ? "Choose the sheet to import" : "Workbook sheets"}</CardTitle>
        <CardDescription>
          Each batch imports one sheet of individual {ledgerKind}. Monthly returns, budgets, AOP plans, quarterly totals and
          dashboards are different kinds of data and must not be imported as transactions.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        {isOwner ? (
          <div className="flex flex-wrap items-center gap-2">
            <Button type="button" variant="outline" size="sm" disabled={busy || (ai.configured && ai.calls_used >= ai.calls_limit)} onClick={onAnalyze}>
              <SparklesIcon aria-hidden="true" />
              {analyzed ? "Analyze again" : ai.configured ? "Analyze sheets with AI" : "Analyze sheets"}
            </Button>
            <span className="text-xs text-muted-foreground">
              {ai.configured
                ? "Sends each sheet's name, column names and up to 8 sample rows to OpenAI to identify what it contains. Nothing is imported."
                : "AI isn't configured on this server; a keyword check of the column names is used instead."}
            </span>
          </div>
        ) : null}

        {ai.classification_error ? (
          <Alert variant="warning">
            <AlertDescription>{ai.classification_error}</AlertDescription>
          </Alert>
        ) : null}
        {ai.classification?.workbook_notes.length ? (
          <Alert>
            <AlertDescription>
              <ul className="list-disc space-y-1 pl-4">
                {ai.classification.workbook_notes.map((note) => (
                  <li key={note}>{note}</li>
                ))}
              </ul>
            </AlertDescription>
          </Alert>
        ) : null}

        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Sheet</TableHead>
              <TableHead className="text-right">Rows</TableHead>
              {analyzed ? <TableHead className="min-w-64">Reads as</TableHead> : null}
              <TableHead />
            </TableRow>
          </TableHeader>
          <TableBody>
            {batch.sheets.map((sheet) => {
              const aiReading = aiBySheet.get(sheet.name);
              const keyword = keywordBySheet.get(sheet.name);
              const kind = aiReading?.kind ?? keyword?.kind;
              const matches = kind ? kindMatchesLedger(kind, batch.ledger_type) : false;
              return (
                <TableRow key={sheet.name} className="align-top">
                  <TableCell className="font-medium">
                    {sheet.name}
                    {sheet.state !== "visible" ? <span className="ml-1 text-xs text-muted-foreground">(hidden)</span> : null}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">{sheet.rowCount}</TableCell>
                  {analyzed ? (
                    <TableCell>
                      {kind ? (
                        <div className="flex flex-col gap-1">
                          <span className="flex flex-wrap items-center gap-1.5">
                            <Badge variant={matches ? "approved" : "outline"}>{SHEET_KIND_LABELS[kind]}</Badge>
                            {aiReading ? (
                              <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                                <SparklesIcon aria-hidden="true" className="size-3" />
                                AI · {Math.round(aiReading.confidence * 100)}%
                              </span>
                            ) : (
                              <span className="text-xs text-muted-foreground">keyword check</span>
                            )}
                            {aiReading && keyword && keyword.kind !== aiReading.kind ? (
                              <span className="text-xs text-status-pending">
                                keyword check says {SHEET_KIND_LABELS[keyword.kind].toLowerCase()}
                              </span>
                            ) : null}
                          </span>
                          <span className="text-xs text-muted-foreground">{aiReading?.rationale ?? keyword?.reason}</span>
                          {aiReading?.evidence.length ? (
                            <span className="text-xs text-muted-foreground">Evidence: {aiReading.evidence.join(" · ")}</span>
                          ) : null}
                          {aiReading && (aiReading.fiscal_year || aiReading.quarter || aiReading.months.length || aiReading.mda_hint) ? (
                            <span className="text-xs text-muted-foreground">
                              {[
                                aiReading.mda_hint,
                                aiReading.fiscal_year ? `FY ${aiReading.fiscal_year}` : null,
                                aiReading.quarter ? `Q${aiReading.quarter}` : null,
                                aiReading.months.length ? `months ${aiReading.months.join(", ")}` : null,
                              ]
                                .filter(Boolean)
                                .join(" · ")}
                            </span>
                          ) : null}
                          {aiReading?.overlaps_with.length ? (
                            <span className="flex items-start gap-1 text-xs text-status-pending">
                              <AlertTriangleIcon aria-hidden="true" className="mt-0.5 size-3 shrink-0" />
                              Repeats or totals {aiReading.overlaps_with.join(", ")} — importing both would double count.
                            </span>
                          ) : null}
                          {!matches ? (
                            <span className="text-xs">Belongs in: {SHEET_KIND_DESTINATIONS[kind]}</span>
                          ) : null}
                        </div>
                      ) : null}
                    </TableCell>
                  ) : null}
                  <TableCell className="text-right">
                    {sheet.name === batch.sheet_name ? (
                      <span className="text-xs text-muted-foreground">Selected</span>
                    ) : isOwner ? (
                      <Button
                        type="button"
                        size="sm"
                        variant={!analyzed || matches ? "outline" : "ghost"}
                        disabled={busy || sheet.rowCount < 2}
                        onClick={() => onSelect(sheet.name)}
                      >
                        {analyzed && !matches ? "Use anyway" : "Use this sheet"}
                      </Button>
                    ) : null}
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
