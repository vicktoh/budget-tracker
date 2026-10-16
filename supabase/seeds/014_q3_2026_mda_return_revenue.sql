-- Q3 2026 revenue and receipts from MDA monthly returns (Jul-Sep).
--
-- Collections go to budget_line_revenue_actuals (quarter 3), the BIR's
-- revenue section. They are not releases: funding_entries are untouched.
-- All figures are provisional until the official Q3 BPR.
--
--   * Existing approved revenue lines get their Q3 collection, matched by MDA,
--     stream, economic code and receipt description (exactly one line each).
--     Explicit zero returns (SMOH BHCPF and UNICEF ODF grants) are kept as 0.
--   * SMOH reports ten donor receipts under 13020102 (the FGN domestic grants
--     code, shared with its BHCPF line, which it reports as N0). Each becomes
--     its own unbudgeted 13020102 line named after the donor, so code-level
--     totals include them without crediting BHCPF.
--   * MAWSH's internally generated revenue uses codes that differ from its
--     approved lines, so it is loaded as one MDA-level Q3 total (as Q2 was).
--   * DMA lists in-kind commodities with no economic code; they are loaded as
--     one uncoded capital-receipt line, itemised in its description.
--
-- Idempotent: deterministic ids and upserts on the natural keys.

begin;

do $$
begin
  if exists (select 1 from public.budget_implementation_report_publications
             where fiscal_year = 2026 and quarter = 3) then
    raise exception 'Q3 FY2026 is published; load revenue through an Admin amendment.';
  end if;
end $$;

create temporary table q3_revenue (
  mda_code text not null,
  stream text not null,
  economic_code text not null,
  economic_description text,
  receipt_description text not null,
  match_existing boolean not null,
  source_row_number int,
  amount numeric(18,2) not null,
  source_label text not null
) on commit drop;

insert into q3_revenue values
  -- Existing approved lines.
  ('052100900100', 'capital_receipt', '13020104', null, 'Local Government 1% Grant%', true, null, 811458888.00,
   'KHETFUND Q3 2026 BUDGET PERFORMANCE.xlsx (MDA monthly return, Q3 2026, provisional)'),
  ('052101300100', 'capital_receipt', '13020102', null, '%Intergrated last mile%', true, null, 45000000.00,
   'DMCSA Q3.xlsx (MDA monthly return, Q3 2026, provisional)'),
  ('052101300100', 'capital_receipt', '13020102', null, '%4 zonal warehouse%', true, null, 30000000.00,
   'DMCSA Q3.xlsx (MDA monthly return, Q3 2026, provisional)'),
  ('052100500100', 'capital_receipt', '13020202', null, '%Community H%', true, null, 97531177.74,
   'Updated KSPHCMB  Q1, Q2,Q3  BUDGET PERFORMANCE.xlsx (MDA monthly return, Q3 2026, provisional)'),
  ('052100100100', 'capital_receipt', '13020102', null, '%Basic Health Care Provision Fund%', true, null, 0,
   'SMOH Q3 2026 BUDGET PERFORMANCE.xlsx row 302 (MDA monthly return, Q3 2026, provisional)'),
  ('052100100100', 'capital_receipt', '13020202', null, '%Open Defecation%', true, null, 0,
   'SMOH Q3 2026 BUDGET PERFORMANCE.xlsx row 301 (MDA monthly return, Q3 2026, provisional)'),
  -- SMOH donor receipts coded 13020102 in the return; no approved line.
  ('052100100100', 'capital_receipt', '13020102', 'CAPITAL DOMESTIC GRANTS FROM FGN (as coded in SMOH return)',
   'Support From Health MOU (KNSG, BMGF and Dangote)', false, 303, 732561685.47,
   'SMOH Q3 2026 BUDGET PERFORMANCE.xlsx row 303 (donor receipt coded 13020102; unbudgeted; provisional)'),
  ('052100100100', 'capital_receipt', '13020102', 'CAPITAL DOMESTIC GRANTS FROM FGN (as coded in SMOH return)',
   'Support From Unicef and Nutrition International', false, 304, 2826341868.91,
   'SMOH Q3 2026 BUDGET PERFORMANCE.xlsx row 304 (donor receipt coded 13020102; unbudgeted; provisional)'),
  ('052100100100', 'capital_receipt', '13020102', 'CAPITAL DOMESTIC GRANTS FROM FGN (as coded in SMOH return)',
   'KHETFUND Interventions', false, 305, 61998399.86,
   'SMOH Q3 2026 BUDGET PERFORMANCE.xlsx row 305 (receipt coded 13020102; unbudgeted; provisional)'),
  ('052100100100', 'capital_receipt', '13020102', 'CAPITAL DOMESTIC GRANTS FROM FGN (as coded in SMOH return)',
   'Development Partners Support For Non Communicable Diseases', false, 306, 1754900000.00,
   'SMOH Q3 2026 BUDGET PERFORMANCE.xlsx row 306 (donor receipt coded 13020102; unbudgeted; provisional)'),
  ('052100100100', 'capital_receipt', '13020102', 'CAPITAL DOMESTIC GRANTS FROM FGN (as coded in SMOH return)',
   'Support From Lafiya FCDO', false, 307, 44147825.00,
   'SMOH Q3 2026 BUDGET PERFORMANCE.xlsx row 307 (donor receipt coded 13020102; unbudgeted; provisional)'),
  ('052100100100', 'capital_receipt', '13020102', 'CAPITAL DOMESTIC GRANTS FROM FGN (as coded in SMOH return)',
   'Support From Coregroup, Acephap, eHealthAfrica, IntegratE and SFH', false, 308, 331521837.50,
   'SMOH Q3 2026 BUDGET PERFORMANCE.xlsx row 308 (donor receipt coded 13020102; unbudgeted; provisional)'),
  ('052100100100', 'capital_receipt', '13020102', 'CAPITAL DOMESTIC GRANTS FROM FGN (as coded in SMOH return)',
   'Support From SANDHEF', false, 309, 30500000.00,
   'SMOH Q3 2026 BUDGET PERFORMANCE.xlsx row 309 (donor receipt coded 13020102; unbudgeted; provisional)'),
  ('052100100100', 'capital_receipt', '13020102', 'CAPITAL DOMESTIC GRANTS FROM FGN (as coded in SMOH return)',
   'Support From SOLINA/SightSavers', false, 310, 35786304.00,
   'SMOH Q3 2026 BUDGET PERFORMANCE.xlsx row 310 (donor receipt coded 13020102; unbudgeted; provisional)'),
  ('052100100100', 'capital_receipt', '13020102', 'CAPITAL DOMESTIC GRANTS FROM FGN (as coded in SMOH return)',
   'Malaria Consortium', false, 311, 22738879645.00,
   'SMOH Q3 2026 BUDGET PERFORMANCE.xlsx row 311 (donor receipt coded 13020102; unbudgeted; provisional)'),
  ('052100100100', 'capital_receipt', '13020102', 'CAPITAL DOMESTIC GRANTS FROM FGN (as coded in SMOH return)',
   'A 360 and Bloom Initiative support for Adolescent And Young People Health', false, 312, 241889600.00,
   'SMOH Q3 2026 BUDGET PERFORMANCE.xlsx row 312 (donor receipt coded 13020102; unbudgeted; provisional)'),
  -- MAWSH internally generated revenue: one MDA-level total (Jul 41,902,189.29;
  -- Aug 39,638,634.00; Sep 41,052,554.45), as Q2 was loaded.
  ('052100300200', 'recurrent', 'Q3-AGGREGATE', 'AGGREGATE INTERNALLY GENERATED REVENUE',
   'MDA-level Q3 total from the MAWTH Jul-Sep return; its line codes differ from the approved revenue lines (to be clarified)',
   false, null, 122593377.74,
   'MAWTH JULY TO SEPT. 2026 BUDGET PERFORMANCE.xlsx (MDA monthly return, Q3 2026, provisional)'),
  -- DMA in-kind commodities, listed without economic codes (July).
  ('052101300100', 'capital_receipt', 'UNCODED', 'IN-KIND COMMODITIES (NO ECONOMIC CODE IN RETURN)',
   'Oxytocin Inj N13,960,863.55; Tranexamic Acid Inj N12,612,531.40; Calibrate drape N53,769,851.80; Misoprostol 200 mcg N7,937,598.20; SWIPHA N305,000.00 (to be clarified)',
   false, null, 88585844.95,
   'DMCSA Q3.xlsx rows 85-89 (in-kind, no economic code; provisional)');

