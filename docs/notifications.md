# Email notifications

Three kinds of email go out, all through Resend and all recorded in the
`email_delivery_events` outbox:

| Email | When | Who |
|---|---|---|
| Remark on an entry | Right after a comment is posted | "The other party" (below) |
| Monthly reminder | 5th of each month, 09:00 WAT | MDA users whose MDA has empty months in the current quarter |
| Monthly executive summary | 7th of each month, 09:00 WAT | All Admins and Viewers, with the Budget Implementation Report PDF attached |

Everyone can turn each email off at **Settings → Email notifications**
(`/settings/notifications`). No stored preference means the email is on.
In-app notifications are unaffected by these settings.

## Who receives a remark email

- **Viewer or Admin comments** → the MDA side: the user who recorded the entry,
  the members of the entry's MDA, and (for PHC expenditure) users assigned to
  the entry's facility.
- **MDA or facility user comments** → the Viewers and Admins who have already
  commented on that entry. If no Viewer or Admin has commented yet, every
  Viewer is emailed.

The recipient rule lives in `app_private.enqueue_entry_comment_emails()`
(migration `20261014120000_email_notifications.sql`). The email itself is
rendered at send time from live data (`src/lib/notifications/entry-comment-email.ts`).

## What counts as "outstanding" for the monthly reminder

- The reminder covers the **current quarter only**: the quarter containing the
  previous month, from its first month through the previous month. On 5 Oct it
  checks July–September; on 5 Nov it checks October only.
- A month is outstanding for an MDA when **no funding or expenditure entry** is
  dated in it.
- Quarters whose Budget Implementation Report is published are skipped (they
  are locked, so there is nothing users can do).
- MDAs with no MDA users get no reminder; the executive summary lists them so
  Admins can invite someone.

Earlier quarters are deliberately out of scope: Q2 2026 actuals were recorded
as quarter totals dated 30 June, so April and May would otherwise look empty
forever.

## Executive summary

Every number comes from `computeExecutiveOverview` and friends in
`src/lib/reporting/executive.ts`, the same module behind the Commissioner
overview, so the email and `/admin` always agree. The narrative is generated
from fixed rules over those numbers (`src/lib/notifications/executive-summary.ts`);
data gaps come straight from the overview's coverage notes. The attached PDF is
built server-side (`executive-summary-pdf.ts`) and uses "N" for naira because
jsPDF's built-in fonts have no ₦ glyph.

## How sending works

1. Rows are queued in `email_delivery_events` with a `dedupe_key`, so re-running
   a job or retrying a trigger never queues the same email twice:
   - comments: by the database trigger on `entry_comments`
   - reminders / summary: by `POST /api/notifications/monthly-reminders` and
     `POST /api/notifications/executive-summary`
2. `POST /api/notifications/dispatch` claims queued rows
   (`claim_email_deliveries`, `FOR UPDATE SKIP LOCKED`), renders and sends them.
   Failures are retried with a growing back-off and marked `failed` after five
   attempts. The Resend idempotency key is the `dedupe_key`.
3. pg_cron (migration `20261014120100_schedule_notification_jobs.sql`) calls the
   routes: dispatch every 10 minutes as a backstop, reminders on the 5th, the
   summary on the 7th. The comment trigger also calls dispatch immediately.

All routes accept either the shared `x-cron-secret` header or an Admin's
Supabase bearer token. Body (all optional):
`{ "runDate": "2026-10-05", "dryRun": true, "includeHtml": true }`.
A dry run returns the plan and a rendered preview without queueing anything.

## Setup (one-off, per environment)

1. Apply `20261014120000_email_notifications.sql`. It is inert until step 3:
   comment emails are queued but nothing calls dispatch.
2. Generate a long random secret and add it to App Hosting as
   `NOTIFICATIONS_CRON_SECRET` (Cloud Secret Manager, `RUNTIME`), then deploy.
3. Store the app URL and the same secret in Supabase Vault:

   ```sql
   select vault.create_secret('https://kano-budget-tracker.app', 'notifications_app_url');
   select vault.create_secret('<the secret>', 'notifications_cron_secret');
   ```

4. Apply `20261014120100_schedule_notification_jobs.sql` (enables pg_net and
   pg_cron and schedules the three jobs).

To check delivery: `select status, count(*) from email_delivery_events group by 1;`
and `select * from cron.job_run_details order by start_time desc limit 20;`.

## Open decision: nil returns (parked 14 Oct 2026)

An MDA that genuinely spent and received nothing in a month cannot clear the
reminder, because entry amounts must be positive and "outstanding" means "no
entry dated in the month". The reminder will repeat every month until the
quarter is published.

Option discussed: a **nil return**, where an MDA user confirms "nothing to report for
<month>" and the month counts as reported. It would need a small table (MDA,
month, confirmed by, confirmed at), a confirm action linked from the reminder,
and the reminder planner treating a nil return like an entry. This mirrors the
monthly tracking rule that an explicit ₦0 row counts as reported while a missing
row is a gap.

Parked by the client for now; revisit before MDAs start receiving reminders in
volume.
