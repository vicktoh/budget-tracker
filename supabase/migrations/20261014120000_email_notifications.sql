-- Email notifications: entry comment emails, monthly MDA reminders and the
-- monthly executive summary.
--
-- email_delivery_events is the outbox. Rows are queued by the database (entry
-- comments) or by the scheduled app routes (reminders, executive summary) and
-- sent by POST /api/notifications/dispatch, which claims rows with
-- claim_email_deliveries() so concurrent dispatch runs never double-send.
-- dedupe_key makes every enqueue idempotent: re-running a monthly job, or a
-- retried trigger, cannot queue the same email twice.

begin;

-- ---------------------------------------------------------------------------
-- Per-user email preferences. No row means every email the user's role
-- receives is on.
-- ---------------------------------------------------------------------------
create table public.notification_preferences (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  entry_comment_emails boolean not null default true,
  monthly_reminder_emails boolean not null default true,
  executive_summary_emails boolean not null default true,
  updated_at timestamptz not null default now()
);

create trigger set_notification_preferences_updated_at
  before update on public.notification_preferences
  for each row execute function app_private.touch_updated_at();

alter table public.notification_preferences enable row level security;

create policy "notification_preferences_select_own" on public.notification_preferences
for select to authenticated using (user_id = (select auth.uid()));
create policy "notification_preferences_insert_own" on public.notification_preferences
for insert to authenticated with check (user_id = (select auth.uid()));
create policy "notification_preferences_update_own" on public.notification_preferences
for update to authenticated
using (user_id = (select auth.uid()))
with check (user_id = (select auth.uid()));

-- ---------------------------------------------------------------------------
-- Outbox columns.
-- ---------------------------------------------------------------------------
alter table public.email_delivery_events
  add column dedupe_key text,
  add column attempts integer not null default 0,
  add column last_attempt_at timestamptz;

alter table public.email_delivery_events
  add constraint email_delivery_events_dedupe_key_key unique (dedupe_key);

-- 'sending' = claimed by a dispatch run; 'skipped' = intentionally not sent
-- (recipient opted out or the subject no longer exists).
alter table public.email_delivery_events drop constraint email_delivery_events_status_check;
alter table public.email_delivery_events add constraint email_delivery_events_status_check
  check (status in ('queued', 'sending', 'sent', 'delivered', 'failed', 'skipped'));

create index idx_email_delivery_events_queued
  on public.email_delivery_events (created_at)
  where status = 'queued';

-- Claims up to p_limit queued rows for one dispatch run. Rows stuck in
-- 'sending' for 10 minutes (a crashed run) are returned to the queue first;
-- failed sends wait longer after each attempt before they are retried.
create or replace function public.claim_email_deliveries(p_limit integer default 25)
returns setof public.email_delivery_events
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
begin
  update public.email_delivery_events
  set status = 'queued'
  where status = 'sending'
    and last_attempt_at < now() - interval '10 minutes';

  return query
  update public.email_delivery_events event
  set status = 'sending',
      attempts = event.attempts + 1,
      last_attempt_at = now()
  where event.id in (
    select queued.id
    from public.email_delivery_events queued
    where queued.status = 'queued'
      -- Back off retries: 2 minutes per previous attempt.
      and (
        queued.last_attempt_at is null
        or queued.last_attempt_at < now() - make_interval(mins => queued.attempts * 2)
      )
    order by queued.created_at
    limit greatest(1, least(p_limit, 100))
    for update skip locked
  )
  returning event.*;
end;
$$;

revoke all on function public.claim_email_deliveries(integer) from public;
revoke all on function public.claim_email_deliveries(integer) from anon;
revoke all on function public.claim_email_deliveries(integer) from authenticated;
grant execute on function public.claim_email_deliveries(integer) to service_role;

-- ---------------------------------------------------------------------------
-- Calls one of the app's /api/notifications/* routes over pg_net, using the
-- app URL and shared cron secret stored in Vault (see docs/notifications.md).
-- It does nothing until pg_net is installed and both secrets exist, and it
-- swallows every error: a nudge must never block the statement that fired it.
-- The scheduled jobs in the follow-up migration use the same helper.
-- ---------------------------------------------------------------------------
create or replace function app_private.call_notification_route(
  p_path text,
  p_timeout_ms integer default 5000
)
returns void
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  app_url text;
  cron_secret text;
