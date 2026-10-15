-- Ledger import commit verification harness.
--
-- Run against a local/staging database after applying migrations (in plain
-- Postgres, load tools/verify_supabase_stubs.sql first). Exercises
-- commit_import_batch as real authenticated users with RLS in force:
-- atomic commit, idempotent replay, stale-plan rejection, cross-MDA tampering,
-- publication locks, inactive references, allocation totals, cross-user
-- isolation, completed-batch immutability, source-file storage scope and
-- ledger entry origin tagging.
-- Everything runs in one transaction and is rolled back.

\set ON_ERROR_STOP on
begin;

-- Supabase grants these to authenticated by default; plain Postgres does not.
grant usage on schema public, storage, app_private, auth to authenticated;
grant execute on all functions in schema auth to authenticated;
grant all on all tables in schema public to authenticated;
grant all on all tables in schema storage to authenticated;
alter table storage.objects enable row level security;

insert into auth.users (id) values
  ('11000000-0000-0000-0000-000000000001'),
  ('11000000-0000-0000-0000-000000000002'),
  ('11000000-0000-0000-0000-000000000003');
insert into public.profiles (id, full_name, role) values
  ('11000000-0000-0000-0000-000000000001', 'Import Funding Submitter', 'mda_user'),
  ('11000000-0000-0000-0000-000000000002', 'Other MDA User', 'mda_user'),
  ('11000000-0000-0000-0000-000000000003', 'Import Expenditure Submitter', 'mda_user');
insert into public.mdas (id, code, name) values
  ('21000000-0000-0000-0000-000000000001', 'IMP-A', 'Import MDA A'),
  ('21000000-0000-0000-0000-000000000002', 'IMP-B', 'Import MDA B');
insert into public.programme_areas (id, slug, name) values ('31000000-0000-0000-0000-000000000001', 'imp-prog', 'Import Programme');
insert into public.funding_sources (id, slug, name) values
  ('31000000-0000-0000-0000-000000000002', 'imp-src', 'Import Source'),
  ('31000000-0000-0000-0000-000000000005', 'imp-src-2', 'Import Source Two');
insert into public.expenditure_categories (id, slug, name) values ('31000000-0000-0000-0000-000000000003', 'imp-cat', 'Import Category');
insert into public.payment_methods (id, slug, name) values ('31000000-0000-0000-0000-000000000004', 'imp-pm', 'Import Method');
insert into public.user_mda_memberships (user_id, mda_id, membership_role) values
  ('11000000-0000-0000-0000-000000000001', '21000000-0000-0000-0000-000000000001', 'funding_submitter'),
  ('11000000-0000-0000-0000-000000000002', '21000000-0000-0000-0000-000000000002', 'funding_submitter'),
  ('11000000-0000-0000-0000-000000000003', '21000000-0000-0000-0000-000000000001', 'expenditure_submitter');

-- Fixture helper: stage a batch with rows, then fingerprint it as the server would.
create function pg_temp.stage(p_batch uuid, p_ledger text, p_rows jsonb) returns text language plpgsql as $$
declare r jsonb; n int := 1;
begin
  insert into public.import_batches (id, ledger_type, status, source_file_name, source_format, source_storage_path, source_sha256, source_size_bytes)
  values (p_batch, p_ledger, 'ready_for_review', 'test.csv', 'csv', auth.uid()::text || '/' || p_batch || '/test.csv', repeat('a', 64), 10);
  for r in select value from jsonb_array_elements(p_rows) loop
    n := n + 1;
    insert into public.import_rows (batch_id, source_row_number, raw, proposed, disposition)
    values (p_batch, n, '{}'::jsonb, case when r ? 'blocked' then null else r end,
            case when r ? 'blocked' then 'blocked' else 'eligible' end);
  end loop;
  update public.import_batches set plan_hash = public.import_batch_plan_hash(p_batch) where id = p_batch;
  return public.import_batch_plan_hash(p_batch);
end $$;
grant execute on function pg_temp.stage(uuid, text, jsonb) to authenticated;

set local role authenticated;

