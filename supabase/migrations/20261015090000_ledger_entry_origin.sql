-- Ledger entry origin: where each funding and expenditure row came from.
--
--   manual  entered through the entry forms (the default)
--   import  inserted by commit_import_batch from a confirmed /imports batch
--   bpr     loaded by admin scripts from the official Budget Performance
--           Report (Q1 BPR26Q1-* and Q2 BPR-2026Q2-* references). The BPR does
--           not report funding sources, so the funding source on these rows is
--           an assumption (the state appropriation), not a reported fact.
--
-- Users can never set or change origin: for the authenticated role the
-- trigger derives it on insert and preserves it on update. Admin scripts and
-- migrations, which run as other roles, may set it explicitly.

begin;

alter table public.funding_entries
  add column origin text not null default 'manual'
  check (origin in ('manual', 'import', 'bpr'));
alter table public.expenditure_entries
  add column origin text not null default 'manual'
  check (origin in ('manual', 'import', 'bpr'));

comment on column public.funding_entries.origin is
  'manual | import | bpr. Set by app_private.set_ledger_origin; bpr rows carry an assumed funding source.';
comment on column public.expenditure_entries.origin is
  'manual | import | bpr. Set by app_private.set_ledger_origin; bpr rows carry an assumed funding source.';

-- Backfill without touching updated_at or writing audit events: this records
-- provenance that already existed, it is not an edit of the entries.
alter table public.funding_entries disable trigger set_funding_entries_updated_at, disable trigger audit_funding_entries;
alter table public.expenditure_entries disable trigger set_expenditure_entries_updated_at, disable trigger audit_expenditure_entries;

update public.funding_entries set origin = 'bpr' where reference_no like 'BPR%';
update public.expenditure_entries set origin = 'bpr' where voucher_ref_no like 'BPR%';

update public.funding_entries e set origin = 'import'
from public.import_rows r join public.import_batches b on b.id = r.batch_id
where r.committed_entry_id = e.id and b.ledger_type = 'funding';
update public.expenditure_entries e set origin = 'import'
from public.import_rows r join public.import_batches b on b.id = r.batch_id
where r.committed_entry_id = e.id and b.ledger_type = 'expenditure';

alter table public.funding_entries enable trigger set_funding_entries_updated_at, enable trigger audit_funding_entries;
alter table public.expenditure_entries enable trigger set_expenditure_entries_updated_at, enable trigger audit_expenditure_entries;

-- SECURITY INVOKER on purpose: current_user must be the caller's role.
create or replace function app_private.set_ledger_origin()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if current_user not in ('authenticated', 'anon') then
    return new;
  end if;
  if tg_op = 'UPDATE' then
    new.origin := old.origin;
  else
    new.origin := case
      when current_setting('app.ledger_origin', true) = 'import' then 'import'
      else 'manual'
    end;
  end if;
  return new;
end;
$$;

create trigger set_funding_origin before insert or update on public.funding_entries
for each row execute function app_private.set_ledger_origin();
create trigger set_expenditure_origin before insert or update on public.expenditure_entries
for each row execute function app_private.set_ledger_origin();

-- Unchanged from 20261013120000_ledger_imports.sql except for the
-- set_config call that tags the rows it inserts.
create or replace function public.commit_import_batch(
  p_batch_id uuid,
  p_plan_hash text
)
returns jsonb
language plpgsql
security invoker
set search_path = public
as $$
declare
  batch public.import_batches%rowtype;
  current_hash text;
  r record;
  p jsonb;
  alloc jsonb;
  alloc_total numeric(18,2);
  new_id uuid;
  new_public_id text;
  inserted_count int := 0;
  inserted_total numeric(18,2) := 0;
  v_entries jsonb := '[]'::jsonb;
  v_receipt jsonb;
