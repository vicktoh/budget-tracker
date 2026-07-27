begin;

-- Quarterly BIR publication replaces the per-entry approval state machine.
-- Publication records are append-only metadata; ledger rows remain the source
-- of truth and may only change after publication through the amendment RPCs.

create table public.budget_implementation_report_publications (
  id uuid primary key default gen_random_uuid(),
  fiscal_year int not null check (fiscal_year between 2000 and 2200),
  quarter smallint not null check (quarter between 1 and 4),
  version int not null check (version > 0),
  published_by uuid not null references public.profiles(id) on delete restrict,
  published_at timestamptz not null default now(),
  supersedes_publication_id uuid references public.budget_implementation_report_publications(id) on delete restrict,
  amendment_reason text,
  unique (fiscal_year, quarter, version),
  check (
    (version = 1 and supersedes_publication_id is null and amendment_reason is null)
    or
    (version > 1 and supersedes_publication_id is not null and nullif(btrim(amendment_reason), '') is not null)
  )
);

create table public.budget_implementation_report_amendments (
  id uuid primary key default gen_random_uuid(),
  entry_type text not null check (entry_type in ('funding_entry', 'expenditure_entry')),
  entry_id uuid not null,
  source_publication_id uuid not null references public.budget_implementation_report_publications(id) on delete restrict,
  resulting_publication_id uuid not null references public.budget_implementation_report_publications(id) on delete restrict,
  reason text not null check (nullif(btrim(reason), '') is not null),
  before_values jsonb not null,
  after_values jsonb not null,
  amended_by uuid not null references public.profiles(id) on delete restrict,
  amended_at timestamptz not null default now(),
  unique (resulting_publication_id)
);

create table public.archived_ledger_entries (
  id uuid primary key default gen_random_uuid(),
  entry_type text not null check (entry_type in ('funding_entry', 'expenditure_entry')),
  original_entry_id uuid not null,
  public_id text,
  fiscal_year int not null,
  quarter smallint not null check (quarter between 1 and 4),
  mda_id uuid not null references public.mdas(id) on delete restrict,
  archive_reason text not null,
  entry_snapshot jsonb not null,
  comments_snapshot jsonb not null default '[]'::jsonb,
  audit_snapshot jsonb not null default '[]'::jsonb,
  attachments_snapshot jsonb not null default '[]'::jsonb,
  archived_at timestamptz not null default now(),
  archived_by uuid references public.profiles(id) on delete set null,
  unique (entry_type, original_entry_id)
);

create index idx_bir_publications_period
  on public.budget_implementation_report_publications(fiscal_year, quarter, version desc);
create index idx_bir_amendments_entry
  on public.budget_implementation_report_amendments(entry_type, entry_id, amended_at desc);
create index idx_archived_ledger_entries_period
  on public.archived_ledger_entries(fiscal_year, quarter, mda_id);

alter table public.budget_implementation_report_publications enable row level security;
alter table public.budget_implementation_report_amendments enable row level security;
alter table public.archived_ledger_entries enable row level security;

create or replace function app_private.prevent_bir_publication_mutation()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  raise exception 'BIR publication records are append-only and cannot be updated or deleted.'
    using errcode = '55000';
end;
$$;

create trigger prevent_bir_publication_mutation
before update or delete on public.budget_implementation_report_publications
for each row execute function app_private.prevent_bir_publication_mutation();

revoke all on public.budget_implementation_report_publications from anon, authenticated;
revoke all on public.budget_implementation_report_amendments from anon, authenticated;
revoke all on public.archived_ledger_entries from anon, authenticated;
grant select on public.budget_implementation_report_publications to authenticated;
grant select on public.budget_implementation_report_amendments to authenticated;
grant select on public.archived_ledger_entries to authenticated;

create policy "bir_publications_authenticated_read"
on public.budget_implementation_report_publications
for select to authenticated
using (true);

create policy "bir_amendments_entry_viewers_read"
on public.budget_implementation_report_amendments
for select to authenticated
using (app_private.current_user_can_view_entry(entry_type, entry_id));

create policy "archived_ledger_entries_admin_read"
on public.archived_ledger_entries
for select to authenticated
using (app_private.current_user_is_admin());

