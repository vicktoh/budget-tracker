"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { ArrowLeftIcon, DownloadIcon } from "lucide-react";
import { ImportStatusBadge, ledgerLabel } from "@/components/imports/import-status";
import { MappingPanel } from "@/components/imports/mapping-panel";
import { ReceiptPanel } from "@/components/imports/receipt-panel";
import { QuestionsPanel } from "@/components/imports/questions-panel";
import { ReviewPanel } from "@/components/imports/review-panel";
import { SheetsPanel, type BatchAiView } from "@/components/imports/sheets-panel";
import { PageHeader } from "@/components/layout/page-header";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button, buttonVariants } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import type { ImportMapping } from "@/lib/imports/fields";
import type { ImportBatchRow, ImportReceipt, ImportRowRecord } from "@/lib/imports/server";
import type { ImportOptions } from "@/lib/imports/validate";
import type { MappingSuggestion } from "@/lib/imports/ai/assist";
import type { ValueQuestionView } from "@/lib/imports/ai/actions";
import { useOnlineStatus } from "@/lib/offline/use-online-status";

type Detail = {
  batch: ImportBatchRow;
  rows: ImportRowRecord[];
  labels: Record<string, string>;
  permitted_mdas: Array<{ id: string; name: string }>;
  is_owner: boolean;
  receipt?: ImportReceipt;
  ai: BatchAiView;
  questions: ValueQuestionView[];
};

export function ImportBatchRoute({ id }: { id: string }) {
  const online = useOnlineStatus();
  const [detail, setDetail] = useState<Detail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [committing, setCommitting] = useState(false);

  const load = useCallback(async () => {
    const response = await fetch(`/api/imports/${id}`, { cache: "no-store" });
    const body = await response.json();
    if (!response.ok) {
      setError(body.error ?? "This import could not be loaded.");
      return;
    }
    setDetail(body);
  }, [id]);

  useEffect(() => {
    void load();
  }, [load]);

  async function act(payload: Record<string, unknown>) {
    setBusy(true);
    setCommitting(payload.action === "commit");
    setError(null);
    try {
      const response = await fetch(`/api/imports/${id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const body = await response.json();
      if (!response.ok) {
        setError(body.error ?? "The request failed.");
        // The server may have refreshed the preview (stale plan, new lock).
        await load();
        return;
      }
      setDetail(body);
    } catch {
      // A lost response after a confirm is safe to re-check: the batch either
      // completed (its receipt shows) or nothing was inserted.
      setError("The server didn't respond. Refreshing to show the batch's actual state.");
      await load();
    } finally {
      setBusy(false);
      setCommitting(false);
    }
  }

  if (!detail) {
    return (
      <div className="flex flex-col gap-4">
        {error ? (
          <Alert variant="destructive">
            <AlertTitle>Import unavailable</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        ) : (
          <>
            <Skeleton className="h-10 w-72" />
            <Skeleton className="h-64 w-full" />
          </>
        )}
      </div>
    );
  }

  const { batch, rows } = detail;
  const open = batch.status !== "completed" && batch.status !== "cancelled";
  const receipt = batch.receipt ?? detail.receipt;

  return (
    <div className="flex flex-col gap-5">
      <Link className={buttonVariants({ variant: "link", className: "w-fit" })} href="/imports">
        <ArrowLeftIcon aria-hidden="true" className="size-4" />
        All imports
      </Link>
      <PageHeader
        title={batch.source_file_name}
        description={`${ledgerLabel(batch.ledger_type)} · ${batch.source_format.toUpperCase()} · ${(batch.source_size_bytes / 1024).toFixed(0)} KB · SHA-256 ${batch.source_sha256.slice(0, 12)}…${batch.sheet_name && batch.sheet_name !== "CSV" ? ` · sheet "${batch.sheet_name}"` : ""}`}
        actions={
          <>
            <ImportStatusBadge status={batch.status} />
            {rows.length ? (
              <a className={buttonVariants({ variant: "outline", size: "sm" })} href={`/api/imports/${id}/report`}>
                <DownloadIcon aria-hidden="true" />
                Issue report
              </a>
            ) : null}
            {open && detail.is_owner ? (
              <Button type="button" size="sm" variant="ghost" disabled={busy} onClick={() => act({ action: "cancel" })}>
                Cancel batch
              </Button>
            ) : null}
          </>
        }
      />

      {!online && open ? (
        <Alert variant="warning">
          <AlertTitle>You're offline</AlertTitle>
          <AlertDescription>Reconnect to change or confirm this batch.</AlertDescription>
        </Alert>
      ) : null}
      {error ? (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}
      {batch.last_error && !error && open ? (
        <Alert variant="destructive">
          <AlertTitle>Last confirmation failed</AlertTitle>
          <AlertDescription>{batch.last_error}</AlertDescription>
        </Alert>
      ) : null}
      {batch.status === "cancelled" ? (
        <Alert>
          <AlertDescription>This batch was cancelled. Nothing from it was inserted.</AlertDescription>
        </Alert>
      ) : null}

      {receipt && batch.status === "completed" ? <ReceiptPanel receipt={receipt} /> : null}

      {open && batch.source_format === "xlsx" ? (
        <SheetsPanel
          batch={batch}
          ai={detail.ai}
          isOwner={detail.is_owner}
          busy={busy}
          onAnalyze={() => act({ action: "analyze_workbook" })}
          onSelect={(sheetName) => act({ action: "select_sheet", sheet_name: sheetName })}
        />
      ) : null}

      {open && detail.is_owner && batch.status !== "needs_sheet" ? (
        <MappingPanel
          batch={batch}
          rows={rows}
          permittedMdas={detail.permitted_mdas}
          busy={busy}
          onApply={(mapping: ImportMapping, options: ImportOptions) => act({ action: "set_mapping", mapping, options })}
          aiSuggestions={
            detail.ai.mapping_suggestions?.sheet === batch.sheet_name
              ? (detail.ai.mapping_suggestions.suggestions as MappingSuggestion[])
              : null
          }
          aiConfigured={detail.ai.configured}
          aiCallsLeft={detail.ai.calls_limit - detail.ai.calls_used}
          onSuggest={() => act({ action: "suggest_mapping" })}
        />
      ) : null}

      {open && detail.is_owner && detail.questions.length ? (
        <QuestionsPanel
          ledger={batch.ledger_type}
          questions={detail.questions}
          aiConfigured={detail.ai.configured}
          aiCallsLeft={detail.ai.calls_limit - detail.ai.calls_used}
          busy={busy}
          onAnswer={(answers) => act({ action: "answer_values", answers })}
          onSuggest={() => act({ action: "suggest_values" })}
        />
      ) : null}

      {rows.length && batch.status !== "needs_sheet" ? (
        <ReviewPanel
          batch={batch}
          rows={rows}
          labels={detail.labels}
          busy={busy}
          committing={committing}
          online={online}
          isOwner={detail.is_owner}
          onUpdateRow={(rowId, change) => act({ action: "update_row", row_id: rowId, ...change })}
          onConfirm={(planHash) => act({ action: "commit", plan_hash: planHash })}
        />
      ) : null}
    </div>
  );
}
