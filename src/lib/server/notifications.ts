/**
 * Server-side notification jobs: enqueueing the monthly emails and draining
 * the email outbox (`email_delivery_events`). All reads use the service role
 * because these run from scheduled calls, not as a signed-in user.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { timingSafeEqual } from "node:crypto";
import { renderEntryCommentEmail, type CommentAuthorRole, type EntryCommentEmailModel } from "@/lib/notifications/entry-comment-email";
import type { RenderedEmail } from "@/lib/notifications/email-layout";
import {
  buildExecutiveSummary,
  executiveSummaryDedupeKey,
  renderExecutiveSummaryEmail,
  type DirectoryUser,
  type ExecutiveSummaryModel,
} from "@/lib/notifications/executive-summary";
import { renderExecutiveSummaryPdf } from "@/lib/notifications/executive-summary-pdf";
import {
  planMonthlyReminders,
  reminderDedupeKey,
  reminderPeriod,
  renderMonthlyReminderEmail,
  type MdaPosition,
  type MonthlyReminderEmailModel,
  type ReminderPlan,
} from "@/lib/notifications/monthly-reminder";
import { computeMdaPerformance } from "@/lib/reporting/executive";
import { loadReportingDataset } from "@/lib/reporting/queries";
import { createServiceClient } from "@/lib/server/auth";
import { isEmailConfigured, sendEmail } from "@/lib/server/email";

type ServiceClient = SupabaseClient;

const MAX_ATTEMPTS = 5;
/** Stay under Resend's default rate limit (2 requests/second). */
const SEND_SPACING_MS = 600;

// ---------------------------------------------------------------------------
// Authorization for the scheduled routes
// ---------------------------------------------------------------------------

/**
 * Scheduled calls carry the shared secret in `x-cron-secret`. A signed-in
 * Admin may also call the routes (for previews and manual re-runs).
 */
export async function authorizeNotificationJob(request: Request): Promise<{ via: "cron" | "admin" }> {
  const expected = process.env.NOTIFICATIONS_CRON_SECRET;
  const provided = request.headers.get("x-cron-secret");
  if (expected && provided) {
    const a = Buffer.from(provided);
    const b = Buffer.from(expected);
    if (a.length === b.length && timingSafeEqual(a, b)) return { via: "cron" };
    throw new Error("Invalid cron secret");
  }

  const authorization = request.headers.get("Authorization");
  if (!authorization) throw new Error("Missing credentials");
  const service = createServiceClient();
  const { data, error } = await service.auth.getUser(authorization.replace("Bearer ", ""));
  if (error || !data.user) throw new Error("Invalid Supabase session");
  const { data: profile } = await service.from("profiles").select("role").eq("id", data.user.id).maybeSingle();
  if (profile?.role !== "admin") throw new Error("Only Admins can run notification jobs");
  return { via: "admin" };
}

// ---------------------------------------------------------------------------
// Shared loaders
// ---------------------------------------------------------------------------

async function loadDirectory(service: ServiceClient): Promise<DirectoryUser[]> {
  const { data: profiles, error } = await service.from("profiles").select("id, full_name, role");
  if (error) throw error;

  const accounts = new Map<string, { email: string | null; lastSignInAt: string | null; banned: boolean }>();
  const now = Date.now();
  for (let page = 1; ; page += 1) {
    const { data, error: listError } = await service.auth.admin.listUsers({ page, perPage: 1000 });
    if (listError) throw listError;
    for (const user of data.users) {
      const bannedUntil = (user as { banned_until?: string | null }).banned_until;
      accounts.set(user.id, {
        email: user.email ?? null,
        lastSignInAt: user.last_sign_in_at ?? null,
        banned: Boolean(bannedUntil && new Date(bannedUntil).getTime() > now),
      });
    }
    if (data.users.length < 1000) break;
  }

  return (profiles ?? []).map((profile: { id: string; full_name: string | null; role: string }) => {
    const account = accounts.get(profile.id);
    return {
      id: profile.id,
      name: profile.full_name?.trim() || account?.email || "User",
      email: account?.email ?? null,
      role: profile.role,
      lastSignInAt: account?.lastSignInAt ?? null,
      banned: account?.banned ?? true,
    };
  });
}