-- Preserve rejected legacy records before removing them from active ledgers.
insert into public.archived_ledger_entries (
  entry_type, original_entry_id, public_id, fiscal_year, quarter, mda_id,
  archive_reason, entry_snapshot, comments_snapshot, audit_snapshot,
  attachments_snapshot, archived_by
)
select
  'funding_entry', fe.id, fe.public_id, fe.fiscal_year, fe.quarter, fe.mda_id,
  'Archived during removal of the ledger review workflow because the entry was rejected.',
  to_jsonb(fe),
  coalesce((select jsonb_agg(to_jsonb(c) order by c.created_at) from public.entry_comments c
    where c.entry_type = 'funding_entry' and c.entry_id = fe.id), '[]'::jsonb),
  coalesce((select jsonb_agg(to_jsonb(a) order by a.created_at) from public.entry_audit_events a
    where a.entity_type = 'funding_entries' and a.entity_id = fe.id), '[]'::jsonb),
  coalesce((select jsonb_agg(to_jsonb(att) order by att.created_at) from public.entry_attachments att
    where att.entry_type = 'funding_entry' and att.entry_id = fe.id), '[]'::jsonb),
  null
from public.funding_entries fe
where fe.status = 'rejected';

insert into public.archived_ledger_entries (
  entry_type, original_entry_id, public_id, fiscal_year, quarter, mda_id,
  archive_reason, entry_snapshot, comments_snapshot, audit_snapshot,
  attachments_snapshot, archived_by
)
select
  'expenditure_entry', ee.id, ee.public_id, ee.fiscal_year, ee.quarter, ee.mda_id,
  'Archived during removal of the ledger review workflow because the entry was rejected.',
  to_jsonb(ee),
  coalesce((select jsonb_agg(to_jsonb(c) order by c.created_at) from public.entry_comments c
    where c.entry_type = 'expenditure_entry' and c.entry_id = ee.id), '[]'::jsonb),
  coalesce((select jsonb_agg(to_jsonb(a) order by a.created_at) from public.entry_audit_events a
    where a.entity_type = 'expenditure_entries' and a.entity_id = ee.id), '[]'::jsonb),
  coalesce((select jsonb_agg(to_jsonb(att) order by att.created_at) from public.entry_attachments att
    where att.entry_type = 'expenditure_entry' and att.entry_id = ee.id), '[]'::jsonb),
  null
from public.expenditure_entries ee
where ee.status = 'rejected';

delete from public.entry_comments c
where (c.entry_type = 'funding_entry' and exists (
  select 1 from public.funding_entries fe where fe.id = c.entry_id and fe.status = 'rejected'
)) or (c.entry_type = 'expenditure_entry' and exists (
  select 1 from public.expenditure_entries ee where ee.id = c.entry_id and ee.status = 'rejected'
));

delete from public.entry_attachments a
where (a.entry_type = 'funding_entry' and exists (
  select 1 from public.funding_entries fe where fe.id = a.entry_id and fe.status = 'rejected'
)) or (a.entry_type = 'expenditure_entry' and exists (
  select 1 from public.expenditure_entries ee where ee.id = a.entry_id and ee.status = 'rejected'
));

delete from public.entry_data_quality_warnings w
where (w.entry_type = 'funding_entry' and exists (
  select 1 from public.funding_entries fe where fe.id = w.entry_id and fe.status = 'rejected'
)) or (w.entry_type = 'expenditure_entry' and exists (
  select 1 from public.expenditure_entries ee where ee.id = w.entry_id and ee.status = 'rejected'
));

delete from public.funding_entries where status = 'rejected';
delete from public.expenditure_entries where status = 'rejected';

-- Approval notes on retained rows become ordinary discussion comments.
update public.entry_comments set comment_type = 'general'
where comment_type in ('approval_note', 'rejection_reason');
alter table public.entry_comments drop constraint if exists entry_comments_comment_type_check;
alter table public.entry_comments add constraint entry_comments_comment_type_check
  check (comment_type in ('general', 'clarification'));

-- Remove the old public state-machine surface before dropping its columns.
drop function if exists public.review_entry(text, uuid, text, text, text);
drop function if exists public.resubmit_entry(text, uuid);
drop function if exists public.update_reviewed_funding_entry(uuid, text, date, uuid, uuid, uuid, numeric, text, text);
drop function if exists public.update_reviewed_expenditure_entry(uuid, text, date, uuid, uuid, uuid, uuid, uuid, boolean, uuid, uuid, numeric, text, uuid, text);
drop function if exists public.update_reviewed_expenditure_entry(uuid, text, date, uuid, uuid, uuid, uuid, uuid, boolean, uuid, uuid, numeric, text, uuid, text, jsonb);

