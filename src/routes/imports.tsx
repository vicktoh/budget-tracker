"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { UploadIcon } from "lucide-react";
import { ImportStatusBadge, ledgerLabel } from "@/components/imports/import-status";
import { PageHeader } from "@/components/layout/page-header";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Empty } from "@/components/ui/empty";
import { FileUpload } from "@/components/ui/file-upload";
import { Field, FieldDescription, FieldLabel } from "@/components/ui/form";
import { Select } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import type { LedgerType } from "@/lib/imports/fields";
import { decimalToKobo, formatKobo } from "@/lib/imports/normalize";
import type { ImportBatchRow } from "@/lib/imports/server";
import { useOnlineStatus } from "@/lib/offline/use-online-status";

type ListResponse = { batches: ImportBatchRow[]; ledgers: LedgerType[]; max_file_bytes: number };

export function ImportsRoute() {
  const router = useRouter();
  const online = useOnlineStatus();
  const [data, setData] = useState<ListResponse | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [ledger, setLedger] = useState<LedgerType | "">("");
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  const load = useCallback(async () => {
    const response = await fetch("/api/imports", { cache: "no-store" });
    const body = await response.json();
    if (!response.ok) {
      setLoadError(body.error ?? "Your imports could not be loaded.");
      return;
    }
    setData(body);
    setLedger((current) => current || (body.ledgers.length === 1 ? body.ledgers[0] : ""));
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function upload() {
    if (!file || !ledger) return;
    setUploading(true);
    setUploadError(null);
    const form = new FormData();
    form.set("file", file);
    form.set("ledger_type", ledger);
    try {
      const response = await fetch("/api/imports", { method: "POST", body: form });
      const body = await response.json();
      if (!response.ok) {
        setUploadError(body.error ?? "The file could not be uploaded.");
        return;
      }
      router.push(`/imports/${body.id}`);
    } catch {
      setUploadError("The upload did not reach the server. Check your connection and try again.");
    } finally {
      setUploading(false);
    }
  }

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title="Import entries"
        description="Upload a CSV or Excel ledger, resolve every row that can't be saved yet, and confirm exactly what will be inserted. Nothing reaches reports until you confirm."
      />

      {!online ? (
        <Alert variant="warning">
          <AlertTitle>You're offline</AlertTitle>
          <AlertDescription>
            Imports are checked and saved on the server. Reconnect to upload, review or confirm a batch. Offline manual
            entry still works from the entry forms.
          </AlertDescription>
        </Alert>
      ) : null}

      {loadError ? (
        <Alert variant="destructive">
          <AlertTitle>Imports unavailable</AlertTitle>
          <AlertDescription>{loadError}</AlertDescription>
        </Alert>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle>New import</CardTitle>
          <CardDescription>
            One table per file: a header row, then one transaction per row. Accepted: .csv (UTF-8) and .xlsx, up to 10 MB
            and 5,000 rows. Files are stored privately and are not processed by AI.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <Field className="max-w-sm">
            <FieldLabel htmlFor="import-ledger">What does each row record?</FieldLabel>
            <Select
              id="import-ledger"
              value={ledger}
              onChange={(event) => setLedger(event.target.value as LedgerType | "")}
              disabled={!data}
            >
              <option value="">Choose…</option>
              {data?.ledgers.map((value) => (
                <option key={value} value={value}>
                  {ledgerLabel(value)}
                </option>
              ))}
            </Select>
            <FieldDescription>
              Monthly returns, budgets, AOP plans and published quarterly totals are not transactions and can't be imported
              here.
            </FieldDescription>
          </Field>
          <FileUpload
            id="import-file"
            label="Source file"
            accept=".csv,.xlsx,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
            selectedFile={file}
            onChange={(files) => {
              setFile(files?.[0] ?? null);
              setUploadError(null);
            }}
            onClear={() => setFile(null)}
            error={uploadError}
            disabled={uploading}
          />
          {uploadError ? (
            <Alert variant="destructive">
              <AlertDescription>{uploadError}</AlertDescription>
            </Alert>
          ) : null}
          <div>
            <Button type="button" onClick={upload} disabled={!file || !ledger || uploading || !online}>
              <UploadIcon aria-hidden="true" />
              {uploading ? "Uploading and inspecting…" : "Upload and inspect"}
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Your recent imports</CardTitle>
          <CardDescription>Drafts never affect reports. Only confirmed batches insert entries.</CardDescription>
        </CardHeader>
        <CardContent>
          {data && data.batches.length === 0 ? (
            <Empty title="No imports yet" description="Upload a file above to start a draft batch." />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>File</TableHead>
                  <TableHead>Rows record</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Ready / total rows</TableHead>
                  <TableHead className="text-right">Inserted</TableHead>
                  <TableHead>Uploaded</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data?.batches.map((batch) => (
                  <TableRow key={batch.id}>
                    <TableCell className="max-w-64 truncate font-medium">
                      <Link className="hover:underline" href={`/imports/${batch.id}`}>
                        {batch.source_file_name}
                      </Link>
                    </TableCell>
                    <TableCell>{ledgerLabel(batch.ledger_type)}</TableCell>
                    <TableCell>
                      <ImportStatusBadge status={batch.status} />
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {batch.summary?.counts
                        ? `${batch.summary.counts.eligible} / ${batch.summary.counts.total}`
                        : "—"}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {batch.receipt
                        ? `${batch.receipt.inserted_count} · ${formatKobo(decimalToKobo(batch.receipt.inserted_total))}`
                        : "—"}
                    </TableCell>
                    <TableCell className="whitespace-nowrap text-muted-foreground">
                      {new Date(batch.created_at).toLocaleString("en-NG", { dateStyle: "medium", timeStyle: "short" })}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
