-- Kano State 2026 Q1 Budget Implementation Report (BPR) actuals.
--
-- Source: "Kano State Government Budget Implementation Report Quarter Q1 2026"
-- (published April 2026). Health-sector MDAs only:
--   Table 5  — Personnel expenditure by administrative classification
--   Table 7  — Capital expenditure by administrative classification
--   Table 24 — Primary Healthcare capital expenditure by project (PHCMB)
--   Table 2  — Revenue (IGR) by administrative classification
-- Overhead expenditure was nil for all health MDAs in Q1 (Table 6).
--
-- Requires seeds 001 (reference data), 002 (budgets), 004 (demo users) and
-- 006 (PHCMB AOP) to be applied first. Replaces the fictional demo ledger
-- from 005 for FY 2026.
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
/* Remove the fictional demo ledger (005) so reports show only BPR figures  */
/* ----------------------------------------------------------------------- */

delete from public.expenditure_entries where voucher_ref_no like 'DEMO-%';
delete from public.funding_entries where reference_no like 'DEMO-%';

/* ----------------------------------------------------------------------- */
/* Funding entries                                                          */
/*                                                                          */
/* Treasury releases sized to the Q1 outturn per MDA, grouped by the same   */
/* programme area as the expenditure they finance (the funding-pool balance */
/* is keyed on mda + fiscal year + source + programme area), plus the       */
/* actual IGR receipts reported in Table 2.                                 */
/* ----------------------------------------------------------------------- */