-- Every existing-line receipt must match exactly one approved revenue line.
do $$
declare
  bad jsonb;
begin
  select jsonb_agg(jsonb_build_object('mda', q.mda_code, 'code', q.economic_code, 'line', q.receipt_description, 'matches', n))
    into bad
  from (
    select q.*, (
      select count(*) from public.budget_line_revenues r join public.mdas m on m.id = r.mda_id
      where m.code = q.mda_code and r.fiscal_year = 2026 and r.stream = q.stream
        and r.economic_code = q.economic_code and r.receipt_description ilike q.receipt_description
    ) as n
    from q3_revenue q where q.match_existing
  ) q
  where n <> 1;
  if bad is not null then
    raise exception 'Revenue lines did not match exactly once: %', bad;
  end if;
end $$;

-- New (unbudgeted) revenue lines.
insert into public.budget_line_revenues (
  id, fiscal_year, mda_id, stream, economic_code, economic_description,
  receipt_description, approved_amount, source_label, source_row_number, active)
select
  md5(format('2026-q3-mda-return-revenue-line:%s:%s:%s:%s', q.mda_code, q.stream, q.economic_code, coalesce(q.source_row_number, -1)))::uuid,
  2026, m.id, q.stream, q.economic_code, q.economic_description,
  q.receipt_description, 0, q.source_label, q.source_row_number, true
from q3_revenue q
join public.mdas m on m.code = q.mda_code
where not q.match_existing
on conflict (fiscal_year, mda_id, stream, economic_code, (coalesce(source_row_number, -1)))
do update set
  economic_description = excluded.economic_description,
  receipt_description = excluded.receipt_description,
  source_label = excluded.source_label,
  active = true,
  updated_at = now();

-- Q3 collections.
insert into public.budget_line_revenue_actuals (budget_line_revenue_id, quarter, amount, source_label)
select r.id, 3, q.amount, q.source_label
from q3_revenue q
join public.mdas m on m.code = q.mda_code
join public.budget_line_revenues r
  on r.mda_id = m.id and r.fiscal_year = 2026 and r.stream = q.stream
 and r.economic_code = q.economic_code
 and (
   (q.match_existing and r.receipt_description ilike q.receipt_description)
   or (not q.match_existing and coalesce(r.source_row_number, -1) = coalesce(q.source_row_number, -1))
 )
on conflict (budget_line_revenue_id, quarter)
do update set amount = excluded.amount, source_label = excluded.source_label, updated_at = now();

commit;

select m.name, r.stream, r.economic_code, left(coalesce(r.receipt_description, r.economic_description), 60) as line,
       r.approved_amount, a.amount as q3_collected
from public.budget_line_revenue_actuals a
join public.budget_line_revenues r on r.id = a.budget_line_revenue_id
join public.mdas m on m.id = r.mda_id
where r.fiscal_year = 2026 and a.quarter = 3
order by m.name, a.amount desc;
