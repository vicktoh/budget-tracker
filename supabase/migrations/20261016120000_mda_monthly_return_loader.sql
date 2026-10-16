-- Loader for MDA monthly budget-tracking returns (IBP template), one MDA and
-- one quarter at a time. Admin tooling only: run by scripts/mda_monthly_return.py
-- through a privileged connection, never exposed to app users.
--
--   * Months before the quarter are compared with monthly_expenditure_tracking
--     and reported. They are never written: earlier quarters stay as loaded.
--   * Months in the quarter replace the MDA's monthly tracking for those
--     months. A filled cell (0 included) is a return; a blank stays absent.
--   * Each budget line with spending in the quarter becomes one ledger
--     expenditure row for the quarter only (never year-to-date), dated the
--     last day of the quarter and bound to its approved budget line, so the
--     BIR and the executive views include it. Rows carry origin 'import' and
--     voucher MDA-<fy>Q<q>-<mda code>-<economic code>-R<row>. They are
--     provisional until the official quarterly BPR replaces them.
--   * No releases (funding entries) are created: the template reports
--     spending only. Each ledger row is allocated to the state budget release
--     because every template line is an approved state budget line.
--
-- p_apply = false returns the check report and writes nothing. Re-running the
-- same return changes nothing.

begin;

create or replace function app_private.mr_norm(value text)
returns text
language sql
immutable
as $$
  select trim(regexp_replace(lower(coalesce(value, '')), '[^a-z0-9]+', ' ', 'g'))
$$;

create or replace function app_private.load_mda_monthly_return(
  p_mda_code text,
  p_fiscal_year int,
  p_quarter int,
  p_source_label text,
  p_lines jsonb,
  p_warnings jsonb default '[]'::jsonb,
  p_apply boolean default false
)
returns jsonb
language plpgsql
set search_path = public
as $$
declare
  v_mda public.mdas%rowtype;
  v_first int := p_quarter * 3 - 2;
  v_last int := p_quarter * 3;
  v_quarter_end date;
  v_prefix text;
  v_locked boolean;
  v_duplicates jsonb;
  v_report jsonb;
  v_actor constant uuid := '00000000-0000-0000-0000-000000000001';
  v_source uuid;
  v_programme uuid;
  v_payment uuid;
  n_tracking_removed int := 0;
  n_tracking_written int := 0;
  n_ledger_removed int := 0;
  n_ledger_written int := 0;
