"use client";

import * as React from "react";
import Link from "next/link";
import { FileTextIcon, HistoryIcon, LockIcon, MessageSquareTextIcon, PaperclipIcon, PencilLineIcon } from "lucide-react";
import { toast } from "sonner";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { insertEntryComment, type EntryAttachmentRow, type EntryAuditEventRow, type EntryCommentRow } from "@/lib/db/entries";
import { getRoleLabel } from "@/lib/access";
import type { BirAmendment, EntryType } from "@/lib/db/types";
import { formatNaira } from "@/lib/format";
import { supabase } from "@/lib/supabase";
import { cn } from "@/lib/utils";

export type EntryDetailSection = { label: string; value: React.ReactNode; full?: boolean };

export function EntryDetail({ entryType, entry, sections, remarks, currentUserId, comments, attachments, auditEvents, amendments, publishedVersion, canAmend, editHref, loadError, onRefresh }: {
  entryType: EntryType;
  entry: { id: string; publicId: string | null; transactionDate: string; fiscalYear: number; quarter: number; mdaLabel: string; amount: number };
  sections: EntryDetailSection[];
  remarks: string | null;
  currentUserId: string | null;
  comments: EntryCommentRow[];
  attachments: EntryAttachmentRow[];
  auditEvents: EntryAuditEventRow[];
  amendments: BirAmendment[];
  publishedVersion: number | null;
  canAmend: boolean;
  editHref: string;
  loadError: string | null;
  onRefresh: () => void;
}) {
  const [body, setBody] = React.useState("");
  const [posting, setPosting] = React.useState(false);
  async function postComment() {
    if (!supabase || !currentUserId || !body.trim()) return;
    setPosting(true);
    try {
      await insertEntryComment(supabase, { entryType, entryId: entry.id, body: body.trim(), authorId: currentUserId });
      setBody(""); toast.success("Comment posted."); onRefresh();
    } catch (error) { toast.error(error instanceof Error ? error.message : "Could not post comment."); }
    finally { setPosting(false); }
  }
  return <div className="flex flex-col gap-5">
    {loadError ? <Alert variant="warning"><AlertTitle>Some details are limited</AlertTitle><AlertDescription>{loadError}</AlertDescription></Alert> : null}
    <Card><CardHeader className="flex-col items-start gap-3 md:flex-row md:items-center md:justify-between"><div><div className="flex items-center gap-2"><span className="font-mono text-sm font-semibold">{entry.publicId ?? entry.id.slice(0, 8)}</span>{publishedVersion ? <Badge variant="outline"><LockIcon className="size-3" /> Published · v{publishedVersion}</Badge> : <Badge variant="secondary">Open quarter</Badge>}</div><CardDescription>{entry.transactionDate} · FY {entry.fiscalYear} · Q{entry.quarter} · {entry.mdaLabel} · {formatNaira(entry.amount)}</CardDescription></div>{canAmend ? <Link href={`${editHref}?amend=1`} className={cn(buttonVariants({ variant: "outline", size: "sm" }))}><PencilLineIcon className="size-4" /> Amend published entry</Link> : null}</CardHeader><CardContent><dl className="grid gap-x-6 gap-y-4 sm:grid-cols-2">{sections.map((section) => <div key={section.label} className={cn("flex flex-col gap-0.5", section.full && "sm:col-span-2")}><dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{section.label}</dt><dd className="text-sm">{section.value ?? "—"}</dd></div>)}{remarks ? <div className="sm:col-span-2"><dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Remarks</dt><dd className="whitespace-pre-line text-sm">{remarks}</dd></div> : null}</dl></CardContent></Card>
    <Card><CardHeader><CardTitle className="flex items-center gap-2 text-base"><MessageSquareTextIcon className="size-4" /> Comments</CardTitle><CardDescription>Viewers, submitters, and Admins can discuss this entry before and after publication.</CardDescription></CardHeader><CardContent className="flex flex-col gap-4"><div className="flex flex-col gap-3">{comments.length ? comments.map((comment) => <div key={comment.id} className="flex flex-col gap-2 rounded-md border p-3"><div className="flex items-center justify-between gap-2 text-xs text-muted-foreground"><span>{comment.author_name} · {getRoleLabel(comment.author_role)}</span><time>{new Date(comment.created_at).toLocaleString()}</time></div><p className="whitespace-pre-wrap text-sm">{comment.body}</p></div>) : <p className="text-sm text-muted-foreground">No comments yet.</p>}</div>{currentUserId ? <div className="flex flex-col gap-3"><Textarea className="w-full resize-y" value={body} onChange={(event) => setBody(event.target.value)} placeholder="Add a comment or request clarification…" /><Button className="self-end" onClick={postComment} disabled={posting || !body.trim()}>{posting ? "Posting…" : "Post comment"}</Button></div> : null}</CardContent></Card>
    <div className="grid gap-4 lg:grid-cols-2"><Card><CardHeader><CardTitle className="flex items-center gap-2 text-base"><PaperclipIcon className="size-4" /> Attachments</CardTitle></CardHeader><CardContent>{attachments.length ? <ul className="space-y-2">{attachments.map((item) => <li key={item.id} className="flex items-center gap-2 text-sm"><FileTextIcon className="size-4" /> {item.file_name}</li>)}</ul> : <p className="text-sm text-muted-foreground">No attachments.</p>}</CardContent></Card><Card><CardHeader><CardTitle className="flex items-center gap-2 text-base"><HistoryIcon className="size-4" /> Audit events</CardTitle></CardHeader><CardContent>{auditEvents.length ? <ol className="space-y-2">{auditEvents.map((event) => <li key={event.id} className="text-sm"><span className="font-medium capitalize">{event.event_type.replaceAll("_", " ")}</span> · {event.actor?.full_name ?? "System"}<span className="block text-xs text-muted-foreground">{new Date(event.created_at).toLocaleString()}{event.reason ? ` · ${event.reason}` : ""}</span></li>)}</ol> : <p className="text-sm text-muted-foreground">No audit events available.</p>}</CardContent></Card></div>
    {amendments.length ? <Card><CardHeader><CardTitle className="text-base">BIR amendment history</CardTitle><CardDescription>Each amendment created a new publication version.</CardDescription></CardHeader><CardContent><ol className="space-y-3">{amendments.map((amendment) => <li key={amendment.id} className="rounded-md border p-3 text-sm"><span className="font-medium">{amendment.reason}</span><span className="block text-xs text-muted-foreground">{new Date(amendment.amended_at).toLocaleString()}</span></li>)}</ol></CardContent></Card> : null}
  </div>;
}
