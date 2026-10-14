-- Schedules the notification routes with pg_cron. Calls go through
-- app_private.call_notification_route, which reads the app URL and cron secret
-- from Vault and is a no-op until both exist (setup: docs/notifications.md).
--
-- Times are UTC; Kano is UTC+1 with no daylight saving, so 08:00 UTC is
-- 09:00 in Kano.
--   * dispatch            every 10 minutes - retries and anything the
--                         immediate comment nudge missed
--   * monthly reminders   5th of each month, 09:00 WAT
--   * executive summary   7th of each month, 09:00 WAT

create extension if not exists pg_net;
create extension if not exists pg_cron;

select cron.unschedule(jobname)
from cron.job
where jobname in (
  'notifications-dispatch',
  'notifications-monthly-reminders',
  'notifications-executive-summary'
);

select cron.schedule(
  'notifications-dispatch',
  '*/10 * * * *',
  $$select app_private.call_notification_route('/api/notifications/dispatch', 60000)$$
);

select cron.schedule(
  'notifications-monthly-reminders',
  '0 8 5 * *',
  $$select app_private.call_notification_route('/api/notifications/monthly-reminders', 120000)$$
);

select cron.schedule(
  'notifications-executive-summary',
  '0 8 7 * *',
  $$select app_private.call_notification_route('/api/notifications/executive-summary', 120000)$$
);