with plan(mda_code, source_slug, pa_slug, tx_date, amount, ref_no, remark) as (
  values
    -- Ministry of Health (HQ) — monthly personnel releases + capital release
    ('052100100100', 'kano-state-govt-budget-release', 'admin-general-services',        '2026-01-26',   134108863.46, 'BPR26Q1-FND-HQ-001', 'January personnel cost release — Kano State 2026 Q1 BPR'),
    ('052100100100', 'kano-state-govt-budget-release', 'admin-general-services',        '2026-02-23',   134108863.46, 'BPR26Q1-FND-HQ-002', 'February personnel cost release — Kano State 2026 Q1 BPR'),
    ('052100100100', 'kano-state-govt-budget-release', 'admin-general-services',        '2026-03-24',   134108863.46, 'BPR26Q1-FND-HQ-003', 'March personnel cost release — Kano State 2026 Q1 BPR'),
    ('052100100100', 'kano-state-govt-budget-release', 'health-management-programmes',  '2026-03-18', 10667105284.17, 'BPR26Q1-FND-HQ-004', 'Q1 capital expenditure release — Kano State 2026 Q1 BPR, Table 7'),
    -- Hospital Management Board (HQ & Zones) — monthly personnel releases
    ('052100300100', 'kano-state-govt-budget-release', 'hospital-services',             '2026-01-26',  1970495481.33, 'BPR26Q1-FND-HMB-001', 'January personnel cost release — Kano State 2026 Q1 BPR'),
    ('052100300100', 'kano-state-govt-budget-release', 'hospital-services',             '2026-02-23',  1970495481.33, 'BPR26Q1-FND-HMB-002', 'February personnel cost release — Kano State 2026 Q1 BPR'),
    ('052100300100', 'kano-state-govt-budget-release', 'hospital-services',             '2026-03-24',  1970495481.33, 'BPR26Q1-FND-HMB-003', 'March personnel cost release — Kano State 2026 Q1 BPR'),
    -- PHCMB — monthly personnel releases
    ('052100500100', 'kano-state-govt-budget-release', 'admin-general-services',        '2026-01-26',    33328624.16, 'BPR26Q1-FND-PHC-001', 'January personnel cost release — Kano State 2026 Q1 BPR'),
    ('052100500100', 'kano-state-govt-budget-release', 'admin-general-services',        '2026-02-23',    33328624.16, 'BPR26Q1-FND-PHC-002', 'February personnel cost release — Kano State 2026 Q1 BPR'),
    ('052100500100', 'kano-state-govt-budget-release', 'admin-general-services',        '2026-03-24',    33328624.16, 'BPR26Q1-FND-PHC-003', 'March personnel cost release — Kano State 2026 Q1 BPR'),
    -- PHCMB — capital project releases (Table 24)
    ('052100500100', 'kano-state-govt-budget-release', 'admin-general-services',        '2026-02-12',   150678900.00, 'BPR26Q1-FND-PHC-004', 'Release: procurement of 10no. operational vehicles — Kano State 2026 Q1 BPR, Table 24'),
    ('052100500100', 'kano-state-govt-budget-release', 'admin-general-services',        '2026-03-09',   235670000.00, 'BPR26Q1-FND-PHC-005', 'Release: procurement of 4no. replacement operational vehicles — Kano State 2026 Q1 BPR, Table 24'),
    ('052100500100', 'kano-state-govt-budget-release', 'immunisation-vaccines',         '2026-02-06',   243500000.00, 'BPR26Q1-FND-PHC-006', 'Release: solarization of board HQ and cold stores — Kano State 2026 Q1 BPR, Table 24'),
    ('052100500100', 'kano-state-govt-budget-release', 'immunisation-vaccines',         '2026-03-16',  1078500000.00, 'BPR26Q1-FND-PHC-007', 'Release: routine immunization programme — Kano State 2026 Q1 BPR, Table 24'),
    ('052100500100', 'kano-state-govt-budget-release', 'community-health-services',     '2026-02-27',   234500000.00, 'BPR26Q1-FND-PHC-008', 'Release: renovation/maintenance of PHC facilities — Kano State 2026 Q1 BPR, Table 24'),
    ('052100500100', 'kano-state-govt-budget-release', 'community-health-services',     '2026-03-06',   756000000.00, 'BPR26Q1-FND-PHC-009', 'Release: Minimal Service Package (MSP) investment plan — Kano State 2026 Q1 BPR, Table 24'),
    ('052100500100', 'kano-state-govt-budget-release', 'community-health-services',     '2026-03-13',    62000000.00, 'BPR26Q1-FND-PHC-010', 'Release: medical field unit / mobile health services — Kano State 2026 Q1 BPR, Table 24'),
    ('052100500100', 'kano-state-govt-budget-release', 'planning-research-statistics',  '2026-02-20',    56600000.00, 'BPR26Q1-FND-PHC-011', 'Release: printing of data tools for routine inspection — Kano State 2026 Q1 BPR, Table 24'),
    ('052100500100', 'kano-state-govt-budget-release', 'health-management-programmes',  '2026-03-12',    56000000.00, 'BPR26Q1-FND-PHC-012', 'Release: coordination of PHC services/activities — Kano State 2026 Q1 BPR, Table 24'),
    ('052100500100', 'kano-state-govt-budget-release', 'health-emergency-preparedness-response', '2026-03-19', 254000000.00, 'BPR26Q1-FND-PHC-013', 'Release: coordination of public health emergency at LGA level — Kano State 2026 Q1 BPR, Table 24'),
    ('052100500100', 'kano-state-govt-budget-release', 'reproductive-maternal-newborn-child-health', '2026-03-20', 123000000.00, 'BPR26Q1-FND-PHC-014', 'Release: newborn resuscitation centres in 44 LGAs — Kano State 2026 Q1 BPR, Table 24'),
    -- IGR receipts (Table 2 — Total Revenue by Administrative Classification)
    ('052100300100', 'internally-generated-revenue-igr', 'hospital-services',           '2026-03-31',   278860038.37, 'BPR26Q1-FND-HMB-004', 'Q1 internally generated revenue — Kano State 2026 Q1 BPR, Table 2'),
    ('052100300200', 'internally-generated-revenue-igr', 'hospital-services',           '2026-03-31',    82848233.20, 'BPR26Q1-FND-MAW-001', 'Q1 internally generated revenue — Kano State 2026 Q1 BPR, Table 2'),
    ('052100400100', 'internally-generated-revenue-igr', 'nursing-services',            '2026-03-31',    14650000.00, 'BPR26Q1-FND-CNM-001', 'Q1 internally generated revenue — Kano State 2026 Q1 BPR, Table 2')
)
insert into public.funding_entries (
  transaction_date,
  mda_id,
  funding_source_id,
  programme_area_id,
  amount,
  reference_no,
  status,
  entered_by,
  approved_by,
  approved_at,
  remarks
)
select
  plan.tx_date::date,
  m.id,
  fs.id,
  pa.id,
  plan.amount,
  plan.ref_no,
  'processed',
  '00000000-0000-0000-0000-000000000002'::uuid,
  '00000000-0000-0000-0000-000000000003'::uuid,
  (plan.tx_date::date + 7)::timestamptz,
  plan.remark
