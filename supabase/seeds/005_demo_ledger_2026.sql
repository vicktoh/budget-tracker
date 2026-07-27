-- Demo ledger data for FY 2026 (Q1 + Q2): funding and expenditure entries
-- that power the dashboards and the Budget Performance Report.
--
-- Requires seeds 001 (reference data), 002 (budgets), 003 (AOP), and
-- 004 (demo users) to be applied first.
--
-- Idempotent: rows are keyed on deterministic reference / voucher numbers
-- and inserted with `on conflict do nothing`, so re-running is safe.

begin;

do $$
begin
  if not exists (select 1 from public.mdas where code = '052100100100') then
    raise exception 'Reference data missing — apply supabase/seeds/001_reference_data.sql first.';
  end if;
  if not exists (
    select 1 from public.profiles
    where id in (
      '00000000-0000-0000-0000-000000000002',
      '00000000-0000-0000-0000-000000000003'
    )
  ) then
    raise exception 'Demo users missing — apply supabase/seeds/004_demo_users.sql first.';
  end if;
end $$;

/* ----------------------------------------------------------------------- */
/* Funding entries                                                          */
/* ----------------------------------------------------------------------- */

with plan(mda_code, source_slug, pa_slug, tx_date, amount, status, ref_no) as (
  values
    -- Ministry of Health (HQ) — budget 102.6B
    ('052100100100', 'kano-state-govt-budget-release', 'admin-general-services',                    '2026-01-20', 5500000000.00, 'processed', 'DEMO-FND-HQ-001'),
    ('052100100100', 'bhcpf-allocation',               'health-financing',                          '2026-02-12',  450000000.00, 'approved',  'DEMO-FND-HQ-002'),
    ('052100100100', 'donors-development-partners-funding', 'hiv-aids-tb-malaria',                  '2026-03-05',  800000000.00, 'approved',  'DEMO-FND-HQ-003'),
    ('052100100100', 'internally-generated-revenue-igr', 'admin-general-services',                  '2026-03-25',   60000000.00, 'rejected',  'DEMO-FND-HQ-004'),
    ('052100100100', 'kano-state-govt-budget-release', 'admin-general-services',                    '2026-04-18', 7200000000.00, 'processed', 'DEMO-FND-HQ-005'),
    ('052100100100', 'federal-government-grant',       'public-health-disease-control',             '2026-05-10',  600000000.00, 'approved',  'DEMO-FND-HQ-006'),
    ('052100100100', 'donors-development-partners-funding', 'immunisation-vaccines',                '2026-06-02',  950000000.00, 'approved',  'DEMO-FND-HQ-007'),
    ('052100100100', 'internally-generated-revenue-igr', 'admin-general-services',                  '2026-06-20',  120000000.00, 'pending',   'DEMO-FND-HQ-008'),
    -- Hospital Management Board — budget 68.1B
    ('052100300100', 'kano-state-govt-budget-release', 'hospital-services',                         '2026-01-25', 4800000000.00, 'processed', 'DEMO-FND-HMB-001'),
    ('052100300100', 'internally-generated-revenue-igr', 'hospital-services',                       '2026-02-20',  350000000.00, 'approved',  'DEMO-FND-HMB-002'),
    ('052100300100', 'donors-development-partners-funding', 'hospital-services',                    '2026-03-15',  150000000.00, 'rejected',  'DEMO-FND-HMB-003'),
    ('052100300100', 'kano-state-govt-budget-release', 'hospital-services',                         '2026-04-22', 6500000000.00, 'processed', 'DEMO-FND-HMB-004'),
    ('052100300100', 'nhia-nhis',                      'health-financing',                          '2026-05-15',  280000000.00, 'approved',  'DEMO-FND-HMB-005'),
    ('052100300100', 'internally-generated-revenue-igr', 'hospital-services',                       '2026-06-10',  410000000.00, 'processed', 'DEMO-FND-HMB-006'),
    -- MAWSH — budget 2.66B
    ('052100300200', 'kano-state-govt-budget-release', 'hospital-services',                         '2026-02-05',  180000000.00, 'processed', 'DEMO-FND-MAW-001'),
    ('052100300200', 'kano-state-govt-budget-release', 'hospital-services',                         '2026-05-06',  240000000.00, 'processed', 'DEMO-FND-MAW-002'),
    ('052100300200', 'internally-generated-revenue-igr', 'hospital-services',                       '2026-06-12',   45000000.00, 'approved',  'DEMO-FND-MAW-003'),
    -- PHCMB — budget 15.6B
    ('052100500100', 'kano-state-govt-budget-release', 'community-health-services',                 '2026-01-28',  950000000.00, 'processed', 'DEMO-FND-PHC-001'),
    ('052100500100', 'bhcpf-allocation',               'community-health-services',                 '2026-02-15',  520000000.00, 'processed', 'DEMO-FND-PHC-002'),
    ('052100500100', 'donors-development-partners-funding', 'immunisation-vaccines',                '2026-03-10',  300000000.00, 'approved',  'DEMO-FND-PHC-003'),
    ('052100500100', 'donors-development-partners-funding', 'community-health-services',            '2026-02-28',   80000000.00, 'rejected',  'DEMO-FND-PHC-004'),
    ('052100500100', 'kano-state-govt-budget-release', 'community-health-services',                 '2026-04-25', 1350000000.00, 'processed', 'DEMO-FND-PHC-005'),
    ('052100500100', 'bhcpf-allocation',               'community-health-services',                 '2026-05-20',  560000000.00, 'processed', 'DEMO-FND-PHC-006'),
    ('052100500100', 'donors-development-partners-funding', 'reproductive-maternal-newborn-child-health', '2026-06-08', 420000000.00, 'approved', 'DEMO-FND-PHC-007'),
    ('052100500100', 'lga-contribution',               'community-health-services',                 '2026-06-25',  150000000.00, 'pending',   'DEMO-FND-PHC-008'),
    -- KCHIMA — budget 8.76B
    ('052100800100', 'kano-state-govt-budget-release', 'health-financing',                          '2026-02-10',  420000000.00, 'processed', 'DEMO-FND-KCH-001'),
    ('052100800100', 'kano-state-govt-budget-release', 'health-financing',                          '2026-05-12',  610000000.00, 'processed', 'DEMO-FND-KCH-002'),
    ('052100800100', 'nhia-nhis',                      'health-financing',                          '2026-06-05',  180000000.00, 'approved',  'DEMO-FND-KCH-003'),
    -- KHETFUND — budget 7.39B
    ('052100900100', 'kano-state-govt-budget-release', 'physical-planning',                         '2026-02-18',  380000000.00, 'processed', 'DEMO-FND-KHT-001'),
    ('052100900100', 'kano-state-govt-budget-release', 'physical-planning',                         '2026-05-22',  520000000.00, 'processed', 'DEMO-FND-KHT-002'),
    ('052100900100', 'donors-development-partners-funding', 'physical-planning',                    '2026-06-15',  200000000.00, 'approved',  'DEMO-FND-KHT-003'),
    -- DMA — budget 3.06B
    ('052101300100', 'kano-state-govt-budget-release', 'drug-supply-management',                    '2026-01-30',  210000000.00, 'processed', 'DEMO-FND-DMA-001'),
    ('052101300100', 'kano-state-govt-budget-release', 'drug-supply-management',                    '2026-04-28',  320000000.00, 'processed', 'DEMO-FND-DMA-002'),
    ('052101300100', 'donors-development-partners-funding', 'drug-supply-management',               '2026-06-03',  140000000.00, 'approved',  'DEMO-FND-DMA-003'),
    -- KNCDC — budget 3.09B
    ('052101400100', 'kano-state-govt-budget-release', 'health-emergency-preparedness-response',    '2026-02-08',  150000000.00, 'processed', 'DEMO-FND-CDC-001'),
    ('052101400100', 'donors-development-partners-funding', 'disease-control',                      '2026-03-12',   90000000.00, 'approved',  'DEMO-FND-CDC-002'),
    ('052101400100', 'kano-state-govt-budget-release', 'health-emergency-preparedness-response',    '2026-05-08',  260000000.00, 'processed', 'DEMO-FND-CDC-003'),
    ('052101400100', 'federal-government-grant',       'public-health-disease-control',             '2026-06-18',  110000000.00, 'approved',  'DEMO-FND-CDC-004')
)
insert into public.funding_entries (
  transaction_date,
  mda_id,
  funding_source_id,
  programme_area_id,
  amount,
  reference_no,
  entered_by,
  remarks
)
select
  plan.tx_date::date,
  m.id,
  fs.id,
  pa.id,
  plan.amount,
  plan.ref_no,
  '00000000-0000-0000-0000-000000000002'::uuid,
  'Demo seed data'
