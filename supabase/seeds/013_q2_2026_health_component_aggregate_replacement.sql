-- Approved Q2 2026 Health Component aggregate replacement.
--
-- Source workbook: "Q2 2026 Health Component.xlsx"
-- SHA-256: e4cfc7c7094ec1bcf880a4e48e71c9bbadf450a68d510107377e9e8655ada5fd
--
-- The workbook contains authoritative MDA/component totals but not a
-- self-contained transaction-level ledger. This import therefore:
--   * preserves Q1 unchanged;
--   * archives the previous Q2 BPR expenditure and funding rows;
--   * replaces Q2 expenditure with one row per MDA and economic component;
--   * replaces Q2 revenue actuals with one explicit aggregate row per MDA;
--   * replaces Q2 operational funding rows with matching aggregate rows.
--
-- The deterministic import-batch ID makes this seed idempotent.

begin;

select pg_advisory_xact_lock(
  hashtext('budget-tracker:2026-q2-health-component-aggregate-replacement')
);

create temporary table q2_health_expenditure_target (
  mda_code text not null,
  component text not null check (component in ('personnel', 'overhead', 'capital')),
  amount numeric(18,2) not null check (amount > 0),
  primary key (mda_code, component)
) on commit drop;

insert into q2_health_expenditure_target (mda_code, component, amount) values
  ('052100100100', 'personnel',  1854219026.70),
  ('052100100100', 'overhead',     92562917.28),
  ('052100100100', 'capital',   30536038129.69),
  ('052100300100', 'personnel', 17366329361.42),
  ('052100300100', 'overhead',   1793382996.89),
  ('052100300100', 'capital',      180000000.00),
  ('052100300200', 'overhead',     207652835.05),
  ('052100400100', 'overhead',      66554630.00),
  ('052100400200', 'overhead',      22058200.00),
  ('052100400300', 'overhead',      13092680.00),
  ('052100400400', 'overhead',      28372925.00),
  ('052100400600', 'overhead',      19816300.00),
  ('052100400700', 'overhead',       4669000.00),
  ('052100400800', 'overhead',      10931900.00),
  ('052101000100', 'overhead',       2075631.60),
  ('052104000100', 'overhead',      49116430.00),
  ('052104000100', 'capital',      100000000.00),
  ('052100500100', 'personnel',    194166882.53),
  ('052100500100', 'overhead',     653329310.13),
  ('052100500100', 'capital',     1742281296.78),
  ('052100600100', 'overhead',       4000000.00),
  ('052100800100', 'overhead',     483513728.23),
  ('052100800100', 'capital',     2607399943.88),
  ('052100900100', 'overhead',      33802832.30),
  ('052100900100', 'capital',      326076466.00),
  ('052101100100', 'overhead',       1500000.00),
  ('052101100100', 'capital',       40000000.00),
  ('052101300100', 'overhead',      75914000.00),
  ('052101300100', 'capital',      126102396.75),
  ('052101400100', 'overhead',     131085720.00),
  ('052101400100', 'capital',       72939347.00);

create temporary table q2_health_revenue_target (
  mda_code text primary key,
  amount numeric(18,2) not null check (amount > 0)
) on commit drop;

insert into q2_health_revenue_target (mda_code, amount) values
  ('052100100100',  265985891.00),
  ('052100300100',  546439110.01),
  ('052100300200',   74238023.00),
  ('052100400100',   17003500.00),
  ('052100500100',  674546946.00),
  ('052100800100', 4249484706.90),
  ('052100900100',  829267060.43),
  ('052101100100',    8772500.00),
  ('052101300100',  349560380.40),
  ('052101400100', 1007045957.00);

create temporary table q2_health_import_control (
  should_apply boolean not null
) on commit drop;

insert into q2_health_import_control (should_apply)
select not exists (
  select 1
  from public.admin_import_batches
  where id = md5(
    '2026-q2-health-component-aggregate-replacement'
  )::uuid
    and status = 'imported'
);

do $preflight$
declare
  apply_now boolean;
  current_expenditure_rows bigint;
  current_expenditure_total numeric(18,2);
  current_funding_rows bigint;
  current_funding_total numeric(18,2);
  current_revenue_rows bigint;
  current_revenue_total numeric(18,2);
