"use client";

import { HistoryIcon } from "lucide-react";

/**
 * Inline banner shown on read/browse surfaces when the data on screen came
 * from the offline cache rather than a live fetch.
 */
export function OfflineDataNotice({ cachedAt }: { cachedAt: string | null }) {
  if (!cachedAt) return null;
  return (
    <div
      role="status"
      aria-live="polite"
      className="flex items-center gap-2.5 rounded-lg border border-status-pending/30 bg-status-pending-bg px-4 py-2.5 text-sm text-status-pending"
    >
      <HistoryIcon aria-hidden="true" className="size-4 shrink-0" />
      <span className="leading-snug">
        Showing data saved on this device as of{" "}
        {new Date(cachedAt).toLocaleString()}. Reconnect to refresh — filters
        may not apply to the cached snapshot.
      </span>
    </div>
  );
}