drop policy if exists "funding_insert_by_submitter" on public.funding_entries;
drop policy if exists "funding_update_pending_by_submitter" on public.funding_entries;
drop policy if exists "funding_review_update_by_reviewer" on public.funding_entries;
drop policy if exists "expenditure_insert_by_submitter" on public.expenditure_entries;
drop policy if exists "expenditure_update_pending_by_submitter" on public.expenditure_entries;
drop policy if exists "expenditure_review_update_by_reviewer" on public.expenditure_entries;
drop policy if exists "expenditure_insert_by_facility_user" on public.expenditure_entries;
drop policy if exists "expenditure_update_pending_by_facility_user" on public.expenditure_entries;

-- Allocation policies also inspect the parent entry status. Remove them before
-- dropping the ledger status columns; status-free replacements are created
-- later in this migration.
drop policy if exists "expenditure_allocations_insert" on public.expenditure_funding_allocations;
drop policy if exists "expenditure_allocations_update" on public.expenditure_funding_allocations;
drop policy if exists "expenditure_allocations_delete" on public.expenditure_funding_allocations;

drop index if exists public.idx_funding_entries_year_mda_status;
drop index if exists public.idx_expenditure_entries_year_mda_status;
drop trigger if exists set_entry_statuses_updated_at on public.entry_statuses;

alter table public.funding_entries
  drop column approved_by,
  drop column approved_at,
  drop column status;
alter table public.expenditure_entries
  drop column approved_by,
  drop column approved_at,
  drop column status;
drop table public.entry_statuses;

-- Reviewer authority is profile-level and statewide. Obsolete per-MDA reviewer
-- membership values were already removed by the statewide-viewer migration.
alter table public.user_mda_memberships
  drop constraint if exists user_mda_memberships_membership_role_check;
alter table public.user_mda_memberships
  add constraint user_mda_memberships_membership_role_check
  check (membership_role in ('funding_submitter', 'expenditure_submitter'));

create or replace function app_private.bir_period_is_published(
  p_fiscal_year int,
  p_quarter smallint
)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.budget_implementation_report_publications
    where fiscal_year = p_fiscal_year and quarter = p_quarter
  );
$$;

create or replace function app_private.bir_amendment_context_allows(
  p_entry_type text,
  p_entry_id uuid,
  p_fiscal_year int,
  p_quarter smallint
)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.budget_implementation_report_amendments a
    join public.budget_implementation_report_publications source
      on source.id = a.source_publication_id
    where a.id::text = nullif(current_setting('app.bir_amendment_id', true), '')
      and a.entry_type = p_entry_type
      and a.entry_id = p_entry_id
      and a.amended_by = (select auth.uid())
      and source.fiscal_year = p_fiscal_year
      and source.quarter = p_quarter
  );
$$;

create or replace function app_private.enforce_bir_ledger_publication_lock()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  old_locked boolean := false;
  new_locked boolean := false;
  old_fiscal_year int;
  old_quarter smallint;
  new_fiscal_year int;
  new_quarter smallint;
  entry_kind text := case when tg_table_name = 'funding_entries' then 'funding_entry' else 'expenditure_entry' end;
  target_id uuid := coalesce(new.id, old.id);
begin
  if tg_op in ('UPDATE', 'DELETE') then
    old_fiscal_year := app_private.entry_fiscal_year(old.transaction_date);
    old_quarter := app_private.entry_quarter(old.transaction_date);
    old_locked := app_private.bir_period_is_published(old_fiscal_year, old_quarter);
    if old_locked and not app_private.bir_amendment_context_allows(entry_kind, target_id, old_fiscal_year, old_quarter) then
      raise exception 'Quarter Q% FY% has been published. Use an Admin BIR amendment to change this entry.', old_quarter, old_fiscal_year
        using errcode = 'P0001', hint = 'quarter_published';
    end if;
  end if;

  if tg_op in ('INSERT', 'UPDATE') then
    new_fiscal_year := app_private.entry_fiscal_year(new.transaction_date);
    new_quarter := app_private.entry_quarter(new.transaction_date);
    new_locked := app_private.bir_period_is_published(new_fiscal_year, new_quarter);
    if new_locked and not app_private.bir_amendment_context_allows(entry_kind, target_id, new_fiscal_year, new_quarter) then
      raise exception 'Quarter Q% FY% has been published. New submissions and routine edits are locked.', new_quarter, new_fiscal_year
        using errcode = 'P0001', hint = 'quarter_published';
    end if;
  end if;

  return coalesce(new, old);
end;
$$;

create trigger enforce_funding_bir_publication_lock
before insert or update or delete on public.funding_entries
for each row execute function app_private.enforce_bir_ledger_publication_lock();