begin
  if p_quarter is null or p_quarter not between 1 and 4 then
    raise exception 'Quarter must be between 1 and 4.';
  end if;
  select * into v_mda from public.mdas where code = p_mda_code;
  if not found then
    raise exception 'No MDA has code %.', p_mda_code;
  end if;

  v_quarter_end := (make_date(p_fiscal_year, v_last, 1) + interval '1 month' - interval '1 day')::date;
  v_prefix := format('MDA-%sQ%s-%s-', p_fiscal_year, p_quarter, p_mda_code);
  select exists (
    select 1 from public.budget_implementation_report_publications
    where fiscal_year = p_fiscal_year and quarter = p_quarter
  ) into v_locked;

  -- Sheet lines, matched to the MDA's existing tracking line (same class and
  -- economic code, and the same description unless the code is unique) and
  -- to its approved budget line. Matching is one-to-one: when several sheet
  -- rows claim the same line (repeated codes, repeated descriptions), the
  -- closest keeps it and the others stay separate lines keyed by their own
  -- sheet row.
  drop table if exists pg_temp._mr_lines;
  create temp table _mr_lines on commit drop as
  with src as (
    select x.row_no, x.budget_class, x.economic_code, trim(x.descr) as descr, x.budget, x.months
    from jsonb_to_recordset(p_lines)
      as x(row_no int, budget_class text, economic_code text, descr text, budget numeric, months jsonb)
  ),
  tracked as (
    select distinct budget_class, economic_code, source_row_number, description, approved_budget_line_id
    from public.monthly_expenditure_tracking
    where mda_id = v_mda.id and fiscal_year = p_fiscal_year
  ),
  budgeted as (
    select id, budget_class, economic_code, coalesce(project_description, economic_description) as descr
    from public.approved_budget_lines
    where mda_id = v_mda.id and fiscal_year = p_fiscal_year and active
  ),
  candidates as (
    select s.*,
           coalesce(t.matched, false) as t_matched, t.source_row_number as t_row,
           t.approved_budget_line_id as t_line, coalesce(t.desc_eq, false) as t_desc_eq,
           b.id as b_id, coalesce(b.desc_eq, false) as b_desc_eq
    from src s
  left join lateral (
    select true as matched, e.source_row_number, e.approved_budget_line_id,
           app_private.mr_norm(e.description) = app_private.mr_norm(s.descr) as desc_eq
    from tracked e
    where e.budget_class = s.budget_class and e.economic_code = s.economic_code
      and (
        app_private.mr_norm(e.description) = app_private.mr_norm(s.descr)
        or (select count(*) from tracked c
            where c.budget_class = s.budget_class and c.economic_code = s.economic_code) = 1
      )
    order by (app_private.mr_norm(e.description) = app_private.mr_norm(s.descr)) desc,
             abs(coalesce(e.source_row_number, 0) - s.row_no)
    limit 1
  ) t on true
  left join lateral (
    select a.id, app_private.mr_norm(a.descr) = app_private.mr_norm(s.descr) as desc_eq
    from budgeted a
    where a.budget_class = s.budget_class and a.economic_code = s.economic_code
      and (
        app_private.mr_norm(a.descr) = app_private.mr_norm(s.descr)
        or (select count(*) from budgeted c
            where c.budget_class = s.budget_class and c.economic_code = s.economic_code) = 1
      )
    order by (app_private.mr_norm(a.descr) = app_private.mr_norm(s.descr)) desc
    limit 1
  ) b on true
  ),
  ranked as (
    select c.*,
      case when c.t_matched then row_number() over (
        partition by c.t_matched, c.budget_class, c.economic_code, c.t_row
        order by c.t_desc_eq desc, abs(coalesce(c.t_row, 0) - c.row_no), c.row_no) end as t_rank,
      case when c.b_id is not null then row_number() over (
        partition by c.b_id order by c.b_desc_eq desc, c.row_no) end as b_rank
    from candidates c
  ),
  resolved as (
    select r.*,
      r.t_rank = 1 as won,
      case when r.t_rank = 1 then r.t_line end as kept_line
    from ranked r
  )
  select
    r.row_no, r.budget_class, r.economic_code, r.descr, r.budget, r.months,
    coalesce(r.won, false) as tracked,
    case
      when r.won then coalesce(r.t_row, -1)
      -- A separate line keeps its own sheet row as key, moved clear of any
      -- platform line that already uses that row number for the same code.
      when exists (select 1 from tracked e
                   where e.budget_class = r.budget_class and e.economic_code = r.economic_code
                     and e.source_row_number = r.row_no) then 100000 + r.row_no
      else r.row_no
    end as k_row,
    coalesce(r.kept_line, case when r.b_rank = 1 then r.b_id end) as line_id,
    coalesce(bl.project_description, bl.economic_description, r.descr) as title
  from resolved r
  left join public.approved_budget_lines bl
    on bl.id = coalesce(r.kept_line, case when r.b_rank = 1 then r.b_id end);

  select coalesce(jsonb_agg(jsonb_build_object(
           'economic_code', economic_code, 'budget_class', budget_class, 'row', k_row, 'sheet_rows', n)), '[]')
    into v_duplicates
  from (
    select budget_class, economic_code, k_row, count(*) as n
    from _mr_lines group by 1, 2, 3 having count(*) > 1
  ) d;

  drop table if exists pg_temp._mr_cells;
  create temp table _mr_cells on commit drop as
  select l.budget_class, l.economic_code, l.k_row, a.ord::int as month, (a.val #>> '{}')::numeric(18,2) as amount
  from _mr_lines l
  cross join lateral jsonb_array_elements(l.months) with ordinality as a(val, ord)
  where jsonb_typeof(a.val) = 'number';

  drop table if exists pg_temp._mr_ledger;
  create temp table _mr_ledger on commit drop as
  select
    md5(format('mda-return:%s:Q%s:%s:%s:%s:%s',
      p_fiscal_year, p_quarter, p_mda_code, l.budget_class, l.economic_code, l.k_row))::uuid as id,
    v_prefix || l.economic_code || '-R' || l.k_row as voucher_ref_no,
    l.budget_class,
    l.economic_code,
    l.line_id,
    l.title,
    q.amount,
    format('%s — %s monthly return, Q%s %s (%s). Provisional until the official Q%s BPR.',
      l.title, v_mda.name, p_quarter, p_fiscal_year, q.detail, p_quarter) as remarks
  from _mr_lines l
  cross join lateral (
    select
      sum(c.amount) as amount,
      string_agg(
        to_char(make_date(2000, m, 1), 'Mon') || ' '
          || coalesce('₦' || to_char(c.amount, 'FM999,999,999,990.00'), 'not reported'),
        '; ' order by m) as detail
    from generate_series(v_first, v_last) as m
    left join _mr_cells c
      on c.month = m and c.budget_class = l.budget_class
     and c.economic_code = l.economic_code and c.k_row = l.k_row
  ) q
  where q.amount > 0;

  v_report := jsonb_build_object(
    'mda', jsonb_build_object('code', v_mda.code, 'name', v_mda.name),
    'fiscal_year', p_fiscal_year,
    'quarter', p_quarter,
    'source', p_source_label,
    'mode', case when p_apply then 'apply' else 'check' end,
    'published_and_locked', v_locked,
    'sheet_warnings', p_warnings,
    'lines', jsonb_build_object(
      'in_sheet', (select count(*) from _mr_lines),
      'matched_to_tracking', (select count(*) from _mr_lines where tracked),
      'bound_to_budget_line', (select count(*) from _mr_lines where line_id is not null),
      'duplicate_keys', v_duplicates
    ),
    'earlier_months', (
      with s as (select * from _mr_cells where month < v_first),
           p as (
             select budget_class, economic_code, coalesce(source_row_number, -1) as k_row, month, amount
             from public.monthly_expenditure_tracking
             where mda_id = v_mda.id and fiscal_year = p_fiscal_year and month < v_first
           ),
           j as (
             select coalesce(s.budget_class, p.budget_class) as budget_class,
                    coalesce(s.economic_code, p.economic_code) as economic_code,
                    coalesce(s.k_row, p.k_row) as k_row,
                    coalesce(s.month, p.month) as month,
                    s.amount as sheet, p.amount as platform
             from s full join p
               on p.budget_class = s.budget_class and p.economic_code = s.economic_code
              and p.k_row = s.k_row and p.month = s.month
           )
      select jsonb_build_object(
        'cells_compared', count(*),
        'cells_matching', count(*) filter (where sheet is not distinct from platform),
        'sheet_total', coalesce(sum(sheet), 0),
        'platform_total', coalesce(sum(platform), 0),
        'differences', coalesce(jsonb_agg(jsonb_build_object(
            'economic_code', j.economic_code,
            'line', (select l.descr from _mr_lines l
                     where l.budget_class = j.budget_class and l.economic_code = j.economic_code
                       and l.k_row = j.k_row limit 1),
            'month', j.month, 'sheet', j.sheet, 'platform', j.platform)
            order by j.month, j.economic_code)
          filter (where sheet is distinct from platform), '[]')
      )
      from j
    ),
    'budget_differences', (
      select coalesce(jsonb_agg(jsonb_build_object(
          'economic_code', l.economic_code, 'line', l.descr,
          'sheet', l.budget, 'platform', b.approved_amount)), '[]')
      from _mr_lines l
      left join public.approved_budget_lines b on b.id = l.line_id
      where l.budget is distinct from b.approved_amount
        and not (coalesce(l.budget, 0) = 0 and b.id is null)
    ),
    'unbound_lines_with_spend', (
      select coalesce(jsonb_agg(jsonb_build_object(
          'economic_code', g.economic_code, 'budget_class', g.budget_class,
          'line', g.title, 'amount', g.amount)), '[]')
      from _mr_ledger g where g.line_id is null
    ),
    'quarter_months', (
      select jsonb_agg(jsonb_build_object(
          'month', m,
          'lines_filled', (select count(*) from _mr_cells c where c.month = m),
          'lines_with_spend', (select count(*) from _mr_cells c where c.month = m and c.amount <> 0),
          'total', (select coalesce(sum(amount), 0) from _mr_cells c where c.month = m))
        order by m)
      from generate_series(v_first, v_last) as m
    ),
    'quarter_total', (select coalesce(sum(amount), 0) from _mr_ledger),
    'ledger_rows', (select count(*) from _mr_ledger),
    'later_months_ignored', (select count(*) from _mr_cells where month > v_last),
    'already_on_platform', jsonb_build_object(
      'tracking_cells', (
        select count(*) from public.monthly_expenditure_tracking
        where mda_id = v_mda.id and fiscal_year = p_fiscal_year and month between v_first and v_last),
      'ledger_rows', (
        select count(*) from public.expenditure_entries
        where mda_id = v_mda.id and fiscal_year = p_fiscal_year and quarter = p_quarter),
      'ledger_total', (
        select coalesce(sum(amount), 0) from public.expenditure_entries
        where mda_id = v_mda.id and fiscal_year = p_fiscal_year and quarter = p_quarter),
      'ledger_rows_from_other_sources', (
        select count(*) from public.expenditure_entries
        where mda_id = v_mda.id and fiscal_year = p_fiscal_year and quarter = p_quarter
          and voucher_ref_no not like v_prefix || '%')
    )
  );

  if not p_apply then
    return v_report;
  end if;

  if v_locked then
    raise exception 'Q% FY% is published; its figures can only change through an Admin amendment.',
      p_quarter, p_fiscal_year using errcode = '55000';
  end if;
  if jsonb_array_length(v_duplicates) > 0 then
    raise exception 'Two sheet rows map to the same budget line: %. Fix the sheet or match them by hand.', v_duplicates;
  end if;
  if (v_report #>> '{already_on_platform,ledger_rows_from_other_sources}')::int > 0 then
    raise exception 'Q% already has ledger entries for % from another source; loading this return would double count.',
      p_quarter, v_mda.name;
  end if;

  select id into strict v_source from public.funding_sources where slug = 'kano-state-govt-budget-release';
  select id into strict v_programme from public.programme_areas where slug = 'other';
  select id into strict v_payment from public.payment_methods where slug = 'other';

  -- Monthly tracking: the return replaces this quarter's months.
  delete from public.monthly_expenditure_tracking t
  where t.mda_id = v_mda.id and t.fiscal_year = p_fiscal_year and t.month between v_first and v_last
    and not exists (
      select 1 from _mr_cells c
      where c.month = t.month and c.budget_class = t.budget_class
        and c.economic_code = t.economic_code and c.k_row = coalesce(t.source_row_number, -1));
  get diagnostics n_tracking_removed = row_count;

  insert into public.monthly_expenditure_tracking (
    fiscal_year, mda_id, budget_class, economic_code, description,
    approved_budget_line_id, month, amount, source_label, source_row_number)
  select p_fiscal_year, v_mda.id, l.budget_class, l.economic_code, l.descr,
         l.line_id, c.month, c.amount, p_source_label, nullif(l.k_row, -1)
  from _mr_cells c
  join _mr_lines l
    on l.budget_class = c.budget_class and l.economic_code = c.economic_code and l.k_row = c.k_row
  where c.month between v_first and v_last
  on conflict (fiscal_year, mda_id, budget_class, economic_code, coalesce(source_row_number, -1), month)
  do update set amount = excluded.amount,
                description = excluded.description,
                approved_budget_line_id = excluded.approved_budget_line_id,
                source_label = excluded.source_label;
  get diagnostics n_tracking_written = row_count;

  -- Ledger: one quarter-only row per budget line with spending.
  delete from public.expenditure_entries e
  where e.mda_id = v_mda.id and e.fiscal_year = p_fiscal_year
    and e.voucher_ref_no like v_prefix || '%'
    and e.id not in (select id from _mr_ledger);
  get diagnostics n_ledger_removed = row_count;

  insert into public.expenditure_entries (
    id, transaction_date, mda_id, expenditure_category_id, programme_area_id,
    approved_budget_line_id, is_phc, amount, voucher_ref_no, payment_method_id,
    remarks, entered_by, origin)
  select g.id, v_quarter_end, v_mda.id, cat.id, v_programme,
         g.line_id, false, g.amount, g.voucher_ref_no, v_payment,
         g.remarks, v_actor, 'import'
  from _mr_ledger g
  join public.expenditure_categories cat on cat.slug = case g.budget_class
    when 'personnel' then 'personnel-costs'
    when 'capital' then 'capital-expenditure'
    else 'overhead-running-costs' end
  on conflict (id) do update
    set amount = excluded.amount,
        remarks = excluded.remarks,
        approved_budget_line_id = excluded.approved_budget_line_id,
        expenditure_category_id = excluded.expenditure_category_id,
        transaction_date = excluded.transaction_date;
  get diagnostics n_ledger_written = row_count;

  insert into public.expenditure_funding_allocations (expenditure_entry_id, funding_source_id, amount)
  select g.id, v_source, g.amount from _mr_ledger g
  on conflict (expenditure_entry_id, funding_source_id) do update set amount = excluded.amount;

  v_report := v_report || jsonb_build_object('applied', jsonb_build_object(
    'tracking_cells_written', n_tracking_written,
    'tracking_cells_removed', n_tracking_removed,
    'ledger_rows_written', n_ledger_written,
    'ledger_rows_removed', n_ledger_removed,
    'applied_at', now()));

  insert into public.admin_import_batches (
    id, import_type, source_file_name, status, summary, created_by, completed_at)
  values (
    md5(format('mda-return:%s:Q%s:%s', p_fiscal_year, p_quarter, p_mda_code))::uuid,
    'monthly_tracking', p_source_label, 'imported', v_report, v_actor, now())
  on conflict (id) do update
    set source_file_name = excluded.source_file_name,
        status = excluded.status,
        summary = excluded.summary,
        completed_at = excluded.completed_at;

  return v_report;
end;
$$;

revoke all on function app_private.load_mda_monthly_return(text, int, int, text, jsonb, jsonb, boolean)
  from public, anon, authenticated;
revoke all on function app_private.mr_norm(text) from public, anon, authenticated;

commit;
