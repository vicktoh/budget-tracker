import type { ValidatedFundingEntry } from "@/lib/funding/validation";
import type { ValidatedExpenditureEntry } from "@/lib/expenditure/validation";

/**
 * Offline sync primitives for funding and expenditure logs.
 *
 * When a submission is captured without connectivity, it is persisted to
 * IndexedDB as a {@link QueuedOperation}. The sync engine drains the queue in
 * the order operations were captured once the network is restored.
 */

export type OperationKind =
  | "funding.create"
  | "funding.update"
  | "expenditure.create"
  | "expenditure.update";

export type OperationStatus = "pending" | "syncing" | "failed";

type BaseOperation = {
  id: string;
  /** Monotonic sequence used to preserve first-in-first-out ordering. */
  seq: number;
  enteredBy: string;
  /** Target row id for update operations. */
  targetEntryId?: string;
  /** Human-friendly label (e.g. reference number) for the pending UI. */
  label: string;
  createdAt: string;
  status: OperationStatus;
  attempts: number;
  lastError?: string;
};

export type FundingOperation = BaseOperation & {
  kind: "funding.create" | "funding.update";
  payload: ValidatedFundingEntry;
};

export type ExpenditureOperation = BaseOperation & {
  kind: "expenditure.create" | "expenditure.update";
  payload: ValidatedExpenditureEntry;
};

export type QueuedOperation = FundingOperation | ExpenditureOperation;

export type EntryDomain = "funding" | "expenditure";

export function operationDomain(op: QueuedOperation): EntryDomain {
  return op.kind.startsWith("funding") ? "funding" : "expenditure";
}

/** A timestamped snapshot of reference data for offline form rendering. */
export type ReferenceCacheRecord<T = unknown> = {
  key: string;
  cachedAt: string;
  data: T;
};
