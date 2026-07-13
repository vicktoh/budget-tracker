import { beforeEach, describe, expect, it, vi } from "vitest";
import type { TypedSupabaseClient } from "@/lib/supabase/client";

const store = vi.hoisted(() => {
  const map = new Map<string, unknown>();
  return {
    map,
    getAllOperations: vi.fn(async () => [...map.values()]),
    putOperation: vi.fn(async (op: { id: string }) => {
      map.set(op.id, op);
    }),
    deleteOperation: vi.fn(async (id: string) => {
      map.delete(id);
    }),
  };
});

const dbMocks = vi.hoisted(() => ({
  insertFundingEntry: vi.fn(),
  updatePendingFundingEntry: vi.fn(),
  insertExpenditureEntry: vi.fn(),
  updatePendingExpenditureEntry: vi.fn(),
}));

vi.mock("@/lib/offline/idb", () => ({
  getAllOperations: store.getAllOperations,
  putOperation: store.putOperation,
  deleteOperation: store.deleteOperation,
}));

vi.mock("@/lib/db/funding-entries", () => ({
  insertFundingEntry: dbMocks.insertFundingEntry,
  updatePendingFundingEntry: dbMocks.updatePendingFundingEntry,
}));

vi.mock("@/lib/db/expenditure-entries", () => ({
  insertExpenditureEntry: dbMocks.insertExpenditureEntry,
  updatePendingExpenditureEntry: dbMocks.updatePendingExpenditureEntry,
}));

import {
  enqueueOperation,
  getQueue,
  processQueue,
} from "@/lib/offline/sync-engine";
import type { ValidatedFundingEntry } from "@/lib/funding/validation";

const CLIENT = {} as TypedSupabaseClient;

function fundingPayload(ref: string): ValidatedFundingEntry {
  return {
    transaction_date: "2026-01-01",
    mda_id: "mda-1",
    programme_area_id: "pa-1",
    funding_source_id: "fs-1",
    amount: 1000,
    reference_no: ref,
    remarks: null,
    fiscal_year: 2026,
    quarter: 1,
  };
}

beforeEach(() => {
  store.map.clear();
  vi.clearAllMocks();
});

describe("processQueue", () => {
  it("syncs queued operations in capture order and clears them", async () => {
    const synced: string[] = [];
    dbMocks.insertFundingEntry.mockImplementation(
      async (_client, values: ValidatedFundingEntry) => {
        synced.push(values.reference_no);
        return {};
      },
    );

    await enqueueOperation({
      kind: "funding.create",
      payload: fundingPayload("REF-A"),
      enteredBy: "user-1",
    });
    await enqueueOperation({
      kind: "funding.create",
      payload: fundingPayload("REF-B"),
      enteredBy: "user-1",
    });

    const result = await processQueue(CLIENT);

    expect(synced).toEqual(["REF-A", "REF-B"]);
    expect(result.synced).toBe(2);
    expect(result.remaining).toBe(0);
    expect(await getQueue()).toHaveLength(0);
  });

  it("marks permanent failures and continues past them", async () => {
    dbMocks.insertFundingEntry
      .mockRejectedValueOnce({
        code: "23505",
        message: "duplicate key value violates unique constraint reference_no",
      })
      .mockResolvedValueOnce({});

    await enqueueOperation({
      kind: "funding.create",
      payload: fundingPayload("DUP"),
      enteredBy: "user-1",
    });
    await enqueueOperation({
      kind: "funding.create",
      payload: fundingPayload("OK"),
      enteredBy: "user-1",
    });

    const result = await processQueue(CLIENT);

    expect(result.failed).toBe(1);
    expect(result.synced).toBe(1);
    const queue = await getQueue();
    expect(queue).toHaveLength(1);
    expect(queue[0]!.status).toBe("failed");
    expect(queue[0]!.label).toBe("DUP");
  });

  it("stops on a transient error so ordering is preserved", async () => {
    dbMocks.insertFundingEntry.mockRejectedValue(
      new TypeError("Failed to fetch"),
    );

    await enqueueOperation({
      kind: "funding.create",
      payload: fundingPayload("REF-A"),
      enteredBy: "user-1",
    });
    await enqueueOperation({
      kind: "funding.create",
      payload: fundingPayload("REF-B"),
      enteredBy: "user-1",
    });

    const result = await processQueue(CLIENT);

    // First op failed transiently -> loop breaks, both remain pending.
    expect(result.synced).toBe(0);
    expect(dbMocks.insertFundingEntry).toHaveBeenCalledTimes(1);
    const queue = await getQueue();
    expect(queue).toHaveLength(2);
    expect(queue.every((op) => op.status === "pending")).toBe(true);
  });

  it("does nothing without a client", async () => {
    await enqueueOperation({
      kind: "funding.create",
      payload: fundingPayload("REF-A"),
      enteredBy: "user-1",
    });
    const result = await processQueue(null);
    expect(result.synced).toBe(0);
    expect(result.remaining).toBe(1);
    expect(dbMocks.insertFundingEntry).not.toHaveBeenCalled();
  });
});