begin
  -- Serialises concurrent confirmations of the same batch.
  select * into batch from public.import_batches where id = p_batch_id for update;
  if not found then
    raise exception 'Import batch not found.' using errcode = '02000';
  end if;
  if batch.created_by is distinct from (select auth.uid()) then
    raise exception 'Only the user who uploaded this batch can confirm it.' using errcode = '42501';
  end if;

  -- Idempotent replay: a confirmation that already landed returns its receipt.
  if batch.status = 'completed' then
    return batch.receipt || jsonb_build_object('replayed', true);
  end if;
  if batch.status <> 'ready_for_review' then
    raise exception 'This batch is not ready to confirm (status: %).', batch.status
      using errcode = 'P0001', hint = 'import_not_ready';
  end if;

  current_hash := public.import_batch_plan_hash(p_batch_id);
  if p_plan_hash is null or batch.plan_hash is distinct from p_plan_hash or current_hash <> p_plan_hash then
    raise exception 'The reviewed plan has changed. Review the batch again before confirming.'
      using errcode = 'P0001', hint = 'import_plan_stale';
  end if;

  -- Tags every ledger row this transaction inserts as origin 'import'
  -- (app_private.set_ledger_origin). Transaction-local, so it ends with the RPC.
  perform set_config('app.ledger_origin', 'import', true);

  for r in
    select * from public.import_rows
    where batch_id = p_batch_id and disposition = 'eligible'
    order by source_row_number
  loop
    if r.committed_entry_id is not null then
      raise exception 'Row % is already linked to an entry.', r.source_row_number
        using errcode = 'P0001', hint = 'import_row_already_committed';
    end if;
    p := r.proposed;

    -- Reference values must still be active at commit time. The ledger
    -- triggers check shape and scope; activeness is an entry-form rule.
    if not exists (select 1 from public.mdas where id = (p->>'mda_id')::uuid and active)
       or not exists (select 1 from public.programme_areas where id = (p->>'programme_area_id')::uuid and active) then
      raise exception 'Row %: the MDA or programme area is no longer active.', r.source_row_number
        using errcode = 'P0001', hint = 'import_reference_inactive';
    end if;

    if batch.ledger_type = 'funding' then
      if not exists (select 1 from public.funding_sources where id = (p->>'funding_source_id')::uuid and active) then
        raise exception 'Row %: the funding source is no longer active.', r.source_row_number
          using errcode = 'P0001', hint = 'import_reference_inactive';
      end if;

      insert into public.funding_entries (
        transaction_date, mda_id, programme_area_id, funding_source_id,
        amount, reference_no, remarks, entered_by
      ) values (
        (p->>'transaction_date')::date,
        (p->>'mda_id')::uuid,
        (p->>'programme_area_id')::uuid,
        (p->>'funding_source_id')::uuid,
        (p->>'amount')::numeric(18,2),
        p->>'reference_no',
        nullif(p->>'remarks', ''),
        (select auth.uid())
      )
      returning id, public_id into new_id, new_public_id;
    else
      if not exists (select 1 from public.expenditure_categories where id = (p->>'expenditure_category_id')::uuid and active)
         or not exists (select 1 from public.payment_methods where id = (p->>'payment_method_id')::uuid and active)
         or (p->>'expenditure_item_id' is not null
             and not exists (select 1 from public.expenditure_items where id = (p->>'expenditure_item_id')::uuid and active))
         or (p->>'aop_activity_id' is not null
             and not exists (select 1 from public.aop_activities where id = (p->>'aop_activity_id')::uuid and active))
         or (p->>'facility_id' is not null
             and not exists (select 1 from public.facilities where id = (p->>'facility_id')::uuid and active)) then
        raise exception 'Row %: a selected reference value is no longer active.', r.source_row_number
          using errcode = 'P0001', hint = 'import_reference_inactive';
      end if;

      if jsonb_typeof(p->'funding_allocations') <> 'array' or jsonb_array_length(p->'funding_allocations') < 1 then
        raise exception 'Row %: at least one funding allocation is required.', r.source_row_number
          using errcode = '22023';
      end if;
      select coalesce(sum((a->>'amount')::numeric(18,2)), 0) into alloc_total
      from jsonb_array_elements(p->'funding_allocations') a;
      if alloc_total <> (p->>'amount')::numeric(18,2) then
        raise exception 'Row %: funding allocations must sum to the expenditure amount.', r.source_row_number
          using errcode = '22023';
      end if;

      insert into public.expenditure_entries (
        transaction_date, mda_id, programme_area_id, expenditure_category_id,
        expenditure_item_id, aop_activity_id, is_phc, lga_id, facility_id,
        amount, voucher_ref_no, payment_method_id, remarks, entered_by
      ) values (
        (p->>'transaction_date')::date,
        (p->>'mda_id')::uuid,
        (p->>'programme_area_id')::uuid,
        (p->>'expenditure_category_id')::uuid,
        (p->>'expenditure_item_id')::uuid,
        (p->>'aop_activity_id')::uuid,
        coalesce((p->>'is_phc')::boolean, false),
        (p->>'lga_id')::uuid,
        (p->>'facility_id')::uuid,
        (p->>'amount')::numeric(18,2),
        p->>'voucher_ref_no',
        (p->>'payment_method_id')::uuid,
        nullif(p->>'remarks', ''),
        (select auth.uid())
      )
      returning id, public_id into new_id, new_public_id;

      for alloc in select value from jsonb_array_elements(p->'funding_allocations') loop
        if not exists (select 1 from public.funding_sources where id = (alloc->>'funding_source_id')::uuid and active) then
          raise exception 'Row %: a funding source in the allocation is no longer active.', r.source_row_number
            using errcode = 'P0001', hint = 'import_reference_inactive';
        end if;
        -- Duplicate sources violate the table's unique key and abort the batch.
        insert into public.expenditure_funding_allocations (expenditure_entry_id, funding_source_id, amount)
        values (new_id, (alloc->>'funding_source_id')::uuid, (alloc->>'amount')::numeric(18,2));
      end loop;
      perform app_private.sync_expenditure_funding_warnings(new_id);
    end if;

    update public.import_rows
       set committed_entry_id = new_id, committed_public_id = new_public_id
     where id = r.id;

    inserted_count := inserted_count + 1;
    inserted_total := inserted_total + (p->>'amount')::numeric(18,2);
    v_entries := v_entries || jsonb_build_object(
      'row_id', r.id,
      'source_row_number', r.source_row_number,
      'entry_id', new_id,
      'public_id', new_public_id,
      'amount', (p->>'amount')::numeric(18,2)
    );
  end loop;

  if inserted_count = 0 then
    raise exception 'There are no eligible rows to insert.' using errcode = 'P0001', hint = 'import_nothing_to_commit';
  end if;

  v_receipt := jsonb_build_object(
    'ledger_type', batch.ledger_type,
    'inserted_count', inserted_count,
    'inserted_total', inserted_total::text,
    'committed_at', now(),
    'plan_hash', p_plan_hash,
    'entries', v_entries,
    'not_inserted', (
      select jsonb_build_object(
        'blocked', count(*) filter (where disposition = 'blocked'),
        'duplicate', count(*) filter (where disposition = 'duplicate'),
        'excluded', count(*) filter (where disposition = 'excluded')
      )
      from public.import_rows where batch_id = p_batch_id
    )
  );

  update public.import_batches
     set status = 'completed', receipt = v_receipt, committed_at = now(), last_error = null
   where id = p_batch_id;

  return v_receipt;
end;
$$;

commit;