from plan
join public.mdas m on m.code = plan.mda_code
join public.funding_sources fs on fs.slug = plan.source_slug
join public.programme_areas pa on pa.slug = plan.pa_slug
where plan.status <> 'rejected'
on conflict (fiscal_year, mda_id, reference_no) do nothing;

/* ----------------------------------------------------------------------- */
/* Expenditure entries (non-PHC)                                            */
/* ----------------------------------------------------------------------- */

with plan(mda_code, ec_slug, pa_slug, pm_slug, tx_date, amount, status, voucher, aop_code) as (
  values
    -- Ministry of Health (HQ)
    ('052100100100', 'personnel-costs',            'admin-general-services',                 'ippis',         '2026-01-31', 1650000000.00, 'processed', 'DEMO-EXP-HQ-001', null),
    ('052100100100', 'overhead-running-costs',     'admin-general-services',                 'bank-transfer', '2026-02-14',  420000000.00, 'processed', 'DEMO-EXP-HQ-002', null),
    ('052100100100', 'training-capacity-building', 'planning-research-statistics',           'bank-transfer', '2026-02-26',    9800000.00, 'approved',  'DEMO-EXP-HQ-003', '1.1.1.1.1'),
    ('052100100100', 'monitoring-evaluation',      'health-management-programmes',           'bank-transfer', '2026-03-08',   10200000.00, 'approved',  'DEMO-EXP-HQ-004', '1.4.4.1.1'),
    ('052100100100', 'transport-logistics',        'admin-general-services',                 'bank-transfer', '2026-03-15',   85000000.00, 'approved',  'DEMO-EXP-HQ-005', null),
    ('052100100100', 'drugs-medical-supplies',     'hiv-aids-tb-malaria',                    'bank-transfer', '2026-03-28',  380000000.00, 'processed', 'DEMO-EXP-HQ-006', null),
    ('052100100100', 'personnel-costs',            'admin-general-services',                 'ippis',         '2026-04-30', 1680000000.00, 'processed', 'DEMO-EXP-HQ-007', null),
    ('052100100100', 'overhead-running-costs',     'admin-general-services',                 'bank-transfer', '2026-05-09',  510000000.00, 'processed', 'DEMO-EXP-HQ-008', null),
    ('052100100100', 'training-capacity-building', 'health-management-programmes',           'bank-transfer', '2026-05-18',    5400000.00, 'approved',  'DEMO-EXP-HQ-009', '1.2.2.1.5'),
    ('052100100100', 'capital-expenditure',        'physical-planning',                      'gifmis',        '2026-05-27', 2400000000.00, 'processed', 'DEMO-EXP-HQ-010', null),
    ('052100100100', 'outreach-service-delivery',  'immunisation-vaccines',                  'bank-transfer', '2026-06-06',  310000000.00, 'approved',  'DEMO-EXP-HQ-011', null),
    ('052100100100', 'monitoring-evaluation',      'planning-research-statistics',           'bank-transfer', '2026-06-14',   12000000.00, 'approved',  'DEMO-EXP-HQ-012', '1.4.4.2.4'),
    ('052100100100', 'equipment-furniture',        'admin-general-services',                 'bank-transfer', '2026-06-21',  175000000.00, 'pending',   'DEMO-EXP-HQ-013', null),
    ('052100100100', 'transport-logistics',        'admin-general-services',                 'cheque',        '2026-06-26',   65000000.00, 'rejected',  'DEMO-EXP-HQ-014', null),
    -- Hospital Management Board
    ('052100300100', 'personnel-costs',            'human-resource-for-health',              'ippis',         '2026-01-31', 2900000000.00, 'processed', 'DEMO-EXP-HMB-001', null),
    ('052100300100', 'drugs-medical-supplies',     'hospital-services',                      'bank-transfer', '2026-02-22',  450000000.00, 'processed', 'DEMO-EXP-HMB-002', null),
    ('052100300100', 'overhead-running-costs',     'hospital-services',                      'bank-transfer', '2026-03-05',  380000000.00, 'approved',  'DEMO-EXP-HMB-003', null),
    ('052100300100', 'equipment-furniture',        'hospital-services',                      'bank-transfer', '2026-03-20',  220000000.00, 'approved',  'DEMO-EXP-HMB-004', null),
    ('052100300100', 'personnel-costs',            'human-resource-for-health',              'ippis',         '2026-04-30', 2950000000.00, 'processed', 'DEMO-EXP-HMB-005', null),
    ('052100300100', 'drugs-medical-supplies',     'hospital-services',                      'bank-transfer', '2026-05-16',  610000000.00, 'processed', 'DEMO-EXP-HMB-006', null),
    ('052100300100', 'infrastructure-rehabilitation', 'hospital-services',                   'gifmis',        '2026-05-30',  850000000.00, 'approved',  'DEMO-EXP-HMB-007', null),
    ('052100300100', 'overhead-running-costs',     'hospital-services',                      'bank-transfer', '2026-06-11',  410000000.00, 'processed', 'DEMO-EXP-HMB-008', null),
    ('052100300100', 'training-capacity-building', 'human-resource-for-health',              'bank-transfer', '2026-06-24',   45000000.00, 'pending',   'DEMO-EXP-HMB-009', null),
    -- MAWSH
    ('052100300200', 'overhead-running-costs',     'hospital-services',                      'bank-transfer', '2026-02-12',   65000000.00, 'processed', 'DEMO-EXP-MAW-001', null),
    ('052100300200', 'drugs-medical-supplies',     'hospital-services',                      'bank-transfer', '2026-03-02',   48000000.00, 'approved',  'DEMO-EXP-MAW-002', null),
    ('052100300200', 'overhead-running-costs',     'hospital-services',                      'bank-transfer', '2026-05-14',   78000000.00, 'processed', 'DEMO-EXP-MAW-003', null),
    ('052100300200', 'equipment-furniture',        'hospital-services',                      'bank-transfer', '2026-06-04',   95000000.00, 'approved',  'DEMO-EXP-MAW-004', null),
    ('052100300200', 'drugs-medical-supplies',     'hospital-services',                      'bank-transfer', '2026-06-17',   52000000.00, 'processed', 'DEMO-EXP-MAW-005', null),
    -- PHCMB (non-PHC overheads)
    ('052100500100', 'personnel-costs',            'community-health-services',              'ippis',         '2026-01-31',  620000000.00, 'processed', 'DEMO-EXP-PHC-001', null),
    ('052100500100', 'overhead-running-costs',     'community-health-services',              'bank-transfer', '2026-04-29',  130000000.00, 'processed', 'DEMO-EXP-PHC-002', null),
    -- KCHIMA
    ('052100800100', 'overhead-running-costs',     'health-financing',                       'bank-transfer', '2026-03-06',   85000000.00, 'processed', 'DEMO-EXP-KCH-001', null),
    ('052100800100', 'monitoring-evaluation',      'health-financing',                       'bank-transfer', '2026-03-26',   22000000.00, 'approved',  'DEMO-EXP-KCH-002', null),
    ('052100800100', 'overhead-running-costs',     'health-financing',                       'bank-transfer', '2026-05-21',   96000000.00, 'processed', 'DEMO-EXP-KCH-003', null),
    ('052100800100', 'training-capacity-building', 'health-financing',                       'bank-transfer', '2026-06-13',   18500000.00, 'approved',  'DEMO-EXP-KCH-004', null),
    -- KHETFUND
    ('052100900100', 'infrastructure-rehabilitation', 'physical-planning',                   'gifmis',        '2026-03-14',  210000000.00, 'processed', 'DEMO-EXP-KHT-001', null),
    ('052100900100', 'equipment-furniture',        'physical-planning',                      'bank-transfer', '2026-04-21',   88000000.00, 'approved',  'DEMO-EXP-KHT-002', null),
    ('052100900100', 'infrastructure-rehabilitation', 'physical-planning',                   'gifmis',        '2026-06-07',  260000000.00, 'processed', 'DEMO-EXP-KHT-003', null),
    -- DMA
    ('052101300100', 'drugs-medical-supplies',     'drug-supply-management',                 'bank-transfer', '2026-02-25',  145000000.00, 'processed', 'DEMO-EXP-DMA-001', null),
    ('052101300100', 'transport-logistics',        'drug-supply-management',                 'bank-transfer', '2026-03-18',   28000000.00, 'approved',  'DEMO-EXP-DMA-002', null),
    ('052101300100', 'drugs-medical-supplies',     'drug-supply-management',                 'bank-transfer', '2026-05-23',  195000000.00, 'processed', 'DEMO-EXP-DMA-003', null),
    ('052101300100', 'overhead-running-costs',     'drug-supply-management',                 'bank-transfer', '2026-06-16',   33500000.00, 'approved',  'DEMO-EXP-DMA-004', null),
    -- KNCDC
    ('052101400100', 'outreach-service-delivery',  'disease-control',                        'bank-transfer', '2026-03-09',   62000000.00, 'processed', 'DEMO-EXP-CDC-001', null),
    ('052101400100', 'training-capacity-building', 'health-emergency-preparedness-response', 'bank-transfer', '2026-03-24',   24500000.00, 'approved',  'DEMO-EXP-CDC-002', null),
    ('052101400100', 'monitoring-evaluation',      'public-health-disease-control',          'bank-transfer', '2026-05-26',   19800000.00, 'approved',  'DEMO-EXP-CDC-003', null),
    ('052101400100', 'outreach-service-delivery',  'disease-control',                        'bank-transfer', '2026-06-12',   88000000.00, 'processed', 'DEMO-EXP-CDC-004', null)
)
insert into public.expenditure_entries (
  transaction_date,
  mda_id,
  expenditure_category_id,
  programme_area_id,
  aop_activity_id,
  is_phc,
  amount,
  voucher_ref_no,
  payment_method_id,
  entered_by,
  remarks
)
select
  plan.tx_date::date,
  m.id,
  ec.id,
  pa.id,
  case when plan.aop_code is not null then (
    select a.id from public.aop_activities a
    where a.mda_id = m.id and a.fiscal_year = 2026 and a.activity_code = plan.aop_code
    order by a.source_row_number
    limit 1
  ) end,
  false,
  plan.amount,
  plan.voucher,
  pm.id,
  '00000000-0000-0000-0000-000000000002'::uuid,
  'Demo seed data'
