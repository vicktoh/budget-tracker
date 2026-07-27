-- Create in-app notifications when a user comments on a funding or
-- expenditure entry. Recipients mirror the users who can participate in the
-- entry conversation: statewide admins/viewers, MDA members for the entry,
-- and (for PHC expenditure) users assigned to the entry's facility.

begin;

-- Snapshot the small amount of author identity needed to render a
-- conversation. This avoids granting participants general profile-directory
-- access just so a PostgREST relationship can resolve.
alter table public.entry_comments add column author_name text;
alter table public.entry_comments add column author_role text;

update public.entry_comments comment
set
  author_name = coalesce(nullif(btrim(profile.full_name), ''), 'User'),
  author_role = profile.role
from public.profiles profile
where profile.id = comment.author_id;

update public.entry_comments
set author_name = 'User', author_role = 'mda_user'
where author_name is null or author_role is null;

alter table public.entry_comments alter column author_name set not null;
alter table public.entry_comments alter column author_role set not null;
alter table public.entry_comments add constraint entry_comments_author_role_check
  check (author_role in ('admin', 'reviewer', 'mda_user', 'facility_user'));

create or replace function app_private.snapshot_entry_comment_author()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
begin
  select
    coalesce(nullif(btrim(profile.full_name), ''), 'User'),
    profile.role
  into new.author_name, new.author_role
  from public.profiles profile
  where profile.id = new.author_id;

  if new.author_name is null or new.author_role is null then
    raise exception 'Comment author profile was not found.';
  end if;
  return new;
end;
$$;

revoke all on function app_private.snapshot_entry_comment_author() from public;
revoke all on function app_private.snapshot_entry_comment_author() from anon;
revoke all on function app_private.snapshot_entry_comment_author() from authenticated;

create trigger snapshot_entry_comment_author
  before insert or update of author_id on public.entry_comments
  for each row execute function app_private.snapshot_entry_comment_author();

create or replace function app_private.notify_entry_comment_participants()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  target_mda_id uuid;
  target_facility_id uuid;
  target_entered_by uuid;
  target_public_id text;
  entry_label text;
  notification_title text;
  notification_body text;
begin
  if new.entry_type = 'funding_entry' then
    select mda_id, entered_by, public_id
      into target_mda_id, target_entered_by, target_public_id
    from public.funding_entries
    where id = new.entry_id;
    entry_label := 'funding entry';
  elsif new.entry_type = 'expenditure_entry' then
    select mda_id, facility_id, entered_by, public_id
      into target_mda_id, target_facility_id, target_entered_by, target_public_id
    from public.expenditure_entries
    where id = new.entry_id;
    entry_label := 'expenditure entry';
  else
    return new;
  end if;

  -- A comment cannot pass RLS for a missing entry, but keep the trigger
  -- defensive for privileged imports and maintenance scripts.
  if target_mda_id is null then
    return new;
  end if;

  notification_title := format(
    'New comment on %s %s',
    entry_label,
    coalesce(target_public_id, left(new.entry_id::text, 8))
  );
  notification_body := format(
    '%s: %s',
    new.author_name,
    left(regexp_replace(btrim(new.body), E'[\\n\\r\\t]+', ' ', 'g'), 180)
  );

  insert into public.notifications (
    recipient_id,
    notification_type,
    title,
    body,
    entity_type,
    entity_id
  )
  select
    recipient.id,
    'entry_comment_added',
    notification_title,
    notification_body,
    new.entry_type,
    new.entry_id
  from public.profiles recipient
  where recipient.id <> new.author_id
    and (
      recipient.role in ('admin', 'reviewer')
      or recipient.id = target_entered_by
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
    );

  return new;
end;
$$;

revoke all on function app_private.notify_entry_comment_participants() from public;
revoke all on function app_private.notify_entry_comment_participants() from anon;
revoke all on function app_private.notify_entry_comment_participants() from authenticated;

drop trigger if exists notify_entry_comment_participants on public.entry_comments;
create trigger notify_entry_comment_participants
  after insert on public.entry_comments
  for each row execute function app_private.notify_entry_comment_participants();

-- An admin may audit all notifications, but only the recipient should change
-- read state from the application.
drop policy if exists "notifications_update_own_read_at" on public.notifications;
create policy "notifications_update_own_read_at" on public.notifications
for update to authenticated
using (recipient_id = (select auth.uid()))
with check (recipient_id = (select auth.uid()));

-- Postgres Changes is sufficient for this small, per-user stream. The client
-- also refreshes on reconnect and focus, so notification delivery is durable
-- even if Realtime is temporarily unavailable.
do $$
begin
  if exists (
    select 1 from pg_catalog.pg_publication where pubname = 'supabase_realtime'
  ) and not exists (
    select 1
    from pg_catalog.pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'notifications'
  ) then
    alter publication supabase_realtime add table public.notifications;
  end if;
end;
$$;

commit;
