"use client";

import { CloudUploadIcon, TriangleAlertIcon } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { formatNaira } from "@/lib/format";
import { operationDomain, type EntryDomain } from "@/lib/offline/types";
import { useSyncQueue } from "@/lib/offline/use-sync-queue";

/**
 * Surfaces funding/expenditure entries captured offline that are waiting to
 * sync (or have failed) so submitters can see they were not lost.
 */
export function PendingSyncCard({ domain }: { domain: EntryDomain }) {
  const { operations } = useSyncQueue();
  const scoped = operations
    .filter((op) => operationDomain(op) === domain)
    .sort((a, b) => a.seq - b.seq);

  if (scoped.length === 0) return null;

  return (
    <Card className="border-status-pending/30 bg-status-pending-bg/30">
      <CardHeader className="flex-row items-center gap-2">
        <CloudUploadIcon
          aria-hidden="true"
          className="size-4 text-status-pending"
        />
        <div className="flex flex-col gap-0.5">
          <CardTitle className="text-base">Waiting to sync</CardTitle>
          <CardDescription>
            Captured on this device. They submit automatically when you
            reconnect.
          </CardDescription>
        </div>
      </CardHeader>
      <CardContent>
        <ul className="flex flex-col divide-y">
          {scoped.map((op) => (
            <li
              key={op.id}
              className="flex items-center justify-between gap-3 py-2 text-sm"
            >
              <div className="flex min-w-0 flex-col">
                <span className="truncate font-mono text-xs">
                  {op.label || "—"}
                  {op.kind.endsWith("update") ? " (edit)" : ""}
                </span>
                <span className="text-xs text-muted-foreground">
                  {op.payload.transaction_date} ·{" "}
                  {formatNaira(Number(op.payload.amount))}
                </span>
                {op.status === "failed" && op.lastError ? (
                  <span className="mt-0.5 flex items-center gap-1 text-xs text-status-rejected">
                    <TriangleAlertIcon aria-hidden="true" className="size-3" />
                    {op.lastError}
                  </span>
                ) : null}
              </div>
              <Badge
                variant="outline"
                className={
                  op.status === "failed"
                    ? "border-status-rejected/40 text-status-rejected"
                    : "border-status-pending/40 text-status-pending"
                }
              >
                {op.status === "failed"
                  ? "Failed"
                  : op.status === "syncing"
                    ? "Syncing"
                    : "Pending"}
              </Badge>
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}