create trigger enforce_expenditure_bir_publication_lock
before insert or update or delete on public.expenditure_entries
for each row execute function app_private.enforce_bir_ledger_publication_lock();

create or replace function app_private.enforce_bir_allocation_publication_lock()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  parent_id uuid := coalesce(new.expenditure_entry_id, old.expenditure_entry_id);
  parent_entry record;
begin
  select id, fiscal_year, quarter into parent_entry
  from public.expenditure_entries where id = parent_id;

  if found and app_private.bir_period_is_published(parent_entry.fiscal_year, parent_entry.quarter)
    and not app_private.bir_amendment_context_allows(
      'expenditure_entry', parent_entry.id, parent_entry.fiscal_year, parent_entry.quarter
    ) then
    raise exception 'Quarter Q% FY% has been published. Funding allocations are locked.', parent_entry.quarter, parent_entry.fiscal_year
      using errcode = 'P0001', hint = 'quarter_published';
  end if;

  return coalesce(new, old);
end;
$$;

create trigger enforce_expenditure_allocation_bir_publication_lock
before insert or update or delete on public.expenditure_funding_allocations
for each row execute function app_private.enforce_bir_allocation_publication_lock();

-- Routine RLS: submitters edit only their own authorized entries; Admins use
-- reasoned correction RPCs for entries they did not create. Publication lock
-- triggers remain authoritative for every database role.
create policy "funding_insert_by_submitter" on public.funding_entries
for insert to authenticated
with check (
  entered_by = (select auth.uid())
  and app_private.current_user_can_submit_funding_for_mda(mda_id)
);

create policy "funding_update_by_submitter" on public.funding_entries
for update to authenticated
using (
  entered_by = (select auth.uid())
  and app_private.current_user_can_submit_funding_for_mda(mda_id)
)
with check (
  entered_by = (select auth.uid())
  and app_private.current_user_can_submit_funding_for_mda(mda_id)
);

create policy "expenditure_insert_by_submitter" on public.expenditure_entries
for insert to authenticated
with check (
  entered_by = (select auth.uid())
  and app_private.current_user_can_submit_expenditure_for_mda(mda_id)
);

create policy "expenditure_update_by_submitter" on public.expenditure_entries
for update to authenticated
using (
  entered_by = (select auth.uid())
  and app_private.current_user_can_submit_expenditure_for_mda(mda_id)
)
with check (
  entered_by = (select auth.uid())
  and app_private.current_user_can_submit_expenditure_for_mda(mda_id)
);

drop policy if exists "expenditure_allocations_insert" on public.expenditure_funding_allocations;
drop policy if exists "expenditure_allocations_update" on public.expenditure_funding_allocations;
drop policy if exists "expenditure_allocations_delete" on public.expenditure_funding_allocations;

create policy "expenditure_allocations_insert" on public.expenditure_funding_allocations
for insert to authenticated
with check (exists (
  select 1 from public.expenditure_entries ee
  where ee.id = expenditure_entry_id
    and ee.entered_by = (select auth.uid())
    and app_private.current_user_can_submit_expenditure_for_mda(ee.mda_id)
));
create policy "expenditure_allocations_update" on public.expenditure_funding_allocations
for update to authenticated
using (exists (
  select 1 from public.expenditure_entries ee
  where ee.id = expenditure_entry_id
    and ee.entered_by = (select auth.uid())
    and app_private.current_user_can_submit_expenditure_for_mda(ee.mda_id)
))
with check (exists (
  select 1 from public.expenditure_entries ee
  where ee.id = expenditure_entry_id
    and ee.entered_by = (select auth.uid())
    and app_private.current_user_can_submit_expenditure_for_mda(ee.mda_id)
));
create policy "expenditure_allocations_delete" on public.expenditure_funding_allocations
for delete to authenticated
using (exists (
  select 1 from public.expenditure_entries ee
  where ee.id = expenditure_entry_id
    and ee.entered_by = (select auth.uid())
    and app_private.current_user_can_submit_expenditure_for_mda(ee.mda_id)
));

