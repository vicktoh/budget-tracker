import type { OperationKind, QueuedOperation } from "@/lib/offline/types";

/**
 * Pure, storage-free queue logic. Kept framework- and IndexedDB-free so the
 * ordering, retry, and error-classification rules can be unit tested in
 * isolation from the browser sync engine.
 */

export type SyncErrorClass = "retry" | "fail";

const RETRYABLE_PG_CODES = new Set([
  "08000", // connection_exception
  "08003", // connection_does_not_exist
  "08006", // connection_failure
  "57014", // query_canceled
  "53300", // too_many_connections
]);

/**
 * Decide whether a failed sync attempt should be retried later (transient,
 * usually network/connectivity) or marked as permanently failed and surfaced
 * to the user (data/permission errors that will never succeed on retry).
 */
export function classifySyncError(error: unknown): SyncErrorClass {
  if (error == null) return "retry";

  // Browser fetch failures (offline mid-sync, DNS, TLS) surface as TypeError,
  // but so do plain programming bugs — so classify by message below rather
  // than by `instanceof TypeError`, or a code defect would masquerade as
  // "offline" and retry forever.

  const candidate = error as {
    code?: string | null;
    message?: string | null;
    name?: string | null;
  };
  const code = (candidate.code ?? "").trim();
  const message = (candidate.message ?? "").toLowerCase();

  if (RETRYABLE_PG_CODES.has(code)) return "retry";

  if (
    !code &&
    (message.includes("failed to fetch") ||
      message.includes("network") ||
      message.includes("load failed") ||
      message.includes("timeout") ||
      message.includes("timed out"))
  ) {
    return "retry";
  }

  // Anything with a concrete Postgres SQLSTATE (unique violation, check
  // violation, RLS) or a non-network message will not self-heal on retry.
  return "fail";
}

/** Returns operations sorted oldest-first by capture sequence. */
export function orderQueue<T extends QueuedOperation>(operations: T[]): T[] {
  return [...operations].sort((a, b) => a.seq - b.seq);
}

/** Operations that still need to be sent (pending or previously syncing). */
export function syncableOperations<T extends QueuedOperation>(
  operations: T[],
): T[] {
  return orderQueue(operations).filter((op) => op.status !== "failed");
}

/** The next operation to attempt, or null when nothing is syncable. */
export function nextOperation<T extends QueuedOperation>(
  operations: T[],
): T | null {
  return syncableOperations(operations)[0] ?? null;
}

export function pendingCount(operations: QueuedOperation[]): number {
  return operations.filter((op) => op.status !== "failed").length;
}

export function failedCount(operations: QueuedOperation[]): number {
  return operations.filter((op) => op.status === "failed").length;
}

export function isUpdateKind(kind: OperationKind): boolean {
  return kind === "funding.update" || kind === "expenditure.update";
}

/**
 * Produce the next monotonic sequence value given the existing queue. Uses a
 * timestamp floor so ordering survives reloads, while still guaranteeing a
 * strict increase when several operations are captured within the same tick.
 */
export function nextSequence(
  operations: QueuedOperation[],
  now: number = Date.now(),
): number {
  const highest = operations.reduce((max, op) => Math.max(max, op.seq), 0);
  return Math.max(now, highest + 1);
}

/** Transition an operation after a sync attempt fails. */
export function markAttemptFailure(
  op: QueuedOperation,
  errorClass: SyncErrorClass,
  message: string,
): QueuedOperation {
  return {
    ...op,
    status: errorClass === "fail" ? "failed" : "pending",
    attempts: op.attempts + 1,
    lastError: message,
  };
}
