import { NextResponse } from "next/server";
import { parseJobRequest } from "@/lib/server/notification-job-request";
import { requestOrigin } from "@/lib/server/invites";
import { authorizeNotificationJob, drainOutbox, runMonthlyReminders } from "@/lib/server/notifications";

export const dynamic = "force-dynamic";

/**
 * Queues the monthly outstanding-entries reminders (pg_cron, 5th of the month)
 * and sends them. Safe to re-run: each MDA/user/month is queued at most once.
 * `{ "dryRun": true }` returns the plan without queueing anything.
 */
export async function POST(request: Request) {
  try {
    await authorizeNotificationJob(request);
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unauthorized" }, { status: 401 });
  }

  try {
    const job = await parseJobRequest(request);
    const appUrl = requestOrigin(request);
    const run = await runMonthlyReminders({ runDate: job.runDate, appUrl, dryRun: job.dryRun });
    const dispatch = job.dryRun ? null : await drainOutbox({ appUrl });
    return NextResponse.json({
      period: run.plan.period,
      quarterPublished: run.plan.quarterPublished,
      reminders: run.plan.reminders.map((reminder) => ({
        mda: reminder.mda.name,
        outstandingMonths: reminder.outstandingMonths,
        recipients: reminder.recipients.map((recipient) => recipient.email),
      })),
      queued: run.queued,
      dispatch,
      preview: run.preview && job.dryRun
        ? { subject: run.preview.subject, ...(job.includeHtml ? { html: run.preview.html } : {}) }
        : null,
    });
  } catch (error) {
    console.error("Monthly reminders failed:", error);
    return NextResponse.json({ error: error instanceof Error ? error.message : "Monthly reminders failed" }, { status: 500 });
  }
}