begin
  select should_apply into apply_now from q2_health_import_control;
  if not apply_now then
    return;
  end if;

  if exists (
    select 1
    from public.budget_implementation_report_publications
    where fiscal_year = 2026 and quarter = 2
  ) then
    raise exception
      'Q2 FY2026 has been published; this aggregate replacement cannot run.'
      using errcode = '55000';
  end if;

  if (
    select count(distinct m.id)
    from public.mdas m
    join (
      select mda_code from q2_health_expenditure_target
      union
      select mda_code from q2_health_revenue_target
    ) target on target.mda_code = m.code
  ) <> (
    select count(*)
    from (
      select mda_code from q2_health_expenditure_target
      union
      select mda_code from q2_health_revenue_target
    ) target
  ) then
    raise exception 'One or more target MDA codes are missing.';
  end if;

  select count(*), coalesce(sum(ee.amount), 0)
    into current_expenditure_rows, current_expenditure_total
  from public.expenditure_entries ee
  join public.mdas m on m.id = ee.mda_id
  where ee.fiscal_year = 2026
    and ee.quarter = 2
    and m.code like '0521%';

  if current_expenditure_rows <> 313
     or current_expenditure_total <> 30913207074.68 then
    raise exception
      'Q2 health expenditure preflight mismatch: expected 313 rows / 30913207074.68, found % rows / %.',
      current_expenditure_rows, current_expenditure_total;
  end if;

  if exists (
    select 1
    from public.expenditure_entries ee
    join public.mdas m on m.id = ee.mda_id
    where ee.fiscal_year = 2026
      and ee.quarter = 2
      and m.code like '0521%'
      and ee.voucher_ref_no not like 'BPR-2026Q2-%'
  ) then
    raise exception 'Unexpected non-BPR Q2 health expenditure rows found.';
  end if;

  select count(*), coalesce(sum(fe.amount), 0)
    into current_funding_rows, current_funding_total
  from public.funding_entries fe
  join public.mdas m on m.id = fe.mda_id
  where fe.fiscal_year = 2026
    and fe.quarter = 2
    and m.code like '0521%';

  if current_funding_rows <> 35
     or current_funding_total <> 36699528033.86 then
    raise exception
      'Q2 health funding preflight mismatch: expected 35 rows / 36699528033.86, found % rows / %.',
      current_funding_rows, current_funding_total;
  end if;

  if exists (
    select 1
    from public.funding_entries fe
    join public.mdas m on m.id = fe.mda_id
    where fe.fiscal_year = 2026
      and fe.quarter = 2
      and m.code like '0521%'
      and fe.reference_no not like 'BPR-2026Q2-%'
  ) then
    raise exception 'Unexpected non-BPR Q2 health funding rows found.';
  end if;

  select count(*), coalesce(sum(actual.amount), 0)
    into current_revenue_rows, current_revenue_total
  from public.budget_line_revenue_actuals actual
  join public.budget_line_revenues line
    on line.id = actual.budget_line_revenue_id
  join public.mdas m on m.id = line.mda_id
  where line.fiscal_year = 2026
    and actual.quarter = 2
    and m.code like '0521%';

  if current_revenue_rows <> 26
     or current_revenue_total <> 5786320959.18 then
    raise exception
      'Q2 health revenue preflight mismatch: expected 26 rows / 5786320959.18, found % rows / %.',
      current_revenue_rows, current_revenue_total;
  end if;
end;
$preflight$;

