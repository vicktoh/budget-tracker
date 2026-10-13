-- Ledger imports (delivery phase 1 of docs/prds/ai-assisted-import.md)
--
-- CSV and clean Excel transaction imports for Funding Entries and Expenditure
-- Entries. An upload creates a draft batch with one staged row per source row;
-- nothing reaches the ledger until the owner confirms an exact plan.
--
-- Security shape:
--   * Batch metadata, staged rows and source files are owner-scoped. Admins
--     can read every batch; nobody can read another user's batch otherwise.
--   * The commit function is SECURITY INVOKER. Every ledger insert it makes
--     runs under the caller's JWT, so the same RLS policies, BIR publication
--     lock triggers, validation triggers, public-ID and audit triggers that
--     govern manual entry govern imported rows. An import can never write a
--     row the user could not have entered by hand.
--   * The whole confirmed set commits in one transaction: entries, funding
--     allocations, row links and the batch receipt either all land or none do.
--   * Idempotency: the batch row is locked for the duration of the commit and
--     each staged row records the entry it produced. A double confirm or a
--     retry after a lost response returns the existing receipt instead of
--     inserting again; the ledger's (fiscal_year, mda_id, reference) unique
--     keys remain the final backstop.

begin;

create table public.import_batches (
  id uuid primary key default gen_random_uuid(),
  created_by uuid not null default auth.uid() references public.profiles(id) on delete restrict,
  ledger_type text not null check (ledger_type in ('funding', 'expenditure')),
  status text not null default 'needs_mapping'
    check (status in ('needs_sheet', 'needs_mapping', 'ready_for_review', 'completed', 'cancelled')),
  source_file_name text not null,
  source_format text not null check (source_format in ('csv', 'xlsx')),
  source_storage_path text not null,
  source_sha256 text not null check (source_sha256 ~ '^[0-9a-f]{64}$'),
  source_size_bytes bigint not null check (source_size_bytes > 0),
  -- Workbook inventory: [{name, state, rowCount}] for xlsx; one entry for csv.
  sheets jsonb not null default '[]'::jsonb,
  sheet_name text,
  header_row_number int,
  headers jsonb not null default '[]'::jsonb,
  -- {field: source header} chosen by the user.
  mapping jsonb not null default '{}'::jsonb,
  -- {date_convention: 'dmy'|'mdy'|null, default_mda_id: uuid|null}
  options jsonb not null default '{}'::jsonb,
  -- Extraction facts surfaced to the user (blank rows skipped, hidden rows...).
  extraction jsonb not null default '{}'::jsonb,
  revision int not null default 0,
  -- SHA-256 of the eligible staged rows the user last reviewed. Compared with a
  -- freshly computed hash at commit; any drift rejects the confirmation.
  plan_hash text,
  summary jsonb not null default '{}'::jsonb,
  receipt jsonb,
  last_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  committed_at timestamptz
);

create index idx_import_batches_owner on public.import_batches (created_by, created_at desc);
create unique index import_batches_source_path_key on public.import_batches (source_storage_path);

create table public.import_rows (
  id uuid primary key default gen_random_uuid(),
  batch_id uuid not null references public.import_batches(id) on delete cascade,
  -- 1-based row number in the source sheet/CSV, for provenance.
  source_row_number int not null check (source_row_number > 0),
  -- Original cell text keyed by source header. Never rewritten.
  raw jsonb not null,
  -- Extraction facts per row: {hidden, formula_headers, missing_cache_headers}.
  source_meta jsonb not null default '{}'::jsonb,
  -- User-supplied replacement cell text keyed by source header.
  overrides jsonb not null default '{}'::jsonb,
  -- Normalised insert payload; null while the row is blocked.
  proposed jsonb,
  disposition text not null default 'blocked'
    check (disposition in ('eligible', 'blocked', 'duplicate', 'excluded')),
  -- [{code, field, message, severity: blocker|warning|info}]
  issues jsonb not null default '[]'::jsonb,
  user_excluded boolean not null default false,
  committed_entry_id uuid,
  committed_public_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (batch_id, source_row_number),
  check (disposition <> 'eligible' or proposed is not null)
);

create index idx_import_rows_batch on public.import_rows (batch_id, disposition);
create unique index import_rows_committed_entry_key
  on public.import_rows (committed_entry_id) where committed_entry_id is not null;

