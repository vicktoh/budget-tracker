import { describe, expect, it } from "vitest";
import type { EntryStatusSlug } from "@/lib/db/types";
import {
  availableActions,
  canResubmit,
  canTransition,
  nextStatus,
  requiresComment,
  type ReviewAction,
} from "@/lib/review/transitions";

// Each row is { status, action, expectedNext }. `null` means the action is
// rejected from that status. These rows mirror exactly what
// `public.review_entry` enforces server-side, so a regression here flags a
// drift between the UI and the RPC.
const TRANSITIONS: ReadonlyArray<{
  status: EntryStatusSlug;
  action: ReviewAction;
  expected: EntryStatusSlug | null;
}> = [
  { status: "pending", action: "approve", expected: "approved" },
  { status: "pending", action: "reject", expected: "rejected" },
  { status: "pending", action: "process", expected: null },
  { status: "approved", action: "approve", expected: null },
  { status: "approved", action: "reject", expected: "rejected" },
  { status: "approved", action: "process", expected: "processed" },
  { status: "rejected", action: "approve", expected: null },
  { status: "rejected", action: "reject", expected: null },
  { status: "rejected", action: "process", expected: null },
  { status: "processed", action: "approve", expected: null },
  { status: "processed", action: "reject", expected: null },
  { status: "processed", action: "process", expected: null },
];

describe("nextStatus / canTransition", () => {
  it.each(TRANSITIONS)(
    "from $status doing $action -> $expected",
    ({ status, action, expected }) => {
      expect(nextStatus(status, action)).toBe(expected);
      expect(canTransition(status, action)).toBe(expected !== null);
    },
  );
});

describe("availableActions", () => {
  it("offers approve/reject from pending only", () => {
    expect(availableActions("pending").sort()).toEqual(["approve", "reject"]);
  });

  it("offers process/reject from approved", () => {
    expect(availableActions("approved").sort()).toEqual(["process", "reject"]);
  });

  it("offers nothing from rejected (submitter resubmits instead)", () => {
    expect(availableActions("rejected")).toEqual([]);
  });

  it("offers nothing from processed (terminal state)", () => {
    expect(availableActions("processed")).toEqual([]);
  });
});

describe("requiresComment", () => {
  it("requires a comment for rejection only", () => {
    expect(requiresComment("reject")).toBe(true);
    expect(requiresComment("approve")).toBe(false);
    expect(requiresComment("process")).toBe(false);
  });
});

describe("canResubmit", () => {
  it("only rejected entries can be resubmitted by the submitter", () => {
    expect(canResubmit("rejected")).toBe(true);
    expect(canResubmit("pending")).toBe(false);
    expect(canResubmit("approved")).toBe(false);
    expect(canResubmit("processed")).toBe(false);
  });
});
