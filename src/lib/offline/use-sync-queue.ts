"use client";

import * as React from "react";
import { failedCount, pendingCount } from "@/lib/offline/queue";
import { getQueue, subscribeToQueue } from "@/lib/offline/sync-engine";
import type { QueuedOperation } from "@/lib/offline/types";

export type SyncQueueState = {
  operations: QueuedOperation[];
  pending: number;
  failed: number;
  loaded: boolean;
};

/**
 * Subscribes to the offline outbox and re-renders whenever operations are
 * enqueued, synced, or marked failed.
 */
export function useSyncQueue(): SyncQueueState {
  const [operations, setOperations] = React.useState<QueuedOperation[]>([]);
  const [loaded, setLoaded] = React.useState(false);

  React.useEffect(() => {
    let active = true;
    const refresh = () => {
      getQueue()
        .then((ops) => {
          if (!active) return;
          setOperations(ops);
          setLoaded(true);
        })
        .catch(() => {
          if (active) setLoaded(true);
        });
    };
    refresh();
    return subscribeToQueue(refresh);
  }, []);

  return {
    operations,
    pending: pendingCount(operations),
    failed: failedCount(operations),
    loaded,
  };
}
