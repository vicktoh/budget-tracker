"use client";

import * as React from "react";
import {
  CheckIcon,
  ClockIcon,
  FileTextIcon,
  HistoryIcon,
  MessageSquareTextIcon,
  PaperclipIcon,
  PencilLineIcon,
  RotateCcwIcon,
  ShieldAlertIcon,
  XIcon,
} from "lucide-react";
import { toast } from "sonner";
import Link from "next/link";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge, StatusBadge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Empty } from "@/components/ui/empty";
import { Textarea } from "@/components/ui/textarea";
import { ReviewActionDialog } from "@/components/review/review-action-dialog";
import {
  insertEntryComment,
  resubmitEntry,
  type EntryAttachmentRow,
  type EntryAuditEventRow,
  type EntryCommentRow,
} from "@/lib/db/review";
import type { EntryType } from "@/lib/db/types";
import {
  REVIEW_ACTION_LABELS,
  availableActions,
  canResubmit,
  type ReviewAction,
} from "@/lib/review/transitions";
import { supabase } from "@/lib/supabase";
import { cn } from "@/lib/utils";

type EntryHeader = {
  id: string;
  publicId: string | null;
  status: "pending" | "approved" | "processed" | "rejected";
  transactionDate: string;
  fiscalYear: number;
  quarter: number;
  mdaLabel: string;
  amount: number;
  enteredBy: string;
};

export type EntryReviewSection = {
  label: string;
  value: React.ReactNode;
  /** Single-cell rows stretch full width; default puts two per row. */
  full?: boolean;
};

const COMMENT_TYPE_LABELS: Record<EntryCommentRow["comment_type"], string> = {
  general: "Comment",
  clarification: "Clarification",
  rejection_reason: "Rejection",
  approval_note: "Approval",
};

const COMMENT_TYPE_VARIANT: Record<
  EntryCommentRow["comment_type"],
  "secondary" | "approved" | "rejected" | "pending"
> = {
  general: "secondary",
  clarification: "pending",
  rejection_reason: "rejected",
  approval_note: "approved",
};

const naira = new Intl.NumberFormat("en-NG", {
  style: "currency",
  currency: "NGN",
  maximumFractionDigits: 2,
});

