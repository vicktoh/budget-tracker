-- Kano State FY2025 health-sector actuals & budgets.
--
-- Source: "Kano Health Numbers" (International Budget Partnership, Q1 2026),
-- "The Full Picture — All Verified Figures" table, verified against the 2025
-- final BIR. Seeded so year-over-year comparisons in the reports hub have a
-- real FY2025 baseline.
--
-- Anchor-faithful modelling: sector economic-class actuals and PHCMB detail
-- (incl. the Q4 capital spike = 87% of annual) reproduce the published figures
-- exactly; per-MDA approved budgets are scaled from each MDA's 2026 share so the
-- health-sector total hits the published ~N109.8bn (PHCMB pinned to its +35%
-- anchor). Actuals are concentrated on the three MDAs the report details
-- (Ministry of Health HQ, HMB, PHCMB); other MDAs receive budgets only —
-- matching how FY2026 is seeded.
--
-- Requires seeds 001, 002, 004. Idempotent via KH25-* keys + on conflict.

begin;

do $$
begin
  if not exists (select 1 from public.mdas where code = '052100100100') then
    raise exception 'Reference data missing — apply supabase/seeds/001_reference_data.sql first.';
  end if;
end $$;

-- Migration-safe re-run
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

/* -------------------- Funding entries (FY2025 budget releases) -------------------- */
with plan(mda_code, pa_slug, tx_date, amount, ref_no, remark) as (
  values
    ('052100100100', 'admin-general-services', '2025-02-25', 1133291092.25, 'KH25-FND-MOH-001', 'FY2025 budget release for MoH personnel Q1 — Kano Health Numbers (IBP)'),
    ('052100100100', 'admin-general-services', '2025-05-27', 1133291092.25, 'KH25-FND-MOH-002', 'FY2025 budget release for MoH personnel Q2 — Kano Health Numbers (IBP)'),
    ('052100100100', 'admin-general-services', '2025-08-26', 1133291092.25, 'KH25-FND-MOH-003', 'FY2025 budget release for MoH personnel Q3 — Kano Health Numbers (IBP)'),
    ('052100100100', 'admin-general-services', '2025-11-25', 1133291092.25, 'KH25-FND-MOH-004', 'FY2025 budget release for MoH personnel Q4 — Kano Health Numbers (IBP)'),
    ('052100100100', 'admin-general-services', '2025-02-25', 265302202.25, 'KH25-FND-MOH-005', 'FY2025 budget release for MoH overhead Q1 — Kano Health Numbers (IBP)'),
    ('052100100100', 'admin-general-services', '2025-05-27', 265302202.25, 'KH25-FND-MOH-006', 'FY2025 budget release for MoH overhead Q2 — Kano Health Numbers (IBP)'),
    ('052100100100', 'admin-general-services', '2025-08-26', 265302202.25, 'KH25-FND-MOH-007', 'FY2025 budget release for MoH overhead Q3 — Kano Health Numbers (IBP)'),
    ('052100100100', 'admin-general-services', '2025-11-25', 265302202.25, 'KH25-FND-MOH-008', 'FY2025 budget release for MoH overhead Q4 — Kano Health Numbers (IBP)'),
    ('052100100100', 'health-management-programmes', '2025-02-25', 1960880393.31, 'KH25-FND-MOH-009', 'FY2025 budget release for MoH capital Q1 — Kano Health Numbers (IBP)'),
    ('052100100100', 'health-management-programmes', '2025-05-27', 3921760786.62, 'KH25-FND-MOH-010', 'FY2025 budget release for MoH capital Q2 — Kano Health Numbers (IBP)'),
    ('052100100100', 'health-management-programmes', '2025-08-26', 5882641179.93, 'KH25-FND-MOH-011', 'FY2025 budget release for MoH capital Q3 — Kano Health Numbers (IBP)'),
    ('052100100100', 'health-management-programmes', '2025-11-25', 16667483343.14, 'KH25-FND-MOH-012', 'FY2025 budget release for MoH capital Q4 — Kano Health Numbers (IBP)'),
    ('052100300100', 'hospital-services', '2025-02-25', 5250000000.00, 'KH25-FND-HMB-013', 'FY2025 budget release for HMB personnel Q1 — Kano Health Numbers (IBP)'),
    ('052100300100', 'hospital-services', '2025-05-27', 5250000000.00, 'KH25-FND-HMB-014', 'FY2025 budget release for HMB personnel Q2 — Kano Health Numbers (IBP)'),
    ('052100300100', 'hospital-services', '2025-08-26', 5250000000.00, 'KH25-FND-HMB-015', 'FY2025 budget release for HMB personnel Q3 — Kano Health Numbers (IBP)'),
    ('052100300100', 'hospital-services', '2025-11-25', 5250000000.00, 'KH25-FND-HMB-016', 'FY2025 budget release for HMB personnel Q4 — Kano Health Numbers (IBP)'),
    ('052100300100', 'hospital-services', '2025-02-25', 26096250.00, 'KH25-FND-HMB-017', 'FY2025 budget release for HMB overhead Q1 — Kano Health Numbers (IBP)'),
    ('052100300100', 'hospital-services', '2025-05-27', 26096250.00, 'KH25-FND-HMB-018', 'FY2025 budget release for HMB overhead Q2 — Kano Health Numbers (IBP)'),
    ('052100300100', 'hospital-services', '2025-08-26', 26096250.00, 'KH25-FND-HMB-019', 'FY2025 budget release for HMB overhead Q3 — Kano Health Numbers (IBP)'),
    ('052100300100', 'hospital-services', '2025-11-25', 26096250.00, 'KH25-FND-HMB-020', 'FY2025 budget release for HMB overhead Q4 — Kano Health Numbers (IBP)'),
    ('052100500100', 'community-health-services', '2025-02-25', 1500000.00, 'KH25-FND-PHC-021', 'FY2025 budget release for PHCMB overhead Q1 — Kano Health Numbers (IBP)'),
    ('052100500100', 'community-health-services', '2025-05-27', 1500000.00, 'KH25-FND-PHC-022', 'FY2025 budget release for PHCMB overhead Q2 — Kano Health Numbers (IBP)'),
    ('052100500100', 'community-health-services', '2025-08-26', 1500000.00, 'KH25-FND-PHC-023', 'FY2025 budget release for PHCMB overhead Q3 — Kano Health Numbers (IBP)'),
    ('052100500100', 'community-health-services', '2025-11-25', 1500000.00, 'KH25-FND-PHC-024', 'FY2025 budget release for PHCMB overhead Q4 — Kano Health Numbers (IBP)'),
    ('052100500100', 'admin-general-services', '2025-05-27', 541838.00, 'KH25-FND-PHC-025', 'FY2025 budget release for PHCMB personnel — Kano Health Numbers (IBP)'),
    ('052100500100', 'community-health-services', '2025-02-25', 340851722.00, 'KH25-FND-PHC-026', 'FY2025 budget release for PHCMB capital Q1 — Kano Health Numbers (IBP)'),
    ('052100500100', 'community-health-services', '2025-05-27', 340851722.00, 'KH25-FND-PHC-027', 'FY2025 budget release for PHCMB capital Q2 — Kano Health Numbers (IBP)'),
    ('052100500100', 'community-health-services', '2025-08-26', 340851722.00, 'KH25-FND-PHC-028', 'FY2025 budget release for PHCMB capital Q3 — Kano Health Numbers (IBP)'),
    ('052100500100', 'community-health-services', '2025-11-25', 6899619163.00, 'KH25-FND-PHC-029', 'FY2025 budget release for PHCMB capital Q4 (Q4 spike, 87% of annual) — Kano Health Numbers (IBP)')
)
insert into public.funding_entries (
  transaction_date, mda_id, funding_source_id, programme_area_id, amount,
  reference_no, status, entered_by, approved_by, approved_at, remarks
)
select plan.tx_date::date, m.id,
  (select id from public.funding_sources where slug = 'kano-state-govt-budget-release'),
  pa.id, plan.amount, plan.ref_no, 'processed',
  '00000000-0000-0000-0000-000000000002'::uuid,
  '00000000-0000-0000-0000-000000000003'::uuid,
  (plan.tx_date::date + 7)::timestamptz, plan.remark
