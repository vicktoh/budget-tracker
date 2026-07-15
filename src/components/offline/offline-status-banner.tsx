"use client";

import { CloudOffIcon, RefreshCwIcon, TriangleAlertIcon } from "lucide-react";
import { cn } from "@/lib/utils";

function pluralize(count: number, singular: string, plural: string): string {
  return count === 1 ? singular : plural;
}

export function OfflineStatusBanner({
  online,
  pending,
  failed,
}: {
  online: boolean;
  pending: number;
  failed: number;
}) {
  if (online && pending === 0 && failed === 0) return null;

  let tone: "offline" | "syncing" | "failed" = "syncing";
  if (!online) tone = "offline";
  else if (failed > 0 && pending === 0) tone = "failed";

  const Icon =
    tone === "offline"
      ? CloudOffIcon
      : tone === "failed"
        ? TriangleAlertIcon
        : RefreshCwIcon;

  const message =
    tone === "offline"
      ? pending > 0
        ? `You're offline. ${pending} ${pluralize(pending, "entry is", "entries are")} saved on this device and will sync automatically when you reconnect.`
        : "You're offline. Funding and expenditure entries you submit are saved on this device and sync automatically when you reconnect."
      : tone === "failed"
        ? `${failed} ${pluralize(failed, "entry", "entries")} couldn't sync. Open the entry to review and resubmit.`
        : `Syncing ${pending} pending ${pluralize(pending, "entry", "entries")}…${failed > 0 ? ` ${failed} need attention.` : ""}`;

  return (
    <div
      role="status"
      aria-live="polite"
      className={cn(
        "flex items-center gap-2.5 rounded-lg border px-4 py-2.5 text-sm",
        tone === "offline" &&
          "border-status-pending/30 bg-status-pending-bg text-status-pending",
        tone === "syncing" &&
          "border-status-approved/30 bg-status-approved-bg text-status-approved",
        tone === "failed" &&
          "border-status-rejected/30 bg-status-rejected-bg text-status-rejected",
      )}
    >
      <Icon
        aria-hidden="true"
        className={cn("size-4 shrink-0", tone === "syncing" && "animate-spin")}
      />
      <span className="leading-snug">{message}</span>
    </div>
  );
}