export function EntryReviewDetail({
  entryType,
  entry,
  sections,
  remarks,
  canReview,
  canEditReviewed,
  reviewedEditHref,
  currentUserId,
  comments,
  attachments,
  auditEvents,
  loading,
  loadError,
  onRefresh,
}: {
  entryType: EntryType;
  entry: EntryHeader;
  sections: EntryReviewSection[];
  remarks: string | null;
  canReview: boolean;
  canEditReviewed: boolean;
  reviewedEditHref?: string;
  currentUserId: string | null;
  comments: EntryCommentRow[];
  attachments: EntryAttachmentRow[];
  auditEvents: EntryAuditEventRow[];
  loading: boolean;
  loadError: string | null;
  onRefresh: () => void;
}) {
  const [dialogAction, setDialogAction] = React.useState<ReviewAction | null>(
    null,
  );
  const [resubmitting, setResubmitting] = React.useState(false);

  const actions = canReview ? availableActions(entry.status) : [];
  const canDoResubmit =
    !!currentUserId &&
    entry.enteredBy === currentUserId &&
    canResubmit(entry.status);

  async function handleResubmit() {
    if (!supabase) return;
    setResubmitting(true);
    try {
      await resubmitEntry(supabase, { entryType, entryId: entry.id });
      toast.success(
        `Resubmitted entry ${entry.publicId ?? entry.id.slice(0, 8)}. It is back in the pending queue.`,
      );
      onRefresh();
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Could not resubmit the entry.",
      );
    } finally {
      setResubmitting(false);
    }
  }

  return (
    <div className="flex flex-col gap-5">
      {loadError ? (
        <Alert variant="destructive">
          <AlertTitle>We couldn&rsquo;t load all entry details</AlertTitle>
          <AlertDescription>{loadError}</AlertDescription>
        </Alert>
      ) : null}

      <Card>
        <CardHeader className="flex-col items-start gap-3 md:flex-row md:items-center md:justify-between">
          <div className="flex flex-col gap-1">
            <div className="flex items-center gap-2">
              <span className="font-mono text-sm font-semibold">
                {entry.publicId ?? entry.id.slice(0, 8)}
              </span>
              <StatusBadge status={entry.status} />
            </div>
            <CardDescription>
              {entry.transactionDate} · FY {entry.fiscalYear} · Q{entry.quarter} ·{" "}
              {entry.mdaLabel} · {naira.format(entry.amount)}
            </CardDescription>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {actions.map((action) => (
              <Button
                key={action}
                size="sm"
                type="button"
                variant={action === "reject" ? "destructive" : "default"}
                onClick={() => setDialogAction(action)}
              >
                {action === "approve" ? (
                  <CheckIcon aria-hidden="true" data-icon="inline-start" />
                ) : action === "reject" ? (
                  <XIcon aria-hidden="true" data-icon="inline-start" />
                ) : (
                  <ShieldAlertIcon
                    aria-hidden="true"
                    data-icon="inline-start"
                  />
                )}
                {REVIEW_ACTION_LABELS[action]}
              </Button>
            ))}
            {canEditReviewed && reviewedEditHref ? (
              <Link
                href={reviewedEditHref}
                className={cn(buttonVariants({ variant: "outline", size: "sm" }))}
              >
                <PencilLineIcon
                  aria-hidden="true"
                  data-icon="inline-start"
                />
                Edit with reason
              </Link>
            ) : null}
            {canDoResubmit ? (
              <Button
                size="sm"
                type="button"
                variant="outline"
                onClick={handleResubmit}
                disabled={resubmitting}
              >
                <RotateCcwIcon aria-hidden="true" data-icon="inline-start" />
                {resubmitting ? "Resubmitting…" : "Resubmit"}
              </Button>
            ) : null}
          </div>
        </CardHeader>
        <CardContent>
          <dl className="grid gap-x-6 gap-y-4 sm:grid-cols-2">
            {sections.map((section) => (
              <div
                key={section.label}
                className={cn("flex flex-col gap-0.5", section.full && "sm:col-span-2")}
              >
                <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  {section.label}
                </dt>
                <dd className="text-sm">{section.value ?? "—"}</dd>
              </div>
            ))}
            {remarks ? (
              <div className="flex flex-col gap-0.5 sm:col-span-2">
                <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Remarks
                </dt>
                <dd className="whitespace-pre-line text-sm">{remarks}</dd>
              </div>
            ) : null}
          </dl>
        </CardContent>
      </Card>

      <CommentsCard
        comments={comments}
        currentUserId={currentUserId}
        entryId={entry.id}
        entryType={entryType}
        loading={loading}
        onPosted={onRefresh}
      />

      <AttachmentsCard attachments={attachments} loading={loading} />

      <AuditCard auditEvents={auditEvents} loading={loading} />

      <ReviewActionDialog
        open={dialogAction !== null}
        action={dialogAction}
        entryType={entryType}
        entryId={entry.id}
        publicId={entry.publicId}
        onOpenChange={(next) => {
          if (!next) setDialogAction(null);
        }}
        onSuccess={onRefresh}
      />
    </div>
  );
}

function CommentsCard({
  comments,
  currentUserId,
  entryId,
  entryType,
  loading,
  onPosted,
}: {
  comments: EntryCommentRow[];
  currentUserId: string | null;
  entryId: string;
  entryType: EntryType;
  loading: boolean;
  onPosted: () => void;
}) {
  const [body, setBody] = React.useState("");
  const [submitting, setSubmitting] = React.useState(false);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (!supabase || !currentUserId) return;
    const trimmed = body.trim();
    if (trimmed.length === 0) return;
    setSubmitting(true);
    try {
      await insertEntryComment(supabase, {
        entryType,
        entryId,
        body: trimmed,
        commentType: "general",
        authorId: currentUserId,
      });
      setBody("");
      onPosted();
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Could not post comment.",
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <MessageSquareTextIcon
            aria-hidden="true"
            className="size-4 text-muted-foreground"
          />
          Comments
        </CardTitle>
        <CardDescription>
          Anyone who can view this entry can add a comment. Approve/reject notes
          are added automatically when reviewers act.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        {loading ? (
          <p className="text-sm text-muted-foreground">Loading…</p>
        ) : comments.length === 0 ? (
          <Empty
            description="No comments on this entry yet. Reviewers and submitters can share context here."
            icon={MessageSquareTextIcon}
            title="No comments"
          />
        ) : (
          <ol className="flex flex-col gap-3">
            {comments.map((comment) => (
              <li
                key={comment.id}
                className="flex flex-col gap-1 rounded-md border bg-card p-3"
              >
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <Badge variant={COMMENT_TYPE_VARIANT[comment.comment_type]}>
                    {COMMENT_TYPE_LABELS[comment.comment_type]}
                  </Badge>
                  <span className="font-medium text-foreground">
                    {comment.author?.full_name ?? "Unknown"}
                  </span>
                  <span>·</span>
                  <span>{formatTimestamp(comment.created_at)}</span>
                </div>
                <p className="whitespace-pre-line text-sm">{comment.body}</p>
              </li>
            ))}
          </ol>
        )}

        {currentUserId ? (
          <form className="flex flex-col gap-2" onSubmit={handleSubmit}>
            <label className="flex flex-col gap-1 text-sm">
              <span className="font-medium">Add a comment</span>
              <Textarea
                placeholder="Share clarification or context for this entry."
                value={body}
                onChange={(event) => setBody(event.target.value)}
              />
            </label>
            <div className="flex justify-end">
              <Button
                type="submit"
                size="sm"
                disabled={submitting || body.trim().length === 0}
              >
                {submitting ? "Posting…" : "Post comment"}
              </Button>
            </div>
          </form>
        ) : null}
      </CardContent>
    </Card>
  );
}

