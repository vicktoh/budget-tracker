-- Facility-level expenditure users and admin user management (ADR 0004, PRD 7).
--
-- Adds a `facility_user` role, a `user_facility_assignments` scoping table,
-- capability helpers, RLS policies, and triggers so facility staff can submit
-- PHC expenditure for their own facilities only. The PHC fields (is_phc, MDA,
-- LGA, facility) are enforced server-side here, not just in the UI.

begin;

-- 1. Extend the role enum on profiles to include facility users.
alter table public.profiles
  drop constraint if exists profiles_role_check;
alter table public.profiles
  add constraint profiles_role_check
  check (role in ('admin', 'mda_user', 'reviewer', 'facility_user'));

-- 2. Facility assignment scoping table.
-- A user may be assigned multiple facilities but exactly one MDA (the board the
-- facilities report under). The single-MDA rule is enforced by a trigger below.
create table public.user_facility_assignments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  facility_id uuid not null references public.facilities(id) on delete restrict,
  mda_id uuid not null references public.mdas(id) on delete restrict,
  created_at timestamptz not null default now(),
  unique (user_id, facility_id)
);

create index idx_user_facility_assignments_user
  on public.user_facility_assignments(user_id);
create index idx_user_facility_assignments_facility
  on public.user_facility_assignments(facility_id);

create or replace function app_private.enforce_single_mda_per_facility_user()
returns trigger
language plpgsql
as $$
begin
  if exists (
    select 1
    from public.user_facility_assignments
    where user_id = new.user_id
      and mda_id is distinct from new.mda_id
  ) then
    raise exception 'A facility user can only be assigned facilities under a single MDA.';
  end if;
  return new;
end;
$$;

create trigger enforce_single_mda_per_facility_user
  before insert or update on public.user_facility_assignments
  for each row execute function app_private.enforce_single_mda_per_facility_user();

create trigger audit_user_facility_assignments
  after insert or update or delete on public.user_facility_assignments
  for each row execute function app_private.audit_row_change();

-- 3. Capability helpers mirroring the MDA ones.
create or replace function app_private.current_user_is_facility_user()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.profiles
    where id = (select auth.uid())
      and role = 'facility_user'
  );
$$;

-- True for admins or for users assigned to the given facility.
create or replace function app_private.current_user_can_submit_for_facility(target_facility_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select app_private.current_user_is_admin()
    or exists (
      select 1
      from public.user_facility_assignments
      where user_id = (select auth.uid())
        and facility_id = target_facility_id
    );
$$;

-- 4. RLS for the assignment table: read own or admin; admin manages all.
alter table public.user_facility_assignments enable row level security;

create policy "facility_assignments_select_own_or_admin" on public.user_facility_assignments
for select to authenticated
using (user_id = (select auth.uid()) or app_private.current_user_is_admin());

create policy "facility_assignments_admin_all" on public.user_facility_assignments
for all to authenticated
using (app_private.current_user_is_admin())
with check (app_private.current_user_is_admin());

-- 5. Expenditure RLS additions for facility users.
-- Facility users have no MDA membership, so the existing membership policies
-- never match them. These policies grant a facility-scoped slice and are OR'd
-- with the existing ones at evaluation time.
create policy "expenditure_select_by_facility_assignment" on public.expenditure_entries
for select to authenticated
using (
  facility_id is not null
  and exists (
    select 1
    from public.user_facility_assignments a
    where a.user_id = (select auth.uid())
      and a.facility_id = expenditure_entries.facility_id
  )
);

create policy "expenditure_insert_by_facility_user" on public.expenditure_entries
for insert to authenticated
with check (
  entered_by = (select auth.uid())
  and status = 'pending'
  and is_phc
  and facility_id is not null
  and exists (
    select 1
    from public.user_facility_assignments a
    where a.user_id = (select auth.uid())
      and a.facility_id = expenditure_entries.facility_id
      and a.mda_id = expenditure_entries.mda_id
  )
);

create policy "expenditure_update_pending_by_facility_user" on public.expenditure_entries
for update to authenticated
using (
  status = 'pending'
  and entered_by = (select auth.uid())
  and facility_id is not null
  and exists (
    select 1
    from public.user_facility_assignments a
    where a.user_id = (select auth.uid())
      and a.facility_id = expenditure_entries.facility_id
  )
)
with check (
  status = 'pending'
  and entered_by = (select auth.uid())
  and is_phc
  and facility_id is not null
  and exists (
    select 1
    from public.user_facility_assignments a
    where a.user_id = (select auth.uid())
      and a.facility_id = expenditure_entries.facility_id
      and a.mda_id = expenditure_entries.mda_id
  )
);

-- 6. Trigger enforcement keyed on the entering user's role, so that even a
-- service-role write (which bypasses RLS) cannot record facility-user
-- expenditure outside the user's assignment.
create or replace function app_private.validate_expenditure_facility_scope()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  enterer_role text;
  match_count int;
begin
  select role into enterer_role from public.profiles where id = new.entered_by;

  if enterer_role = 'facility_user' then
    if not new.is_phc then
      raise exception 'Facility users can only submit PHC expenditure.';
    end if;
    if new.facility_id is null then
      raise exception 'Facility users must record a facility on every expenditure entry.';
    end if;

    select count(*) into match_count
    from public.user_facility_assignments a
    where a.user_id = new.entered_by
      and a.facility_id = new.facility_id
      and a.mda_id = new.mda_id;

    if match_count = 0 then
      raise exception 'Expenditure must target a facility assigned to this user under their MDA.';
    end if;
  end if;

  return new;
end;
$$;

create trigger validate_expenditure_facility_scope
  before insert or update on public.expenditure_entries
  for each row execute function app_private.validate_expenditure_facility_scope();

commit;