from plan
join public.mdas m on m.code = plan.mda_code
join public.funding_sources fs on fs.slug = plan.source_slug
join public.programme_areas pa on pa.slug = plan.pa_slug
on conflict (fiscal_year, mda_id, reference_no) do nothing;

/* ----------------------------------------------------------------------- */
/* Migration guard: earlier versions of this seed inserted the five         */
/* statewide PHC capital projects as single board-level rows. They are now  */
/* attributed across the 44 LGAs below, so drop the old board-level rows if  */
/* a prior run created them (no-op on a fresh database).                     */
/* ----------------------------------------------------------------------- */

delete from public.expenditure_entries
where voucher_ref_no in (
  'BPR26Q1-EXP-PHC-104', 'BPR26Q1-EXP-PHC-105', 'BPR26Q1-EXP-PHC-109',
  'BPR26Q1-EXP-PHC-110', 'BPR26Q1-EXP-PHC-111'
);

/* ----------------------------------------------------------------------- */
/* Expenditure entries                                                      */
/*                                                                          */
/* Personnel (Table 5) split across the three monthly salary runs; capital  */
/* (Tables 7 and 24). Overhead was nil for all health MDAs in Q1 (Table 6). */
/*                                                                          */
/* PHCMB capital that is genuinely central (vehicles, HQ solarization, data */
/* tools, coordination) stays board-level (is_phc = false). The statewide / */
/* "across all 44 LGAs" projects are attributed to LGAs in the next section */
/* so they populate the facility-level PHC dashboard cards.                 */
/* ----------------------------------------------------------------------- */

