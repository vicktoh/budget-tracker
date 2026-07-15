"use client";

import * as React from "react";
import { toast } from "sonner";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Dialog, DialogFooter } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { reviewEntry } from "@/lib/db/review";
import type { EntryType } from "@/lib/db/types";
import {
  REVIEW_ACTION_LABELS,
  requiresComment,
  type ReviewAction,
} from "@/lib/review/transitions";
import { supabase } from "@/lib/supabase";

type Props = {
  open: boolean;
  action: ReviewAction | null;
  entryType: EntryType;
  entryId: string;
  publicId: string | null;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
};

const ACTION_DESCRIPTIONS: Record<ReviewAction, string> = {
  approve:
    "Approve this entry for reporting. You can add an optional approval note that becomes part of the audit trail.",
  reject:
    "Reject this entry. A rejection reason is required and will be shared with the submitter.",
  process:
    "Mark this approved entry as processed (reconciled / posted). You can add an optional note.",
};

export function ReviewActionDialog({
  open,
  action,
  entryType,
  entryId,
  publicId,
  onOpenChange,
  onSuccess,
}: Props) {
  const [comment, setComment] = React.useState("");
  const [submitting, setSubmitting] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (open) {
      setComment("");
      setError(null);
    }
  }, [open, action]);

  if (!action) return null;

  const mustComment = requiresComment(action);
  const trimmed = comment.trim();
  const submitDisabled = submitting || (mustComment && trimmed.length === 0);

  async function handleSubmit() {
    if (!supabase || !action) return;
    if (mustComment && trimmed.length === 0) {
      setError("A rejection reason is required.");
      return;
    }

    setSubmitting(true);
    setError(null);
    try {
      await reviewEntry(supabase, {
        entryType,
        entryId,
        action,
        // The server stamps audit reason from `reason ?? comment`, so passing
        // the same text into both keeps the audit log and the comment thread
        // in sync without forcing the operator to type it twice.
        reason: trimmed.length > 0 ? trimmed : null,
        comment: trimmed.length > 0 ? trimmed : null,
      });
      const label = REVIEW_ACTION_LABELS[action];
      toast.success(
        `${label}d entry ${publicId ?? entryId.slice(0, 8)}.`,
      );
      onOpenChange(false);
      onSuccess();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Could not complete the action.",
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      title={`${REVIEW_ACTION_LABELS[action]} entry`}
      description={ACTION_DESCRIPTIONS[action]}
    >
      <div className="flex flex-col gap-3">
        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium">
            {mustComment ? "Reason" : "Note"}
            {mustComment ? (
              <span className="ml-1 text-status-rejected">*</span>
            ) : null}
          </span>
          <Textarea
            placeholder={
              mustComment
                ? "Explain why this entry is being rejected. The submitter will see this."
                : "Optional context for the audit trail."
            }
            value={comment}
            onChange={(event) => setComment(event.target.value)}
          />
        </label>

        {error ? (
          <Alert variant="destructive">
            <AlertTitle>We couldn&rsquo;t complete the action</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        ) : null}
      </div>

      <DialogFooter>
        <Button
          type="button"
          variant="ghost"
          onClick={() => onOpenChange(false)}
          disabled={submitting}
        >
          Cancel
        </Button>
        <Button
          type="button"
          onClick={handleSubmit}
          disabled={submitDisabled}
          variant={action === "reject" ? "destructive" : "default"}
        >
          {submitting ? "Working…" : REVIEW_ACTION_LABELS[action]}
        </Button>
      </DialogFooter>
    </Dialog>
  );
}