type Preferences = { entry_comment_emails: boolean; monthly_reminder_emails: boolean; executive_summary_emails: boolean };

async function loadPreferences(service: ServiceClient): Promise<Map<string, Preferences>> {
  const { data, error } = await service
    .from("notification_preferences")
    .select("user_id, entry_comment_emails, monthly_reminder_emails, executive_summary_emails");
  if (error) throw error;
  return new Map((data ?? []).map((row: Preferences & { user_id: string }) => [row.user_id, row]));
}

async function loadMemberships(service: ServiceClient): Promise<Array<{ user_id: string; mda_id: string }>> {
  const { data, error } = await service.from("user_mda_memberships").select("user_id, mda_id");
  if (error) throw error;
  return data ?? [];
}

async function loadMdas(service: ServiceClient) {
  const { data, error } = await service.from("mdas").select("id, name, abbreviation, active");
  if (error) throw error;
  return (data ?? []) as Array<{ id: string; name: string; abbreviation: string | null; active: boolean }>;
}

type QueuedEmail = {
  recipient_id: string;
  recipient_email: string;
  template_key: "monthly_reminder" | "executive_summary";
  entity_type: string;
  entity_id: string | null;
  payload: unknown;
  dedupe_key: string;
};

/** Inserts outbox rows, skipping any whose dedupe_key already exists. */
async function enqueue(service: ServiceClient, rows: QueuedEmail[]): Promise<number> {
  if (!rows.length) return 0;
  const { data, error } = await service
    .from("email_delivery_events")
    .upsert(rows, { onConflict: "dedupe_key", ignoreDuplicates: true })
    .select("id");
  if (error) throw error;
  return data?.length ?? 0;
}

// ---------------------------------------------------------------------------
// Monthly reminders (5th of the month)
// ---------------------------------------------------------------------------

export type MonthlyReminderRun = {
  plan: ReminderPlan;
  queued: number;
  preview: RenderedEmail | null;
};

export async function runMonthlyReminders({
  runDate,
  appUrl,
  dryRun,
}: {
  runDate: Date;
  appUrl: string;
  dryRun: boolean;
}): Promise<MonthlyReminderRun> {
  const service = createServiceClient();
  const [dataset, directory, preferences, memberships, mdas] = await Promise.all([
    loadReportingDataset(service as never),
    loadDirectory(service),
    loadPreferences(service),
    loadMemberships(service),
    loadMdas(service),
  ]);

  const usersById = new Map(directory.map((user) => [user.id, user]));
  const entries = [
    ...dataset.funding.map((row) => ({ mda_id: row.mda_id, transaction_date: row.transaction_date, kind: "funding" as const })),
    ...dataset.expenditure.map((row) => ({ mda_id: row.mda_id, transaction_date: row.transaction_date, kind: "expenditure" as const })),
  ];
  const lastEntryDates = new Map<string, string>();
  for (const entry of entries) {
    const current = lastEntryDates.get(entry.mda_id);
    if (!current || entry.transaction_date > current) lastEntryDates.set(entry.mda_id, entry.transaction_date);
  }

  // FY position for each MDA, from the same metrics as the executive overview.
  const { mdas: performance } = computeMdaPerformance(dataset, reminderPeriod(runDate).year);
  const positions = new Map<string, MdaPosition>(
    performance.map((mda) => [
      mda.mda_id,
      { budget: mda.budget, released: mda.released, spent: mda.spent, utilisation: mda.utilisation, release_rate: mda.release_rate },
    ]),
  );

  const plan = planMonthlyReminders({
    runDate,
    mdas,
    entries,
    lastEntryDates,
    members: memberships.flatMap((membership) => {
      const user = usersById.get(membership.user_id);
      if (!user) return [];
      return [{
        user_id: user.id,
        mda_id: membership.mda_id,
        name: user.name,
        email: user.email,
        role: user.role,
        banned: user.banned,
        monthlyReminderEmails: preferences.get(user.id)?.monthly_reminder_emails ?? true,
      }];
    }),
    publications: dataset.publications,
    positions,
  });

  const actualsThrough = dataset.expenditure
    .filter((row) => row.fiscal_year === plan.period.year)
    .reduce<string | null>((latest, row) => (!latest || row.transaction_date > latest ? row.transaction_date : latest), null);
  const admin = directory
    .filter((user) => user.role === "admin" && !user.banned && user.email)
    .sort((a, b) => (b.lastSignInAt ?? "").localeCompare(a.lastSignInAt ?? ""))[0];

  const rows: QueuedEmail[] = [];
  let preview: RenderedEmail | null = null;
  for (const reminder of plan.reminders) {
    for (const recipient of reminder.recipients) {
      const model: MonthlyReminderEmailModel = {
        appUrl,
        recipientName: recipient.name,
        mdaName: reminder.mda.name,
        period: plan.period,
        months: reminder.months,
        outstandingMonths: reminder.outstandingMonths,
        lastEntryDate: reminder.lastEntryDate,
        position: reminder.position,
        actualsThrough,
        adminContact: admin ? { name: admin.name, email: admin.email as string } : null,
      };
      preview ??= renderMonthlyReminderEmail(model);
      rows.push({
        recipient_id: recipient.user_id,
        recipient_email: recipient.email,
        template_key: "monthly_reminder",
        entity_type: "mda",
        entity_id: reminder.mda.id,
        payload: model,
        dedupe_key: reminderDedupeKey(plan.period, reminder.mda.id, recipient.user_id),
      });
    }
  }

  const queued = dryRun ? 0 : await enqueue(service, rows);
  return { plan, queued, preview };
}