create or replace function app_private.funding_pool_balance(
  p_mda_id uuid,
  p_fiscal_year int,
  p_funding_source_id uuid,
  p_programme_area_id uuid,
  p_exclude_expenditure_entry_id uuid default null
)
returns table (received_amount numeric, allocated_amount numeric, available_amount numeric)
language sql
stable
set search_path = public
as $$
  with received as (
    select coalesce(sum(fe.amount), 0)::numeric(18,2) total
    from public.funding_entries fe
    where fe.mda_id = p_mda_id and fe.fiscal_year = p_fiscal_year
      and fe.funding_source_id = p_funding_source_id
      and fe.programme_area_id = p_programme_area_id
  ), allocated as (
    select coalesce(sum(efa.amount), 0)::numeric(18,2) total
    from public.expenditure_funding_allocations efa
    join public.expenditure_entries ee on ee.id = efa.expenditure_entry_id
    where ee.mda_id = p_mda_id and ee.fiscal_year = p_fiscal_year
      and efa.funding_source_id = p_funding_source_id
      and ee.programme_area_id = p_programme_area_id
      and (p_exclude_expenditure_entry_id is null or ee.id <> p_exclude_expenditure_entry_id)
  )
  select received.total, allocated.total,
    (received.total - allocated.total)::numeric(18,2)
  from received, allocated;
$$;