-- A. Atomic commit by the owner: two eligible rows land, the blocked one does not.
select set_config('request.jwt.claim.sub', '11000000-0000-0000-0000-000000000001', true);
do $$
declare h text; receipt jsonb; n int;
begin
  h := pg_temp.stage('51000000-0000-0000-0000-00000000000a', 'funding', '[
    {"transaction_date":"2026-07-02","mda_id":"21000000-0000-0000-0000-000000000001","programme_area_id":"31000000-0000-0000-0000-000000000001","funding_source_id":"31000000-0000-0000-0000-000000000002","amount":"1000.50","reference_no":"IMP-1","remarks":null},
    {"transaction_date":"2026-08-15","mda_id":"21000000-0000-0000-0000-000000000001","programme_area_id":"31000000-0000-0000-0000-000000000001","funding_source_id":"31000000-0000-0000-0000-000000000002","amount":"2000.00","reference_no":"IMP-2","remarks":"second"},
    {"blocked":true}
  ]');
  receipt := public.commit_import_batch('51000000-0000-0000-0000-00000000000a', h);
  if (receipt->>'inserted_count')::int <> 2 or receipt->>'inserted_total' <> '3000.50' then
    raise exception 'A: unexpected receipt %', receipt;
  end if;
  select count(*) into n from public.funding_entries where reference_no in ('IMP-1', 'IMP-2') and public_id is not null;
  if n <> 2 then raise exception 'A: expected 2 entries with public IDs, got %', n; end if;
  select count(*) into n from public.import_rows where batch_id = '51000000-0000-0000-0000-00000000000a' and committed_entry_id is not null;
  if n <> 2 then raise exception 'A: expected 2 linked rows, got %', n; end if;
  if (receipt->'not_inserted'->>'blocked')::int <> 1 then raise exception 'A: blocked count missing'; end if;
  raise notice 'A ok: atomic commit with receipt %', receipt->>'inserted_total';
end $$;

-- B. Replay (double click / lost response) returns the receipt without inserting.
do $$
declare receipt jsonb; n int;
begin
  receipt := public.commit_import_batch('51000000-0000-0000-0000-00000000000a',
    (select plan_hash from public.import_batches where id = '51000000-0000-0000-0000-00000000000a'));
  if not coalesce((receipt->>'replayed')::boolean, false) then raise exception 'B: expected replayed receipt'; end if;
  select count(*) into n from public.funding_entries where reference_no in ('IMP-1', 'IMP-2');
  if n <> 2 then raise exception 'B: replay inserted again (% rows)', n; end if;
  raise notice 'B ok: replay is idempotent';
end $$;

-- C. Stale plan: a row edited after review rejects the old fingerprint.
do $$
declare h text;
begin
  h := pg_temp.stage('51000000-0000-0000-0000-00000000000c', 'funding', '[
    {"transaction_date":"2026-07-03","mda_id":"21000000-0000-0000-0000-000000000001","programme_area_id":"31000000-0000-0000-0000-000000000001","funding_source_id":"31000000-0000-0000-0000-000000000002","amount":"10.00","reference_no":"IMP-C","remarks":null}
  ]');
  update public.import_rows set proposed = jsonb_set(proposed, '{amount}', '"99.00"') where batch_id = '51000000-0000-0000-0000-00000000000c';
  begin
    perform public.commit_import_batch('51000000-0000-0000-0000-00000000000c', h);
    raise exception 'C: stale plan was accepted';
  exception when raise_exception then
    if sqlerrm not like '%reviewed plan has changed%' then raise; end if;
  end;
  if exists (select 1 from public.funding_entries where reference_no = 'IMP-C') then raise exception 'C: stale plan inserted'; end if;
  raise notice 'C ok: stale plan rejected';
end $$;

-- D. Tampered row for an MDA without a grant aborts the whole batch.
do $$
declare h text;
begin
  h := pg_temp.stage('51000000-0000-0000-0000-00000000000d', 'funding', '[
    {"transaction_date":"2026-07-04","mda_id":"21000000-0000-0000-0000-000000000001","programme_area_id":"31000000-0000-0000-0000-000000000001","funding_source_id":"31000000-0000-0000-0000-000000000002","amount":"10.00","reference_no":"IMP-D1","remarks":null},
    {"transaction_date":"2026-07-04","mda_id":"21000000-0000-0000-0000-000000000002","programme_area_id":"31000000-0000-0000-0000-000000000001","funding_source_id":"31000000-0000-0000-0000-000000000002","amount":"10.00","reference_no":"IMP-D2","remarks":null}
  ]');
  begin
    perform public.commit_import_batch('51000000-0000-0000-0000-00000000000d', h);
    raise exception 'D: unauthorised MDA row was committed';
  exception when insufficient_privilege then null;
  end;
  if exists (select 1 from public.funding_entries where reference_no in ('IMP-D1', 'IMP-D2')) then
    raise exception 'D: partial commit leaked';
  end if;
  if (select status from public.import_batches where id = '51000000-0000-0000-0000-00000000000d') <> 'ready_for_review' then
    raise exception 'D: failed commit changed batch status';
  end if;
  raise notice 'D ok: RLS rejects foreign MDA and nothing is inserted';