// ---------------------------------------------------------------------------
// Executive summary (7th of the month)
// ---------------------------------------------------------------------------

export type ExecutiveSummaryRun = {
  model: ExecutiveSummaryModel;
  recipients: Array<{ name: string; email: string; role: string }>;
  queued: number;
  preview: RenderedEmail;
};

export async function runExecutiveSummary({
  runDate,
  appUrl,
  dryRun,
}: {
  runDate: Date;
  appUrl: string;
  dryRun: boolean;
}): Promise<ExecutiveSummaryRun> {
  const service = createServiceClient();
  const [dataset, directory, preferences, memberships, mdas] = await Promise.all([
    loadReportingDataset(service as never),
    loadDirectory(service),
    loadPreferences(service),
    loadMemberships(service),
    loadMdas(service),
  ]);

  const model = buildExecutiveSummary({ runDate, appUrl, dataset, mdaMeta: mdas, users: directory, memberships });
  const recipients = directory
    .filter(
      (user) =>
        (user.role === "admin" || user.role === "reviewer") &&
        !user.banned &&
        user.email &&
        (preferences.get(user.id)?.executive_summary_emails ?? true),
    )
    .sort((a, b) => a.name.localeCompare(b.name));

  const rows: QueuedEmail[] = recipients.map((user) => ({
    recipient_id: user.id,
    recipient_email: user.email as string,
    template_key: "executive_summary",
    entity_type: "executive_summary",
    entity_id: null,
    payload: model,
    dedupe_key: executiveSummaryDedupeKey(model.issue.key, user.id),
  }));

  const queued = dryRun ? 0 : await enqueue(service, rows);
  return {
    model,
    recipients: recipients.map((user) => ({ name: user.name, email: user.email as string, role: user.role })),
    queued,
    preview: renderExecutiveSummaryEmail(model),
  };
}

// ---------------------------------------------------------------------------
// Entry comment emails (rendered at send time from live data)
// ---------------------------------------------------------------------------

type CommentRow = {
  id: string;
  entry_type: "funding_entry" | "expenditure_entry";
  entry_id: string;
  body: string;
  author_id: string;
  author_name: string;
  author_role: CommentAuthorRole;
  created_at: string;
};

