import { NextResponse } from "next/server";
import { parseJobRequest } from "@/lib/server/notification-job-request";
import { requestOrigin } from "@/lib/server/invites";
import { authorizeNotificationJob, drainOutbox, runExecutiveSummary } from "@/lib/server/notifications";

export const dynamic = "force-dynamic";

/**
 * Queues the monthly executive summary for Admins and Viewers (pg_cron, 7th of
 * the month) and sends it. Safe to re-run: each user gets one per month.
 * `{ "dryRun": true }` returns the recipients and subject without queueing.
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
    const run = await runExecutiveSummary({ runDate: job.runDate, appUrl, dryRun: job.dryRun });
    const dispatch = job.dryRun ? null : await drainOutbox({ appUrl });
    return NextResponse.json({
      issue: run.model.issue,
      fiscalYear: run.model.fiscalYear,
      subject: run.model.subject,
      recipients: run.recipients,
      queued: run.queued,
      dispatch,
      preview: job.dryRun && job.includeHtml ? { html: run.preview.html } : null,
    });
  } catch (error) {
    console.error("Executive summary failed:", error);
    return NextResponse.json({ error: error instanceof Error ? error.message : "Executive summary failed" }, { status: 500 });
  }
}
