import { describe, expect, it } from "vitest";
import {
  classifySyncError,
  failedCount,
  markAttemptFailure,
  nextOperation,
  nextSequence,
  orderQueue,
  pendingCount,
  syncableOperations,
} from "@/lib/offline/queue";
import type { QueuedOperation } from "@/lib/offline/types";

function fundingOp(
  overrides: Partial<QueuedOperation> = {},
): QueuedOperation {
  return {
    id: overrides.id ?? "op-1",
    seq: overrides.seq ?? 1,
    kind: "funding.create",
    enteredBy: "user-1",
    label: "REF-1",
    createdAt: "2026-01-01T00:00:00.000Z",
    status: overrides.status ?? "pending",
    attempts: overrides.attempts ?? 0,
    payload: {
      transaction_date: "2026-01-01",
      mda_id: "mda-1",
      programme_area_id: "pa-1",
      funding_source_id: "fs-1",
      amount: 1000,
      reference_no: "REF-1",
      remarks: null,
      fiscal_year: 2026,
      quarter: 1,
    },
    ...overrides,
  } as QueuedOperation;
}

describe("classifySyncError", () => {
  it("retries browser fetch failures (TypeError)", () => {
    expect(classifySyncError(new TypeError("Failed to fetch"))).toBe("retry");
  });

  it("fails permanently on programming TypeErrors (not network)", () => {
    // Regression: a detached-method bug threw this exact TypeError and was
    // misclassified as a dropped connection, sending online submits into the
    // offline outbox and retrying them forever.
    expect(
      classifySyncError(
        new TypeError("Cannot read properties of undefined (reading 'rest')"),
      ),
    ).toBe("fail");
  });

  it("retries network-shaped messages with no code", () => {
    expect(classifySyncError({ message: "Network request timed out" })).toBe(
      "retry",
    );
    expect(classifySyncError({ message: "load failed" })).toBe("retry");
  });

  it("retries known transient Postgres connection codes", () => {
    expect(classifySyncError({ code: "08006", message: "conn" })).toBe("retry");
  });

  it("fails permanently on unique-violation", () => {
    expect(
      classifySyncError({
        code: "23505",
        message: "duplicate key value violates unique constraint reference_no",
      }),
    ).toBe("fail");
  });

  it("fails permanently on RLS denial", () => {
    expect(
      classifySyncError({ code: "42501", message: "row-level security" }),
    ).toBe("fail");
  });

  it("retries when there is no error object", () => {
    expect(classifySyncError(null)).toBe("retry");
  });
});

describe("queue ordering", () => {
  it("orders operations oldest-first by sequence", () => {
    const ops = [
      fundingOp({ id: "c", seq: 30 }),
      fundingOp({ id: "a", seq: 10 }),
      fundingOp({ id: "b", seq: 20 }),
    ];
    expect(orderQueue(ops).map((op) => op.id)).toEqual(["a", "b", "c"]);
  });

  it("excludes failed operations from the syncable set", () => {
    const ops = [
      fundingOp({ id: "a", seq: 10, status: "failed" }),
      fundingOp({ id: "b", seq: 20, status: "pending" }),
    ];
    expect(syncableOperations(ops).map((op) => op.id)).toEqual(["b"]);
  });

  it("returns the earliest syncable operation as next", () => {
    const ops = [
      fundingOp({ id: "a", seq: 10, status: "failed" }),
      fundingOp({ id: "b", seq: 20 }),
      fundingOp({ id: "c", seq: 30 }),
    ];
    expect(nextOperation(ops)?.id).toBe("b");
  });

  it("returns null when nothing is syncable", () => {
    expect(nextOperation([fundingOp({ status: "failed" })])).toBeNull();
  });
});

describe("counts", () => {
  it("counts pending (non-failed) and failed separately", () => {
    const ops = [
      fundingOp({ id: "a", status: "pending" }),
      fundingOp({ id: "b", status: "syncing" }),
      fundingOp({ id: "c", status: "failed" }),
    ];
    expect(pendingCount(ops)).toBe(2);
    expect(failedCount(ops)).toBe(1);
  });
});

describe("nextSequence", () => {
  it("is strictly greater than every existing sequence", () => {
    const ops = [fundingOp({ seq: 5 }), fundingOp({ seq: 9 })];
    expect(nextSequence(ops, 1)).toBe(10);
  });

  it("uses the clock when it exceeds existing sequences", () => {
    expect(nextSequence([fundingOp({ seq: 5 })], 1000)).toBe(1000);
  });
});

describe("markAttemptFailure", () => {
  it("keeps retryable operations pending and increments attempts", () => {
    const result = markAttemptFailure(fundingOp(), "retry", "offline");
    expect(result.status).toBe("pending");
    expect(result.attempts).toBe(1);
    expect(result.lastError).toBe("offline");
  });

  it("marks permanent failures as failed", () => {
    const result = markAttemptFailure(fundingOp(), "fail", "duplicate");
    expect(result.status).toBe("failed");
  });
});