async function loadEntryCommentModel(
  service: ServiceClient,
  commentId: string,
  recipientId: string,
  appUrl: string,
): Promise<EntryCommentEmailModel | null> {
  const { data: comment } = await service
    .from("entry_comments")
    .select("id, entry_type, entry_id, body, author_id, author_name, author_role, created_at")
    .eq("id", commentId)
    .maybeSingle<CommentRow>();
  if (!comment) return null;

  const isFunding = comment.entry_type === "funding_entry";
  const { data: entry } = isFunding
    ? await service
        .from("funding_entries")
        .select("id, public_id, amount, transaction_date, fiscal_year, quarter, reference_no, entered_by, mda:mdas(name, abbreviation), source:funding_sources(name)")
        .eq("id", comment.entry_id)
        .maybeSingle()
    : await service
        .from("expenditure_entries")
        .select("id, public_id, amount, transaction_date, fiscal_year, quarter, voucher_ref_no, entered_by, mda:mdas(name, abbreviation), category:expenditure_categories(name)")
        .eq("id", comment.entry_id)
        .maybeSingle();
  if (!entry) return null;
  // to-one embeds come back as objects at runtime; the generic client types them as arrays.
  const row = entry as unknown as Record<string, unknown> & {
    public_id: string | null;
    amount: number | string;
    transaction_date: string;
    fiscal_year: number;
    quarter: number;
    entered_by: string | null;
    mda: { name: string; abbreviation: string | null } | null;
  };

  const [{ data: thread }, { data: people }, { data: publications }] = await Promise.all([
    service
      .from("entry_comments")
      .select("id, body, author_id, author_name, author_role, created_at")
      .eq("entry_type", comment.entry_type)
      .eq("entry_id", comment.entry_id)
      .lt("created_at", comment.created_at)
      .order("created_at", { ascending: false }),
    service.from("profiles").select("id, full_name, role").in("id", [recipientId, row.entered_by].filter(Boolean) as string[]),
    service
      .from("budget_implementation_report_publications")
      .select("id")
      .eq("fiscal_year", row.fiscal_year)
      .eq("quarter", row.quarter)
      .limit(1),
  ]);

  const recipient = (people ?? []).find((p: { id: string }) => p.id === recipientId) as
    | { full_name: string | null; role: string }
    | undefined;
  if (!recipient) return null;
  const recordedBy = (people ?? []).find((p: { id: string }) => p.id === row.entered_by) as { full_name: string | null } | undefined;
  const earlier = (thread ?? []) as Array<Omit<CommentRow, "entry_type" | "entry_id">>;
  const previous = earlier.find((c) => c.author_id !== comment.author_id) ?? null;

  return {
    appUrl,
    recipient: {
      name: recipient.full_name?.trim() || "there",
      side: recipient.role === "admin" || recipient.role === "reviewer" ? "oversight" : "mda",
      previouslyCommented: earlier.some((c) => c.author_id === recipientId),
    },
    comment: { authorName: comment.author_name, authorRole: comment.author_role, body: comment.body, createdAt: comment.created_at },
    previousComment: previous
      ? { authorName: previous.author_name, authorRole: previous.author_role, body: previous.body, createdAt: previous.created_at }
      : null,
    entry: {
      type: comment.entry_type,
      publicId: row.public_id ?? comment.entry_id.slice(0, 8),
      url: `${appUrl}/entries/${isFunding ? "funding" : "expenditure"}/${comment.entry_id}`,
      mdaName: row.mda?.name ?? "Unknown MDA",
      mdaAbbreviation: row.mda?.abbreviation ?? null,
      amount: Number(row.amount),
      transactionDate: row.transaction_date,
      quarter: row.quarter,
      fiscalYear: row.fiscal_year,
      detailLabel: isFunding ? "Funding source" : "Expenditure category",
      detailValue: isFunding
        ? ((row.source as { name: string } | null)?.name ?? "—")
        : ((row.category as { name: string } | null)?.name ?? "—"),
      referenceLabel: isFunding ? "Reference no." : "Voucher ref. no.",
      referenceValue: String((isFunding ? row.reference_no : row.voucher_ref_no) ?? "—"),
      recordedBy: recordedBy?.full_name?.trim() || null,
      quarterPublished: Boolean(publications?.length),
    },
  };
}

// ---------------------------------------------------------------------------
// Dispatch
// ---------------------------------------------------------------------------

type OutboxRow = {
  id: string;
  recipient_id: string | null;
  recipient_email: string;
  template_key: string;
  entity_id: string | null;
  payload: unknown;
  attempts: number;
  dedupe_key: string | null;
};