-- Preserve the original imported ledger rows and their audit context.
insert into public.archived_ledger_entries (
  entry_type,
  original_entry_id,
  public_id,
  fiscal_year,
  quarter,
  mda_id,
  archive_reason,
  entry_snapshot,
  comments_snapshot,
  audit_snapshot,
  attachments_snapshot,
  archived_by
)
select
  'expenditure_entry',
  ee.id,
  ee.public_id,
  ee.fiscal_year,
  ee.quarter,
  ee.mda_id,
  'Replaced by the approved Q2 2026 Health Component aggregate import; source SHA-256 e4cfc7c7094ec1bcf880a4e48e71c9bbadf450a68d510107377e9e8655ada5fd.',
  to_jsonb(ee) || jsonb_build_object(
    'data_quality_warnings',
    coalesce((
      select jsonb_agg(to_jsonb(warning) order by warning.created_at)
      from public.entry_data_quality_warnings warning
      where warning.entry_type = 'expenditure_entry'
        and warning.entry_id = ee.id
    ), '[]'::jsonb)
  ),
  coalesce((
    select jsonb_agg(to_jsonb(comment) order by comment.created_at)
    from public.entry_comments comment
    where comment.entry_type = 'expenditure_entry'
      and comment.entry_id = ee.id
  ), '[]'::jsonb),
  coalesce((
    select jsonb_agg(to_jsonb(audit) order by audit.created_at)
    from public.entry_audit_events audit
    where audit.entity_type = 'expenditure_entries'
      and audit.entity_id = ee.id
  ), '[]'::jsonb),
  coalesce((
    select jsonb_agg(to_jsonb(attachment) order by attachment.created_at)
    from public.entry_attachments attachment
    where attachment.entry_type = 'expenditure_entry'
      and attachment.entry_id = ee.id
  ), '[]'::jsonb),
  '00000000-0000-0000-0000-000000000001'::uuid
from public.expenditure_entries ee
join public.mdas m on m.id = ee.mda_id
where (select should_apply from q2_health_import_control)
  and ee.fiscal_year = 2026
  and ee.quarter = 2
  and m.code like '0521%'
  and ee.voucher_ref_no like 'BPR-2026Q2-%'
on conflict (entry_type, original_entry_id) do nothing;

insert into public.archived_ledger_entries (
  entry_type,
  original_entry_id,
  public_id,
  fiscal_year,
  quarter,
  mda_id,
  archive_reason,
  entry_snapshot,
  comments_snapshot,
  audit_snapshot,
  attachments_snapshot,
  archived_by
)
select
  'funding_entry',
  fe.id,
  fe.public_id,
  fe.fiscal_year,
  fe.quarter,
  fe.mda_id,
  'Replaced by the approved Q2 2026 Health Component aggregate import; source SHA-256 e4cfc7c7094ec1bcf880a4e48e71c9bbadf450a68d510107377e9e8655ada5fd.',
  to_jsonb(fe) || jsonb_build_object(
    'data_quality_warnings',
    coalesce((
      select jsonb_agg(to_jsonb(warning) order by warning.created_at)
      from public.entry_data_quality_warnings warning
      where warning.entry_type = 'funding_entry'
        and warning.entry_id = fe.id
    ), '[]'::jsonb)
  ),
  coalesce((
    select jsonb_agg(to_jsonb(comment) order by comment.created_at)
    from public.entry_comments comment
    where comment.entry_type = 'funding_entry'
      and comment.entry_id = fe.id
  ), '[]'::jsonb),
  coalesce((
    select jsonb_agg(to_jsonb(audit) order by audit.created_at)
    from public.entry_audit_events audit
    where audit.entity_type = 'funding_entries'
      and audit.entity_id = fe.id
  ), '[]'::jsonb),
  coalesce((
    select jsonb_agg(to_jsonb(attachment) order by attachment.created_at)
    from public.entry_attachments attachment
    where attachment.entry_type = 'funding_entry'
      and attachment.entry_id = fe.id
  ), '[]'::jsonb),
  '00000000-0000-0000-0000-000000000001'::uuid
from public.funding_entries fe
join public.mdas m on m.id = fe.mda_id
where (select should_apply from q2_health_import_control)
  and fe.fiscal_year = 2026
  and fe.quarter = 2
  and m.code like '0521%'
  and fe.reference_no like 'BPR-2026Q2-%'
on conflict (entry_type, original_entry_id) do nothing;

-- Remove polymorphic dependants before deleting the active ledger rows.
delete from public.entry_comments comment
where (select should_apply from q2_health_import_control)
  and (
    (
      comment.entry_type = 'expenditure_entry'
      and exists (
        select 1
        from public.expenditure_entries ee
        join public.mdas m on m.id = ee.mda_id
        where ee.id = comment.entry_id
          and ee.fiscal_year = 2026
          and ee.quarter = 2
          and m.code like '0521%'
          and ee.voucher_ref_no like 'BPR-2026Q2-%'
      )
    )
    or
    (
      comment.entry_type = 'funding_entry'
      and exists (
        select 1
        from public.funding_entries fe
        join public.mdas m on m.id = fe.mda_id
        where fe.id = comment.entry_id
          and fe.fiscal_year = 2026
          and fe.quarter = 2
          and m.code like '0521%'
          and fe.reference_no like 'BPR-2026Q2-%'
      )
    )
  );