from plan
join public.mdas m on m.code = plan.mda_code
join public.programme_areas pa on pa.slug = plan.pa_slug
on conflict (fiscal_year, mda_id, reference_no) do nothing;

/* -------------------- Expenditure entries (FY2025 actuals) -------------------- */
with plan(mda_code, ec_slug, pa_slug, pm_slug, tx_date, amount, voucher, remark) as (
  values
    ('052100100100', 'personnel-costs', 'admin-general-services', 'gifmis', '2025-02-25', 1133291092.25, 'KH25-EXP-MOH-001', 'FY2025 MoH personnel Q1 — Kano Health Numbers (IBP), All Verified Figures'),
    ('052100100100', 'personnel-costs', 'admin-general-services', 'gifmis', '2025-05-27', 1133291092.25, 'KH25-EXP-MOH-002', 'FY2025 MoH personnel Q2 — Kano Health Numbers (IBP), All Verified Figures'),
    ('052100100100', 'personnel-costs', 'admin-general-services', 'gifmis', '2025-08-26', 1133291092.25, 'KH25-EXP-MOH-003', 'FY2025 MoH personnel Q3 — Kano Health Numbers (IBP), All Verified Figures'),
    ('052100100100', 'personnel-costs', 'admin-general-services', 'gifmis', '2025-11-25', 1133291092.25, 'KH25-EXP-MOH-004', 'FY2025 MoH personnel Q4 — Kano Health Numbers (IBP), All Verified Figures'),
    ('052100100100', 'overhead-running-costs', 'admin-general-services', 'gifmis', '2025-02-25', 265302202.25, 'KH25-EXP-MOH-005', 'FY2025 MoH overhead Q1 — Kano Health Numbers (IBP), All Verified Figures'),
    ('052100100100', 'overhead-running-costs', 'admin-general-services', 'gifmis', '2025-05-27', 265302202.25, 'KH25-EXP-MOH-006', 'FY2025 MoH overhead Q2 — Kano Health Numbers (IBP), All Verified Figures'),
    ('052100100100', 'overhead-running-costs', 'admin-general-services', 'gifmis', '2025-08-26', 265302202.25, 'KH25-EXP-MOH-007', 'FY2025 MoH overhead Q3 — Kano Health Numbers (IBP), All Verified Figures'),
    ('052100100100', 'overhead-running-costs', 'admin-general-services', 'gifmis', '2025-11-25', 265302202.25, 'KH25-EXP-MOH-008', 'FY2025 MoH overhead Q4 — Kano Health Numbers (IBP), All Verified Figures'),
    ('052100100100', 'capital-expenditure', 'health-management-programmes', 'gifmis', '2025-02-25', 1960880393.31, 'KH25-EXP-MOH-009', 'FY2025 MoH capital Q1 — Kano Health Numbers (IBP), All Verified Figures'),
    ('052100100100', 'capital-expenditure', 'health-management-programmes', 'gifmis', '2025-05-27', 3921760786.62, 'KH25-EXP-MOH-010', 'FY2025 MoH capital Q2 — Kano Health Numbers (IBP), All Verified Figures'),
    ('052100100100', 'capital-expenditure', 'health-management-programmes', 'gifmis', '2025-08-26', 5882641179.93, 'KH25-EXP-MOH-011', 'FY2025 MoH capital Q3 — Kano Health Numbers (IBP), All Verified Figures'),
    ('052100100100', 'capital-expenditure', 'health-management-programmes', 'gifmis', '2025-11-25', 16667483343.14, 'KH25-EXP-MOH-012', 'FY2025 MoH capital Q4 — Kano Health Numbers (IBP), All Verified Figures'),
    ('052100300100', 'personnel-costs', 'hospital-services', 'gifmis', '2025-02-25', 5250000000.00, 'KH25-EXP-HMB-013', 'FY2025 HMB personnel Q1 — Kano Health Numbers (IBP), All Verified Figures'),
    ('052100300100', 'personnel-costs', 'hospital-services', 'gifmis', '2025-05-27', 5250000000.00, 'KH25-EXP-HMB-014', 'FY2025 HMB personnel Q2 — Kano Health Numbers (IBP), All Verified Figures'),
    ('052100300100', 'personnel-costs', 'hospital-services', 'gifmis', '2025-08-26', 5250000000.00, 'KH25-EXP-HMB-015', 'FY2025 HMB personnel Q3 — Kano Health Numbers (IBP), All Verified Figures'),
    ('052100300100', 'personnel-costs', 'hospital-services', 'gifmis', '2025-11-25', 5250000000.00, 'KH25-EXP-HMB-016', 'FY2025 HMB personnel Q4 — Kano Health Numbers (IBP), All Verified Figures'),
    ('052100300100', 'overhead-running-costs', 'hospital-services', 'gifmis', '2025-02-25', 26096250.00, 'KH25-EXP-HMB-017', 'FY2025 HMB overhead Q1 — Kano Health Numbers (IBP), All Verified Figures'),
    ('052100300100', 'overhead-running-costs', 'hospital-services', 'gifmis', '2025-05-27', 26096250.00, 'KH25-EXP-HMB-018', 'FY2025 HMB overhead Q2 — Kano Health Numbers (IBP), All Verified Figures'),
    ('052100300100', 'overhead-running-costs', 'hospital-services', 'gifmis', '2025-08-26', 26096250.00, 'KH25-EXP-HMB-019', 'FY2025 HMB overhead Q3 — Kano Health Numbers (IBP), All Verified Figures'),
    ('052100300100', 'overhead-running-costs', 'hospital-services', 'gifmis', '2025-11-25', 26096250.00, 'KH25-EXP-HMB-020', 'FY2025 HMB overhead Q4 — Kano Health Numbers (IBP), All Verified Figures'),
    ('052100500100', 'overhead-running-costs', 'community-health-services', 'gifmis', '2025-02-25', 1500000.00, 'KH25-EXP-PHC-021', 'FY2025 PHCMB overhead Q1 — Kano Health Numbers (IBP), All Verified Figures'),
    ('052100500100', 'overhead-running-costs', 'community-health-services', 'gifmis', '2025-05-27', 1500000.00, 'KH25-EXP-PHC-022', 'FY2025 PHCMB overhead Q2 — Kano Health Numbers (IBP), All Verified Figures'),
    ('052100500100', 'overhead-running-costs', 'community-health-services', 'gifmis', '2025-08-26', 1500000.00, 'KH25-EXP-PHC-023', 'FY2025 PHCMB overhead Q3 — Kano Health Numbers (IBP), All Verified Figures'),
    ('052100500100', 'overhead-running-costs', 'community-health-services', 'gifmis', '2025-11-25', 1500000.00, 'KH25-EXP-PHC-024', 'FY2025 PHCMB overhead Q4 — Kano Health Numbers (IBP), All Verified Figures'),
    ('052100500100', 'personnel-costs', 'admin-general-services', 'gifmis', '2025-05-27', 541838.00, 'KH25-EXP-PHC-025', 'FY2025 PHCMB personnel — Kano Health Numbers (IBP), All Verified Figures'),
    ('052100500100', 'capital-expenditure', 'community-health-services', 'gifmis', '2025-02-25', 340851722.00, 'KH25-EXP-PHC-026', 'FY2025 PHCMB capital Q1 — Kano Health Numbers (IBP), All Verified Figures'),
    ('052100500100', 'capital-expenditure', 'community-health-services', 'gifmis', '2025-05-27', 340851722.00, 'KH25-EXP-PHC-027', 'FY2025 PHCMB capital Q2 — Kano Health Numbers (IBP), All Verified Figures'),
    ('052100500100', 'capital-expenditure', 'community-health-services', 'gifmis', '2025-08-26', 340851722.00, 'KH25-EXP-PHC-028', 'FY2025 PHCMB capital Q3 — Kano Health Numbers (IBP), All Verified Figures'),
    ('052100500100', 'capital-expenditure', 'community-health-services', 'gifmis', '2025-11-25', 6899619163.00, 'KH25-EXP-PHC-029', 'FY2025 PHCMB capital Q4 (Q4 spike, 87% of annual) — Kano Health Numbers (IBP), All Verified Figures')
)
insert into public.expenditure_entries (
  transaction_date, mda_id, expenditure_category_id, programme_area_id,
  is_phc, amount, voucher_ref_no, payment_method_id,
  status, entered_by, approved_by, approved_at, remarks
)
select plan.tx_date::date, m.id, ec.id, pa.id, false, plan.amount, plan.voucher, pm.id, 'processed',
  '00000000-0000-0000-0000-000000000002'::uuid,
  '00000000-0000-0000-0000-000000000003'::uuid,
  (plan.tx_date::date + 7)::timestamptz, plan.remark
from plan
join public.mdas m on m.code = plan.mda_code
join public.expenditure_categories ec on ec.slug = plan.ec_slug
join public.programme_areas pa on pa.slug = plan.pa_slug
join public.payment_methods pm on pm.slug = plan.pm_slug
on conflict (fiscal_year, mda_id, voucher_ref_no) do nothing;

/* -------------------- Funding allocations (100% budget release) -------------------- */
insert into public.expenditure_funding_allocations (expenditure_entry_id, funding_source_id, amount)
select ee.id,
  (select id from public.funding_sources where slug = 'kano-state-govt-budget-release'),
  ee.amount
from public.expenditure_entries ee
where ee.voucher_ref_no like 'KH25-EXP-%'
on conflict (expenditure_entry_id, funding_source_id) do nothing;

commit;
