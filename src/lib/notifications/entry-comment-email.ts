import { formatNaira } from "@/lib/format";
import {
  button,
  callout,
  emailShell,
  escapeHtml,
  footer,
  heading,
  htmlToText,
  keyValueTable,
  link,
  paragraph,
  quote,
  type RenderedEmail,
} from "@/lib/notifications/email-layout";
import { formatDateTime, formatDay, shortMdaName } from "@/lib/notifications/format";

export type CommentAuthorRole = "admin" | "reviewer" | "mda_user" | "facility_user";

export type EntryCommentEmailModel = {
  appUrl: string;
  recipient: {
    name: string;
    /** "mda" = MDA/facility user being told about a Viewer/Admin remark. */
    side: "mda" | "oversight";
    /** Oversight recipients only: whether they had already commented. */
    previouslyCommented: boolean;
  };
  comment: { authorName: string; authorRole: CommentAuthorRole; body: string; createdAt: string };
  /** The most recent earlier comment in the thread, shown for context. */
  previousComment: { authorName: string; authorRole: CommentAuthorRole; body: string; createdAt: string } | null;
  entry: {
    type: "funding_entry" | "expenditure_entry";
    publicId: string;
    url: string;
    mdaName: string;
    mdaAbbreviation: string | null;
    amount: number;
    transactionDate: string;
    quarter: number;
    fiscalYear: number;
    detailLabel: string;
    detailValue: string;
    referenceLabel: string;
    referenceValue: string;
    recordedBy: string | null;
    quarterPublished: boolean;
  };
};

const ROLE_LABEL: Record<CommentAuthorRole, string> = {
  admin: "Admin",
  reviewer: "Viewer",
  mda_user: "MDA user",
  facility_user: "Facility user",
};

function authorMeta(role: CommentAuthorRole, mdaName: string, createdAt: string): string {
  const who = role === "admin" || role === "reviewer" ? ROLE_LABEL[role] : `${ROLE_LABEL[role]}, ${mdaName}`;
  return `${who} · ${formatDateTime(createdAt)}`;
}

export function renderEntryCommentEmail(model: EntryCommentEmailModel): RenderedEmail {
  const { recipient, comment, previousComment, entry, appUrl } = model;
  const entryNoun = entry.type === "funding_entry" ? "funding entry" : "expenditure entry";
  const mdaShort = shortMdaName(entry.mdaName, entry.mdaAbbreviation);
  const settingsLink = link("Notification settings", `${appUrl}/settings/notifications`);
  const quarterLabel = `Q${entry.quarter} ${entry.fiscalYear}`;

  const thread =
    (previousComment
      ? quote({
          author: previousComment.authorName,
          meta: authorMeta(previousComment.authorRole, entry.mdaName, previousComment.createdAt),
          text: previousComment.body,
          highlight: false,
        })
      : "") +
    quote({
      author: comment.authorName,
      meta: authorMeta(comment.authorRole, entry.mdaName, comment.createdAt),
      text: comment.body,
    });

  const entryRows: Array<[string, string]> = [
    ["Entry", `<strong>${escapeHtml(entry.publicId)}</strong> · ${entry.type === "funding_entry" ? "Funding entry" : "Expenditure entry"}`],
    ["MDA", escapeHtml(entry.mdaName)],
    [entry.detailLabel, escapeHtml(entry.detailValue)],
    ["Amount", `<strong>${escapeHtml(formatNaira(entry.amount))}</strong>`],
    ["Transaction date", `${escapeHtml(formatDay(entry.transactionDate))} · Q${entry.quarter} FY${entry.fiscalYear}`],
    [entry.referenceLabel, `<span style="font-family:Menlo,Consolas,monospace;">${escapeHtml(entry.referenceValue)}</span>`],
  ];
  if (entry.recordedBy) entryRows.push(["Recorded by", escapeHtml(entry.recordedBy)]);

  let subject: string;
  let preheader: string;
  let body: string;

  if (recipient.side === "mda") {
    const article = comment.authorRole === "admin" ? "An Admin" : "A Viewer";
    subject = `New remark on ${entry.publicId} from ${comment.authorName}`;
    preheader = `“${truncate(comment.body, 90)}” — ${comment.authorName} on ${entry.publicId}`;
    body =
      heading(`${comment.authorName} left a remark on your ${entryNoun}`) +
      paragraph(`Hello ${escapeHtml(recipient.name)},`, { color: "#1a1a1a" }) +
      paragraph(
        `${article} has commented on a ${entryNoun} recorded for <strong>${escapeHtml(entry.mdaName)}</strong>. ` +
          "Please reply on the platform so the explanation stays attached to the entry.",
      ) +
      thread +
      '<div style="height:8px;"></div>' +
      keyValueTable(entryRows) +
      (entry.quarterPublished
        ? callout(
            `<strong>${quarterLabel} has been published.</strong> Routine edits are locked for this quarter. ` +
              "If the remark points to an error, ask an Admin to record an amendment.",
            "grey",
          )
        : callout(
            `<strong>${quarterLabel} is still open.</strong> The Q${entry.quarter} Budget Implementation Report has not been ` +
              "published, so you can still correct this entry if the remark points to an error.",
            "grey",
          )) +
      button("View entry and reply", entry.url) +
      footer(
        `You're receiving this because you recorded this entry or are a member of ${escapeHtml(entry.mdaName)}. ` +
          `Remarks ask for clarification only and never change whether an entry counts in reports. ${settingsLink}`,
      );
  } else if (recipient.previouslyCommented) {
    subject = `Re: ${entry.publicId} — ${mdaShort} replied`;
    preheader = `${comment.authorName} replied on ${entry.publicId}`;
    body =
      heading(`${entry.mdaName} replied to your remark`) +
      paragraph(`Hello ${escapeHtml(recipient.name)},`, { color: "#1a1a1a" }) +
      paragraph(
        `${comment.authorRole === "facility_user" ? "A facility user" : "An MDA user"} has replied on ` +
          `<strong>${escapeHtml(entry.publicId)}</strong>, the ${entryNoun} you commented on.`,
      ) +
      thread +
      '<div style="height:8px;"></div>' +
      keyValueTable([entryRows[0], entryRows[1], entryRows[3], entryRows[4]]) +
      button("Open the conversation", entry.url) +
      footer(`You're receiving this because you commented on this entry. ${settingsLink}`);
  } else {
    subject = `New comment on ${entry.publicId} from ${mdaShort}`;
    preheader = `“${truncate(comment.body, 90)}” — ${comment.authorName}, ${mdaShort}`;
    body =
      heading(`${comment.authorName} commented on ${entry.publicId}`) +
      paragraph(`Hello ${escapeHtml(recipient.name)},`, { color: "#1a1a1a" }) +
      paragraph(
        `${comment.authorRole === "facility_user" ? "A facility user" : "An MDA user"} from ` +
          `<strong>${escapeHtml(entry.mdaName)}</strong> commented on a ${entryNoun}.`,
      ) +
      thread +
      '<div style="height:8px;"></div>' +
      keyValueTable(entryRows) +
      button("Open the conversation", entry.url) +
      footer(
        "You're receiving this because you're a Viewer and no Viewer or Admin has commented on this entry yet. " +
          settingsLink,
      );
  }

  const html = emailShell({ body, preheader });
  return { subject, html, text: htmlToText(html) };
}

function truncate(value: string, max: number): string {
  const flat = value.replace(/\s+/g, " ").trim();
  return flat.length > max ? `${flat.slice(0, max - 1)}…` : flat;
}