begin
  if to_regproc('net.http_post') is null then
    return;
  end if;

  select decrypted_secret into app_url
  from vault.decrypted_secrets where name = 'notifications_app_url';
  select decrypted_secret into cron_secret
  from vault.decrypted_secrets where name = 'notifications_cron_secret';

  if app_url is null or cron_secret is null then
    return;
  end if;

  execute 'select net.http_post(url := $1, body := $2, headers := $3, timeout_milliseconds := $4)'
  using
    rtrim(app_url, '/') || p_path,
    '{}'::jsonb,
    jsonb_build_object('Content-Type', 'application/json', 'x-cron-secret', cron_secret),
    p_timeout_ms;
exception when others then
  return;
end;
$$;

revoke all on function app_private.call_notification_route(text, integer) from public;
revoke all on function app_private.call_notification_route(text, integer) from anon;
revoke all on function app_private.call_notification_route(text, integer) from authenticated;

-- ---------------------------------------------------------------------------
-- Entry comment emails go to "the other party":
--   * A Viewer/Admin comment emails the MDA side: the MDA user who recorded the
--     entry, the entry MDA's members and, for PHC expenditure, users assigned
--     to the entry's facility.
--   * An MDA/facility user comment emails the Viewers and Admins who have
--     already commented on the entry. When no Viewer or Admin has commented
--     yet, it goes to every Viewer.
-- In-app notifications (notify_entry_comment_participants) are unchanged and
-- still reach every participant.
-- ---------------------------------------------------------------------------
create or replace function app_private.enqueue_entry_comment_emails()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  target_mda_id uuid;
  target_facility_id uuid;
  target_entered_by uuid;
  author_is_oversight boolean := new.author_role in ('admin', 'reviewer');
  queued_count integer;
begin
  if new.entry_type = 'funding_entry' then
    select mda_id, entered_by
      into target_mda_id, target_entered_by
    from public.funding_entries
    where id = new.entry_id;
  elsif new.entry_type = 'expenditure_entry' then
    select mda_id, facility_id, entered_by
      into target_mda_id, target_facility_id, target_entered_by
    from public.expenditure_entries
    where id = new.entry_id;
  else
    return new;
  end if;

  if target_mda_id is null then
    return new;
  end if;

  insert into public.email_delivery_events (
    recipient_id,
    recipient_email,
    template_key,
    entity_type,
    entity_id,
    payload,
    dedupe_key
  )
  select
    recipient.id,
    account.email,
    'entry_comment',
    'entry_comment',
    new.id,
    jsonb_build_object('entry_type', new.entry_type, 'entry_id', new.entry_id),
    format('entry_comment:%s:%s', new.id, recipient.id)
  from public.profiles recipient
  join auth.users account on account.id = recipient.id
  left join public.notification_preferences preference on preference.user_id = recipient.id
  where recipient.id <> new.author_id
    and account.email is not null
    and (account.banned_until is null or account.banned_until <= now())
    and coalesce(preference.entry_comment_emails, true)
    and (
      (
        author_is_oversight
        and recipient.role in ('mda_user', 'facility_user')
        and (
          recipient.id = target_entered_by
          or exists (
            select 1
            from public.user_mda_memberships membership
            where membership.user_id = recipient.id
              and membership.mda_id = target_mda_id
          )
          or (
            new.entry_type = 'expenditure_entry'
            and target_facility_id is not null
            and exists (
              select 1
              from public.user_facility_assignments assignment
              where assignment.user_id = recipient.id
                and assignment.facility_id = target_facility_id
                and assignment.mda_id = target_mda_id
            )
          )
        )
      )
      or (
        not author_is_oversight
        and recipient.role in ('admin', 'reviewer')
        and (
          exists (
            select 1
            from public.entry_comments prior
            where prior.entry_type = new.entry_type
              and prior.entry_id = new.entry_id
              and prior.id <> new.id
              and prior.author_id = recipient.id
          )
          or (
            recipient.role = 'reviewer'
            and not exists (
              select 1
              from public.entry_comments prior
              where prior.entry_type = new.entry_type
                and prior.entry_id = new.entry_id
                and prior.id <> new.id
                and prior.author_role in ('admin', 'reviewer')
            )
          )
        )
      )
    )
  on conflict (dedupe_key) do nothing;

  get diagnostics queued_count = row_count;
  if queued_count > 0 then
    -- Send now rather than waiting for the scheduled dispatch.
    perform app_private.call_notification_route('/api/notifications/dispatch');
  end if;

  return new;
end;
$$;

revoke all on function app_private.enqueue_entry_comment_emails() from public;
revoke all on function app_private.enqueue_entry_comment_emails() from anon;
revoke all on function app_private.enqueue_entry_comment_emails() from authenticated;

drop trigger if exists enqueue_entry_comment_emails on public.entry_comments;
create trigger enqueue_entry_comment_emails
  after insert on public.entry_comments
  for each row execute function app_private.enqueue_entry_comment_emails();

commit;
