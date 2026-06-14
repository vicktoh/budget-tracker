import type { EntryStatusSlug } from "@/lib/db/types";

/**
 * Review state machine, mirroring the server-side `review_entry` RPC.
 *
 *   pending  -> approved | rejected     (reviewer/admin actions)
 *   approved -> processed | rejected    (reviewer/admin actions)
 *   rejected -> pending                 (submitter resubmits)
 *   processed: terminal.
 *
 * The UI uses these helpers to decide which action buttons to render and
 * which inputs are required, so it never offers an action the server will
 * refuse.
 */

export type ReviewAction = "approve" | "reject" | "process";

const ACTION_TRANSITIONS: Record<ReviewAction, Partial<Record<EntryStatusSlug, EntryStatusSlug>>> = {
  approve: { pending: "approved" },
  process: { approved: "processed" },
  reject: { pending: "rejected", approved: "rejected" },
};

export function nextStatus(
  status: EntryStatusSlug,
  action: ReviewAction,
): EntryStatusSlug | null {
  return ACTION_TRANSITIONS[action][status] ?? null;
}

export function canTransition(
  status: EntryStatusSlug,
  action: ReviewAction,
): boolean {
  return nextStatus(status, action) !== null;
}

/** Reviewer/admin actions available from a given status. */
export function availableActions(status: EntryStatusSlug): ReviewAction[] {
  const actions: ReviewAction[] = [];
  for (const action of ["approve", "reject", "process"] as const) {
    if (canTransition(status, action)) actions.push(action);
  }
  return actions;
}

/** A rejection must always carry an operator-facing explanation. */
export function requiresComment(action: ReviewAction): boolean {
  return action === "reject";
}

/** True if the original submitter can resubmit this entry. */
export function canResubmit(status: EntryStatusSlug): boolean {
  return status === "rejected";
}

export const REVIEW_ACTION_LABELS: Record<ReviewAction, string> = {
  approve: "Approve",
  reject: "Reject",
  process: "Mark processed",
};