create or replace function app_private.current_user_can_view_entry_audit(
  target_entity_type text,
  target_entity_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select case
    when target_entity_type = 'funding_entries' then exists (
      select 1 from public.funding_entries
      where id = target_entity_id and app_private.current_user_can_view_mda(mda_id)
    )
    when target_entity_type = 'expenditure_entries' then exists (
      select 1 from public.expenditure_entries
      where id = target_entity_id and app_private.current_user_can_view_mda(mda_id)
    )
    else app_private.current_user_is_admin()
  end;
$$;

create or replace function public.publish_budget_implementation_report(
  p_fiscal_year int,
  p_quarter smallint
)
returns public.budget_implementation_report_publications
language plpgsql
security definer
set search_path = public
as $$
declare
  publication public.budget_implementation_report_publications%rowtype;
begin
  if not app_private.current_user_is_admin() then
    raise exception 'Only Admins can publish a Budget Implementation Report.' using errcode = '42501';
  end if;
  if p_fiscal_year not between 2000 and 2200 or p_quarter not between 1 and 4 then
    raise exception 'A valid fiscal year and exact quarter are required.' using errcode = '22023';
  end if;

  insert into public.budget_implementation_report_publications (
    fiscal_year, quarter, version, published_by
  ) values (p_fiscal_year, p_quarter, 1, (select auth.uid()))
  returning * into publication;
  return publication;
exception when unique_violation then
  raise exception 'Q% FY% has already been published.', p_quarter, p_fiscal_year
    using errcode = '23505', hint = 'quarter_published';
end;
$$;

create or replace function public.correct_unpublished_funding_entry(
  p_id uuid, p_reason text, p_transaction_date date, p_mda_id uuid,
  p_programme_area_id uuid, p_funding_source_id uuid, p_amount numeric,
  p_reference_no text, p_remarks text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  entry_row public.funding_entries%rowtype;
  reason text := nullif(btrim(coalesce(p_reason, '')), '');
begin
  if not app_private.current_user_is_admin() then raise exception 'Only Admins can correct entries.' using errcode = '42501'; end if;
  if reason is null then raise exception 'An audit reason is required.' using errcode = '22023'; end if;
  select * into entry_row from public.funding_entries where id = p_id for update;
  if not found then raise exception 'Entry not found.' using errcode = '02000'; end if;
  if app_private.bir_period_is_published(entry_row.fiscal_year, entry_row.quarter)
    or app_private.bir_period_is_published(app_private.entry_fiscal_year(p_transaction_date), app_private.entry_quarter(p_transaction_date)) then
    raise exception 'Published entries must be changed with a BIR amendment.' using errcode = 'P0001', hint = 'quarter_published';
  end if;
  perform set_config('app.audit_reason', reason, true);
  update public.funding_entries set transaction_date=p_transaction_date, mda_id=p_mda_id,
    programme_area_id=p_programme_area_id, funding_source_id=p_funding_source_id,
    amount=p_amount, reference_no=p_reference_no, remarks=p_remarks where id=p_id;
end;
$$;

create or replace function public.correct_unpublished_expenditure_entry(
  p_id uuid, p_reason text, p_transaction_date date, p_mda_id uuid,
  p_programme_area_id uuid, p_expenditure_category_id uuid,
  p_expenditure_item_id uuid, p_aop_activity_id uuid, p_is_phc boolean,
  p_lga_id uuid, p_facility_id uuid, p_amount numeric, p_voucher_ref_no text,
  p_payment_method_id uuid, p_remarks text, p_allocations jsonb default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  entry_row public.expenditure_entries%rowtype;
  reason text := nullif(btrim(coalesce(p_reason, '')), '');
begin
  if not app_private.current_user_is_admin() then raise exception 'Only Admins can correct entries.' using errcode = '42501'; end if;
  if reason is null then raise exception 'An audit reason is required.' using errcode = '22023'; end if;
  select * into entry_row from public.expenditure_entries where id = p_id for update;
  if not found then raise exception 'Entry not found.' using errcode = '02000'; end if;
  if app_private.bir_period_is_published(entry_row.fiscal_year, entry_row.quarter)
    or app_private.bir_period_is_published(app_private.entry_fiscal_year(p_transaction_date), app_private.entry_quarter(p_transaction_date)) then
    raise exception 'Published entries must be changed with a BIR amendment.' using errcode = 'P0001', hint = 'quarter_published';
  end if;
  perform set_config('app.audit_reason', reason, true);
  perform set_config('app.admin_correction_entry_id', p_id::text, true);
  update public.expenditure_entries set transaction_date=p_transaction_date, mda_id=p_mda_id,
    programme_area_id=p_programme_area_id, expenditure_category_id=p_expenditure_category_id,
    expenditure_item_id=p_expenditure_item_id, aop_activity_id=p_aop_activity_id,
    is_phc=p_is_phc, lga_id=p_lga_id, facility_id=p_facility_id, amount=p_amount,
    voucher_ref_no=p_voucher_ref_no, payment_method_id=p_payment_method_id,
    remarks=p_remarks where id=p_id;
  if p_allocations is not null then
    perform public.replace_expenditure_funding_allocations(p_id, p_allocations);
  end if;
end;
$$;

create or replace function public.amend_published_funding_entry(
  p_id uuid, p_reason text, p_transaction_date date, p_mda_id uuid,
  p_programme_area_id uuid, p_funding_source_id uuid, p_amount numeric,
  p_reference_no text, p_remarks text
)
returns public.budget_implementation_report_publications
language plpgsql
security definer
set search_path = public
as $$
declare
  entry_row public.funding_entries%rowtype;
  source_pub public.budget_implementation_report_publications%rowtype;
  result_pub public.budget_implementation_report_publications%rowtype;
  amendment_id uuid;
  reason text := nullif(btrim(coalesce(p_reason, '')), '');
begin
  if not app_private.current_user_is_admin() then raise exception 'Only Admins can amend a published entry.' using errcode = '42501'; end if;
  if reason is null then raise exception 'An amendment reason is required.' using errcode = '22023'; end if;
  select * into entry_row from public.funding_entries where id=p_id for update;
  if not found then raise exception 'Entry not found.' using errcode = '02000'; end if;
  if app_private.entry_fiscal_year(p_transaction_date) <> entry_row.fiscal_year
    or app_private.entry_quarter(p_transaction_date) <> entry_row.quarter then
    raise exception 'A published entry cannot move to another fiscal quarter.' using errcode = '22023';
  end if;
  select * into source_pub from public.budget_implementation_report_publications
    where fiscal_year=entry_row.fiscal_year and quarter=entry_row.quarter
    order by version desc limit 1 for update;
  if not found then raise exception 'This quarter has not been published; use an unpublished correction.' using errcode = '22023'; end if;
  insert into public.budget_implementation_report_publications (
    fiscal_year, quarter, version, published_by, supersedes_publication_id, amendment_reason
  ) values (source_pub.fiscal_year, source_pub.quarter, source_pub.version+1,
    (select auth.uid()), source_pub.id, reason) returning * into result_pub;
  insert into public.budget_implementation_report_amendments (
    entry_type, entry_id, source_publication_id, resulting_publication_id,
    reason, before_values, after_values, amended_by
  ) values ('funding_entry', p_id, source_pub.id, result_pub.id, reason,
    to_jsonb(entry_row), '{}'::jsonb, (select auth.uid())) returning id into amendment_id;
  perform set_config('app.bir_amendment_id', amendment_id::text, true);
  perform set_config('app.audit_reason', reason, true);
  update public.funding_entries set transaction_date=p_transaction_date, mda_id=p_mda_id,
    programme_area_id=p_programme_area_id, funding_source_id=p_funding_source_id,
    amount=p_amount, reference_no=p_reference_no, remarks=p_remarks where id=p_id;
  update public.budget_implementation_report_amendments a set after_values=to_jsonb(fe)
    from public.funding_entries fe where a.id=amendment_id and fe.id=p_id;
  return result_pub;
end;
$$;

create or replace function public.amend_published_expenditure_entry(
  p_id uuid, p_reason text, p_transaction_date date, p_mda_id uuid,
  p_programme_area_id uuid, p_expenditure_category_id uuid,
  p_expenditure_item_id uuid, p_aop_activity_id uuid, p_is_phc boolean,
  p_lga_id uuid, p_facility_id uuid, p_amount numeric, p_voucher_ref_no text,
  p_payment_method_id uuid, p_remarks text, p_allocations jsonb
)
returns public.budget_implementation_report_publications
language plpgsql
security definer
set search_path = public
as $$
declare
  entry_row public.expenditure_entries%rowtype;
  source_pub public.budget_implementation_report_publications%rowtype;
  result_pub public.budget_implementation_report_publications%rowtype;
  amendment_id uuid;
  before_snapshot jsonb;
  after_snapshot jsonb;
  reason text := nullif(btrim(coalesce(p_reason, '')), '');
begin
  if not app_private.current_user_is_admin() then raise exception 'Only Admins can amend a published entry.' using errcode = '42501'; end if;
  if reason is null then raise exception 'An amendment reason is required.' using errcode = '22023'; end if;
  if jsonb_typeof(p_allocations) <> 'array' or jsonb_array_length(p_allocations) < 1 then
    raise exception 'Published expenditure amendments require complete funding allocations.' using errcode = '22023';
  end if;
  select * into entry_row from public.expenditure_entries where id=p_id for update;
  if not found then raise exception 'Entry not found.' using errcode = '02000'; end if;
  if app_private.entry_fiscal_year(p_transaction_date) <> entry_row.fiscal_year
    or app_private.entry_quarter(p_transaction_date) <> entry_row.quarter then
    raise exception 'A published entry cannot move to another fiscal quarter.' using errcode = '22023';
  end if;
  select * into source_pub from public.budget_implementation_report_publications
    where fiscal_year=entry_row.fiscal_year and quarter=entry_row.quarter
    order by version desc limit 1 for update;
  if not found then raise exception 'This quarter has not been published; use an unpublished correction.' using errcode = '22023'; end if;
  select to_jsonb(entry_row) || jsonb_build_object('funding_allocations', coalesce(
    (select jsonb_agg(to_jsonb(efa) order by efa.funding_source_id)
     from public.expenditure_funding_allocations efa where efa.expenditure_entry_id=p_id), '[]'::jsonb
  )) into before_snapshot;
  insert into public.budget_implementation_report_publications (
    fiscal_year, quarter, version, published_by, supersedes_publication_id, amendment_reason
  ) values (source_pub.fiscal_year, source_pub.quarter, source_pub.version+1,
    (select auth.uid()), source_pub.id, reason) returning * into result_pub;
  insert into public.budget_implementation_report_amendments (
    entry_type, entry_id, source_publication_id, resulting_publication_id,
    reason, before_values, after_values, amended_by
  ) values ('expenditure_entry', p_id, source_pub.id, result_pub.id, reason,
    before_snapshot, '{}'::jsonb, (select auth.uid())) returning id into amendment_id;
  perform set_config('app.bir_amendment_id', amendment_id::text, true);
  perform set_config('app.audit_reason', reason, true);
  update public.expenditure_entries set transaction_date=p_transaction_date, mda_id=p_mda_id,
    programme_area_id=p_programme_area_id, expenditure_category_id=p_expenditure_category_id,
    expenditure_item_id=p_expenditure_item_id, aop_activity_id=p_aop_activity_id,
    is_phc=p_is_phc, lga_id=p_lga_id, facility_id=p_facility_id, amount=p_amount,
    voucher_ref_no=p_voucher_ref_no, payment_method_id=p_payment_method_id,
    remarks=p_remarks where id=p_id;
  perform public.replace_expenditure_funding_allocations(p_id, p_allocations);
  select to_jsonb(ee) || jsonb_build_object('funding_allocations', coalesce(
    (select jsonb_agg(to_jsonb(efa) order by efa.funding_source_id)
     from public.expenditure_funding_allocations efa where efa.expenditure_entry_id=p_id), '[]'::jsonb
  )) into after_snapshot from public.expenditure_entries ee where ee.id=p_id;
  update public.budget_implementation_report_amendments set after_values=after_snapshot where id=amendment_id;
  return result_pub;
end;
$$;

-- Rework allocation replacement without status semantics. The deep trigger
-- enforces publication; this function enforces actor ownership/scope.
create or replace function public.replace_expenditure_funding_allocations(
  p_expenditure_entry_id uuid,
  p_allocations jsonb
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  entry_row public.expenditure_entries%rowtype;
  alloc jsonb; total_alloc numeric(18,2) := 0; source_id uuid;
  alloc_amount numeric(18,2); seen_sources uuid[] := array[]::uuid[];
begin
  if jsonb_typeof(p_allocations) <> 'array' or jsonb_array_length(p_allocations) < 1 then
    raise exception 'At least one funding allocation is required.' using errcode = '22023';
  end if;
  select * into entry_row from public.expenditure_entries where id=p_expenditure_entry_id;
  if not found then raise exception 'Entry not found.' using errcode = '02000'; end if;
  if not app_private.bir_amendment_context_allows('expenditure_entry', entry_row.id, entry_row.fiscal_year, entry_row.quarter)
    and not (entry_row.entered_by=(select auth.uid()) and app_private.current_user_can_submit_expenditure_for_mda(entry_row.mda_id))
    and not (
      app_private.current_user_is_admin()
      and nullif(current_setting('app.admin_correction_entry_id', true), '') = entry_row.id::text
      and nullif(btrim(current_setting('app.audit_reason', true)), '') is not null
    ) then
    raise exception 'You do not have permission to update these allocations.' using errcode = '42501';
  end if;
  for alloc in select value from jsonb_array_elements(p_allocations) loop
    source_id := (alloc->>'funding_source_id')::uuid;
    alloc_amount := (alloc->>'amount')::numeric(18,2);
    if source_id is null or alloc_amount is null or alloc_amount <= 0 then
      raise exception 'Each allocation requires a source and positive amount.' using errcode = '22023';
    end if;
    if source_id=any(seen_sources) then raise exception 'Each funding source can only appear once.' using errcode = '22023'; end if;
    seen_sources := array_append(seen_sources, source_id); total_alloc := total_alloc + alloc_amount;
  end loop;
  if total_alloc <> entry_row.amount then raise exception 'Funding allocations must sum to the expenditure amount.' using errcode = '22023'; end if;
  delete from public.expenditure_funding_allocations where expenditure_entry_id=p_expenditure_entry_id;
  for alloc in select value from jsonb_array_elements(p_allocations) loop
    insert into public.expenditure_funding_allocations(expenditure_entry_id, funding_source_id, amount)
    values (p_expenditure_entry_id, (alloc->>'funding_source_id')::uuid, (alloc->>'amount')::numeric(18,2));
  end loop;
  perform app_private.sync_expenditure_funding_warnings(p_expenditure_entry_id);
end;
$$;

revoke all on function public.publish_budget_implementation_report(int, smallint) from public, anon, authenticated;
revoke all on function public.correct_unpublished_funding_entry(uuid, text, date, uuid, uuid, uuid, numeric, text, text) from public, anon, authenticated;
revoke all on function public.correct_unpublished_expenditure_entry(uuid, text, date, uuid, uuid, uuid, uuid, uuid, boolean, uuid, uuid, numeric, text, uuid, text, jsonb) from public, anon, authenticated;
revoke all on function public.amend_published_funding_entry(uuid, text, date, uuid, uuid, uuid, numeric, text, text) from public, anon, authenticated;
revoke all on function public.amend_published_expenditure_entry(uuid, text, date, uuid, uuid, uuid, uuid, uuid, boolean, uuid, uuid, numeric, text, uuid, text, jsonb) from public, anon, authenticated;
revoke all on function public.replace_expenditure_funding_allocations(uuid, jsonb) from public, anon, authenticated;
grant execute on function public.publish_budget_implementation_report(int, smallint) to authenticated;
grant execute on function public.correct_unpublished_funding_entry(uuid, text, date, uuid, uuid, uuid, numeric, text, text) to authenticated;
grant execute on function public.correct_unpublished_expenditure_entry(uuid, text, date, uuid, uuid, uuid, uuid, uuid, boolean, uuid, uuid, numeric, text, uuid, text, jsonb) to authenticated;
grant execute on function public.amend_published_funding_entry(uuid, text, date, uuid, uuid, uuid, numeric, text, text) to authenticated;
grant execute on function public.amend_published_expenditure_entry(uuid, text, date, uuid, uuid, uuid, uuid, uuid, boolean, uuid, uuid, numeric, text, uuid, text, jsonb) to authenticated;
grant execute on function public.replace_expenditure_funding_allocations(uuid, jsonb) to authenticated;

-- Direct table mutations are intentionally unavailable; metadata is append-only
-- through the security-definer commands above.

commit;
