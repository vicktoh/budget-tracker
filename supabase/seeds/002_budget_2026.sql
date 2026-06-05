-- Generated from Kano Health Finance Tracker.xlsx. Do not edit by hand.
begin;
insert into public.approved_budgets (
  fiscal_year,
  mda_id,
  personnel_amount,
  other_recurrent_amount,
  total_recurrent_amount,
  capital_amount,
  total_budget_amount,
  source_label
)
values
  (2026, (select id from public.mdas where code = '052100100100'), 5213024000.00, 5983519445.00, 11196543445.00, 91360467517.09, 102557010962.09, 'Kano State Government 2026 Approved Budget'),
  (2026, (select id from public.mdas where code = '052100300100'), 58750191000.00, 5295314349.37, 64045505349.37, 4040000000.00, 68085505349.37, 'Kano State Government 2026 Approved Budget'),
  (2026, (select id from public.mdas where code = '052100300200'), 0.00, 981334000.00, 981334000.00, 1673806488.95, 2655140488.95, 'Kano State Government 2026 Approved Budget'),
  (2026, (select id from public.mdas where code = '052100400100'), 0.00, 246350000.00, 246350000.00, 0.00, 246350000.00, 'Kano State Government 2026 Approved Budget'),
  (2026, (select id from public.mdas where code = '052100400200'), 0.00, 34800000.00, 34800000.00, 0.00, 34800000.00, 'Kano State Government 2026 Approved Budget'),
  (2026, (select id from public.mdas where code = '052100400300'), 0.00, 32000000.00, 32000000.00, 0.00, 32000000.00, 'Kano State Government 2026 Approved Budget'),
  (2026, (select id from public.mdas where code = '052100400400'), 0.00, 30800000.00, 30800000.00, 0.00, 30800000.00, 'Kano State Government 2026 Approved Budget'),
  (2026, (select id from public.mdas where code = '052100400600'), 0.00, 31050000.00, 31050000.00, 0.00, 31050000.00, 'Kano State Government 2026 Approved Budget'),
  (2026, (select id from public.mdas where code = '052100400700'), 0.00, 16600000.00, 16600000.00, 0.00, 16600000.00, 'Kano State Government 2026 Approved Budget'),
  (2026, (select id from public.mdas where code = '052100400800'), 0.00, 26900000.00, 26900000.00, 0.00, 26900000.00, 'Kano State Government 2026 Approved Budget'),
  (2026, (select id from public.mdas where code = '052100500100'), 700512000.00, 2016612000.00, 2717124000.00, 12901240748.29, 15618364748.29, 'Kano State Government 2026 Approved Budget'),
  (2026, (select id from public.mdas where code = '052100600100'), 0.00, 12000000.00, 12000000.00, 1288881920.00, 1300881920.00, 'Kano State Government 2026 Approved Budget'),
  (2026, (select id from public.mdas where code = '052100800100'), 0.00, 1397000000.00, 1397000000.00, 7364500000.00, 8761500000.00, 'Kano State Government 2026 Approved Budget'),
  (2026, (select id from public.mdas where code = '052100900100'), 0.00, 191000000.00, 191000000.00, 7200594170.00, 7391594170.00, 'Kano State Government 2026 Approved Budget'),
  (2026, (select id from public.mdas where code = '052101000100'), 0.00, 17369000.00, 17369000.00, 0.00, 17369000.00, 'Kano State Government 2026 Approved Budget'),
  (2026, (select id from public.mdas where code = '052101100100'), 0.00, 270500000.00, 270500000.00, 404000000.00, 674500000.00, 'Kano State Government 2026 Approved Budget'),
  (2026, (select id from public.mdas where code = '052101300100'), 0.00, 277500000.00, 277500000.00, 2780227896.00, 3057727896.00, 'Kano State Government 2026 Approved Budget'),
  (2026, (select id from public.mdas where code = '052101400100'), 0.00, 1328485588.00, 1328485588.00, 1766123270.00, 3094608858.00, 'Kano State Government 2026 Approved Budget'),
  (2026, (select id from public.mdas where code = '052102000100'), 0.00, 6250000.00, 6250000.00, 0.00, 6250000.00, 'Kano State Government 2026 Approved Budget'),
  (2026, (select id from public.mdas where code = '052103000100'), 0.00, 42500000.00, 42500000.00, 0.00, 42500000.00, 'Kano State Government 2026 Approved Budget'),
  (2026, (select id from public.mdas where code = '052104000100'), 0.00, 88500000.00, 88500000.00, 1069355871.00, 1157855871.00, 'Kano State Government 2026 Approved Budget')
on conflict (fiscal_year, mda_id) do update
set personnel_amount = excluded.personnel_amount,
    other_recurrent_amount = excluded.other_recurrent_amount,
    total_recurrent_amount = excluded.total_recurrent_amount,
    capital_amount = excluded.capital_amount,
    total_budget_amount = excluded.total_budget_amount,
    source_label = excluded.source_label,
    updated_at = now();

commit;