create trigger set_import_batches_updated_at before update on public.import_batches
for each row execute function app_private.touch_updated_at();
create trigger set_import_rows_updated_at before update on public.import_rows
for each row execute function app_private.touch_updated_at();
-- Batch lifecycle changes (mapping, revisions, confirmation) are audited.
-- Staged rows are not: they are drafts, and committed entries carry their own
-- audit events through the ledger triggers.
create trigger audit_import_batches after insert or update or delete on public.import_batches
for each row execute function app_private.audit_row_change();

-- Completed batches are an immutable receipt. Cancelled batches stay readable.
create or replace function app_private.prevent_completed_import_mutation()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  parent_status text;
begin
  if tg_table_name = 'import_batches' then
    if old.status in ('completed', 'cancelled') then
      raise exception 'This import batch is % and can no longer change.', old.status
        using errcode = 'P0001', hint = 'import_batch_closed';
    end if;
    return coalesce(new, old);
  end if;

  select status into parent_status from public.import_batches
  where id = coalesce(new.batch_id, old.batch_id);
  if parent_status in ('completed', 'cancelled') then
    raise exception 'This import batch is % and its rows can no longer change.', parent_status
      using errcode = 'P0001', hint = 'import_batch_closed';
  end if;
  return coalesce(new, old);
end;
$$;

create trigger prevent_completed_import_batch_mutation
before update or delete on public.import_batches
for each row execute function app_private.prevent_completed_import_mutation();
create trigger prevent_completed_import_row_mutation
before insert or update or delete on public.import_rows
for each row execute function app_private.prevent_completed_import_mutation();

alter table public.import_batches enable row level security;
alter table public.import_rows enable row level security;

create policy "import_batches_select_owner_or_admin" on public.import_batches
for select to authenticated
using (created_by = (select auth.uid()) or app_private.current_user_is_admin());
create policy "import_batches_insert_owner" on public.import_batches
for insert to authenticated
with check (created_by = (select auth.uid()));
create policy "import_batches_update_owner" on public.import_batches
for update to authenticated
using (created_by = (select auth.uid()))
with check (created_by = (select auth.uid()));

create policy "import_rows_select_owner_or_admin" on public.import_rows
for select to authenticated
using (exists (
  select 1 from public.import_batches b
  where b.id = batch_id
    and (b.created_by = (select auth.uid()) or app_private.current_user_is_admin())
));
create policy "import_rows_write_owner" on public.import_rows
for all to authenticated
using (exists (
  select 1 from public.import_batches b
  where b.id = batch_id and b.created_by = (select auth.uid())
))
with check (exists (
  select 1 from public.import_batches b
  where b.id = batch_id and b.created_by = (select auth.uid())
));

-- Private source files: <owner uid>/<batch id>/<file name>. Owners read and
-- write their own folder; admins can read every source for support.
insert into storage.buckets (id, name, public, file_size_limit)
values ('import-sources', 'import-sources', false, 10485760)
on conflict (id) do nothing;

create policy "import_sources_owner_insert" on storage.objects
for insert to authenticated
with check (
  bucket_id = 'import-sources'
  and (storage.foldername(name))[1] = (select auth.uid())::text
);
create policy "import_sources_owner_or_admin_select" on storage.objects
for select to authenticated
using (
  bucket_id = 'import-sources'
  and (
    (storage.foldername(name))[1] = (select auth.uid())::text
    or app_private.current_user_is_admin()
  )
);

-- Deterministic fingerprint of exactly what would be inserted. jsonb text
-- output is canonical (sorted keys), so equal plans hash equally.
create or replace function public.import_batch_plan_hash(p_batch_id uuid)
returns text
language sql
stable
security invoker
set search_path = public
as $$
  select encode(sha256(convert_to(
    coalesce(b.ledger_type, '') || '|' ||
    coalesce((
      select string_agg(r.id::text || '=' || r.proposed::text, E'\n' order by r.source_row_number)
      from public.import_rows r
      where r.batch_id = b.id and r.disposition = 'eligible'
    ), ''),
    'UTF8')), 'hex')
  from public.import_batches b
  where b.id = p_batch_id;
$$;

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

revoke all on function public.import_batch_plan_hash(uuid) from public, anon;
revoke all on function public.commit_import_batch(uuid, text) from public, anon;
grant execute on function public.import_batch_plan_hash(uuid) to authenticated;
grant execute on function public.commit_import_batch(uuid, text) to authenticated;

commit;