delete from public.entry_attachments attachment
where (select should_apply from q2_health_import_control)
  and (
    (
      attachment.entry_type = 'expenditure_entry'
      and exists (
        select 1
        from public.expenditure_entries ee
        join public.mdas m on m.id = ee.mda_id
        where ee.id = attachment.entry_id
          and ee.fiscal_year = 2026
          and ee.quarter = 2
          and m.code like '0521%'
          and ee.voucher_ref_no like 'BPR-2026Q2-%'
      )
    )
    or
    (
      attachment.entry_type = 'funding_entry'
      and exists (
        select 1
        from public.funding_entries fe
        join public.mdas m on m.id = fe.mda_id
        where fe.id = attachment.entry_id
          and fe.fiscal_year = 2026
          and fe.quarter = 2
          and m.code like '0521%'
          and fe.reference_no like 'BPR-2026Q2-%'
      )
    )
  );

delete from public.entry_data_quality_warnings warning
where (select should_apply from q2_health_import_control)
  and (
    (
      warning.entry_type = 'expenditure_entry'
      and exists (
        select 1
        from public.expenditure_entries ee
        join public.mdas m on m.id = ee.mda_id
        where ee.id = warning.entry_id
          and ee.fiscal_year = 2026
          and ee.quarter = 2
          and m.code like '0521%'
          and ee.voucher_ref_no like 'BPR-2026Q2-%'
      )
    )
    or
    (
      warning.entry_type = 'funding_entry'
      and exists (
        select 1
        from public.funding_entries fe
        join public.mdas m on m.id = fe.mda_id
        where fe.id = warning.entry_id
          and fe.fiscal_year = 2026
          and fe.quarter = 2
          and m.code like '0521%'
          and fe.reference_no like 'BPR-2026Q2-%'
      )
    )
  );

delete from public.expenditure_entries ee
using public.mdas m
where (select should_apply from q2_health_import_control)
  and m.id = ee.mda_id
  and ee.fiscal_year = 2026
  and ee.quarter = 2
  and m.code like '0521%'
  and ee.voucher_ref_no like 'BPR-2026Q2-%';

delete from public.funding_entries fe
using public.mdas m
where (select should_apply from q2_health_import_control)
  and m.id = fe.mda_id
  and fe.fiscal_year = 2026
  and fe.quarter = 2
  and m.code like '0521%'
  and fe.reference_no like 'BPR-2026Q2-%';

-- Replace detailed revenue actuals with an explicit combined aggregate line.
delete from public.budget_line_revenue_actuals actual
using public.budget_line_revenues line, public.mdas m
where (select should_apply from q2_health_import_control)
  and line.id = actual.budget_line_revenue_id
  and m.id = line.mda_id
  and line.fiscal_year = 2026
  and actual.quarter = 2
  and m.code like '0521%';

insert into public.budget_line_revenues (
  id,
  fiscal_year,
  mda_id,
  stream,
  economic_code,
  economic_description,
  receipt_description,
  approved_amount,
  source_label,
  source_row_number,
  active
)
select
  md5('2026-q2-health-revenue-aggregate-line:' || target.mda_code)::uuid,
  2026,
  m.id,
  'recurrent',
  'Q2-AGGREGATE',
  'AGGREGATE TOTAL REVENUE (RECURRENT + CAPITAL RECEIPTS)',
  'MDA-level Q2 total from Q2 2026 Health Component.xlsx',
  0,
  'Q2 2026 Health Component aggregate replacement | SHA-256 e4cfc7c7094ec1bcf880a4e48e71c9bbadf450a68d510107377e9e8655ada5fd',
  null,
  true
from q2_health_revenue_target target
join public.mdas m on m.code = target.mda_code
where (select should_apply from q2_health_import_control)
on conflict (
  fiscal_year,
  mda_id,
  stream,
  economic_code,
  (coalesce(source_row_number, -1))
)
do update set
  economic_description = excluded.economic_description,
  receipt_description = excluded.receipt_description,
  approved_amount = 0,
  source_label = excluded.source_label,
  active = true,
  updated_at = now();