end $$;

-- F. Another user can't see, change or confirm this user's batches.
select set_config('request.jwt.claim.sub', '11000000-0000-0000-0000-000000000002', true);
do $$
declare n int;
begin
  select count(*) into n from public.import_batches where created_by = '11000000-0000-0000-0000-000000000001';
  if n <> 0 then raise exception 'F: foreign batches visible (%)', n; end if;
  select count(*) into n from public.import_rows where batch_id = '51000000-0000-0000-0000-00000000000d';
  if n <> 0 then raise exception 'F: foreign rows visible'; end if;
  update public.import_rows set user_excluded = true where batch_id = '51000000-0000-0000-0000-00000000000d';
  get diagnostics n = row_count;
  if n <> 0 then raise exception 'F: foreign rows updatable'; end if;
  begin
    perform public.commit_import_batch('51000000-0000-0000-0000-00000000000d', repeat('0', 64));
    raise exception 'F: foreign commit accepted';
  exception when no_data_found then null; -- invisible under RLS
    when sqlstate '02000' then null;
  end;
  raise notice 'F ok: batches are owner-scoped';
end $$;

-- J. Source files: own folder only.
do $$
begin
  insert into storage.objects (bucket_id, name) values ('import-sources', '11000000-0000-0000-0000-000000000002/x/file.csv');
  begin
    insert into storage.objects (bucket_id, name) values ('import-sources', '11000000-0000-0000-0000-000000000001/x/file.csv');
    raise exception 'J: wrote into another user''s folder';
  exception when insufficient_privilege then null;
  end;
  raise notice 'J ok: storage writes are folder-scoped';
end $$;

-- G. Completed batches are immutable receipts.
select set_config('request.jwt.claim.sub', '11000000-0000-0000-0000-000000000001', true);
do $$
begin
  begin
    update public.import_rows set user_excluded = true where batch_id = '51000000-0000-0000-0000-00000000000a';
    raise exception 'G: completed batch rows changed';
  exception when raise_exception then
    if sqlerrm not like '%can no longer change%' then raise; end if;
  end;
  raise notice 'G ok: completed batch is immutable';
end $$;

-- I. A reference deactivated after review blocks the commit.
reset role;
update public.funding_sources set active = false where id = '31000000-0000-0000-0000-000000000005';
set local role authenticated;
select set_config('request.jwt.claim.sub', '11000000-0000-0000-0000-000000000001', true);
do $$
declare h text;
begin
  h := pg_temp.stage('51000000-0000-0000-0000-00000000000e', 'funding', '[
    {"transaction_date":"2026-07-05","mda_id":"21000000-0000-0000-0000-000000000001","programme_area_id":"31000000-0000-0000-0000-000000000001","funding_source_id":"31000000-0000-0000-0000-000000000005","amount":"10.00","reference_no":"IMP-I","remarks":null}
  ]');
  begin
    perform public.commit_import_batch('51000000-0000-0000-0000-00000000000e', h);
    raise exception 'I: inactive source accepted';
  exception when raise_exception then
    if sqlerrm not like '%no longer active%' then raise; end if;
  end;
  raise notice 'I ok: inactive reference blocks commit';
end $$;

-- E. Published quarter blocks insert through the existing lock trigger.
reset role;
insert into public.budget_implementation_report_publications (fiscal_year, quarter, version, published_by)
values (2026, 1, 1, '11000000-0000-0000-0000-000000000001');
set local role authenticated;
select set_config('request.jwt.claim.sub', '11000000-0000-0000-0000-000000000001', true);
do $$
declare h text;
begin
  h := pg_temp.stage('51000000-0000-0000-0000-00000000000f', 'funding', '[
    {"transaction_date":"2026-02-10","mda_id":"21000000-0000-0000-0000-000000000001","programme_area_id":"31000000-0000-0000-0000-000000000001","funding_source_id":"31000000-0000-0000-0000-000000000002","amount":"10.00","reference_no":"IMP-E","remarks":null}
  ]');
  begin
    perform public.commit_import_batch('51000000-0000-0000-0000-00000000000f', h);
    raise exception 'E: published quarter accepted';
  exception when raise_exception then
    if sqlerrm not like '%has been published%' then raise; end if;
  end;
  raise notice 'E ok: publication lock applies to imports';
