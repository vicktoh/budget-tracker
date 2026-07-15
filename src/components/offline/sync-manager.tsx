"use client";

import * as React from "react";
import { toast } from "sonner";
import { supabase } from "@/lib/supabase";
import { processQueue } from "@/lib/offline/sync-engine";
import { useOnlineStatus } from "@/lib/offline/use-online-status";
import { useSyncQueue } from "@/lib/offline/use-sync-queue";
import { OfflineStatusBanner } from "@/components/offline/offline-status-banner";

const RETRY_INTERVAL_MS = 30_000;

/**
 * Bootstraps the offline outbox: drains the queue on mount, on every
 * reconnect, and whenever a new operation is captured while online. A slow
 * retry timer covers transient failures without hammering the network.
 */
export function SyncManager() {
  const online = useOnlineStatus();
  const { pending, failed } = useSyncQueue();

  const runSync = React.useCallback(async () => {
    const result = await processQueue(supabase);
    if (result.synced > 0) {
      toast.success(
        `Synced ${result.synced} offline ${result.synced === 1 ? "entry" : "entries"}.`,
      );
    }
    if (result.failed > 0) {
      toast.error(
        `${result.failed} offline ${result.failed === 1 ? "entry" : "entries"} couldn't sync. Review and resubmit.`,
      );
    }
  }, []);

  // Attempt a drain whenever there are queued entries — and re-attempt when the
  // browser reports a reconnect. We intentionally don't require `online` to be
  // true: processQueue confirms reachability by actually trying, so a stale/
  // false-negative navigator.onLine can't strand the outbox.
  React.useEffect(() => {
    if (pending > 0) {
      void runSync();
    }
  }, [online, pending, runSync]);

  React.useEffect(() => {
    if (pending === 0) return;
    const id = window.setInterval(() => void runSync(), RETRY_INTERVAL_MS);
    return () => window.clearInterval(id);
  }, [pending, runSync]);

  if (online && pending === 0 && failed === 0) return null;

  return (
    <div className="mb-4">
      <OfflineStatusBanner online={online} pending={pending} failed={failed} />
    </div>
  );
}