insert into public.budget_line_revenue_actuals (
  id,
  budget_line_revenue_id,
  quarter,
  amount,
  source_label
)
select
  md5('2026-q2-health-revenue-aggregate-actual:' || target.mda_code)::uuid,
  line.id,
  2,
  target.amount,
  'Q2 2026 Health Component aggregate replacement | SHA-256 e4cfc7c7094ec1bcf880a4e48e71c9bbadf450a68d510107377e9e8655ada5fd'
from q2_health_revenue_target target
join public.mdas m on m.code = target.mda_code
join public.budget_line_revenues line
  on line.fiscal_year = 2026
 and line.mda_id = m.id
 and line.stream = 'recurrent'
 and line.economic_code = 'Q2-AGGREGATE'
 and coalesce(line.source_row_number, -1) = -1
where (select should_apply from q2_health_import_control);

-- One expenditure ledger row per non-zero MDA/component total.
insert into public.expenditure_entries (
  id,
  transaction_date,
  mda_id,
  expenditure_category_id,
  programme_area_id,
  is_phc,
  amount,
  voucher_ref_no,
  payment_method_id,
  remarks,
  entered_by
)
select
  md5(
    '2026-q2-health-expenditure-aggregate:'
    || target.mda_code || ':' || target.component
  )::uuid,
  date '2026-06-30',
  m.id,
  category.id,
  programme.id,
  false,
  target.amount,
  'BPR-2026Q2-AGG-EXP-' || target.mda_code || '-'
    || case target.component
         when 'personnel' then 'PERS'
         when 'overhead' then 'OVER'
         else 'CAPI'
       end,
  payment.id,
  'Q2 2026 Health Component aggregate replacement | '
    || initcap(target.component) || ' total | Source SHA-256 '
    || 'e4cfc7c7094ec1bcf880a4e48e71c9bbadf450a68d510107377e9e8655ada5fd',
  '00000000-0000-0000-0000-000000000001'::uuid
from q2_health_expenditure_target target
join public.mdas m on m.code = target.mda_code
join public.expenditure_categories category
  on category.slug = case target.component
    when 'personnel' then 'personnel-costs'
    when 'overhead' then 'overhead-running-costs'
    else 'capital-expenditure'
  end
join public.programme_areas programme on programme.slug = 'other'
join public.payment_methods payment on lower(payment.name) = 'gifmis'
where (select should_apply from q2_health_import_control);

-- Matching operational releases preserve funding-versus-expenditure balance.
insert into public.funding_entries (
  id,
  transaction_date,
  mda_id,
  funding_source_id,
  programme_area_id,
  amount,
  reference_no,
  remarks,
  entered_by
)
select
  md5(
    '2026-q2-health-expenditure-funding-aggregate:'
    || target.mda_code || ':' || target.component
  )::uuid,
  date '2026-06-30',
  m.id,
  source.id,
  programme.id,
  target.amount,
  'BPR-2026Q2-AGG-REL-' || target.mda_code || '-'
    || case target.component
         when 'personnel' then 'PERS'
         when 'overhead' then 'OVER'
         else 'CAPI'
       end,
  'Aggregate Q2 release matching the approved MDA/component expenditure replacement.',
  '00000000-0000-0000-0000-000000000001'::uuid
from q2_health_expenditure_target target
join public.mdas m on m.code = target.mda_code
join public.funding_sources source
  on source.slug = 'kano-state-govt-budget-release'
join public.programme_areas programme on programme.slug = 'other'
where (select should_apply from q2_health_import_control);

-- Combined revenue receipts are intentionally classified as "Other" because
-- the source workbook does not split recurrent and capital receipt sources.
insert into public.funding_entries (
  id,
  transaction_date,
  mda_id,
  funding_source_id,
  programme_area_id,
  amount,
  reference_no,
  remarks,
  entered_by
)
select
  md5(
    '2026-q2-health-revenue-funding-aggregate:' || target.mda_code
  )::uuid,
  date '2026-06-30',
  m.id,
  source.id,
  programme.id,
  target.amount,
  'BPR-2026Q2-AGG-REV-' || target.mda_code,
  'Aggregate Q2 total revenue including capital receipts; source workbook does not provide a source split.',
  '00000000-0000-0000-0000-000000000001'::uuid
