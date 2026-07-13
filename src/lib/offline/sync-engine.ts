import type { TypedSupabaseClient } from "@/lib/supabase/client";
import {
  insertFundingEntry,
  updatePendingFundingEntry,
} from "@/lib/db/funding-entries";
import {
  insertExpenditureEntry,
  updatePendingExpenditureEntry,
} from "@/lib/db/expenditure-entries";
import type { ValidatedFundingEntry } from "@/lib/funding/validation";
import type { ValidatedExpenditureEntry } from "@/lib/expenditure/validation";
import {
  deleteOperation,
  getAllOperations,
  putOperation,
} from "@/lib/offline/idb";
import {
  classifySyncError,
  markAttemptFailure,
  nextSequence,
  syncableOperations,
} from "@/lib/offline/queue";
import type { OperationKind, QueuedOperation } from "@/lib/offline/types";

/**
 * Drives the offline outbox: captures funding/expenditure operations to
 * IndexedDB and replays them against Supabase in capture order once the
 * network is back. Errors that cannot self-heal (unique-violation, RLS,
 * check-constraint) mark the operation as failed and surface to the user
 * rather than silently retrying forever.
 */

const listeners = new Set<() => void>();
let processing = false;

export function subscribeToQueue(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function notify(): void {
  for (const listener of listeners) listener();
}

function generateId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `op_${Date.now()}_${Math.random().toString(36).slice(2)}`;
}

export type EnqueueInput =
  | {
      kind: "funding.create" | "funding.update";
      payload: ValidatedFundingEntry;
      enteredBy: string;
      targetEntryId?: string;
    }
  | {
      kind: "expenditure.create" | "expenditure.update";
      payload: ValidatedExpenditureEntry;
      enteredBy: string;
      targetEntryId?: string;
    };

function deriveLabel(input: EnqueueInput): string {
  if (input.kind.startsWith("funding")) {
    return (input.payload as ValidatedFundingEntry).reference_no;
  }
  return (input.payload as ValidatedExpenditureEntry).voucher_ref_no;
}

export async function enqueueOperation(
  input: EnqueueInput,
): Promise<QueuedOperation> {
  const existing = await getAllOperations();
  const op = {
    id: generateId(),
    seq: nextSequence(existing),
    kind: input.kind,
    payload: input.payload,
    enteredBy: input.enteredBy,
    targetEntryId: input.targetEntryId,
    label: deriveLabel(input),
    createdAt: new Date().toISOString(),
    status: "pending",
    attempts: 0,
  } as QueuedOperation;
  await putOperation(op);
  notify();
  return op;
}

export async function getQueue(): Promise<QueuedOperation[]> {
  return getAllOperations();
}

export async function discardOperation(id: string): Promise<void> {
  await deleteOperation(id);
  notify();
}

/** Reset a failed operation back to pending so the next sync retries it. */
export async function retryOperation(id: string): Promise<void> {
  const ops = await getAllOperations();
  const op = ops.find((candidate) => candidate.id === id);
  if (!op) return;
  await putOperation({ ...op, status: "pending", lastError: undefined });
  notify();
}

async function runOperation(
  client: TypedSupabaseClient,
  op: QueuedOperation,
): Promise<void> {
  switch (op.kind) {
    case "funding.create":
      await insertFundingEntry(client, op.payload, op.enteredBy);
      return;
    case "funding.update":
      if (!op.targetEntryId) throw new Error("Missing target entry id.");
      await updatePendingFundingEntry(client, op.targetEntryId, op.payload);
      return;
    case "expenditure.create":
      await insertExpenditureEntry(client, op.payload, op.enteredBy);
      return;
    case "expenditure.update":
      if (!op.targetEntryId) throw new Error("Missing target entry id.");
      await updatePendingExpenditureEntry(client, op.targetEntryId, op.payload);
      return;
    default: {
      const exhaustive: never = op;
      throw new Error(`Unknown operation kind: ${(exhaustive as { kind: OperationKind }).kind}`);
    }
  }
}

export type ProcessResult = {
  synced: number;
  failed: number;
  remaining: number;
};

/**
 * Process the queue in capture order. Stops early on a transient (retryable)
 * error so ordering is preserved for the next reconnect; continues past
 * permanent failures so one bad row cannot block the rest of the outbox.
 */
export async function processQueue(
  client: TypedSupabaseClient | null,
): Promise<ProcessResult> {
  // Reachability is decided empirically: we attempt each operation and let a
  // real network failure (classified "retry") stop the drain. We deliberately
  // do NOT gate on navigator.onLine here — it reports false-negatives in plenty
  // of genuinely-connected setups (VPNs, proxies, VMs, captive portals), which
  // would otherwise strand queued entries as permanently "pending".
  if (!client || processing) {
    const queue = await getAllOperations().catch(() => []);
    return { synced: 0, failed: 0, remaining: syncableOperations(queue).length };
  }

  processing = true;
  let synced = 0;
  let failed = 0;
  try {
    const ordered = syncableOperations(await getAllOperations());
    for (const op of ordered) {
      await putOperation({ ...op, status: "syncing" });
      notify();
      try {
        await runOperation(client, op);
        await deleteOperation(op.id);
        synced += 1;
        notify();
      } catch (error) {
        const errorClass = classifySyncError(error);
        const message =
          (error as { message?: string }).message ?? "Sync failed.";
        await putOperation(markAttemptFailure(op, errorClass, message));
        notify();
        if (errorClass === "retry") {
          // Likely back offline — preserve order and stop for now.
          break;
        }
        failed += 1;
      }
    }
  } finally {
    processing = false;
  }

  const remaining = syncableOperations(await getAllOperations()).length;
  notify();
  return { synced, failed, remaining };
}