from plan
join public.mdas m on m.code = plan.mda_code
join public.expenditure_categories ec on ec.slug = plan.ec_slug
join public.programme_areas pa on pa.slug = plan.pa_slug
join public.payment_methods pm on pm.slug = plan.pm_slug
where plan.status <> 'rejected'
on conflict (fiscal_year, mda_id, voucher_ref_no) do nothing;

/* ----------------------------------------------------------------------- */
/* Expenditure entries (PHC, all PHCMB)                                     */
/* ----------------------------------------------------------------------- */

with plan(ec_slug, pa_slug, tx_date, amount, status, voucher, lga_name, facility_name) as (
  values
    -- Q1
    ('drugs-medical-supplies',        'community-health-services',                  '2026-02-06', 42000000.00, 'processed', 'DEMO-EXP-PHC-101', 'Kano Municipal', 'Gandu Primary Health Centre'),
    ('outreach-service-delivery',     'immunisation-vaccines',                      '2026-02-18', 28500000.00, 'approved',  'DEMO-EXP-PHC-102', 'Dala',           'Kurna Primary Health Centre'),
    ('drugs-medical-supplies',        'community-health-services',                  '2026-03-04', 31200000.00, 'processed', 'DEMO-EXP-PHC-103', 'Fagge',          'Wapa Primary Health Centre'),
    ('infrastructure-rehabilitation', 'community-health-services',                  '2026-03-12', 55000000.00, 'approved',  'DEMO-EXP-PHC-104', 'Nasarawa',       'Gama Health Clinic'),
    ('equipment-furniture',           'community-health-services',                  '2026-03-21', 24800000.00, 'processed', 'DEMO-EXP-PHC-105', 'Ungogo',         'Ungogo Primary Health Centre'),
    ('outreach-service-delivery',     'reproductive-maternal-newborn-child-health', '2026-03-27', 18400000.00, 'approved',  'DEMO-EXP-PHC-106', 'Tarauni',        'Tarauni Primary Health Centre'),
    -- Q2
    ('drugs-medical-supplies',        'community-health-services',                  '2026-04-15', 47500000.00, 'processed', 'DEMO-EXP-PHC-107', 'Kano Municipal', 'Sharada Primary Health Centre'),
    ('outreach-service-delivery',     'immunisation-vaccines',                      '2026-04-24', 33000000.00, 'approved',  'DEMO-EXP-PHC-108', 'Gwale',          'Kabuga Primary Health Centre'),
    ('infrastructure-rehabilitation', 'community-health-services',                  '2026-05-08', 72000000.00, 'approved',  'DEMO-EXP-PHC-109', 'Bichi',          'Badume Primary Health Centre'),
    ('drugs-medical-supplies',        'community-health-services',                  '2026-05-19', 29600000.00, 'processed', 'DEMO-EXP-PHC-110', 'Wudil',          'Utai Primary Health Centre'),
    ('equipment-furniture',           'community-health-services',                  '2026-05-28', 21300000.00, 'approved',  'DEMO-EXP-PHC-111', 'Gaya',           'Kademi Primary Health Centre'),
    ('outreach-service-delivery',     'reproductive-maternal-newborn-child-health', '2026-06-09', 19800000.00, 'processed', 'DEMO-EXP-PHC-112', 'Bunkure',        'Bono Primary Health Centre'),
    ('training-capacity-building',    'community-health-services',                  '2026-06-19', 12500000.00, 'pending',   'DEMO-EXP-PHC-113', 'Dala',           'Kurna Primary Health Centre'),
    ('drugs-medical-supplies',        'community-health-services',                  '2026-06-23', 16400000.00, 'rejected',  'DEMO-EXP-PHC-114', 'Fagge',          'Wapa Primary Health Centre')
)
insert into public.expenditure_entries (
  transaction_date,
  mda_id,
  expenditure_category_id,
  programme_area_id,
  is_phc,
  lga_id,
  facility_id,
  amount,
  voucher_ref_no,
  payment_method_id,
  entered_by,
  remarks
)
select
  plan.tx_date::date,
  m.id,
  ec.id,
  pa.id,
  true,
  l.id,
  f.id,
  plan.amount,
  plan.voucher,
  pm.id,
  '00000000-0000-0000-0000-000000000002'::uuid,
  'Demo seed data'
from plan
join public.mdas m on m.code = '052100500100'
join public.expenditure_categories ec on ec.slug = plan.ec_slug
join public.programme_areas pa on pa.slug = plan.pa_slug
join public.payment_methods pm on pm.slug = 'bank-transfer'
join public.lgas l on l.name = plan.lga_name
join public.facilities f on f.lga_id = l.id and f.name = plan.facility_name
where plan.status <> 'rejected'
on conflict (fiscal_year, mda_id, voucher_ref_no) do nothing;

commit;
