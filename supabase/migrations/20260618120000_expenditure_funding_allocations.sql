begin;

insert into public.funding_sources (slug, name, active)
values ('unspecified', 'Unspecified', true)
on conflict (slug) do nothing;

create table public.expenditure_funding_allocations (
  id uuid primary key default gen_random_uuid(),
  expenditure_entry_id uuid not null
    references public.expenditure_entries(id) on delete cascade,
  funding_source_id uuid not null
    references public.funding_sources(id) on delete restrict,
  amount numeric(18,2) not null check (amount > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (expenditure_entry_id, funding_source_id)
);

create index idx_expenditure_funding_allocations_entry
  on public.expenditure_funding_allocations(expenditure_entry_id);
create index idx_expenditure_funding_allocations_source
  on public.expenditure_funding_allocations(funding_source_id);

create trigger set_expenditure_funding_allocations_updated_at
before update on public.expenditure_funding_allocations
for each row execute function app_private.touch_updated_at();

insert into public.expenditure_funding_allocations (
  expenditure_entry_id,
  funding_source_id,
  amount
)
select
  ee.id,
  fs.id,
  ee.amount
from public.expenditure_entries ee
cross join public.funding_sources fs
where fs.slug = 'unspecified'
  and not exists (
    select 1
    from public.expenditure_funding_allocations existing
    where existing.expenditure_entry_id = ee.id
  );

create or replace function app_private.funding_pool_balance(
  p_mda_id uuid,
  p_fiscal_year int,
  p_funding_source_id uuid,
  p_programme_area_id uuid,
  p_exclude_expenditure_entry_id uuid default null
)
returns table (
  received_amount numeric(18,2),
  allocated_amount numeric(18,2),
  available_amount numeric(18,2)
)
language sql
stable
as $$
  with received as (
    select coalesce(sum(fe.amount), 0)::numeric(18,2) as total
    from public.funding_entries fe
    where fe.mda_id = p_mda_id
      and fe.fiscal_year = p_fiscal_year
      and fe.funding_source_id = p_funding_source_id
      and fe.programme_area_id = p_programme_area_id
      and fe.status in ('approved', 'processed')
  ),
  allocated as (
    select coalesce(sum(efa.amount), 0)::numeric(18,2) as total
    from public.expenditure_funding_allocations efa
    join public.expenditure_entries ee on ee.id = efa.expenditure_entry_id
    where ee.mda_id = p_mda_id
      and ee.fiscal_year = p_fiscal_year
      and efa.funding_source_id = p_funding_source_id
      and ee.programme_area_id = p_programme_area_id
      and ee.status in ('pending', 'approved', 'processed')
      and (p_exclude_expenditure_entry_id is null or ee.id <> p_exclude_expenditure_entry_id)
  )
  select
    received.total as received_amount,
    allocated.total as allocated_amount,
    (received.total - allocated.total)::numeric(18,2) as available_amount
  from received, allocated;
$$;

create or replace function app_private.sync_expenditure_funding_warnings(
  p_expenditure_entry_id uuid
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  entry_row public.expenditure_entries%rowtype;
  alloc_row record;
  pool record;
  overflow numeric(18,2);
begin
  select * into entry_row
  from public.expenditure_entries
  where id = p_expenditure_entry_id;

  if not found then
    return;
  end if;

  delete from public.entry_data_quality_warnings
  where entry_type = 'expenditure_entry'
    and entry_id = p_expenditure_entry_id
    and warning_code = 'funding_source_over_allocated';

  for alloc_row in
    select efa.funding_source_id, efa.amount, fs.name as funding_source_name
    from public.expenditure_funding_allocations efa
    join public.funding_sources fs on fs.id = efa.funding_source_id
    where efa.expenditure_entry_id = p_expenditure_entry_id
  loop
    select *
    into pool
    from app_private.funding_pool_balance(
      entry_row.mda_id,
      entry_row.fiscal_year,
      alloc_row.funding_source_id,
      entry_row.programme_area_id,
      p_expenditure_entry_id
    );

    overflow := alloc_row.amount - coalesce(pool.available_amount, 0);
    if overflow > 0 then
      insert into public.entry_data_quality_warnings (
        entry_type,
        entry_id,
        warning_code,
        message,
        severity
      ) values (
        'expenditure_entry',
        p_expenditure_entry_id,
        'funding_source_over_allocated',
        format(
          '%s allocation exceeds recorded funding by %s for this MDA, programme area, and fiscal year (received %s, already allocated %s).',
          alloc_row.funding_source_name,
          to_char(overflow, 'FM999,999,999,990.00'),
          to_char(coalesce(pool.received_amount, 0), 'FM999,999,999,990.00'),
          to_char(coalesce(pool.allocated_amount, 0), 'FM999,999,999,990.00')
        ),
        'warning'
      );
    end if;
  end loop;
end;
$$;

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
  alloc jsonb;
  total_alloc numeric(18,2) := 0;
  source_id uuid;
  alloc_amount numeric(18,2);
  seen_sources uuid[] := array[]::uuid[];
begin
  if jsonb_typeof(p_allocations) <> 'array' or jsonb_array_length(p_allocations) < 1 then
    raise exception 'At least one funding allocation is required.'
      using errcode = '22023';
  end if;

  select * into entry_row
  from public.expenditure_entries
  where id = p_expenditure_entry_id;

  if not found then
    raise exception 'Entry not found.' using errcode = '02000';
  end if;

  if entry_row.status = 'pending' then
    if not (
      entry_row.entered_by = (select auth.uid())
      and app_private.current_user_can_submit_for_mda(entry_row.mda_id)
    ) and not app_private.current_user_is_admin() then
      raise exception 'You do not have permission to update these allocations.'
        using errcode = '42501';
    end if;
  elsif not app_private.current_user_is_admin() then
    raise exception 'Only admins can update allocations on reviewed entries.'
      using errcode = '42501';
  end if;

  for alloc in select value from jsonb_array_elements(p_allocations)
  loop
    source_id := (alloc->>'funding_source_id')::uuid;
    alloc_amount := (alloc->>'amount')::numeric(18,2);

    if source_id is null then
      raise exception 'Each allocation requires a funding source.'
        using errcode = '22023';
    end if;

    if alloc_amount is null or alloc_amount <= 0 then
      raise exception 'Allocation amounts must be greater than zero.'
        using errcode = '22023';
    end if;

    if source_id = any(seen_sources) then
      raise exception 'Each funding source can only appear once per expenditure entry.'
        using errcode = '22023';
    end if;

    seen_sources := array_append(seen_sources, source_id);
    total_alloc := total_alloc + alloc_amount;
  end loop;

  if total_alloc <> entry_row.amount then
    raise exception 'Funding allocations must sum to the expenditure amount.'
      using errcode = '22023';
  end if;

  delete from public.expenditure_funding_allocations
  where expenditure_entry_id = p_expenditure_entry_id;

  for alloc in select value from jsonb_array_elements(p_allocations)
  loop
    insert into public.expenditure_funding_allocations (
      expenditure_entry_id,
      funding_source_id,
      amount
    ) values (
      p_expenditure_entry_id,
      (alloc->>'funding_source_id')::uuid,
      (alloc->>'amount')::numeric(18,2)
    );
  end loop;

  perform app_private.sync_expenditure_funding_warnings(p_expenditure_entry_id);
end;
$$;

create or replace function public.evaluate_expenditure_funding_warnings(
  p_mda_id uuid,
  p_fiscal_year int,
  p_programme_area_id uuid,
  p_allocations jsonb,
  p_exclude_expenditure_entry_id uuid default null
)
returns jsonb
language plpgsql
stable
security invoker
set search_path = public
as $$
declare
  alloc jsonb;
  source_id uuid;
  alloc_amount numeric(18,2);
  pool record;
  source_name text;
  overflow numeric(18,2);
  warnings jsonb := '[]'::jsonb;
begin
  if jsonb_typeof(p_allocations) <> 'array' then
    return warnings;
  end if;

  for alloc in select value from jsonb_array_elements(p_allocations)
  loop
    source_id := (alloc->>'funding_source_id')::uuid;
    alloc_amount := (alloc->>'amount')::numeric(18,2);
    if source_id is null or alloc_amount is null or alloc_amount <= 0 then
      continue;
    end if;

    select name into source_name
    from public.funding_sources
    where id = source_id;

    select *
    into pool
    from app_private.funding_pool_balance(
      p_mda_id,
      p_fiscal_year,
      source_id,
      p_programme_area_id,
      p_exclude_expenditure_entry_id
    );

    overflow := alloc_amount - coalesce(pool.available_amount, 0);
    if overflow > 0 then
      warnings := warnings || jsonb_build_array(
        jsonb_build_object(
          'funding_source_id', source_id,
          'funding_source_name', coalesce(source_name, 'Funding source'),
          'overflow_amount', overflow,
          'received_amount', coalesce(pool.received_amount, 0),
          'allocated_amount', coalesce(pool.allocated_amount, 0),
          'available_amount', coalesce(pool.available_amount, 0),
          'message', format(
            '%s exceeds available funding by %s for this MDA, programme area, and fiscal year.',
            coalesce(source_name, 'This source'),
            to_char(overflow, 'FM999,999,999,990.00')
          )
        )
      );
    end if;
  end loop;

  return warnings;
end;
$$;

create or replace view public.expenditure_by_funding_source
with (security_invoker = true)
as
select
  ee.fiscal_year,
  ee.quarter,
  ee.mda_id,
  m.name as mda_name,
  fs.id as funding_source_id,
  fs.name as funding_source_name,
  sum(efa.amount)::numeric(18,2) as total_amount,
  count(distinct ee.id) as entry_count
from public.expenditure_funding_allocations efa
join public.expenditure_entries ee on ee.id = efa.expenditure_entry_id
join public.mdas m on m.id = ee.mda_id
join public.funding_sources fs on fs.id = efa.funding_source_id
group by ee.fiscal_year, ee.quarter, ee.mda_id, m.name, fs.id, fs.name;

alter table public.expenditure_funding_allocations enable row level security;

create policy "expenditure_allocations_select"
on public.expenditure_funding_allocations
for select to authenticated
using (
  exists (
    select 1
    from public.expenditure_entries ee
    where ee.id = expenditure_entry_id
      and app_private.current_user_can_view_mda(ee.mda_id)
  )
);

create policy "expenditure_allocations_insert"
on public.expenditure_funding_allocations
for insert to authenticated
with check (
  exists (
    select 1
    from public.expenditure_entries ee
    where ee.id = expenditure_entry_id
      and ee.status = 'pending'
      and ee.entered_by = (select auth.uid())
      and app_private.current_user_can_submit_for_mda(ee.mda_id)
  )
  or app_private.current_user_is_admin()
);

create policy "expenditure_allocations_update"
on public.expenditure_funding_allocations
for update to authenticated
using (
  exists (
    select 1
    from public.expenditure_entries ee
    where ee.id = expenditure_entry_id
      and ee.status = 'pending'
      and ee.entered_by = (select auth.uid())
      and app_private.current_user_can_submit_for_mda(ee.mda_id)
  )
  or app_private.current_user_is_admin()
)
with check (
  exists (
    select 1
    from public.expenditure_entries ee
    where ee.id = expenditure_entry_id
      and ee.status = 'pending'
      and ee.entered_by = (select auth.uid())
      and app_private.current_user_can_submit_for_mda(ee.mda_id)
  )
  or app_private.current_user_is_admin()
);

create policy "expenditure_allocations_delete"
on public.expenditure_funding_allocations
for delete to authenticated
using (
  exists (
    select 1
    from public.expenditure_entries ee
    where ee.id = expenditure_entry_id
      and ee.status = 'pending'
      and ee.entered_by = (select auth.uid())
      and app_private.current_user_can_submit_for_mda(ee.mda_id)
  )
  or app_private.current_user_is_admin()
);

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
  p_remarks text,
  p_allocations jsonb default null
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

  if p_allocations is not null then
    perform public.replace_expenditure_funding_allocations(p_id, p_allocations);
  end if;
end;
$$;

grant execute on function public.replace_expenditure_funding_allocations(uuid, jsonb) to authenticated;
grant execute on function public.evaluate_expenditure_funding_warnings(uuid, int, uuid, jsonb, uuid) to authenticated;

commit;