with plan(mda_code, ec_slug, pa_slug, pm_slug, tx_date, amount, voucher, aop_code, remark) as (
  values
    -- Ministry of Health (HQ): personnel 402,326,590.38 (Q1, Table 5)
    ('052100100100', 'personnel-costs', 'admin-general-services', 'ippis', '2026-01-30',  134108863.46, 'BPR26Q1-EXP-HQ-001', null, 'January salaries — Kano State 2026 Q1 BPR, Table 5'),
    ('052100100100', 'personnel-costs', 'admin-general-services', 'ippis', '2026-02-27',  134108863.46, 'BPR26Q1-EXP-HQ-002', null, 'February salaries — Kano State 2026 Q1 BPR, Table 5'),
    ('052100100100', 'personnel-costs', 'admin-general-services', 'ippis', '2026-03-31',  134108863.46, 'BPR26Q1-EXP-HQ-003', null, 'March salaries — Kano State 2026 Q1 BPR, Table 5'),
    -- Ministry of Health (HQ): capital 10,667,105,284.17 (Q1, Table 7 — no project split published)
    ('052100100100', 'capital-expenditure', 'health-management-programmes', 'gifmis', '2026-03-25', 10667105284.17, 'BPR26Q1-EXP-HQ-004', null, 'Q1 capital expenditure — Kano State 2026 Q1 BPR, Table 7'),
    -- Hospital Management Board (HQ & Zones): personnel 5,911,486,443.99 (Q1, Table 5)
    ('052100300100', 'personnel-costs', 'hospital-services', 'ippis', '2026-01-30', 1970495481.33, 'BPR26Q1-EXP-HMB-001', null, 'January salaries — Kano State 2026 Q1 BPR, Table 5'),
    ('052100300100', 'personnel-costs', 'hospital-services', 'ippis', '2026-02-27', 1970495481.33, 'BPR26Q1-EXP-HMB-002', null, 'February salaries — Kano State 2026 Q1 BPR, Table 5'),
    ('052100300100', 'personnel-costs', 'hospital-services', 'ippis', '2026-03-31', 1970495481.33, 'BPR26Q1-EXP-HMB-003', null, 'March salaries — Kano State 2026 Q1 BPR, Table 5'),
    -- PHCMB: personnel 99,985,872.48 (Q1, Table 5)
    ('052100500100', 'personnel-costs', 'admin-general-services', 'ippis', '2026-01-30',   33328624.16, 'BPR26Q1-EXP-PHC-001', null, 'January salaries — Kano State 2026 Q1 BPR, Table 5'),
    ('052100500100', 'personnel-costs', 'admin-general-services', 'ippis', '2026-02-27',   33328624.16, 'BPR26Q1-EXP-PHC-002', null, 'February salaries — Kano State 2026 Q1 BPR, Table 5'),
    ('052100500100', 'personnel-costs', 'admin-general-services', 'ippis', '2026-03-31',   33328624.16, 'BPR26Q1-EXP-PHC-003', null, 'March salaries — Kano State 2026 Q1 BPR, Table 5'),
    -- PHCMB: central capital that stays board-level (804,448,900.00 of the
    -- 3,250,448,900.00 Q1 capital; the LGA-scoped remainder is in the next
    -- section). Table 24.
    ('052100500100', 'infrastructure-rehabilitation', 'immunisation-vaccines',        'gifmis', '2026-02-10',  243500000.00, 'BPR26Q1-EXP-PHC-101', null, 'Solarization of board HQ, state/zonal/LGA cold stores — Kano State 2026 Q1 BPR, Table 24'),
    ('052100500100', 'transport-logistics',           'admin-general-services',       'gifmis', '2026-02-17',  150678900.00, 'BPR26Q1-EXP-PHC-102', null, 'Procurement of 10no. operational vehicles (1no. per department) — Kano State 2026 Q1 BPR, Table 24'),
    ('052100500100', 'monitoring-evaluation',         'planning-research-statistics', 'gifmis', '2026-02-24',   56600000.00, 'BPR26Q1-EXP-PHC-103', null, 'Printing of data tools, ward & LGA summary for routine inspection — Kano State 2026 Q1 BPR, Table 24'),
    ('052100500100', 'transport-logistics',           'admin-general-services',       'gifmis', '2026-03-12',  235670000.00, 'BPR26Q1-EXP-PHC-106', null, 'Procurement of 4no. operational vehicles to replace aged ones — Kano State 2026 Q1 BPR, Table 24'),
    ('052100500100', 'monitoring-evaluation',         'health-management-programmes', 'gifmis', '2026-03-17',   56000000.00, 'BPR26Q1-EXP-PHC-107', null, 'Coordination of primary health care services/activities — Kano State 2026 Q1 BPR, Table 24'),
    ('052100500100', 'outreach-service-delivery',     'community-health-services',    'gifmis', '2026-03-18',   62000000.00, 'BPR26Q1-EXP-PHC-108', null, 'Medical field unit / integrated mobile health services — Kano State 2026 Q1 BPR, Table 24')
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
  status,
  entered_by,
  approved_by,
  approved_at,
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
  'processed',
  '00000000-0000-0000-0000-000000000002'::uuid,
  '00000000-0000-0000-0000-000000000003'::uuid,
  (plan.tx_date::date + 7)::timestamptz,
  plan.remark
from plan
join public.mdas m on m.code = plan.mda_code
join public.expenditure_categories ec on ec.slug = plan.ec_slug
join public.programme_areas pa on pa.slug = plan.pa_slug
join public.payment_methods pm on pm.slug = plan.pm_slug
on conflict (fiscal_year, mda_id, voucher_ref_no) do nothing;

/* ----------------------------------------------------------------------- */
/* PHC expenditure attributed to LGAs (Table 24, statewide projects)        */
/*                                                                          */
/* The BPR reports these projects only as board totals (no per-LGA split).  */
/* Because they are delivered "across all 44 LGAs" / statewide, each is      */
/* spread evenly over the 44 LGAs at one representative PHC facility, flagged */
/* is_phc = true, so the facility-level PHC dashboard cards populate. Each    */
/* project's per-LGA amounts sum back to its published total (kobo-exact:    */
/* the integer remainder is spread one kobo at a time over the first LGAs).  */
/* Programme areas are unchanged, so the funding pool stays balanced.        */
/* Total attributed here: 2,446,000,000.00.                                  */
/* ----------------------------------------------------------------------- */

with projects(proj, ec_slug, pa_slug, tx_date, total_amount, remark) as (
  values
    ('IMM', 'outreach-service-delivery',     'immunisation-vaccines',                      '2026-03-20', 1078500000.00, 'Routine immunization programme (per-LGA allocation) — Kano State 2026 Q1 BPR, Table 24'),
    ('MSP', 'infrastructure-rehabilitation', 'community-health-services',                   '2026-03-10',  756000000.00, 'Minimal Service Package (MSP) investment plan (per-LGA allocation) — Kano State 2026 Q1 BPR, Table 24'),
    ('EMG', 'outreach-service-delivery',     'health-emergency-preparedness-response',     '2026-03-24',  254000000.00, 'Coordination of public health emergency at LGA level (per-LGA allocation) — Kano State 2026 Q1 BPR, Table 24'),
    ('REN', 'infrastructure-rehabilitation', 'community-health-services',                   '2026-03-03',  234500000.00, 'Renovation/maintenance of PHC facilities (per-LGA allocation) — Kano State 2026 Q1 BPR, Table 24'),
    ('NBR', 'equipment-furniture',           'reproductive-maternal-newborn-child-health', '2026-03-26',  123000000.00, 'Newborn resuscitation centres in all 44 LGAs (per-LGA allocation) — Kano State 2026 Q1 BPR, Table 24')
),
lga_fac as (
  select distinct on (l.id) l.id as lga_id, l.name as lga_name, f.id as facility_id
  from public.lgas l
  join public.facilities f on f.lga_id = l.id and f.facility_type = 'phc'
  order by l.id, f.name
),
lga_pick as (
  select lga_id, lga_name, facility_id,
         row_number() over (order by lga_name) as rn,
         count(*) over () as n_lga
  from lga_fac
),
dist as (
  select
    p.proj, p.ec_slug, p.pa_slug, p.tx_date, p.remark,
    lp.lga_id, lp.facility_id, lp.rn,
    ( ((p.total_amount * 100)::bigint / lp.n_lga)
      + case when lp.rn <= ((p.total_amount * 100)::bigint % lp.n_lga) then 1 else 0 end
    )::numeric / 100 as lga_amount
  from projects p
  cross join lga_pick lp
)
insert into public.expenditure_entries (
  transaction_date, mda_id, expenditure_category_id, programme_area_id,
  is_phc, lga_id, facility_id, amount, voucher_ref_no, payment_method_id,
  status, entered_by, approved_by, approved_at, remarks
)
select
  d.tx_date::date,
  (select id from public.mdas where code = '052100500100'),
  ec.id, pa.id, true, d.lga_id, d.facility_id, d.lga_amount,
  'BPR26Q1-EXP-PHC-' || d.proj || '-' || lpad(d.rn::text, 2, '0'),
  pm.id, 'processed',
  '00000000-0000-0000-0000-000000000002'::uuid,
  '00000000-0000-0000-0000-000000000003'::uuid,
  (d.tx_date::date + 7)::timestamptz,
  d.remark
from dist d
join public.expenditure_categories ec on ec.slug = d.ec_slug
join public.programme_areas pa on pa.slug = d.pa_slug
join public.payment_methods pm on pm.slug = 'gifmis'
on conflict (fiscal_year, mda_id, voucher_ref_no) do nothing;

/* ----------------------------------------------------------------------- */
/* Funding allocations — every BPR expenditure entry is financed 100% by    */
/* the Kano State Govt Budget Release (matches the treasury releases above) */
/* ----------------------------------------------------------------------- */

insert into public.expenditure_funding_allocations (
  expenditure_entry_id,
  funding_source_id,
  amount
)
select
  ee.id,
  (select id from public.funding_sources where slug = 'kano-state-govt-budget-release'),
  ee.amount
from public.expenditure_entries ee
where ee.voucher_ref_no like 'BPR26Q1-EXP-%'
on conflict (expenditure_entry_id, funding_source_id) do nothing;

commit;
