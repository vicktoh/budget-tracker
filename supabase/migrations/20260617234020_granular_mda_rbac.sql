-- Granular MDA RBAC.
--
-- Splits the old generic `submitter` MDA membership into separate
-- funding/expenditure submit grants, keeps reviewer scope MDA-based, and
-- limits reviewed-entry field corrections to admins only.

begin;

-- Drop the legacy role check before backfilling granular membership roles.
alter table public.user_mda_memberships
  drop constraint if exists user_mda_memberships_membership_role_check;

insert into public.user_mda_memberships (user_id, mda_id, membership_role)
select user_id, mda_id, 'funding_submitter'
from public.user_mda_memberships
where membership_role = 'submitter'
on conflict (user_id, mda_id, membership_role) do nothing;

insert into public.user_mda_memberships (user_id, mda_id, membership_role)
select user_id, mda_id, 'expenditure_submitter'
from public.user_mda_memberships
where membership_role = 'submitter'
on conflict (user_id, mda_id, membership_role) do nothing;

delete from public.user_mda_memberships
where membership_role = 'submitter';

alter table public.user_mda_memberships
  add constraint user_mda_memberships_membership_role_check
  check (membership_role in ('funding_submitter', 'expenditure_submitter', 'reviewer'));

create or replace function app_private.current_user_can_submit_funding_for_mda(
  target_mda_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select app_private.current_user_is_admin()
    or exists (
      select 1
      from public.user_mda_memberships
      where user_id = (select auth.uid())
        and mda_id = target_mda_id
        and membership_role = 'funding_submitter'
    );
$$;

create or replace function app_private.current_user_can_submit_expenditure_for_mda(
  target_mda_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select app_private.current_user_is_admin()
    or exists (
      select 1
      from public.user_mda_memberships
      where user_id = (select auth.uid())
        and mda_id = target_mda_id
        and membership_role = 'expenditure_submitter'
    );
$$;

-- Compatibility helper for older code paths. New policies use the
-- ledger-specific helpers above.
create or replace function app_private.current_user_can_submit_for_mda(
  target_mda_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select app_private.current_user_can_submit_funding_for_mda(target_mda_id)
    or app_private.current_user_can_submit_expenditure_for_mda(target_mda_id);
$$;

drop policy if exists "funding_insert_by_submitter" on public.funding_entries;
drop policy if exists "funding_update_pending_by_submitter" on public.funding_entries;
drop policy if exists "funding_review_update_by_reviewer" on public.funding_entries;

create policy "funding_insert_by_submitter" on public.funding_entries
for insert to authenticated
with check (
  entered_by = (select auth.uid())
  and status = 'pending'
  and app_private.current_user_can_submit_funding_for_mda(mda_id)
);

create policy "funding_update_pending_by_submitter" on public.funding_entries
for update to authenticated
using (
  status = 'pending'
  and entered_by = (select auth.uid())
  and app_private.current_user_can_submit_funding_for_mda(mda_id)
)
with check (
  status = 'pending'
  and entered_by = (select auth.uid())
  and app_private.current_user_can_submit_funding_for_mda(mda_id)
);

drop policy if exists "expenditure_insert_by_submitter" on public.expenditure_entries;
drop policy if exists "expenditure_update_pending_by_submitter" on public.expenditure_entries;
drop policy if exists "expenditure_review_update_by_reviewer" on public.expenditure_entries;

create policy "expenditure_insert_by_submitter" on public.expenditure_entries
for insert to authenticated
with check (
  entered_by = (select auth.uid())
  and status = 'pending'
  and app_private.current_user_can_submit_expenditure_for_mda(mda_id)
);

create policy "expenditure_update_pending_by_submitter" on public.expenditure_entries
for update to authenticated
using (
  status = 'pending'
  and entered_by = (select auth.uid())
  and app_private.current_user_can_submit_expenditure_for_mda(mda_id)
)
with check (
  status = 'pending'
  and entered_by = (select auth.uid())
  and app_private.current_user_can_submit_expenditure_for_mda(mda_id)
);

-- Reviewed-entry corrections are admin-only. Reviewers still use review_entry
-- for status workflow; they cannot alter submitted field data.
create or replace function public.update_reviewed_funding_entry(
  p_id uuid,
  p_reason text,
  p_transaction_date date,
  p_mda_id uuid,
  p_programme_area_id uuid,
  p_funding_source_id uuid,
  p_amount numeric,
  p_reference_no text,
  p_remarks text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  current_status text;
  trimmed_reason text := nullif(btrim(coalesce(p_reason, '')), '');
begin
  if trimmed_reason is null then
    raise exception 'An audit reason is required for reviewed-entry edits.'
      using errcode = '22023';
  end if;

  if not app_private.current_user_is_admin() then
    raise exception 'Only admins can correct reviewed funding entries.'
      using errcode = '42501';
  end if;

  select status into current_status
  from public.funding_entries where id = p_id;

  if current_status is null then
    raise exception 'Entry not found.' using errcode = '02000';
  end if;

  if current_status not in ('approved', 'rejected') then
    raise exception 'Only approved or rejected funding entries can be corrected.'
      using errcode = '22023';
  end if;

  perform set_config('app.audit_reason', trimmed_reason, true);

  update public.funding_entries
     set transaction_date = p_transaction_date,
         mda_id = p_mda_id,
         programme_area_id = p_programme_area_id,
         funding_source_id = p_funding_source_id,
         amount = p_amount,
         reference_no = p_reference_no,
         remarks = p_remarks
   where id = p_id;
end;
$$;

create or replace function public.update_reviewed_expenditure_entry(
  p_id uuid,
  p_reason text,
  p_transaction_date date,
  p_mda_id uuid,
  p_programme_area_id uuid,
  p_expenditure_category_id uuid,
  p_expenditure_item_id uuid,
  p_aop_activity_id uuid,
  p_is_phc boolean,
  p_lga_id uuid,
  p_facility_id uuid,
  p_amount numeric,
  p_voucher_ref_no text,
  p_payment_method_id uuid,
  p_remarks text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  current_status text;
  trimmed_reason text := nullif(btrim(coalesce(p_reason, '')), '');
begin
  if trimmed_reason is null then
    raise exception 'An audit reason is required for reviewed-entry edits.'
      using errcode = '22023';
  end if;

  if not app_private.current_user_is_admin() then
    raise exception 'Only admins can correct reviewed expenditure entries.'
      using errcode = '42501';
  end if;

  select status into current_status
  from public.expenditure_entries where id = p_id;

  if current_status is null then
    raise exception 'Entry not found.' using errcode = '02000';
  end if;

  if current_status not in ('approved', 'rejected') then
    raise exception 'Only approved or rejected expenditure entries can be corrected.'
      using errcode = '22023';
  end if;

  perform set_config('app.audit_reason', trimmed_reason, true);

  update public.expenditure_entries
     set transaction_date = p_transaction_date,
         mda_id = p_mda_id,
         programme_area_id = p_programme_area_id,
         expenditure_category_id = p_expenditure_category_id,
         expenditure_item_id = p_expenditure_item_id,
         aop_activity_id = p_aop_activity_id,
         is_phc = p_is_phc,
         lga_id = p_lga_id,
         facility_id = p_facility_id,
         amount = p_amount,
         voucher_ref_no = p_voucher_ref_no,
         payment_method_id = p_payment_method_id,
         remarks = p_remarks
   where id = p_id;
end;
$$;

commit;
