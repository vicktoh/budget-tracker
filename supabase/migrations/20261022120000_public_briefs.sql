begin;

-- Briefs published to the public site (kanohealthbudget.org/reports), starting
-- with the civil-society Accountability Brief. An admin publishes a frozen PDF
-- of the brief from /admin/reports/cso. The database refuses a brief for a
-- period that is not officially published, so provisional quarters can never
-- reach the public through this route.

create table public.public_briefs (
  id uuid primary key default gen_random_uuid(),
  kind text not null default 'accountability_brief' check (kind in ('accountability_brief')),
  fiscal_year int not null check (fiscal_year between 2000 and 2200),
  quarter smallint check (quarter between 1 and 4),  -- null = full year
  title text not null,
  publisher text,
  storage_path text not null,
  file_bytes bigint,
  published_by uuid references public.profiles(id) on delete set null,
  published_at timestamptz not null default now()
);

create unique index public_briefs_one_per_period on public.public_briefs (kind, fiscal_year, coalesce(quarter, 0));

create or replace function app_private.enforce_public_brief_period()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.quarter is null then
    if (select count(distinct quarter) from public.budget_implementation_report_publications
        where fiscal_year = new.fiscal_year) < 4 then
      raise exception 'A full-year brief needs all four quarters of FY% published.', new.fiscal_year using errcode = '42501';
    end if;
  elsif not app_private.bir_period_is_published(new.fiscal_year, new.quarter) then
    raise exception 'Q% FY% is not published; only published quarters can go to the public site.', new.quarter, new.fiscal_year
      using errcode = '42501';
  end if;
  return new;
end;
$$;

create trigger enforce_public_brief_period
before insert or update on public.public_briefs
for each row execute function app_private.enforce_public_brief_period();

alter table public.public_briefs enable row level security;

create policy "public_briefs_public_read" on public.public_briefs
for select to anon, authenticated using (true);

create policy "public_briefs_admin_write" on public.public_briefs
for all to authenticated
using (app_private.current_user_is_admin())
with check (app_private.current_user_is_admin());

grant select on public.public_briefs to anon, authenticated;
grant insert, update, delete on public.public_briefs to authenticated;

insert into storage.buckets (id, name, public)
values ('public-briefs', 'public-briefs', true)
on conflict (id) do update set public = true;

create policy "public_brief_objects_admin_all" on storage.objects
for all to authenticated
using (bucket_id = 'public-briefs' and app_private.current_user_is_admin())
with check (bucket_id = 'public-briefs' and app_private.current_user_is_admin());

commit;