function AttachmentsCard({
  attachments,
  loading,
}: {
  attachments: EntryAttachmentRow[];
  loading: boolean;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <PaperclipIcon
            aria-hidden="true"
            className="size-4 text-muted-foreground"
          />
          Attachments
        </CardTitle>
        <CardDescription>
          Files referenced on this entry. Signed downloads land in a later
          storage-hardening slice.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {loading ? (
          <p className="text-sm text-muted-foreground">Loading…</p>
        ) : attachments.length === 0 ? (
          <Empty
            description="No attachments uploaded for this entry."
            icon={FileTextIcon}
            title="No attachments"
          />
        ) : (
          <ul className="flex flex-col gap-2">
            {attachments.map((attachment) => (
              <li
                key={attachment.id}
                className="flex items-center justify-between gap-3 rounded-md border bg-card p-3"
              >
                <div className="flex flex-col">
                  <span className="text-sm font-medium">
                    {attachment.file_name}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {attachment.content_type ?? "Unknown type"} ·{" "}
                    {attachment.file_size_bytes != null
                      ? `${Math.round(attachment.file_size_bytes / 1024)} KB`
                      : "Unknown size"}{" "}
                    · {formatTimestamp(attachment.created_at)}
                  </span>
                </div>
                <Badge variant="outline">{attachment.storage_bucket}</Badge>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}

function AuditCard({
  auditEvents,
  loading,
}: {
  auditEvents: EntryAuditEventRow[];
  loading: boolean;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <HistoryIcon
            aria-hidden="true"
            className="size-4 text-muted-foreground"
          />
          Audit history
        </CardTitle>
        <CardDescription>
          Every status change and edit is recorded with the reviewer who
          performed it and any reason they captured.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {loading ? (
          <p className="text-sm text-muted-foreground">Loading…</p>
        ) : auditEvents.length === 0 ? (
          <Empty
            description="No audit events for this entry yet."
            icon={ClockIcon}
            title="No history"
          />
        ) : (
          <ol className="flex flex-col gap-3">
            {auditEvents.map((event) => {
              const oldStatus =
                (event.old_values?.status as string | undefined) ?? null;
              const newStatus =
                (event.new_values?.status as string | undefined) ?? null;
              return (
                <li
                  key={event.id}
                  className="flex flex-col gap-1 rounded-md border bg-card p-3"
                >
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <Badge variant="outline">{event.event_type}</Badge>
                    <span className="font-medium text-foreground">
                      {event.actor?.full_name ?? "System"}
                    </span>
                    <span>·</span>
                    <span>{formatTimestamp(event.created_at)}</span>
                  </div>
                  {event.event_type === "status_changed" &&
                  oldStatus &&
                  newStatus ? (
                    <p className="text-sm">
                      Status: <code className="text-xs">{oldStatus}</code> →{" "}
                      <code className="text-xs">{newStatus}</code>
                    </p>
                  ) : null}
                  {event.reason ? (
                    <p className="whitespace-pre-line text-sm text-muted-foreground">
                      {event.reason}
                    </p>
                  ) : null}
                </li>
              );
            })}
          </ol>
        )}
      </CardContent>
    </Card>
  );
}

function formatTimestamp(value: string): string {
  try {
    return new Date(value).toLocaleString("en-NG", {
      dateStyle: "medium",
      timeStyle: "short",
    });
  } catch {
    return value;
  }
}