end $$;

-- H. Expenditure: allocation totals enforced; valid row inserts entry + allocation.
select set_config('request.jwt.claim.sub', '11000000-0000-0000-0000-000000000003', true);
do $$
declare h text; n int;
begin
  h := pg_temp.stage('51000000-0000-0000-0000-000000000010', 'expenditure', '[
    {"transaction_date":"2026-07-06","mda_id":"21000000-0000-0000-0000-000000000001","programme_area_id":"31000000-0000-0000-0000-000000000001","expenditure_category_id":"31000000-0000-0000-0000-000000000003","expenditure_item_id":null,"aop_activity_id":null,"is_phc":false,"lga_id":null,"facility_id":null,"amount":"500.00","voucher_ref_no":"PV-H1","payment_method_id":"31000000-0000-0000-0000-000000000004","remarks":null,
     "funding_allocations":[{"funding_source_id":"31000000-0000-0000-0000-000000000002","amount":"400.00"}]}
  ]');
  begin
    perform public.commit_import_batch('51000000-0000-0000-0000-000000000010', h);
    raise exception 'H: allocation mismatch accepted';
  exception when invalid_parameter_value then null;
  end;

  h := pg_temp.stage('51000000-0000-0000-0000-000000000011', 'expenditure', '[
    {"transaction_date":"2026-07-06","mda_id":"21000000-0000-0000-0000-000000000001","programme_area_id":"31000000-0000-0000-0000-000000000001","expenditure_category_id":"31000000-0000-0000-0000-000000000003","expenditure_item_id":null,"aop_activity_id":null,"is_phc":false,"lga_id":null,"facility_id":null,"amount":"500.00","voucher_ref_no":"PV-H2","payment_method_id":"31000000-0000-0000-0000-000000000004","remarks":null,
     "funding_allocations":[{"funding_source_id":"31000000-0000-0000-0000-000000000002","amount":"500.00"}]}
  ]');
  perform public.commit_import_batch('51000000-0000-0000-0000-000000000011', h);
  select count(*) into n from public.expenditure_entries ee
    join public.expenditure_funding_allocations efa on efa.expenditure_entry_id = ee.id
   where ee.voucher_ref_no = 'PV-H2' and efa.amount = 500;
  if n <> 1 then raise exception 'H: expenditure entry/allocation missing'; end if;
  if exists (select 1 from public.expenditure_entries where voucher_ref_no = 'PV-H1') then raise exception 'H: mismatched entry leaked'; end if;
  raise notice 'H ok: expenditure with allocation committed atomically';
end $$;

-- K. Origin: imports are tagged 'import'; users can't set or change origin.
select set_config('request.jwt.claim.sub', '11000000-0000-0000-0000-000000000001', true);
select set_config('app.ledger_origin', '', true);
do $$
declare v text;
begin
  if exists (select 1 from public.funding_entries where reference_no in ('IMP-1', 'IMP-2') and origin <> 'import')
     or exists (select 1 from public.expenditure_entries where voucher_ref_no = 'PV-H2' and origin <> 'import') then
    raise exception 'K: imported entries not tagged import';
  end if;

  insert into public.funding_entries (transaction_date, mda_id, programme_area_id, funding_source_id, amount, reference_no, entered_by, origin)
  values ('2026-07-09', '21000000-0000-0000-0000-000000000001', '31000000-0000-0000-0000-000000000001',
          '31000000-0000-0000-0000-000000000002', 10, 'MAN-I1', auth.uid(), 'bpr')
  returning origin into v;
  if v <> 'manual' then raise exception 'K: user insert kept origin %', v; end if;

  update public.funding_entries set origin = 'bpr', remarks = 'edited' where reference_no = 'IMP-1' returning origin into v;
  if v <> 'import' then raise exception 'K: user update changed origin to %', v; end if;
  raise notice 'K ok: origin derived on insert and preserved on update';
end $$;

reset role;

do $$
declare v text;
begin
  update public.funding_entries set origin = 'bpr' where reference_no = 'MAN-I1' returning origin into v;
  if v <> 'bpr' then raise exception 'K: admin script could not set origin'; end if;
end $$;
select 'ledger import verification passed' as result;
rollback;