export type DispatchResult = { claimed: number; sent: number; failed: number; retrying: number; skipped: number };

export async function dispatchQueuedEmails({
  appUrl,
  limit = 25,
}: {
  appUrl: string;
  limit?: number;
}): Promise<DispatchResult> {
  const result: DispatchResult = { claimed: 0, sent: 0, failed: 0, retrying: 0, skipped: 0 };
  if (!isEmailConfigured()) {
    throw new Error("RESEND_API_KEY is not configured; queued emails were left in the outbox.");
  }

  const service = createServiceClient();
  const { data, error } = await service.rpc("claim_email_deliveries", { p_limit: limit });
  if (error) throw error;
  const rows = (data ?? []) as OutboxRow[];
  result.claimed = rows.length;

  const pdfCache = new Map<string, Buffer>();
  for (const [index, row] of rows.entries()) {
    if (index > 0) await new Promise((resolve) => setTimeout(resolve, SEND_SPACING_MS));

    let rendered: RenderedEmail | null = null;
    let attachments: Array<{ filename: string; content: Buffer }> | undefined;
    try {
      if (row.template_key === "entry_comment" && row.entity_id && row.recipient_id) {
        const model = await loadEntryCommentModel(service, row.entity_id, row.recipient_id, appUrl);
        rendered = model ? renderEntryCommentEmail(model) : null;
      } else if (row.template_key === "monthly_reminder") {
        rendered = renderMonthlyReminderEmail(row.payload as MonthlyReminderEmailModel);
      } else if (row.template_key === "executive_summary") {
        const model = row.payload as ExecutiveSummaryModel;
        let pdf = pdfCache.get(model.issue.key);
        if (!pdf) {
          pdf = Buffer.from(renderExecutiveSummaryPdf(model));
          pdfCache.set(model.issue.key, pdf);
        }
        attachments = [{ filename: model.pdfFilename, content: pdf }];
        rendered = renderExecutiveSummaryEmail(model);
      }
    } catch (cause) {
      await markRetry(service, row, `Render failed: ${cause instanceof Error ? cause.message : String(cause)}`, result);
      continue;
    }

    if (!rendered) {
      // The comment or entry no longer exists, or the template is unknown.
      await service
        .from("email_delivery_events")
        .update({ status: "skipped", error_message: "Nothing to send: subject not found or unknown template." })
        .eq("id", row.id);
      result.skipped += 1;
      continue;
    }

    const sent = await sendEmail({
      to: row.recipient_email,
      subject: rendered.subject,
      html: rendered.html,
      text: rendered.text,
      attachments,
      idempotencyKey: row.dedupe_key ?? row.id,
    });

    if (sent.sent) {
      await service
        .from("email_delivery_events")
        .update({ status: "sent", provider_message_id: sent.messageId, sent_at: new Date().toISOString(), error_message: null })
        .eq("id", row.id);
      result.sent += 1;
    } else {
      await markRetry(service, row, sent.error, result);
    }
  }

  return result;
}

async function markRetry(service: ServiceClient, row: OutboxRow, message: string, result: DispatchResult) {
  const exhausted = row.attempts >= MAX_ATTEMPTS;
  await service
    .from("email_delivery_events")
    .update({ status: exhausted ? "failed" : "queued", error_message: message })
    .eq("id", row.id);
  if (exhausted) result.failed += 1;
  else result.retrying += 1;
}

/** Drains the outbox in batches until it is empty or `maxBatches` is hit. */
export async function drainOutbox({ appUrl, maxBatches = 8 }: { appUrl: string; maxBatches?: number }) {
  const total: DispatchResult = { claimed: 0, sent: 0, failed: 0, retrying: 0, skipped: 0 };
  for (let batch = 0; batch < maxBatches; batch += 1) {
    const result = await dispatchQueuedEmails({ appUrl });
    for (const key of Object.keys(total) as Array<keyof DispatchResult>) total[key] += result[key];
    // Stop when the queue is empty or only retries remain (they wait for the next run).
    if (result.claimed === 0 || result.sent + result.skipped === 0) break;
  }
  return total;
}