from q2_health_revenue_target target
join public.mdas m on m.code = target.mda_code
join public.funding_sources source on source.slug = 'other'
join public.programme_areas programme on programme.slug = 'other'
where (select should_apply from q2_health_import_control);

insert into public.expenditure_funding_allocations (
  expenditure_entry_id,
  funding_source_id,
  amount
)
select
  ee.id,
  source.id,
  target.amount
from q2_health_expenditure_target target
join public.mdas m on m.code = target.mda_code
join public.expenditure_entries ee
  on ee.mda_id = m.id
 and ee.fiscal_year = 2026
 and ee.quarter = 2
 and ee.voucher_ref_no = (
   'BPR-2026Q2-AGG-EXP-' || target.mda_code || '-'
   || case target.component
        when 'personnel' then 'PERS'
        when 'overhead' then 'OVER'
        else 'CAPI'
      end
 )
join public.funding_sources source
  on source.slug = 'kano-state-govt-budget-release'
where (select should_apply from q2_health_import_control);

insert into public.admin_import_batches (
  id,
  import_type,
  source_file_name,
  storage_path,
  status,
  summary,
  created_by,
  completed_at
)
select
  md5('2026-q2-health-component-aggregate-replacement')::uuid,
  'bpr_quarterly_actuals',
  'Q2 2026 Health Component.xlsx',
  null,
  'imported',
  jsonb_build_object(
    'fiscal_year', 2026,
    'quarter', 2,
    'mode', 'aggregate_mda_component_replacement',
    'source_sha256', 'e4cfc7c7094ec1bcf880a4e48e71c9bbadf450a68d510107377e9e8655ada5fd',
    'archived_expenditure_entries', 313,
    'archived_funding_entries', 35,
    'replaced_revenue_actuals', 26,
    'inserted_expenditure_entries', 31,
    'inserted_funding_entries', 41,
    'inserted_revenue_actuals', 10,
    'target_expenditure_total', 58838984887.23,
    'target_revenue_total', 8022344074.74,
    'note', 'Per-MDA values are stored to two decimals; the workbook parent expenditure total rounds one kobo higher.'
  ),
  '00000000-0000-0000-0000-000000000001'::uuid,
  now()
where (select should_apply from q2_health_import_control);

commit;

select jsonb_build_object(
  'batch', (
    select jsonb_build_object(
      'id', batch.id,
      'status', batch.status,
      'summary', batch.summary
    )
    from public.admin_import_batches batch
    where batch.id = md5(
      '2026-q2-health-component-aggregate-replacement'
    )::uuid
  ),
  'q1_expenditure', (
    select jsonb_build_object('rows', count(*), 'amount', sum(ee.amount))
    from public.expenditure_entries ee
    join public.mdas m on m.id = ee.mda_id
    where ee.fiscal_year = 2026
      and ee.quarter = 1
      and m.code like '0521%'
  ),
  'q2_expenditure', (
    select jsonb_build_object('rows', count(*), 'amount', sum(ee.amount))
    from public.expenditure_entries ee
    join public.mdas m on m.id = ee.mda_id
    where ee.fiscal_year = 2026
      and ee.quarter = 2
      and m.code like '0521%'
  ),
  'q2_funding', (
    select jsonb_build_object('rows', count(*), 'amount', sum(fe.amount))
    from public.funding_entries fe
    join public.mdas m on m.id = fe.mda_id
    where fe.fiscal_year = 2026
      and fe.quarter = 2
      and m.code like '0521%'
  ),
  'q2_revenue', (
    select jsonb_build_object('rows', count(*), 'amount', sum(actual.amount))
    from public.budget_line_revenue_actuals actual
    join public.budget_line_revenues line
      on line.id = actual.budget_line_revenue_id
    join public.mdas m on m.id = line.mda_id
    where line.fiscal_year = 2026
      and actual.quarter = 2
      and m.code like '0521%'
  ),
  'archived_ledger_entries', (
    select jsonb_build_object(
      'rows', count(*),
      'expenditure', count(*) filter (
        where archived.entry_type = 'expenditure_entry'
      ),
      'funding', count(*) filter (
        where archived.entry_type = 'funding_entry'
      )
    )
    from public.archived_ledger_entries archived
    where archived.archive_reason like
      'Replaced by the approved Q2 2026 Health Component aggregate import%'
  )
) as replacement_result;
