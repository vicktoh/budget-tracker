-- Kano State FY2025 health-sector approved budgets.
--
-- Source: "Kano Health Numbers" (International Budget Partnership, Q1 2026),
-- verified against the 2025 final BIR.
--
-- Per-MDA approved budgets are scaled from each MDA's 2026 share so the
-- health-sector total hits the published ~N109.8bn (PHCMB pinned to its +35%
-- anchor).
--
-- Requires seeds 001 and 002. Idempotent via on conflict.

begin;

do $$
begin
  if not exists (select 1 from public.mdas where code = '052100100100') then
    raise exception 'Reference data missing — apply supabase/seeds/001_reference_data.sql first.';
  end if;
end $$;

-- Remove the retired FY2025 dummy ledger entries on re-run while preserving
-- genuine FY2025 entries that may have been entered by users.
delete from public.expenditure_entries where voucher_ref_no like 'KH25-%';
delete from public.funding_entries where reference_no like 'KH25-%';

/* -------------------- Approved budgets (FY2025) -------------------- */
insert into public.approved_budgets (
  fiscal_year, mda_id, personnel_amount, other_recurrent_amount,
  total_recurrent_amount, capital_amount, total_budget_amount, source_label
)
values
  (2025, (select id from public.mdas where code = '052100100100'), 2583308220.91, 2965126378.14, 5548434599.05, 45273577640.01, 50822012239.06, 'Kano State Government 2025 Approved Budget (IBP verified, scaled to sector total)'),
  (2025, (select id from public.mdas where code = '052100300100'), 29113591533.52, 2624087111.63, 31737678645.15, 2002017487.83, 33739696132.98, 'Kano State Government 2025 Approved Budget (IBP verified, scaled to sector total)'),
  (2025, (select id from public.mdas where code = '052100300200'), 0.00, 486298967.67, 486298967.67, 829452936.17, 1315751903.84, 'Kano State Government 2025 Approved Budget (IBP verified, scaled to sector total)'),
  (2025, (select id from public.mdas where code = '052100400100'), 0.00, 122078467.36, 122078467.36, 0.00, 122078467.36, 'Kano State Government 2025 Approved Budget (IBP verified, scaled to sector total)'),
  (2025, (select id from public.mdas where code = '052100400200'), 0.00, 17245101.13, 17245101.13, 0.00, 17245101.13, 'Kano State Government 2025 Approved Budget (IBP verified, scaled to sector total)'),
  (2025, (select id from public.mdas where code = '052100400300'), 0.00, 15857564.26, 15857564.26, 0.00, 15857564.26, 'Kano State Government 2025 Approved Budget (IBP verified, scaled to sector total)'),
  (2025, (select id from public.mdas where code = '052100400400'), 0.00, 15262905.60, 15262905.60, 0.00, 15262905.60, 'Kano State Government 2025 Approved Budget (IBP verified, scaled to sector total)'),
  (2025, (select id from public.mdas where code = '052100400600'), 0.00, 15386792.82, 15386792.82, 0.00, 15386792.82, 'Kano State Government 2025 Approved Budget (IBP verified, scaled to sector total)'),
  (2025, (select id from public.mdas where code = '052100400700'), 0.00, 8226111.46, 8226111.46, 0.00, 8226111.46, 'Kano State Government 2025 Approved Budget (IBP verified, scaled to sector total)'),
  (2025, (select id from public.mdas where code = '052100400800'), 0.00, 13330264.96, 13330264.96, 0.00, 13330264.96, 'Kano State Government 2025 Approved Budget (IBP verified, scaled to sector total)'),
  (2025, (select id from public.mdas where code = '052100500100'), 23690736.70, 1714285714.29, 1737976450.99, 9320205092.94, 11058181543.93, 'Kano State Government 2025 Approved Budget (IBP verified, scaled to sector total)'),
  (2025, (select id from public.mdas where code = '052100600100'), 0.00, 5946586.60, 5946586.60, 638703995.94, 644650582.54, 'Kano State Government 2025 Approved Budget (IBP verified, scaled to sector total)'),
  (2025, (select id from public.mdas where code = '052100800100'), 0.00, 692281789.73, 692281789.73, 3649469749.79, 4341751539.52, 'Kano State Government 2025 Approved Budget (IBP verified, scaled to sector total)'),
  (2025, (select id from public.mdas where code = '052100900100'), 0.00, 94649836.68, 94649836.68, 3568246398.79, 3662896235.47, 'Kano State Government 2025 Approved Budget (IBP verified, scaled to sector total)'),
  (2025, (select id from public.mdas where code = '052101000100'), 0.00, 8607188.55, 8607188.55, 0.00, 8607188.55, 'Kano State Government 2025 Approved Budget (IBP verified, scaled to sector total)'),
  (2025, (select id from public.mdas where code = '052101100100'), 0.00, 134045972.89, 134045972.89, 200201748.78, 334247721.67, 'Kano State Government 2025 Approved Budget (IBP verified, scaled to sector total)'),
  (2025, (select id from public.mdas where code = '052101300100'), 0.00, 137514815.07, 137514815.07, 1377738828.70, 1515253643.77, 'Kano State Government 2025 Approved Budget (IBP verified, scaled to sector total)'),
  (2025, (select id from public.mdas where code = '052101400100'), 0.00, 658329549.38, 658329549.38, 875200413.91, 1533529963.29, 'Kano State Government 2025 Approved Budget (IBP verified, scaled to sector total)'),
  (2025, (select id from public.mdas where code = '052102000100'), 0.00, 3097180.52, 3097180.52, 0.00, 3097180.52, 'Kano State Government 2025 Approved Budget (IBP verified, scaled to sector total)'),
  (2025, (select id from public.mdas where code = '052103000100'), 0.00, 21060827.53, 21060827.53, 0.00, 21060827.53, 'Kano State Government 2025 Approved Budget (IBP verified, scaled to sector total)'),
  (2025, (select id from public.mdas where code = '052104000100'), 0.00, 43856076.16, 43856076.16, 529918107.54, 573774183.70, 'Kano State Government 2025 Approved Budget (IBP verified, scaled to sector total)')
on conflict (fiscal_year, mda_id) do update
set personnel_amount = excluded.personnel_amount,
    other_recurrent_amount = excluded.other_recurrent_amount,
    total_recurrent_amount = excluded.total_recurrent_amount,
    capital_amount = excluded.capital_amount,
    total_budget_amount = excluded.total_budget_amount,
    source_label = excluded.source_label,
    updated_at = now();

commit;
