-- Kano State 2026 Q2 Budget Implementation Report (BPR) actuals.
--
-- Source: "Q2 2026 UPDATED BPR.xlsx" (state-wide BPR workbook, Calibration
-- sheet: Kano / 2026 / Q2 / reporting against Original Budget). Health-sector
-- MDAs only (administrative codes 0521*), drawn from worksheets:
--   1. Rec Revenue      -> budget_line_revenues (stream 'recurrent')
--   2. Personnel        -> expenditure_entries (Personnel Costs)
--   3. Overhead         -> expenditure_entries (Overhead / Running Costs)
--   4. Capital          -> expenditure_entries (Capital Expenditure)
--   5. Capital Receipts -> budget_line_revenues (stream 'capital_receipt')
--
-- Requires seeds 001, 002, 004 and 010 (budget lines) to be applied first, plus
-- migration 20260721090000_budget_line_revenues.sql.
--
-- Reporting basis is the ORIGINAL budget, so the workbook's 2,661,500,000 of
-- Q1 budget revisions (MoH nutrition, KHETFUND, PHCMB) are deliberately NOT
-- loaded -- performance is measured against the original appropriation.
--
-- Idempotent: expenditure entries are keyed on deterministic voucher numbers
-- (BPR-2026Q2-<mda>-<seq>) and guarded by NOT EXISTS; revenue lines and their
-- quarterly actuals upsert on their natural keys. Re-running is safe and is
-- how a corrected workbook should be re-applied.

begin;

do $$
begin
  if not exists (select 1 from public.mdas where code = '052100100100') then
    raise exception 'Reference data missing -- apply supabase/seeds/001_reference_data.sql first.';
  end if;
  if not exists (select 1 from public.approved_budget_lines where fiscal_year = 2026) then
    raise exception 'Budget lines missing -- apply supabase/seeds/010_budget_lines_2026.sql first.';
  end if;
  if to_regclass('public.budget_line_revenues') is null then
    raise exception 'Missing table budget_line_revenues -- apply migration 20260721090000.';
  end if;
end $$;

-- 1. MDA present in the Q2 workbook but absent from the approved budget.
insert into public.mdas (code, name, mda_type_id, active)
select '052100400500', 'School of Post Basic Midwifery Gezawa', t.id, true
from public.mda_types t where t.slug = 'school'
on conflict (code) do nothing;

-- 2. Budget line present in the workbook but missing from seed 010.
insert into public.approved_budget_lines
  (fiscal_year, mda_id, budget_class, economic_code, economic_description,
   function_code, location_code, programme_code, approved_amount, source_label)
select 2026, m.id, 'overhead', '22021011', 'OTHER MISCELLANEOUS',
       '70761', '31944500', '13100100000000', 620000000, 'Q2 2026 UPDATED BPR'
from public.mdas m where m.code = '052100100100'
and not exists (select 1 from public.approved_budget_lines l
  where l.fiscal_year = 2026 and l.mda_id = m.id
    and l.budget_class = 'overhead' and l.economic_code = '22021011');

-- 3. Zero-budget lines carrying unbudgeted Q2 spend (37,369,123.08 in total),
--    so every actual has a budget line to hang from.
insert into public.approved_budget_lines
  (fiscal_year, mda_id, budget_class, economic_code, economic_description, project_description,
   function_code, location_code, programme_code, approved_amount, source_label)
select 2026, m.id, v.cls, v.econ, v.econn, nullif(v.proj, ''),
       v.func, v.loc, v.prog, 0, 'Q2 2026 UPDATED BPR (unbudgeted actual)'
from (values
  ('052100800100','overhead','22021006','POSTAGES & COURIER SERVICES','','70741','31944500','04100100000004'),
  ('052101300100','overhead','22020803','PLANT / GENERATOR FUEL COST','','70711','31944500','04060100000004'),
  ('052101300100','overhead','22021003','PUBLICITY & ADVERTISEMENTS','','70711','31944500','04060100000004'),
  ('052100100100','capital','23010140','PURCHASE OF HOSPITAL FURNITURES','Procurement Of Furniture At Tiga Gen. Hospital.','70741','31944500','04050110010004'),
  ('052100800100','capital','23020124','CONSTRUCTION OF MARKETS/PARKS','Provision Of Parking Shade At The Agency','70741','31944500','04030110080004')
) as v(mda_code, cls, econ, econn, proj, func, loc, prog)
join public.mdas m on m.code = v.mda_code
where not exists (select 1 from public.approved_budget_lines l
  where l.fiscal_year = 2026 and l.mda_id = m.id
    and l.budget_class = v.cls and l.economic_code = v.econ);

-- 4. Refresh the approved_budgets rollup so it matches the line items.
update public.approved_budgets ab
set personnel_amount = r.p, other_recurrent_amount = r.o,
    total_recurrent_amount = r.p + r.o, capital_amount = r.c,
    total_budget_amount = r.p + r.o + r.c, updated_at = now()
from (
  select mda_id,
         coalesce(sum(approved_amount) filter (where budget_class = 'personnel'), 0) p,
         coalesce(sum(approved_amount) filter (where budget_class = 'overhead'), 0)  o,
         coalesce(sum(approved_amount) filter (where budget_class = 'capital'), 0)   c
  from public.approved_budget_lines where fiscal_year = 2026 group by mda_id
) r
where ab.mda_id = r.mda_id and ab.fiscal_year = 2026
  and (ab.personnel_amount, ab.other_recurrent_amount, ab.capital_amount)
      is distinct from (r.p, r.o, r.c);

-- 5. Q2 expenditure actuals: 313 entries totalling 30,913,207,074.68.
--    Each workbook line becomes one aggregate entry dated at quarter end; the
--    NCOA economic code is preserved in `remarks` because the ledger has no
--    economic-class column of its own.
insert into public.expenditure_entries
  (transaction_date, mda_id, expenditure_category_id, programme_area_id, approved_budget_line_id,
   is_phc, amount, voucher_ref_no, payment_method_id, remarks, entered_by)
select date '2026-06-30', m.id, c.id, p.id, l.id, false, wb.amount, wb.voucher,
       (select id from public.payment_methods where name='GIFMIS'),
       wb.remarks, '00000000-0000-0000-0000-000000000001'::uuid
from (values
('052100100100','capital','23010112','3e1be938975a3116dbc97795284525f5','capital-expenditure','planning-research-statistics',112702303.63,'BPR-2026Q2-100100-001','BPR Q2 2026 aggregate | Econ 23010112 PURCHASE OF OFFICE FURNITURE AND FITTINGS | Dept: Planning, Research & Statistics | Project: Procurement Of Office Furniture/Working Materials At EoH & GHO Units'),
('052100100100','capital','23010122','d3c6c1bd79a829f71b2d5c7245a04f7e','capital-expenditure','planning-research-statistics',1063517406.75,'BPR-2026Q2-100100-002','BPR Q2 2026 aggregate | Econ 23010122 PURCHASE OF HEALTH / MEDICAL EQUIPMENT | Dept: Planning, Research & Statistics | Project: Procurement Of Medical Equipment To General Hospitals Across The State'),
('052100100100','capital','23010140','4d59f41abb697b4ddb457724a9d76a4b','capital-expenditure','planning-research-statistics',30625623.08,'BPR-2026Q2-100100-003','BPR Q2 2026 aggregate | Econ 23010140 PURCHASE OF HOSPITAL FURNITURES | Dept: Planning, Research & Statistics | Project: Procurement Of Furniture At Tiga Gen. Hospital.'),
('052100100100','capital','23020106','1c4e0e649ccae1b816036f2b3dc2f8d0','capital-expenditure','planning-research-statistics',28748886.02,'BPR-2026Q2-100100-004','BPR Q2 2026 aggregate | Econ 23020106 CONSTRUCTION / PROVISION OF HOSPITALS / HEALTH CENTRES | Dept: Planning, Research & Statistics | Project: Construction Of  Sexual Assualt Refferal Center At Karaye Council H/Q HoSPital'),
('052100100100','capital','23020106','6a8b66efe8e118eb087d9d38650a1d1f','capital-expenditure','planning-research-statistics',845779352.31,'BPR-2026Q2-100100-005','BPR Q2 2026 aggregate | Econ 23020106 CONSTRUCTION / PROVISION OF HOSPITALS / HEALTH CENTRES | Dept: Planning, Research & Statistics | Project: Construction of Hospitals Across the State'),
('052100100100','capital','23030105','f6ee24e7f5abed23e03f2a03901dabe4','capital-expenditure','physical-planning',138437462.55,'BPR-2026Q2-100100-006','BPR Q2 2026 aggregate | Econ 23030105 REHABILITATION / REPAIRS - HOSPITAL / HEALTH CENTRES | Dept: Physical Planning Department | Project: Rehabilitation Of Secondary Health Facilities In The State'),
('052100100100','capital','23050128','502849633352de387289e16f6f832830','capital-expenditure','planning-research-statistics',64822408.26,'BPR-2026Q2-100100-007','BPR Q2 2026 aggregate | Econ 23050128 OTHER NON-TANGIBLE ASSETS | Dept: Planning, Research & Statistics | Project: Development & Accreditation Programme  (School Of Hygiene, Kano And School Of Health Technology Bebeji)'),
('052100100100','capital','23050128','dded0761bc94b9fa43bc5ec991bb68ee','capital-expenditure','public-health-disease-control',119142192.00,'BPR-2026Q2-100100-008','BPR Q2 2026 aggregate | Econ 23050128 OTHER NON-TANGIBLE ASSETS | Dept: Public Health & Disease Control | Project: Epidemic Preparedness And Response (EPR)'),
('052100100100','capital','23050128','7942039d18580bb915760dfb0d058448','capital-expenditure','public-health-disease-control',71620000.00,'BPR-2026Q2-100100-009','BPR Q2 2026 aggregate | Econ 23050128 OTHER NON-TANGIBLE ASSETS | Dept: Public Health & Disease Control | Project: Global Polio Eradication Initiatives  Proagramme'),
('052100100100','capital','23050128','ad3b36192650850bc12f05bc2e5d8b81','capital-expenditure','medical-services',107501463.90,'BPR-2026Q2-100100-010','BPR Q2 2026 aggregate | Econ 23050128 OTHER NON-TANGIBLE ASSETS | Dept: Medical Services | Project: Improvement Of The Access To Quality ORAL Health Services Across Primary And Secondary Health Facilities'),
('052100100100','capital','23050128','f1bb71f8cb307d667d326d4a27372efe','capital-expenditure','planning-research-statistics',592087825.00,'BPR-2026Q2-100100-011','BPR Q2 2026 aggregate | Econ 23050128 OTHER NON-TANGIBLE ASSETS | Dept: Planning, Research & Statistics | Project: Medical Assistance'),
('052100100100','capital','23050128','fd30f8d938008f25e1494684fbf6d930','capital-expenditure','public-health-disease-control',56840000.00,'BPR-2026Q2-100100-012','BPR Q2 2026 aggregate | Econ 23050128 OTHER NON-TANGIBLE ASSETS | Dept: Public Health & Disease Control | Project: Nut.2/SP.1.2.1 Procurement And Distribution Of Zinc And L-Ors, Deworming Tablets For Mnch Weeks And Routine Services Programme (Khetfund)'),
('052100100100','capital','23050128','99c406f73494cd90a8caedb02da0ee26','capital-expenditure','public-health-disease-control',180000000.00,'BPR-2026Q2-100100-013','BPR Q2 2026 aggregate | Econ 23050128 OTHER NON-TANGIBLE ASSETS | Dept: Public Health & Disease Control | Project: SP.1.2.4: Integrated Maternal Newborn And Child Health (IMNCH)'),
('052100100100','capital','23050128','967e3cbc652862d8b420af9a6c374d8a','capital-expenditure','public-health-disease-control',200000.00,'BPR-2026Q2-100100-014','BPR Q2 2026 aggregate | Econ 23050128 OTHER NON-TANGIBLE ASSETS | Dept: Public Health & Disease Control | Project: SP.1.2.6: Provision And Distribution Of Supplementary Food To Children With Moderate Acute Malnutrition (MAM)'),
('052100100100','overhead','22020102','','overhead-running-costs','admin-general-services',1500000.00,'BPR-2026Q2-100100-015','BPR Q2 2026 aggregate | Econ 22020102 LOCAL TRAVEL & TRANSPORT: OTHERS | Dept: Admin & General Services'),
('052100100100','overhead','22020203','','overhead-running-costs','admin-general-services',4596417.28,'BPR-2026Q2-100100-016','BPR Q2 2026 aggregate | Econ 22020203 INTERNET ACCESS CHARGES | Dept: Admin & General Services'),
('052100100100','overhead','22020401','','overhead-running-costs','admin-general-services',12000000.00,'BPR-2026Q2-100100-017','BPR Q2 2026 aggregate | Econ 22020401 MAINTENANCE OF MOTOR VEHICLE / TRANSPORT EQUIPMENT | Dept: Admin & General Services'),
('052100100100','overhead','22020501','','overhead-running-costs','admin-general-services',800000.00,'BPR-2026Q2-100100-018','BPR Q2 2026 aggregate | Econ 22020501 LOCAL TRAINING | Dept: Admin & General Services'),
('052100100100','overhead','22021021','','overhead-running-costs','admin-general-services',73666500.00,'BPR-2026Q2-100100-019','BPR Q2 2026 aggregate | Econ 22021021 SPECIAL DAYS/CELEBRATIONS | Dept: Admin & General Services'),
('052100100100','personnel','21010101','','personnel-costs','admin-general-services',1109281582.57,'BPR-2026Q2-100100-020','BPR Q2 2026 aggregate | Econ 21010101 SALARY | Dept: Admin & General Services'),
('052100100100','personnel','21020106','','personnel-costs','admin-general-services',566090978.44,'BPR-2026Q2-100100-021','BPR Q2 2026 aggregate | Econ 21020106 RESPONSIBILITY ALLOWANCE | Dept: Admin & General Services'),
('052100100100','personnel','21020107','','personnel-costs','admin-general-services',1300598.56,'BPR-2026Q2-100100-022','BPR Q2 2026 aggregate | Econ 21020107 ENTERTAINMENT ALLOWANCE | Dept: Admin & General Services'),
('052100100100','personnel','21020114','','personnel-costs','admin-general-services',101213987.00,'BPR-2026Q2-100100-023','BPR Q2 2026 aggregate | Econ 21020114 MEDICAL ALLOWANCE | Dept: Admin & General Services'),
('052100100100','personnel','21020116','','personnel-costs','admin-general-services',28971326.00,'BPR-2026Q2-100100-024','BPR Q2 2026 aggregate | Econ 21020116 OTHER ALLOWANCES (LTG, & UPKEEP ) | Dept: Admin & General Services'),
('052100100100','personnel','21020202','','personnel-costs','admin-general-services',47360554.13,'BPR-2026Q2-100100-025','BPR Q2 2026 aggregate | Econ 21020202 CONTRIBUTORY PENSION | Dept: Admin & General Services'),
('052100300100','overhead','22020101','','overhead-running-costs','admin-general-services',1327100.00,'BPR-2026Q2-300100-001','BPR Q2 2026 aggregate | Econ 22020101 LOCAL TRAVEL & TRANSPORT: TRAINING | Dept: Admin & General Services'),
('052100300100','overhead','22020203','','overhead-running-costs','admin-general-services',6390874.44,'BPR-2026Q2-300100-002','BPR Q2 2026 aggregate | Econ 22020203 INTERNET ACCESS CHARGES | Dept: Admin & General Services'),
('052100300100','overhead','22020205','','overhead-running-costs','admin-general-services',278500.00,'BPR-2026Q2-300100-003','BPR Q2 2026 aggregate | Econ 22020205 WATER RATES | Dept: Admin & General Services'),
('052100300100','overhead','22020206','','overhead-running-costs','admin-general-services',429500.00,'BPR-2026Q2-300100-004','BPR Q2 2026 aggregate | Econ 22020206 SEWERAGE CHARGES | Dept: Admin & General Services'),
('052100300100','overhead','22020209','','overhead-running-costs','admin-general-services',5702874.44,'BPR-2026Q2-300100-005','BPR Q2 2026 aggregate | Econ 22020209 OTHER UTILITIES | Dept: Admin & General Services'),
('052100300100','overhead','22020301','','overhead-running-costs','admin-general-services',78900.00,'BPR-2026Q2-300100-006','BPR Q2 2026 aggregate | Econ 22020301 OFFICE STATIONERIES / COMPUTER CONSUMABLES | Dept: Admin & General Services'),
('052100300100','overhead','22020302','','overhead-running-costs','admin-general-services',58356458.38,'BPR-2026Q2-300100-007','BPR Q2 2026 aggregate | Econ 22020302 BOOKS | Dept: Admin & General Services'),
('052100300100','overhead','22020303','','overhead-running-costs','admin-general-services',424000.00,'BPR-2026Q2-300100-008','BPR Q2 2026 aggregate | Econ 22020303 NEWSPAPERS | Dept: Admin & General Services'),
('052100300100','overhead','22020305','','overhead-running-costs','admin-general-services',3249530.00,'BPR-2026Q2-300100-009','BPR Q2 2026 aggregate | Econ 22020305 PRINTING OF NON SECURITY DOCUMENTS | Dept: Admin & General Services'),
('052100300100','overhead','22020306','','overhead-running-costs','admin-general-services',1858800.00,'BPR-2026Q2-300100-010','BPR Q2 2026 aggregate | Econ 22020306 PRINTING OF SECURITY DOCUMENTS | Dept: Admin & General Services'),
('052100300100','overhead','22020307','','overhead-running-costs','admin-general-services',475292312.44,'BPR-2026Q2-300100-011','BPR Q2 2026 aggregate | Econ 22020307 DRUGS/LABORATORY/MEDICAL SUPPLIES | Dept: Admin & General Services'),
('052100300100','personnel','21010101','','personnel-costs','admin-general-services',8890775903.07,'BPR-2026Q2-300100-012','BPR Q2 2026 aggregate | Econ 21010101 SALARY | Dept: Admin & General Services'),
('052100300100','personnel','21020106','','personnel-costs','admin-general-services',4426641208.07,'BPR-2026Q2-300100-013','BPR Q2 2026 aggregate | Econ 21020106 RESPONSIBILITY ALLOWANCE | Dept: Admin & General Services'),
('052100300100','personnel','21020107','','personnel-costs','admin-general-services',7088018.04,'BPR-2026Q2-300100-014','BPR Q2 2026 aggregate | Econ 21020107 ENTERTAINMENT ALLOWANCE | Dept: Admin & General Services'),
('052100300100','personnel','21020114','','personnel-costs','admin-general-services',1426641208.07,'BPR-2026Q2-300100-015','BPR Q2 2026 aggregate | Econ 21020114 MEDICAL ALLOWANCE | Dept: Admin & General Services'),
('052100300100','personnel','21020202','','personnel-costs','admin-general-services',2615183024.17,'BPR-2026Q2-300100-016','BPR Q2 2026 aggregate | Econ 21020202 CONTRIBUTORY PENSION | Dept: Admin & General Services'),
('052100300200','overhead','22020101','','overhead-running-costs','other',699340.00,'BPR-2026Q2-300200-001','BPR Q2 2026 aggregate | Econ 22020101 LOCAL TRAVEL & TRANSPORT: TRAINING | Dept: Office of the Chief Medical Director'),
('052100300200','overhead','22020102','','overhead-running-costs','other',710500.00,'BPR-2026Q2-300200-002','BPR Q2 2026 aggregate | Econ 22020102 LOCAL TRAVEL & TRANSPORT: OTHERS | Dept: Office of the Chief Medical Director'),
('052100300200','overhead','22020201','','overhead-running-costs','other',33348347.90,'BPR-2026Q2-300200-003','BPR Q2 2026 aggregate | Econ 22020201 ELECTRICITY CHARGES | Dept: Office of the Chief Medical Director'),
('052100300200','overhead','22020203','','overhead-running-costs','other',792000.00,'BPR-2026Q2-300200-004','BPR Q2 2026 aggregate | Econ 22020203 INTERNET ACCESS CHARGES | Dept: Office of the Chief Medical Director'),
('052100300200','overhead','22020205','','overhead-running-costs','other',2751000.00,'BPR-2026Q2-300200-005','BPR Q2 2026 aggregate | Econ 22020205 WATER RATES | Dept: Office of the Chief Medical Director'),
('052100300200','overhead','22020206','','overhead-running-costs','other',330500.00,'BPR-2026Q2-300200-006','BPR Q2 2026 aggregate | Econ 22020206 SEWERAGE CHARGES | Dept: Office of the Chief Medical Director'),
('052100300200','overhead','22020209','','overhead-running-costs','other',1430000.00,'BPR-2026Q2-300200-007','BPR Q2 2026 aggregate | Econ 22020209 OTHER UTILITIES | Dept: Office of the Chief Medical Director'),
('052100300200','overhead','22020301','','overhead-running-costs','other',3850544.03,'BPR-2026Q2-300200-008','BPR Q2 2026 aggregate | Econ 22020301 OFFICE STATIONERIES / COMPUTER CONSUMABLES | Dept: Office of the Chief Medical Director'),
('052100300200','overhead','22020302','','overhead-running-costs','other',385000.00,'BPR-2026Q2-300200-009','BPR Q2 2026 aggregate | Econ 22020302 BOOKS | Dept: Office of the Chief Medical Director'),
('052100300200','overhead','22020305','','overhead-running-costs','other',1480095.00,'BPR-2026Q2-300200-010','BPR Q2 2026 aggregate | Econ 22020305 PRINTING OF NON SECURITY DOCUMENTS | Dept: Office of the Chief Medical Director'),
('052100300200','overhead','22020306','','overhead-running-costs','other',576000.00,'BPR-2026Q2-300200-011','BPR Q2 2026 aggregate | Econ 22020306 PRINTING OF SECURITY DOCUMENTS | Dept: Office of the Chief Medical Director'),
('052100300200','overhead','22020307','','overhead-running-costs','other',80154289.29,'BPR-2026Q2-300200-012','BPR Q2 2026 aggregate | Econ 22020307 DRUGS/LABORATORY/MEDICAL SUPPLIES | Dept: Office of the Chief Medical Director'),
('052100300200','overhead','22020308','','overhead-running-costs','other',1049500.00,'BPR-2026Q2-300200-013','BPR Q2 2026 aggregate | Econ 22020308 FIELD & CAMPING MATERIALS SUPPLIES | Dept: Office of the Chief Medical Director'),
('052100300200','overhead','22020309','','overhead-running-costs','other',472000.00,'BPR-2026Q2-300200-014','BPR Q2 2026 aggregate | Econ 22020309 UNIFORMS & OTHER CLOTHING | Dept: Office of the Chief Medical Director'),
('052100300200','overhead','22020311','','overhead-running-costs','other',2603050.00,'BPR-2026Q2-300200-015','BPR Q2 2026 aggregate | Econ 22020311 FOOD STUFF / CATERING MATERIALS SUPPLIES | Dept: Office of the Chief Medical Director'),
('052100300200','overhead','22020316','','overhead-running-costs','other',2693100.00,'BPR-2026Q2-300200-016','BPR Q2 2026 aggregate | Econ 22020316 OTHER MATERIALS AND SUPPLY | Dept: Office of the Chief Medical Director'),
('052100300200','overhead','22020401','','overhead-running-costs','other',939500.00,'BPR-2026Q2-300200-017','BPR Q2 2026 aggregate | Econ 22020401 MAINTENANCE OF MOTOR VEHICLE / TRANSPORT EQUIPMENT | Dept: Office of the Chief Medical Director'),
('052100300200','overhead','22020402','','overhead-running-costs','other',287000.00,'BPR-2026Q2-300200-018','BPR Q2 2026 aggregate | Econ 22020402 MAINTENANCE OF OFFICE FURNITURE | Dept: Office of the Chief Medical Director'),
('052100300200','overhead','22020403','','overhead-running-costs','other',43400.00,'BPR-2026Q2-300200-019','BPR Q2 2026 aggregate | Econ 22020403 MAINTENANCE OF OFFICE BUILDING / RESIDENTIAL QTRS | Dept: Office of the Chief Medical Director'),
('052100300200','overhead','22020405','','overhead-running-costs','other',1199000.00,'BPR-2026Q2-300200-020','BPR Q2 2026 aggregate | Econ 22020405 MAINTENANCE OF PLANTS/GENERATORS | Dept: Office of the Chief Medical Director'),
('052100300200','overhead','22020406','','overhead-running-costs','other',3584050.00,'BPR-2026Q2-300200-021','BPR Q2 2026 aggregate | Econ 22020406 OTHER MAINTENANCE SERVICES | Dept: Office of the Chief Medical Director'),
('052100300200','overhead','22020417','','overhead-running-costs','other',2452500.00,'BPR-2026Q2-300200-022','BPR Q2 2026 aggregate | Econ 22020417 MAINTENANCE OF OTHER INFRASTRUCTURE | Dept: Office of the Chief Medical Director'),
('052100300200','overhead','22020601','','overhead-running-costs','other',1020000.00,'BPR-2026Q2-300200-023','BPR Q2 2026 aggregate | Econ 22020601 SECURITY SERVICES | Dept: Office of the Chief Medical Director'),
('052100300200','overhead','22020605','','overhead-running-costs','other',105000.00,'BPR-2026Q2-300200-024','BPR Q2 2026 aggregate | Econ 22020605 CLEANING & FUMIGATION SERVICES | Dept: Office of the Chief Medical Director'),
('052100300200','overhead','22020708','','overhead-running-costs','other',11357502.00,'BPR-2026Q2-300200-025','BPR Q2 2026 aggregate | Econ 22020708 MEDICAL CONSULTING | Dept: Office of the Chief Medical Director'),
('052100300200','overhead','22020711','','overhead-running-costs','other',4946000.00,'BPR-2026Q2-300200-026','BPR Q2 2026 aggregate | Econ 22020711 SUPERVISION AND MANAGEMENT | Dept: Office of the Chief Medical Director'),
('052100300200','overhead','22020801','','overhead-running-costs','other',2087000.00,'BPR-2026Q2-300200-027','BPR Q2 2026 aggregate | Econ 22020801 MOTOR VEHICLE  FUEL COST | Dept: Office of the Chief Medical Director'),
('052100300200','overhead','22020803','','overhead-running-costs','other',825000.00,'BPR-2026Q2-300200-028','BPR Q2 2026 aggregate | Econ 22020803 PLANT / GENERATOR FUEL COST | Dept: Office of the Chief Medical Director'),
('052100300200','overhead','22021001','','overhead-running-costs','other',296900.00,'BPR-2026Q2-300200-029','BPR Q2 2026 aggregate | Econ 22021001 REFRESHMENT & MEALS | Dept: Office of the Chief Medical Director'),
('052100300200','overhead','22021002','','overhead-running-costs','other',1701000.00,'BPR-2026Q2-300200-030','BPR Q2 2026 aggregate | Econ 22021002 HONORARIUM & SITTING ALLOWANCE | Dept: Office of the Chief Medical Director'),
('052100300200','overhead','22021003','','overhead-running-costs','other',60000.00,'BPR-2026Q2-300200-031','BPR Q2 2026 aggregate | Econ 22021003 PUBLICITY & ADVERTISEMENTS | Dept: Office of the Chief Medical Director'),
('052100300200','overhead','22021007','','overhead-running-costs','other',25808285.88,'BPR-2026Q2-300200-032','BPR Q2 2026 aggregate | Econ 22021007 WELFARE PACKAGES | Dept: Office of the Chief Medical Director'),
('052100300200','overhead','22021011','','overhead-running-costs','other',17615430.95,'BPR-2026Q2-300200-033','BPR Q2 2026 aggregate | Econ 22021011 OTHER MISCELLANEOUS | Dept: Office of the Chief Medical Director'),
('052100400100','overhead','22020201','','overhead-running-costs','other',4204750.00,'BPR-2026Q2-400100-001','BPR Q2 2026 aggregate | Econ 22020201 ELECTRICITY CHARGES | Dept: Finance & Supply'),
('052100400100','overhead','22020202','','overhead-running-costs','other',130000.00,'BPR-2026Q2-400100-002','BPR Q2 2026 aggregate | Econ 22020202 TELEPHONE CHARGES | Dept: Finance & Supply'),
('052100400100','overhead','22020203','','overhead-running-costs','other',159000.00,'BPR-2026Q2-400100-003','BPR Q2 2026 aggregate | Econ 22020203 INTERNET ACCESS CHARGES | Dept: Finance & Supply'),
('052100400100','overhead','22020209','','overhead-running-costs','other',4662000.00,'BPR-2026Q2-400100-004','BPR Q2 2026 aggregate | Econ 22020209 OTHER UTILITIES | Dept: Finance & Supply'),
('052100400100','overhead','22020301','','overhead-running-costs','other',1162000.00,'BPR-2026Q2-400100-005','BPR Q2 2026 aggregate | Econ 22020301 OFFICE STATIONERIES / COMPUTER CONSUMABLES | Dept: Finance & Supply'),
('052100400100','overhead','22020302','','overhead-running-costs','other',5225600.00,'BPR-2026Q2-400100-006','BPR Q2 2026 aggregate | Econ 22020302 BOOKS | Dept: Finance & Supply'),
('052100400100','overhead','22020305','','overhead-running-costs','other',408000.00,'BPR-2026Q2-400100-007','BPR Q2 2026 aggregate | Econ 22020305 PRINTING OF NON SECURITY DOCUMENTS | Dept: Finance & Supply'),
('052100400100','overhead','22020306','','overhead-running-costs','other',3320000.00,'BPR-2026Q2-400100-008','BPR Q2 2026 aggregate | Econ 22020306 PRINTING OF SECURITY DOCUMENTS | Dept: Finance & Supply'),
('052100400100','overhead','22020314','','overhead-running-costs','other',440000.00,'BPR-2026Q2-400100-009','BPR Q2 2026 aggregate | Econ 22020314 EXAMINATION MATERIALS | Dept: Finance & Supply'),
('052100400100','overhead','22020316','','overhead-running-costs','other',690500.00,'BPR-2026Q2-400100-010','BPR Q2 2026 aggregate | Econ 22020316 OTHER MATERIALS AND SUPPLY | Dept: Finance & Supply'),
('052100400100','overhead','22020401','','overhead-running-costs','other',123500.00,'BPR-2026Q2-400100-011','BPR Q2 2026 aggregate | Econ 22020401 MAINTENANCE OF MOTOR VEHICLE / TRANSPORT EQUIPMENT | Dept: Finance & Supply'),
('052100400100','overhead','22020403','','overhead-running-costs','other',1636080.00,'BPR-2026Q2-400100-012','BPR Q2 2026 aggregate | Econ 22020403 MAINTENANCE OF OFFICE BUILDING / RESIDENTIAL QTRS | Dept: Finance & Supply'),
('052100400100','overhead','22020404','','overhead-running-costs','other',857500.00,'BPR-2026Q2-400100-013','BPR Q2 2026 aggregate | Econ 22020404 MAINTENANCE OF OFFICE / IT EQUIPMENTS | Dept: Finance & Supply'),
('052100400100','overhead','22020405','','overhead-running-costs','other',1127650.00,'BPR-2026Q2-400100-014','BPR Q2 2026 aggregate | Econ 22020405 MAINTENANCE OF PLANTS/GENERATORS | Dept: Finance & Supply'),
('052100400100','overhead','22020406','','overhead-running-costs','other',5844200.00,'BPR-2026Q2-400100-015','BPR Q2 2026 aggregate | Econ 22020406 OTHER MAINTENANCE SERVICES | Dept: Finance & Supply'),
('052100400100','overhead','22020417','','overhead-running-costs','other',6476000.00,'BPR-2026Q2-400100-016','BPR Q2 2026 aggregate | Econ 22020417 MAINTENANCE OF OTHER INFRASTRUCTURE | Dept: Finance & Supply'),
('052100400100','overhead','22020501','','overhead-running-costs','other',6343600.00,'BPR-2026Q2-400100-017','BPR Q2 2026 aggregate | Econ 22020501 LOCAL TRAINING | Dept: Finance & Supply'),
('052100400100','overhead','22020605','','overhead-running-costs','other',200000.00,'BPR-2026Q2-400100-018','BPR Q2 2026 aggregate | Econ 22020605 CLEANING & FUMIGATION SERVICES | Dept: Finance & Supply'),
('052100400100','overhead','22020709','','overhead-running-costs','other',750000.00,'BPR-2026Q2-400100-019','BPR Q2 2026 aggregate | Econ 22020709 AUDIT CONSULTANCY | Dept: Finance & Supply'),
('052100400100','overhead','22020711','','overhead-running-costs','other',50000.00,'BPR-2026Q2-400100-020','BPR Q2 2026 aggregate | Econ 22020711 SUPERVISION AND MANAGEMENT | Dept: Finance & Supply'),
('052100400100','overhead','22020801','','overhead-running-costs','other',1030000.00,'BPR-2026Q2-400100-021','BPR Q2 2026 aggregate | Econ 22020801 MOTOR VEHICLE  FUEL COST | Dept: Finance & Supply'),
('052100400100','overhead','22021001','','overhead-running-costs','other',3545250.00,'BPR-2026Q2-400100-022','BPR Q2 2026 aggregate | Econ 22021001 REFRESHMENT & MEALS | Dept: Finance & Supply'),
('052100400100','overhead','22021002','','overhead-running-costs','other',5155000.00,'BPR-2026Q2-400100-023','BPR Q2 2026 aggregate | Econ 22021002 HONORARIUM & SITTING ALLOWANCE | Dept: Finance & Supply'),
('052100400100','overhead','22021008','','overhead-running-costs','other',1680000.00,'BPR-2026Q2-400100-024','BPR Q2 2026 aggregate | Econ 22021008 SUBSCRIPTION TO PROFESSIONAL BODIES | Dept: Finance & Supply'),
('052100400100','overhead','22021011','','overhead-running-costs','other',4904500.00,'BPR-2026Q2-400100-025','BPR Q2 2026 aggregate | Econ 22021011 OTHER MISCELLANEOUS | Dept: Finance & Supply'),
('052100400200','overhead','22020101','','overhead-running-costs','other',397000.00,'BPR-2026Q2-400200-001','BPR Q2 2026 aggregate | Econ 22020101 LOCAL TRAVEL & TRANSPORT: TRAINING | Dept: School of Nursing Kano'),
('052100400200','overhead','22020201','','overhead-running-costs','other',292000.00,'BPR-2026Q2-400200-002','BPR Q2 2026 aggregate | Econ 22020201 ELECTRICITY CHARGES | Dept: School of Nursing Kano'),
('052100400200','overhead','22020203','','overhead-running-costs','other',350000.00,'BPR-2026Q2-400200-003','BPR Q2 2026 aggregate | Econ 22020203 INTERNET ACCESS CHARGES | Dept: School of Nursing Kano'),
('052100400200','overhead','22020205','','overhead-running-costs','other',517500.00,'BPR-2026Q2-400200-004','BPR Q2 2026 aggregate | Econ 22020205 WATER RATES | Dept: School of Nursing Kano'),
('052100400200','overhead','22020209','','overhead-running-costs','other',971500.00,'BPR-2026Q2-400200-005','BPR Q2 2026 aggregate | Econ 22020209 OTHER UTILITIES | Dept: School of Nursing Kano'),
('052100400200','overhead','22020301','','overhead-running-costs','other',1325500.00,'BPR-2026Q2-400200-006','BPR Q2 2026 aggregate | Econ 22020301 OFFICE STATIONERIES / COMPUTER CONSUMABLES | Dept: School of Nursing Kano'),
('052100400200','overhead','22020305','','overhead-running-costs','other',779200.00,'BPR-2026Q2-400200-007','BPR Q2 2026 aggregate | Econ 22020305 PRINTING OF NON SECURITY DOCUMENTS | Dept: School of Nursing Kano'),
('052100400200','overhead','22020308','','overhead-running-costs','other',538000.00,'BPR-2026Q2-400200-008','BPR Q2 2026 aggregate | Econ 22020308 FIELD & CAMPING MATERIALS SUPPLIES | Dept: School of Nursing Kano'),
('052100400200','overhead','22020314','','overhead-running-costs','other',5700500.00,'BPR-2026Q2-400200-009','BPR Q2 2026 aggregate | Econ 22020314 EXAMINATION MATERIALS | Dept: School of Nursing Kano'),
('052100400200','overhead','22020401','','overhead-running-costs','other',19500.00,'BPR-2026Q2-400200-010','BPR Q2 2026 aggregate | Econ 22020401 MAINTENANCE OF MOTOR VEHICLE / TRANSPORT EQUIPMENT | Dept: School of Nursing Kano'),
('052100400200','overhead','22020402','','overhead-running-costs','other',154000.00,'BPR-2026Q2-400200-011','BPR Q2 2026 aggregate | Econ 22020402 MAINTENANCE OF OFFICE FURNITURE | Dept: School of Nursing Kano'),
('052100400200','overhead','22020404','','overhead-running-costs','other',678800.00,'BPR-2026Q2-400200-012','BPR Q2 2026 aggregate | Econ 22020404 MAINTENANCE OF OFFICE / IT EQUIPMENTS | Dept: School of Nursing Kano'),
('052100400200','overhead','22020501','','overhead-running-costs','other',500000.00,'BPR-2026Q2-400200-013','BPR Q2 2026 aggregate | Econ 22020501 LOCAL TRAINING | Dept: School of Nursing Kano'),
('052100400200','overhead','22020801','','overhead-running-costs','other',190000.00,'BPR-2026Q2-400200-014','BPR Q2 2026 aggregate | Econ 22020801 MOTOR VEHICLE  FUEL COST | Dept: School of Nursing Kano'),
('052100400200','overhead','22020803','','overhead-running-costs','other',106650.00,'BPR-2026Q2-400200-015','BPR Q2 2026 aggregate | Econ 22020803 PLANT / GENERATOR FUEL COST | Dept: School of Nursing Kano'),
('052100400200','overhead','22021011','','overhead-running-costs','other',9538050.00,'BPR-2026Q2-400200-016','BPR Q2 2026 aggregate | Econ 22021011 OTHER MISCELLANEOUS | Dept: School of Nursing Kano'),
('052100400300','overhead','22020101','','overhead-running-costs','other',390000.00,'BPR-2026Q2-400300-001','BPR Q2 2026 aggregate | Econ 22020101 LOCAL TRAVEL & TRANSPORT: TRAINING | Dept: School of Basic Mid Wifery Kano'),
('052100400300','overhead','22020301','','overhead-running-costs','other',384000.00,'BPR-2026Q2-400300-002','BPR Q2 2026 aggregate | Econ 22020301 OFFICE STATIONERIES / COMPUTER CONSUMABLES | Dept: School of Basic Mid Wifery Kano'),
('052100400300','overhead','22020305','','overhead-running-costs','other',125000.00,'BPR-2026Q2-400300-003','BPR Q2 2026 aggregate | Econ 22020305 PRINTING OF NON SECURITY DOCUMENTS | Dept: School of Basic Mid Wifery Kano'),
('052100400300','overhead','22020314','','overhead-running-costs','other',168000.00,'BPR-2026Q2-400300-004','BPR Q2 2026 aggregate | Econ 22020314 EXAMINATION MATERIALS | Dept: School of Basic Mid Wifery Kano'),
('052100400300','overhead','22020401','','overhead-running-costs','other',100000.00,'BPR-2026Q2-400300-005','BPR Q2 2026 aggregate | Econ 22020401 MAINTENANCE OF MOTOR VEHICLE / TRANSPORT EQUIPMENT | Dept: School of Basic Mid Wifery Kano'),
('052100400300','overhead','22020403','','overhead-running-costs','other',1081700.00,'BPR-2026Q2-400300-006','BPR Q2 2026 aggregate | Econ 22020403 MAINTENANCE OF OFFICE BUILDING / RESIDENTIAL QTRS | Dept: School of Basic Mid Wifery Kano'),
('052100400300','overhead','22020404','','overhead-running-costs','other',1037000.00,'BPR-2026Q2-400300-007','BPR Q2 2026 aggregate | Econ 22020404 MAINTENANCE OF OFFICE / IT EQUIPMENTS | Dept: School of Basic Mid Wifery Kano'),
('052100400300','overhead','22020406','','overhead-running-costs','other',200000.00,'BPR-2026Q2-400300-008','BPR Q2 2026 aggregate | Econ 22020406 OTHER MAINTENANCE SERVICES | Dept: School of Basic Mid Wifery Kano'),
('052100400300','overhead','22020801','','overhead-running-costs','other',572500.00,'BPR-2026Q2-400300-009','BPR Q2 2026 aggregate | Econ 22020801 MOTOR VEHICLE  FUEL COST | Dept: School of Basic Mid Wifery Kano'),
('052100400300','overhead','22020803','','overhead-running-costs','other',427500.00,'BPR-2026Q2-400300-010','BPR Q2 2026 aggregate | Econ 22020803 PLANT / GENERATOR FUEL COST | Dept: School of Basic Mid Wifery Kano'),
('052100400300','overhead','22021001','','overhead-running-costs','other',1233838.75,'BPR-2026Q2-400300-011','BPR Q2 2026 aggregate | Econ 22021001 REFRESHMENT & MEALS | Dept: School of Basic Mid Wifery Kano'),
('052100400300','overhead','22021002','','overhead-running-costs','other',1223605.00,'BPR-2026Q2-400300-012','BPR Q2 2026 aggregate | Econ 22021002 HONORARIUM & SITTING ALLOWANCE | Dept: School of Basic Mid Wifery Kano'),
('052100400300','overhead','22021011','','overhead-running-costs','other',6149536.25,'BPR-2026Q2-400300-013','BPR Q2 2026 aggregate | Econ 22021011 OTHER MISCELLANEOUS | Dept: School of Basic Mid Wifery Kano'),
('052100400400','overhead','22020101','','overhead-running-costs','other',40000.00,'BPR-2026Q2-400400-001','BPR Q2 2026 aggregate | Econ 22020101 LOCAL TRAVEL & TRANSPORT: TRAINING | Dept: School of Basic Mid Wifery Dambatta'),
('052100400400','overhead','22020201','','overhead-running-costs','other',500000.00,'BPR-2026Q2-400400-002','BPR Q2 2026 aggregate | Econ 22020201 ELECTRICITY CHARGES | Dept: School of Basic Mid Wifery Dambatta'),
('052100400400','overhead','22020205','','overhead-running-costs','other',95850.00,'BPR-2026Q2-400400-003','BPR Q2 2026 aggregate | Econ 22020205 WATER RATES | Dept: School of Basic Mid Wifery Dambatta'),
('052100400400','overhead','22020209','','overhead-running-costs','other',11162875.00,'BPR-2026Q2-400400-004','BPR Q2 2026 aggregate | Econ 22020209 OTHER UTILITIES | Dept: School of Basic Mid Wifery Dambatta'),
('052100400400','overhead','22020301','','overhead-running-costs','other',613000.00,'BPR-2026Q2-400400-005','BPR Q2 2026 aggregate | Econ 22020301 OFFICE STATIONERIES / COMPUTER CONSUMABLES | Dept: School of Basic Mid Wifery Dambatta'),
('052100400400','overhead','22020305','','overhead-running-costs','other',112000.00,'BPR-2026Q2-400400-006','BPR Q2 2026 aggregate | Econ 22020305 PRINTING OF NON SECURITY DOCUMENTS | Dept: School of Basic Mid Wifery Dambatta'),
('052100400400','overhead','22020314','','overhead-running-costs','other',5065700.00,'BPR-2026Q2-400400-007','BPR Q2 2026 aggregate | Econ 22020314 EXAMINATION MATERIALS | Dept: School of Basic Mid Wifery Dambatta'),
('052100400400','overhead','22020401','','overhead-running-costs','other',1774100.00,'BPR-2026Q2-400400-008','BPR Q2 2026 aggregate | Econ 22020401 MAINTENANCE OF MOTOR VEHICLE / TRANSPORT EQUIPMENT | Dept: School of Basic Mid Wifery Dambatta'),
('052100400400','overhead','22020403','','overhead-running-costs','other',895000.00,'BPR-2026Q2-400400-009','BPR Q2 2026 aggregate | Econ 22020403 MAINTENANCE OF OFFICE BUILDING / RESIDENTIAL QTRS | Dept: School of Basic Mid Wifery Dambatta'),
('052100400400','overhead','22020406','','overhead-running-costs','other',417000.00,'BPR-2026Q2-400400-010','BPR Q2 2026 aggregate | Econ 22020406 OTHER MAINTENANCE SERVICES | Dept: School of Basic Mid Wifery Dambatta'),
('052100400400','overhead','22020501','','overhead-running-costs','other',1025000.00,'BPR-2026Q2-400400-011','BPR Q2 2026 aggregate | Econ 22020501 LOCAL TRAINING | Dept: School of Basic Mid Wifery Dambatta'),
('052100400400','overhead','22020709','','overhead-running-costs','other',30000.00,'BPR-2026Q2-400400-012','BPR Q2 2026 aggregate | Econ 22020709 AUDIT CONSULTANCY | Dept: School of Basic Mid Wifery Dambatta'),
('052100400400','overhead','22020801','','overhead-running-costs','other',170000.00,'BPR-2026Q2-400400-013','BPR Q2 2026 aggregate | Econ 22020801 MOTOR VEHICLE  FUEL COST | Dept: School of Basic Mid Wifery Dambatta'),
('052100400400','overhead','22020803','','overhead-running-costs','other',545000.00,'BPR-2026Q2-400400-014','BPR Q2 2026 aggregate | Econ 22020803 PLANT / GENERATOR FUEL COST | Dept: School of Basic Mid Wifery Dambatta'),
('052100400400','overhead','22021001','','overhead-running-costs','other',962000.00,'BPR-2026Q2-400400-015','BPR Q2 2026 aggregate | Econ 22021001 REFRESHMENT & MEALS | Dept: School of Basic Mid Wifery Dambatta'),
('052100400400','overhead','22021002','','overhead-running-costs','other',500000.00,'BPR-2026Q2-400400-016','BPR Q2 2026 aggregate | Econ 22021002 HONORARIUM & SITTING ALLOWANCE | Dept: School of Basic Mid Wifery Dambatta'),
('052100400400','overhead','22021011','','overhead-running-costs','other',4465400.00,'BPR-2026Q2-400400-017','BPR Q2 2026 aggregate | Econ 22021011 OTHER MISCELLANEOUS | Dept: School of Basic Mid Wifery Dambatta'),
('052100400600','overhead','22020201','','overhead-running-costs','other',42000.00,'BPR-2026Q2-400600-001','BPR Q2 2026 aggregate | Econ 22020201 ELECTRICITY CHARGES | Dept: School of Nursing  Madobi'),
('052100400600','overhead','22020209','','overhead-running-costs','other',2335000.00,'BPR-2026Q2-400600-002','BPR Q2 2026 aggregate | Econ 22020209 OTHER UTILITIES | Dept: School of Nursing  Madobi'),
('052100400600','overhead','22020301','','overhead-running-costs','other',2692100.00,'BPR-2026Q2-400600-003','BPR Q2 2026 aggregate | Econ 22020301 OFFICE STATIONERIES / COMPUTER CONSUMABLES | Dept: School of Nursing  Madobi'),
('052100400600','overhead','22020302','','overhead-running-costs','other',2772000.00,'BPR-2026Q2-400600-004','BPR Q2 2026 aggregate | Econ 22020302 BOOKS | Dept: School of Nursing  Madobi'),
('052100400600','overhead','22020314','','overhead-running-costs','other',4459200.00,'BPR-2026Q2-400600-005','BPR Q2 2026 aggregate | Econ 22020314 EXAMINATION MATERIALS | Dept: School of Nursing  Madobi'),
('052100400600','overhead','22020401','','overhead-running-costs','other',492100.00,'BPR-2026Q2-400600-006','BPR Q2 2026 aggregate | Econ 22020401 MAINTENANCE OF MOTOR VEHICLE / TRANSPORT EQUIPMENT | Dept: School of Nursing  Madobi'),
('052100400600','overhead','22020402','','overhead-running-costs','other',774000.00,'BPR-2026Q2-400600-007','BPR Q2 2026 aggregate | Econ 22020402 MAINTENANCE OF OFFICE FURNITURE | Dept: School of Nursing  Madobi'),
('052100400600','overhead','22020405','','overhead-running-costs','other',468000.00,'BPR-2026Q2-400600-008','BPR Q2 2026 aggregate | Econ 22020405 MAINTENANCE OF PLANTS/GENERATORS | Dept: School of Nursing  Madobi'),
('052100400600','overhead','22020501','','overhead-running-costs','other',55000.00,'BPR-2026Q2-400600-009','BPR Q2 2026 aggregate | Econ 22020501 LOCAL TRAINING | Dept: School of Nursing  Madobi'),
('052100400600','overhead','22020801','','overhead-running-costs','other',267000.00,'BPR-2026Q2-400600-010','BPR Q2 2026 aggregate | Econ 22020801 MOTOR VEHICLE  FUEL COST | Dept: School of Nursing  Madobi'),
('052100400600','overhead','22020803','','overhead-running-costs','other',320000.00,'BPR-2026Q2-400600-011','BPR Q2 2026 aggregate | Econ 22020803 PLANT / GENERATOR FUEL COST | Dept: School of Nursing  Madobi'),
('052100400600','overhead','22021011','','overhead-running-costs','other',5139900.00,'BPR-2026Q2-400600-012','BPR Q2 2026 aggregate | Econ 22021011 OTHER MISCELLANEOUS | Dept: School of Nursing  Madobi'),
('052100400700','overhead','22020203','','overhead-running-costs','other',115000.00,'BPR-2026Q2-400700-001','BPR Q2 2026 aggregate | Econ 22020203 INTERNET ACCESS CHARGES | Dept: School of Post Basic Anesthesia'),
('052100400700','overhead','22020209','','overhead-running-costs','other',150000.00,'BPR-2026Q2-400700-002','BPR Q2 2026 aggregate | Econ 22020209 OTHER UTILITIES | Dept: School of Post Basic Anesthesia'),
('052100400700','overhead','22020301','','overhead-running-costs','other',54000.00,'BPR-2026Q2-400700-003','BPR Q2 2026 aggregate | Econ 22020301 OFFICE STATIONERIES / COMPUTER CONSUMABLES | Dept: School of Post Basic Anesthesia'),
('052100400700','overhead','22020306','','overhead-running-costs','other',300000.00,'BPR-2026Q2-400700-004','BPR Q2 2026 aggregate | Econ 22020306 PRINTING OF SECURITY DOCUMENTS | Dept: School of Post Basic Anesthesia'),
('052100400700','overhead','22020308','','overhead-running-costs','other',157000.00,'BPR-2026Q2-400700-005','BPR Q2 2026 aggregate | Econ 22020308 FIELD & CAMPING MATERIALS SUPPLIES | Dept: School of Post Basic Anesthesia'),
('052100400700','overhead','22020314','','overhead-running-costs','other',475000.00,'BPR-2026Q2-400700-006','BPR Q2 2026 aggregate | Econ 22020314 EXAMINATION MATERIALS | Dept: School of Post Basic Anesthesia'),
('052100400700','overhead','22020404','','overhead-running-costs','other',195000.00,'BPR-2026Q2-400700-007','BPR Q2 2026 aggregate | Econ 22020404 MAINTENANCE OF OFFICE / IT EQUIPMENTS | Dept: School of Post Basic Anesthesia'),
('052100400700','overhead','22020406','','overhead-running-costs','other',43250.00,'BPR-2026Q2-400700-008','BPR Q2 2026 aggregate | Econ 22020406 OTHER MAINTENANCE SERVICES | Dept: School of Post Basic Anesthesia'),
('052100400700','overhead','22020501','','overhead-running-costs','other',658000.00,'BPR-2026Q2-400700-009','BPR Q2 2026 aggregate | Econ 22020501 LOCAL TRAINING | Dept: School of Post Basic Anesthesia'),
('052100400700','overhead','22020701','','overhead-running-costs','other',260000.00,'BPR-2026Q2-400700-010','BPR Q2 2026 aggregate | Econ 22020701 FINANCIAL CONSULTING | Dept: School of Post Basic Anesthesia'),
('052100400700','overhead','22020801','','overhead-running-costs','other',544750.00,'BPR-2026Q2-400700-011','BPR Q2 2026 aggregate | Econ 22020801 MOTOR VEHICLE  FUEL COST | Dept: School of Post Basic Anesthesia'),
('052100400700','overhead','22020803','','overhead-running-costs','other',92000.00,'BPR-2026Q2-400700-012','BPR Q2 2026 aggregate | Econ 22020803 PLANT / GENERATOR FUEL COST | Dept: School of Post Basic Anesthesia'),
('052100400700','overhead','22021002','','overhead-running-costs','other',292000.00,'BPR-2026Q2-400700-013','BPR Q2 2026 aggregate | Econ 22021002 HONORARIUM & SITTING ALLOWANCE | Dept: School of Post Basic Anesthesia'),
('052100400700','overhead','22021011','','overhead-running-costs','other',1177000.00,'BPR-2026Q2-400700-014','BPR Q2 2026 aggregate | Econ 22021011 OTHER MISCELLANEOUS | Dept: School of Post Basic Anesthesia'),
('052100400700','overhead','22021021','','overhead-running-costs','other',156000.00,'BPR-2026Q2-400700-015','BPR Q2 2026 aggregate | Econ 22021021 SPECIAL DAYS/CELEBRATIONS | Dept: School of Post Basic Anesthesia'),
('052100400800','overhead','22020101','','overhead-running-costs','other',205000.00,'BPR-2026Q2-400800-001','BPR Q2 2026 aggregate | Econ 22020101 LOCAL TRAVEL & TRANSPORT: TRAINING | Dept: School of Basic Mid Wifery Gwarzo'),
('052100400800','overhead','22020201','','overhead-running-costs','other',264500.00,'BPR-2026Q2-400800-002','BPR Q2 2026 aggregate | Econ 22020201 ELECTRICITY CHARGES | Dept: School of Basic Mid Wifery Gwarzo'),
('052100400800','overhead','22020205','','overhead-running-costs','other',23000.00,'BPR-2026Q2-400800-003','BPR Q2 2026 aggregate | Econ 22020205 WATER RATES | Dept: School of Basic Mid Wifery Gwarzo'),
('052100400800','overhead','22020209','','overhead-running-costs','other',915500.00,'BPR-2026Q2-400800-004','BPR Q2 2026 aggregate | Econ 22020209 OTHER UTILITIES | Dept: School of Basic Mid Wifery Gwarzo'),
('052100400800','overhead','22020301','','overhead-running-costs','other',130000.00,'BPR-2026Q2-400800-005','BPR Q2 2026 aggregate | Econ 22020301 OFFICE STATIONERIES / COMPUTER CONSUMABLES | Dept: School of Basic Mid Wifery Gwarzo'),
('052100400800','overhead','22020305','','overhead-running-costs','other',170000.00,'BPR-2026Q2-400800-006','BPR Q2 2026 aggregate | Econ 22020305 PRINTING OF NON SECURITY DOCUMENTS | Dept: School of Basic Mid Wifery Gwarzo'),
('052100400800','overhead','22020314','','overhead-running-costs','other',315000.00,'BPR-2026Q2-400800-007','BPR Q2 2026 aggregate | Econ 22020314 EXAMINATION MATERIALS | Dept: School of Basic Mid Wifery Gwarzo'),
('052100400800','overhead','22020404','','overhead-running-costs','other',130000.00,'BPR-2026Q2-400800-008','BPR Q2 2026 aggregate | Econ 22020404 MAINTENANCE OF OFFICE / IT EQUIPMENTS | Dept: School of Basic Mid Wifery Gwarzo'),
('052100400800','overhead','22020501','','overhead-running-costs','other',1483000.00,'BPR-2026Q2-400800-009','BPR Q2 2026 aggregate | Econ 22020501 LOCAL TRAINING | Dept: School of Basic Mid Wifery Gwarzo'),
('052100400800','overhead','22020801','','overhead-running-costs','other',106900.00,'BPR-2026Q2-400800-010','BPR Q2 2026 aggregate | Econ 22020801 MOTOR VEHICLE  FUEL COST | Dept: School of Basic Mid Wifery Gwarzo'),
('052100400800','overhead','22021001','','overhead-running-costs','other',390500.00,'BPR-2026Q2-400800-011','BPR Q2 2026 aggregate | Econ 22021001 REFRESHMENT & MEALS | Dept: School of Basic Mid Wifery Gwarzo'),
('052100400800','overhead','22021002','','overhead-running-costs','other',110500.00,'BPR-2026Q2-400800-012','BPR Q2 2026 aggregate | Econ 22021002 HONORARIUM & SITTING ALLOWANCE | Dept: School of Basic Mid Wifery Gwarzo'),
('052100400800','overhead','22021011','','overhead-running-costs','other',6688000.00,'BPR-2026Q2-400800-013','BPR Q2 2026 aggregate | Econ 22021011 OTHER MISCELLANEOUS | Dept: School of Basic Mid Wifery Gwarzo'),
('052100500100','capital','23020106','467a7503cfc3b346412e6d48d06298a3','capital-expenditure','planning-research-statistics',106625050.00,'BPR-2026Q2-500100-001','BPR Q2 2026 aggregate | Econ 23020106 CONSTRUCTION / PROVISION OF HOSPITALS / HEALTH CENTRES | Dept: Planning, Monitoring & Evaluation | Project: Implementation Of Minimal Service Package (MSP) Investment Plan In The State'),
('052100500100','capital','23030105','59a77cc2d9b47c1aa7b55571d394a3ad','capital-expenditure','disease-control',465273032.00,'BPR-2026Q2-500100-002','BPR Q2 2026 aggregate | Econ 23030105 REHABILITATION / REPAIRS - HOSPITAL / HEALTH CENTRES | Dept: Disease Control | Project: Conduction/Provision Of Routine Immunization Programme Across The State'),
('052100500100','capital','23030105','1e63374119ba7bc5e3206665a51b4baa','capital-expenditure','environmental-public-health',54994781.00,'BPR-2026Q2-500100-003','BPR Q2 2026 aggregate | Econ 23030105 REHABILITATION / REPAIRS - HOSPITAL / HEALTH CENTRES | Dept: Environmental & Public Health | Project: Implementation Of Community-Based Health Workers (CBHW) In The State'),
('052100500100','capital','23030127','3c5c942b59a755095af2cfbb49a932fc','capital-expenditure','environmental-public-health',9666000.00,'BPR-2026Q2-500100-004','BPR Q2 2026 aggregate | Econ 23030127 REHABILITATION/REPAIRS- ICT INFRASTRUCTURES | Dept: Environmental & Public Health | Project: Participatory Learning And Action For Community Ownership (PLACO) Activities  And  Ward Development  Committee Activities (WDC)'),
('052100500100','capital','23050103','56afeed221e6e943ed18469a717c09fd','capital-expenditure','planning-research-statistics',24323550.00,'BPR-2026Q2-500100-005','BPR Q2 2026 aggregate | Econ 23050103 MONITORING AND EVALUATION | Dept: Planning, Monitoring & Evaluation | Project: Support The Operation Of  Human Resource For Health Management Information System/Strengthening Administrative And Financial Coordination, Harmonization And Alignment At All PHC Levels'),
('052100500100','capital','23050128','9fd406ab02c4f55ca62529184083a415','capital-expenditure','planning-research-statistics',7165050.00,'BPR-2026Q2-500100-006','BPR Q2 2026 aggregate | Econ 23050128 OTHER NON-TANGIBLE ASSETS | Dept: Planning, Monitoring & Evaluation | Project: Coordination Of The Development Of Evidence Base And Costed Annual Operational Plan Of The Board And  LGA PHC  Department'),
('052100500100','capital','23050128','189caa08b02eb67a4cd7d4d55eda6411','capital-expenditure','admin-general-services',23701000.00,'BPR-2026Q2-500100-007','BPR Q2 2026 aggregate | Econ 23050128 OTHER NON-TANGIBLE ASSETS | Dept: Admin & General Services | Project: Strengthening Administrative And Financial Coordination, Harmonization And Alignment At All PHC Levels'),
('052100500100','capital','23050128','a44553c411e16649bb5c7a5060b85b8e','capital-expenditure','admin-general-services',1522500.00,'BPR-2026Q2-500100-008','BPR Q2 2026 aggregate | Econ 23050128 OTHER NON-TANGIBLE ASSETS | Dept: Admin & General Services | Project: Strengthening Financial Management Oversight And Control Through Risk Protection Of Pooled Funds At Both State And Federal'),
('052100500100','overhead','22020101','','overhead-running-costs','admin-general-services',626947782.13,'BPR-2026Q2-500100-009','BPR Q2 2026 aggregate | Econ 22020101 LOCAL TRAVEL & TRANSPORT: TRAINING | Dept: Admin & General Services'),
('052100500100','overhead','22020203','','overhead-running-costs','admin-general-services',920000.00,'BPR-2026Q2-500100-010','BPR Q2 2026 aggregate | Econ 22020203 INTERNET ACCESS CHARGES | Dept: Admin & General Services'),
('052100500100','overhead','22020205','','overhead-running-costs','admin-general-services',68000.00,'BPR-2026Q2-500100-011','BPR Q2 2026 aggregate | Econ 22020205 WATER RATES | Dept: Admin & General Services'),
('052100500100','overhead','22020301','','overhead-running-costs','admin-general-services',31000.00,'BPR-2026Q2-500100-012','BPR Q2 2026 aggregate | Econ 22020301 OFFICE STATIONERIES / COMPUTER CONSUMABLES | Dept: Admin & General Services'),
('052100500100','overhead','22020401','','overhead-running-costs','admin-general-services',11672440.00,'BPR-2026Q2-500100-013','BPR Q2 2026 aggregate | Econ 22020401 MAINTENANCE OF MOTOR VEHICLE / TRANSPORT EQUIPMENT | Dept: Admin & General Services'),
('052100500100','overhead','22020402','','overhead-running-costs','admin-general-services',214500.00,'BPR-2026Q2-500100-014','BPR Q2 2026 aggregate | Econ 22020402 MAINTENANCE OF OFFICE FURNITURE | Dept: Admin & General Services'),
('052100500100','overhead','22020403','','overhead-running-costs','admin-general-services',1010433.00,'BPR-2026Q2-500100-015','BPR Q2 2026 aggregate | Econ 22020403 MAINTENANCE OF OFFICE BUILDING / RESIDENTIAL QTRS | Dept: Admin & General Services'),
('052100500100','overhead','22020404','','overhead-running-costs','admin-general-services',261000.00,'BPR-2026Q2-500100-016','BPR Q2 2026 aggregate | Econ 22020404 MAINTENANCE OF OFFICE / IT EQUIPMENTS | Dept: Admin & General Services'),
('052100500100','overhead','22020406','','overhead-running-costs','admin-general-services',2584000.00,'BPR-2026Q2-500100-017','BPR Q2 2026 aggregate | Econ 22020406 OTHER MAINTENANCE SERVICES | Dept: Admin & General Services'),
('052100500100','overhead','22020501','','overhead-running-costs','admin-general-services',3135000.00,'BPR-2026Q2-500100-018','BPR Q2 2026 aggregate | Econ 22020501 LOCAL TRAINING | Dept: Admin & General Services'),
('052100500100','overhead','22020801','','overhead-running-costs','admin-general-services',2114495.00,'BPR-2026Q2-500100-019','BPR Q2 2026 aggregate | Econ 22020801 MOTOR VEHICLE  FUEL COST | Dept: Admin & General Services'),
('052100500100','overhead','22020803','','overhead-running-costs','admin-general-services',2039100.00,'BPR-2026Q2-500100-020','BPR Q2 2026 aggregate | Econ 22020803 PLANT / GENERATOR FUEL COST | Dept: Admin & General Services'),
('052100500100','overhead','22021001','','overhead-running-costs','admin-general-services',270000.00,'BPR-2026Q2-500100-021','BPR Q2 2026 aggregate | Econ 22021001 REFRESHMENT & MEALS | Dept: Admin & General Services'),
('052100500100','overhead','22021003','','overhead-running-costs','admin-general-services',398000.00,'BPR-2026Q2-500100-022','BPR Q2 2026 aggregate | Econ 22021003 PUBLICITY & ADVERTISEMENTS | Dept: Admin & General Services'),
('052100500100','overhead','22021011','','overhead-running-costs','admin-general-services',1663560.00,'BPR-2026Q2-500100-023','BPR Q2 2026 aggregate | Econ 22021011 OTHER MISCELLANEOUS | Dept: Admin & General Services'),
('052100500100','personnel','21010101','','personnel-costs','admin-general-services',164303829.18,'BPR-2026Q2-500100-024','BPR Q2 2026 aggregate | Econ 21010101 SALARY | Dept: Admin & General Services'),
('052100500100','personnel','21020107','','personnel-costs','admin-general-services',15000000.00,'BPR-2026Q2-500100-025','BPR Q2 2026 aggregate | Econ 21020107 ENTERTAINMENT ALLOWANCE | Dept: Admin & General Services'),
('052100500100','personnel','21020114','','personnel-costs','admin-general-services',6027502.39,'BPR-2026Q2-500100-026','BPR Q2 2026 aggregate | Econ 21020114 MEDICAL ALLOWANCE | Dept: Admin & General Services'),
('052100500100','personnel','21020202','','personnel-costs','admin-general-services',8835550.96,'BPR-2026Q2-500100-027','BPR Q2 2026 aggregate | Econ 21020202 CONTRIBUTORY PENSION | Dept: Admin & General Services'),
('052100600100','capital','23050128','2045d7bc13293ed12ea35922f6e1dba0','capital-expenditure','other',5445000.00,'BPR-2026Q2-600100-001','BPR Q2 2026 aggregate | Econ 23050128 OTHER NON-TANGIBLE ASSETS | Dept: Procurement Supply and Distribution Department | Project: Increasing The Uptake And Acess To HIV Testing, Treatment, Care, Viral Suppression'),
('052100600100','capital','23050128','b52e063bac373cc3d17d48ec2a0fc507','capital-expenditure','pharmaceutical-services',1836000.00,'BPR-2026Q2-600100-002','BPR Q2 2026 aggregate | Econ 23050128 OTHER NON-TANGIBLE ASSETS | Dept: Pharmaceutical Department | Project: Reach, Treat And Sustain Vertical HIV Transmission And Paediatrics Interventions'),
('052100600100','overhead','22020401','','overhead-running-costs','admin-general-services',240500.00,'BPR-2026Q2-600100-003','BPR Q2 2026 aggregate | Econ 22020401 MAINTENANCE OF MOTOR VEHICLE / TRANSPORT EQUIPMENT | Dept: Admin & General Services'),
('052100600100','overhead','22020403','','overhead-running-costs','admin-general-services',205000.00,'BPR-2026Q2-600100-004','BPR Q2 2026 aggregate | Econ 22020403 MAINTENANCE OF OFFICE BUILDING / RESIDENTIAL QTRS | Dept: Admin & General Services'),
('052100600100','overhead','22020404','','overhead-running-costs','admin-general-services',422500.00,'BPR-2026Q2-600100-005','BPR Q2 2026 aggregate | Econ 22020404 MAINTENANCE OF OFFICE / IT EQUIPMENTS | Dept: Admin & General Services'),
('052100600100','overhead','22020801','','overhead-running-costs','admin-general-services',1092000.00,'BPR-2026Q2-600100-006','BPR Q2 2026 aggregate | Econ 22020801 MOTOR VEHICLE  FUEL COST | Dept: Admin & General Services'),
('052100600100','overhead','22021001','','overhead-running-costs','admin-general-services',40000.00,'BPR-2026Q2-600100-007','BPR Q2 2026 aggregate | Econ 22021001 REFRESHMENT & MEALS | Dept: Admin & General Services'),
('052100800100','capital','23010112','f1f4c6a0e1987f230e39043b307fa876','capital-expenditure','admin-general-services',960000.00,'BPR-2026Q2-800100-001','BPR Q2 2026 aggregate | Econ 23010112 PURCHASE OF OFFICE FURNITURE AND FITTINGS | Dept: Admin & General Services | Project: Purchase Of Office Furniture'),
('052100800100','capital','23020124','f4579567c26cb9ab5fa823151c5ae9ab','capital-expenditure','planning-research-statistics',4770000.00,'BPR-2026Q2-800100-002','BPR Q2 2026 aggregate | Econ 23020124 CONSTRUCTION OF MARKETS/PARKS | Dept: Planning, Research & Statistics | Project: Provision Of Parking Shade At The Agency'),
('052100800100','capital','23020128','d6f26f5d9318cd52d0438dab6ca78f76','capital-expenditure','planning-research-statistics',4770000.00,'BPR-2026Q2-800100-003','BPR Q2 2026 aggregate | Econ 23020128 OTHER CONSTRUCTION | Dept: Planning, Research & Statistics | Project: Construction Of Gate, Sign Board And Bill Boards At Agency H/Q'),
('052100800100','capital','23020128','c13f24aff14e785756b5a257513a8097','capital-expenditure','health-management-programmes',4777000.00,'BPR-2026Q2-800100-004','BPR Q2 2026 aggregate | Econ 23020128 OTHER CONSTRUCTION | Dept: Programmes (Health Management) | Project: Establishment Of Kschma Registration Centres At 20 Major Public Places Across The State'),
('052100800100','capital','23050128','acf6d2b907a67508470516607f05c03f','capital-expenditure','health-management-programmes',1251692430.78,'BPR-2026Q2-800100-005','BPR Q2 2026 aggregate | Econ 23050128 OTHER NON-TANGIBLE ASSETS | Dept: Programmes (Health Management) | Project: Implementation Of The BHCPF'),
('052100800100','capital','23050128','405fa4531ba2fd18fc348c443209ab80','capital-expenditure','health-management-programmes',3013653138.82,'BPR-2026Q2-800100-006','BPR Q2 2026 aggregate | Econ 23050128 OTHER NON-TANGIBLE ASSETS | Dept: Programmes (Health Management) | Project: Implementation Of The Formal Sector And Other Contributory Healthcare Programme'),
('052100800100','capital','23050128','1b7bfa710ede5739dff4ed33f3872bc1','capital-expenditure','health-management-programmes',39679567.64,'BPR-2026Q2-800100-007','BPR Q2 2026 aggregate | Econ 23050128 OTHER NON-TANGIBLE ASSETS | Dept: Programmes (Health Management) | Project: Vulnerable Healthcare Programme'),
('052100800100','overhead','22020101','','overhead-running-costs','admin-general-services',8599148.00,'BPR-2026Q2-800100-008','BPR Q2 2026 aggregate | Econ 22020101 LOCAL TRAVEL & TRANSPORT: TRAINING | Dept: Admin & General Services'),
('052100800100','overhead','22020202','','overhead-running-costs','admin-general-services',1678158.00,'BPR-2026Q2-800100-009','BPR Q2 2026 aggregate | Econ 22020202 TELEPHONE CHARGES | Dept: Admin & General Services'),
('052100800100','overhead','22020203','','overhead-running-costs','admin-general-services',824998.00,'BPR-2026Q2-800100-010','BPR Q2 2026 aggregate | Econ 22020203 INTERNET ACCESS CHARGES | Dept: Admin & General Services'),
('052100800100','overhead','22020205','','overhead-running-costs','admin-general-services',1338000.00,'BPR-2026Q2-800100-011','BPR Q2 2026 aggregate | Econ 22020205 WATER RATES | Dept: Admin & General Services'),
('052100800100','overhead','22020206','','overhead-running-costs','admin-general-services',400000.00,'BPR-2026Q2-800100-012','BPR Q2 2026 aggregate | Econ 22020206 SEWERAGE CHARGES | Dept: Admin & General Services'),
('052100800100','overhead','22020301','','overhead-running-costs','planning-research-statistics',1420000.00,'BPR-2026Q2-800100-013','BPR Q2 2026 aggregate | Econ 22020301 OFFICE STATIONERIES / COMPUTER CONSUMABLES | Dept: Planning, Research & Statistics'),
('052100800100','overhead','22020305','','overhead-running-costs','planning-research-statistics',19152499.99,'BPR-2026Q2-800100-014','BPR Q2 2026 aggregate | Econ 22020305 PRINTING OF NON SECURITY DOCUMENTS | Dept: Planning, Research & Statistics'),
('052100800100','overhead','22020306','','overhead-running-costs','planning-research-statistics',445000.00,'BPR-2026Q2-800100-015','BPR Q2 2026 aggregate | Econ 22020306 PRINTING OF SECURITY DOCUMENTS | Dept: Planning, Research & Statistics'),
('052100800100','overhead','22020309','','overhead-running-costs','planning-research-statistics',525000.00,'BPR-2026Q2-800100-016','BPR Q2 2026 aggregate | Econ 22020309 UNIFORMS & OTHER CLOTHING | Dept: Planning, Research & Statistics'),
('052100800100','overhead','22020316','','overhead-running-costs','planning-research-statistics',10661000.01,'BPR-2026Q2-800100-017','BPR Q2 2026 aggregate | Econ 22020316 OTHER MATERIALS AND SUPPLY | Dept: Planning, Research & Statistics'),
('052100800100','overhead','22020401','','overhead-running-costs','admin-general-services',4422750.00,'BPR-2026Q2-800100-018','BPR Q2 2026 aggregate | Econ 22020401 MAINTENANCE OF MOTOR VEHICLE / TRANSPORT EQUIPMENT | Dept: Admin & General Services'),
('052100800100','overhead','22020403','','overhead-running-costs','admin-general-services',14704740.00,'BPR-2026Q2-800100-019','BPR Q2 2026 aggregate | Econ 22020403 MAINTENANCE OF OFFICE BUILDING / RESIDENTIAL QTRS | Dept: Admin & General Services'),
('052100800100','overhead','22020404','','overhead-running-costs','admin-general-services',3008900.00,'BPR-2026Q2-800100-020','BPR Q2 2026 aggregate | Econ 22020404 MAINTENANCE OF OFFICE / IT EQUIPMENTS | Dept: Admin & General Services'),
('052100800100','overhead','22020417','','overhead-running-costs','admin-general-services',6672800.01,'BPR-2026Q2-800100-021','BPR Q2 2026 aggregate | Econ 22020417 MAINTENANCE OF OTHER INFRASTRUCTURE | Dept: Admin & General Services'),
('052100800100','overhead','22020501','','overhead-running-costs','admin-general-services',18718786.01,'BPR-2026Q2-800100-022','BPR Q2 2026 aggregate | Econ 22020501 LOCAL TRAINING | Dept: Admin & General Services'),
('052100800100','overhead','22020601','','overhead-running-costs','admin-general-services',1500000.00,'BPR-2026Q2-800100-023','BPR Q2 2026 aggregate | Econ 22020601 SECURITY SERVICES | Dept: Admin & General Services'),
('052100800100','overhead','22020702','','overhead-running-costs','information-communication-technology',97587502.76,'BPR-2026Q2-800100-024','BPR Q2 2026 aggregate | Econ 22020702 INFORMATION TECHNOLOGY CONSULTING | Dept: Information and Communication Technology'),
('052100800100','overhead','22020703','','overhead-running-costs','admin-general-services',1400000.00,'BPR-2026Q2-800100-025','BPR Q2 2026 aggregate | Econ 22020703 LEGAL SERVICES | Dept: Admin & General Services'),
('052100800100','overhead','22020801','','overhead-running-costs','admin-general-services',5000000.01,'BPR-2026Q2-800100-026','BPR Q2 2026 aggregate | Econ 22020801 MOTOR VEHICLE  FUEL COST | Dept: Admin & General Services'),
('052100800100','overhead','22020901','','overhead-running-costs','other',1103606.48,'BPR-2026Q2-800100-027','BPR Q2 2026 aggregate | Econ 22020901 BANK CHARGES (OTHER THAN INTEREST) | Dept: Account Investment & Contribution'),
('052100800100','overhead','22021001','','overhead-running-costs','admin-general-services',21614655.19,'BPR-2026Q2-800100-028','BPR Q2 2026 aggregate | Econ 22021001 REFRESHMENT & MEALS | Dept: Admin & General Services'),
('052100800100','overhead','22021002','','overhead-running-costs','admin-general-services',5354000.00,'BPR-2026Q2-800100-029','BPR Q2 2026 aggregate | Econ 22021002 HONORARIUM & SITTING ALLOWANCE | Dept: Admin & General Services'),
('052100800100','overhead','22021003','','overhead-running-costs','admin-general-services',78664433.76,'BPR-2026Q2-800100-030','BPR Q2 2026 aggregate | Econ 22021003 PUBLICITY & ADVERTISEMENTS | Dept: Admin & General Services'),
('052100800100','overhead','22021006','','overhead-running-costs','admin-general-services',81500.00,'BPR-2026Q2-800100-031','BPR Q2 2026 aggregate | Econ 22021006 POSTAGES & COURIER SERVICES | Dept: Admin & General Services'),
('052100800100','overhead','22021007','','overhead-running-costs','admin-general-services',128825750.01,'BPR-2026Q2-800100-032','BPR Q2 2026 aggregate | Econ 22021007 WELFARE PACKAGES | Dept: Admin & General Services'),
('052100800100','overhead','22021011','','overhead-running-costs','admin-general-services',49810500.00,'BPR-2026Q2-800100-033','BPR Q2 2026 aggregate | Econ 22021011 OTHER MISCELLANEOUS | Dept: Admin & General Services'),
('052100900100','capital','23010104','e88f88d80e0d524f3a7d8a081b1c30e4','capital-expenditure','planning-research-statistics',15500000.00,'BPR-2026Q2-900100-001','BPR Q2 2026 aggregate | Econ 23010104 PURCHASE MOTOR CYCLES | Dept: Planning, Research & Statistics | Project: Procurement Of  Operational Vehicles (Toyota Hilux Engine (08m 03 Kn) And Motorcycle (Boxer 125cc Model), 1no D.I Printer Bizhub C368)'),
('052100900100','capital','23010113','66709f32e59f30b39c288f0f17329d76','capital-expenditure','planning-research-statistics',40200000.00,'BPR-2026Q2-900100-002','BPR Q2 2026 aggregate | Econ 23010113 PURCHASE OF COMPUTERS | Dept: Planning, Research & Statistics | Project: Procureement Of Office Equipments (15no Computers,  2no. Hisense Smart Projector 86 Inch)'),
('052100900100','capital','23010122','e150a38b7c3f995ffe3bb6da293e0538','capital-expenditure','other',95220000.00,'BPR-2026Q2-900100-003','BPR Q2 2026 aggregate | Econ 23010122 PURCHASE OF HEALTH / MEDICAL EQUIPMENT | Dept: Office of the Executive Chairman/ Secretary / MD | Project: Disbursement Of  6% Remittances To Other Services & Diseases (Such As: Sickle Cell, Drug Abuse/Psychiatric Illnesses, HIV, TB/Leprosy, Etc.) Monthly To Improve Healthcare Services In The State'),
('052100900100','capital','23010122','82d52ab7f49aa14cb72f2dd3fe57a4a6','capital-expenditure','other',11961900.00,'BPR-2026Q2-900100-004','BPR Q2 2026 aggregate | Econ 23010122 PURCHASE OF HEALTH / MEDICAL EQUIPMENT | Dept: Office of the Executive Chairman/ Secretary / MD | Project: Disbursement Of 10% Remittances To Malaria And Nutrition Program Montly To Augment Their Services'),
('052100900100','capital','23010122','cabd6612efbe86086e746fc5dde32019','capital-expenditure','other',50127681.00,'BPR-2026Q2-900100-005','BPR Q2 2026 aggregate | Econ 23010122 PURCHASE OF HEALTH / MEDICAL EQUIPMENT | Dept: Office of the Executive Chairman/ Secretary / MD | Project: Disbursement Of 5% Remiitances To Free Maternal And Child Healthcare Program Monthly To Reduce Maternal Mortality Rate In The State'),
('052100900100','capital','23020118','3798a308e5224ea53cae7cac7fc8340c','capital-expenditure','other',164584200.00,'BPR-2026Q2-900100-006','BPR Q2 2026 aggregate | Econ 23020118 CONSTRUCTION / PROVISION OF INFRASTRUCTURE | Dept: Office of the Executive Chairman/ Secretary / MD | Project: Disbursement Of 25%  Remittances To State Owned Health Institutions Monthly For Procuments Of Teaching AIDs And Capacity Building'),
('052100900100','capital','23020118','10f8a064aaffa7b04414000acaae1fea','capital-expenditure','other',290851040.00,'BPR-2026Q2-900100-007','BPR Q2 2026 aggregate | Econ 23020118 CONSTRUCTION / PROVISION OF INFRASTRUCTURE | Dept: Office of the Executive Chairman/ Secretary / MD | Project: Disbursement Of 50% Remitances To Primary, Secondary And Tertiary Health Facilities Monthly To Improve Healtcare Service Delivery'),
('052100900100','overhead','22020101','','overhead-running-costs','admin-general-services',443000.00,'BPR-2026Q2-900100-008','BPR Q2 2026 aggregate | Econ 22020101 LOCAL TRAVEL & TRANSPORT: TRAINING | Dept: Admin & General Services'),
('052100900100','overhead','22020102','','overhead-running-costs','admin-general-services',3150000.00,'BPR-2026Q2-900100-009','BPR Q2 2026 aggregate | Econ 22020102 LOCAL TRAVEL & TRANSPORT: OTHERS | Dept: Admin & General Services'),
('052100900100','overhead','22020201','','overhead-running-costs','admin-general-services',489000.00,'BPR-2026Q2-900100-010','BPR Q2 2026 aggregate | Econ 22020201 ELECTRICITY CHARGES | Dept: Admin & General Services'),
('052100900100','overhead','22020209','','overhead-running-costs','admin-general-services',360000.00,'BPR-2026Q2-900100-011','BPR Q2 2026 aggregate | Econ 22020209 OTHER UTILITIES | Dept: Admin & General Services'),
('052100900100','overhead','22020301','','overhead-running-costs','admin-general-services',515000.00,'BPR-2026Q2-900100-012','BPR Q2 2026 aggregate | Econ 22020301 OFFICE STATIONERIES / COMPUTER CONSUMABLES | Dept: Admin & General Services'),
('052100900100','overhead','22020305','','overhead-running-costs','admin-general-services',1210000.00,'BPR-2026Q2-900100-013','BPR Q2 2026 aggregate | Econ 22020305 PRINTING OF NON SECURITY DOCUMENTS | Dept: Admin & General Services'),
('052100900100','overhead','22020307','','overhead-running-costs','admin-general-services',190000.00,'BPR-2026Q2-900100-014','BPR Q2 2026 aggregate | Econ 22020307 DRUGS/LABORATORY/MEDICAL SUPPLIES | Dept: Admin & General Services'),
('052100900100','overhead','22020401','','overhead-running-costs','admin-general-services',270000.00,'BPR-2026Q2-900100-015','BPR Q2 2026 aggregate | Econ 22020401 MAINTENANCE OF MOTOR VEHICLE / TRANSPORT EQUIPMENT | Dept: Admin & General Services'),
('052100900100','overhead','22020403','','overhead-running-costs','admin-general-services',480000.00,'BPR-2026Q2-900100-016','BPR Q2 2026 aggregate | Econ 22020403 MAINTENANCE OF OFFICE BUILDING / RESIDENTIAL QTRS | Dept: Admin & General Services'),
('052100900100','overhead','22020406','','overhead-running-costs','admin-general-services',698000.00,'BPR-2026Q2-900100-017','BPR Q2 2026 aggregate | Econ 22020406 OTHER MAINTENANCE SERVICES | Dept: Admin & General Services'),
('052100900100','overhead','22020501','','overhead-running-costs','admin-general-services',340000.00,'BPR-2026Q2-900100-018','BPR Q2 2026 aggregate | Econ 22020501 LOCAL TRAINING | Dept: Admin & General Services'),
('052100900100','overhead','22020601','','overhead-running-costs','admin-general-services',1321532.30,'BPR-2026Q2-900100-019','BPR Q2 2026 aggregate | Econ 22020601 SECURITY SERVICES | Dept: Admin & General Services'),
('052100900100','overhead','22020801','','overhead-running-costs','admin-general-services',2528300.00,'BPR-2026Q2-900100-020','BPR Q2 2026 aggregate | Econ 22020801 MOTOR VEHICLE  FUEL COST | Dept: Admin & General Services'),
('052100900100','overhead','22021001','','overhead-running-costs','admin-general-services',16875000.00,'BPR-2026Q2-900100-021','BPR Q2 2026 aggregate | Econ 22021001 REFRESHMENT & MEALS | Dept: Admin & General Services'),
('052100900100','overhead','22021002','','overhead-running-costs','admin-general-services',4000000.00,'BPR-2026Q2-900100-022','BPR Q2 2026 aggregate | Econ 22021002 HONORARIUM & SITTING ALLOWANCE | Dept: Admin & General Services'),
('052100900100','overhead','22021003','','overhead-running-costs','admin-general-services',843600.00,'BPR-2026Q2-900100-023','BPR Q2 2026 aggregate | Econ 22021003 PUBLICITY & ADVERTISEMENTS | Dept: Admin & General Services'),
('052100900100','overhead','22021007','','overhead-running-costs','admin-general-services',1045000.00,'BPR-2026Q2-900100-024','BPR Q2 2026 aggregate | Econ 22021007 WELFARE PACKAGES | Dept: Admin & General Services'),
('052100900100','overhead','22021008','','overhead-running-costs','admin-general-services',236400.00,'BPR-2026Q2-900100-025','BPR Q2 2026 aggregate | Econ 22021008 SUBSCRIPTION TO PROFESSIONAL BODIES | Dept: Admin & General Services'),
('052100900100','overhead','22021011','','overhead-running-costs','admin-general-services',540000.00,'BPR-2026Q2-900100-026','BPR Q2 2026 aggregate | Econ 22021011 OTHER MISCELLANEOUS | Dept: Admin & General Services'),
('052100900100','overhead','22021021','','overhead-running-costs','admin-general-services',1044000.00,'BPR-2026Q2-900100-027','BPR Q2 2026 aggregate | Econ 22021021 SPECIAL DAYS/CELEBRATIONS | Dept: Admin & General Services'),
('052101000100','overhead','22020102','','overhead-running-costs','other',50000.00,'BPR-2026Q2-000100-001','BPR Q2 2026 aggregate | Econ 22020102 LOCAL TRAVEL & TRANSPORT: OTHERS | Dept: Kano State College Of Health Science & Technology Head Quarter'),
('052101000100','overhead','22020205','','overhead-running-costs','other',5500.00,'BPR-2026Q2-000100-002','BPR Q2 2026 aggregate | Econ 22020205 WATER RATES | Dept: Kano State College Of Health Science & Technology Head Quarter'),
('052101000100','overhead','22020301','','overhead-running-costs','other',89000.00,'BPR-2026Q2-000100-003','BPR Q2 2026 aggregate | Econ 22020301 OFFICE STATIONERIES / COMPUTER CONSUMABLES | Dept: Kano State College Of Health Science & Technology Head Quarter'),
('052101000100','overhead','22020306','','overhead-running-costs','other',199000.00,'BPR-2026Q2-000100-004','BPR Q2 2026 aggregate | Econ 22020306 PRINTING OF SECURITY DOCUMENTS | Dept: Kano State College Of Health Science & Technology Head Quarter'),
('052101000100','overhead','22020307','','overhead-running-costs','other',107400.00,'BPR-2026Q2-000100-005','BPR Q2 2026 aggregate | Econ 22020307 DRUGS/LABORATORY/MEDICAL SUPPLIES | Dept: Kano State College Of Health Science & Technology Head Quarter'),
('052101000100','overhead','22020312','','overhead-running-costs','other',157000.00,'BPR-2026Q2-000100-006','BPR Q2 2026 aggregate | Econ 22020312 SANITARY MATERIALS | Dept: Kano State College Of Health Science & Technology Head Quarter'),
('052101000100','overhead','22020405','','overhead-running-costs','other',5500.00,'BPR-2026Q2-000100-007','BPR Q2 2026 aggregate | Econ 22020405 MAINTENANCE OF PLANTS/GENERATORS | Dept: Kano State College Of Health Science & Technology Head Quarter'),
('052101000100','overhead','22020406','','overhead-running-costs','other',130000.00,'BPR-2026Q2-000100-008','BPR Q2 2026 aggregate | Econ 22020406 OTHER MAINTENANCE SERVICES | Dept: Kano State College Of Health Science & Technology Head Quarter'),
('052101000100','overhead','22020501','','overhead-running-costs','other',130000.00,'BPR-2026Q2-000100-009','BPR Q2 2026 aggregate | Econ 22020501 LOCAL TRAINING | Dept: Kano State College Of Health Science & Technology Head Quarter'),
('052101000100','overhead','22020801','','overhead-running-costs','other',120000.00,'BPR-2026Q2-000100-010','BPR Q2 2026 aggregate | Econ 22020801 MOTOR VEHICLE  FUEL COST | Dept: Kano State College Of Health Science & Technology Head Quarter'),
('052101000100','overhead','22020803','','overhead-running-costs','other',135000.00,'BPR-2026Q2-000100-011','BPR Q2 2026 aggregate | Econ 22020803 PLANT / GENERATOR FUEL COST | Dept: Kano State College Of Health Science & Technology Head Quarter'),
('052101000100','overhead','22020901','','overhead-running-costs','other',2309.10,'BPR-2026Q2-000100-012','BPR Q2 2026 aggregate | Econ 22020901 BANK CHARGES (OTHER THAN INTEREST) | Dept: Kano State College Of Health Science & Technology Head Quarter'),
('052101000100','overhead','22021001','','overhead-running-costs','other',374600.00,'BPR-2026Q2-000100-013','BPR Q2 2026 aggregate | Econ 22021001 REFRESHMENT & MEALS | Dept: Kano State College Of Health Science & Technology Head Quarter'),
('052101000100','overhead','22021002','','overhead-running-costs','other',45000.00,'BPR-2026Q2-000100-014','BPR Q2 2026 aggregate | Econ 22021002 HONORARIUM & SITTING ALLOWANCE | Dept: Kano State College Of Health Science & Technology Head Quarter'),
('052101000100','overhead','22021003','','overhead-running-costs','other',300322.50,'BPR-2026Q2-000100-015','BPR Q2 2026 aggregate | Econ 22021003 PUBLICITY & ADVERTISEMENTS | Dept: Kano State College Of Health Science & Technology Head Quarter'),
('052101000100','overhead','22021011','','overhead-running-costs','other',225000.00,'BPR-2026Q2-000100-016','BPR Q2 2026 aggregate | Econ 22021011 OTHER MISCELLANEOUS | Dept: Kano State College Of Health Science & Technology Head Quarter'),
('052101300100','overhead','22020201','','overhead-running-costs','admin-general-services',834000.00,'BPR-2026Q2-300100-001','BPR Q2 2026 aggregate | Econ 22020201 ELECTRICITY CHARGES | Dept: Admin & General Services'),
('052101300100','overhead','22020206','','overhead-running-costs','admin-general-services',100000.00,'BPR-2026Q2-300100-002','BPR Q2 2026 aggregate | Econ 22020206 SEWERAGE CHARGES | Dept: Admin & General Services'),
('052101300100','overhead','22020312','','overhead-running-costs','admin-general-services',350000.00,'BPR-2026Q2-300100-003','BPR Q2 2026 aggregate | Econ 22020312 SANITARY MATERIALS | Dept: Admin & General Services'),
('052101300100','overhead','22020405','','overhead-running-costs','admin-general-services',540000.00,'BPR-2026Q2-300100-004','BPR Q2 2026 aggregate | Econ 22020405 MAINTENANCE OF PLANTS/GENERATORS | Dept: Admin & General Services'),
('052101300100','overhead','22020406','','overhead-running-costs','admin-general-services',435000.00,'BPR-2026Q2-300100-005','BPR Q2 2026 aggregate | Econ 22020406 OTHER MAINTENANCE SERVICES | Dept: Admin & General Services'),
('052101300100','overhead','22020801','','overhead-running-costs','admin-general-services',8183300.00,'BPR-2026Q2-300100-006','BPR Q2 2026 aggregate | Econ 22020801 MOTOR VEHICLE  FUEL COST | Dept: Admin & General Services'),
('052101300100','overhead','22020803','','overhead-running-costs','admin-general-services',20000.00,'BPR-2026Q2-300100-007','BPR Q2 2026 aggregate | Econ 22020803 PLANT / GENERATOR FUEL COST | Dept: Admin & General Services'),
('052101300100','overhead','22021003','','overhead-running-costs','admin-general-services',1872000.00,'BPR-2026Q2-300100-008','BPR Q2 2026 aggregate | Econ 22021003 PUBLICITY & ADVERTISEMENTS | Dept: Admin & General Services'),
('052101300100','overhead','22021007','','overhead-running-costs','admin-general-services',63579700.00,'BPR-2026Q2-300100-009','BPR Q2 2026 aggregate | Econ 22021007 WELFARE PACKAGES | Dept: Admin & General Services'),
('052101400100','overhead','22020102','','overhead-running-costs','admin-general-services',17043376.00,'BPR-2026Q2-400100-001','BPR Q2 2026 aggregate | Econ 22020102 LOCAL TRAVEL & TRANSPORT: OTHERS | Dept: Admin & General Services'),
('052101400100','overhead','22020201','','overhead-running-costs','admin-general-services',740000.00,'BPR-2026Q2-400100-002','BPR Q2 2026 aggregate | Econ 22020201 ELECTRICITY CHARGES | Dept: Admin & General Services'),
('052101400100','overhead','22020301','','overhead-running-costs','admin-general-services',1059000.00,'BPR-2026Q2-400100-003','BPR Q2 2026 aggregate | Econ 22020301 OFFICE STATIONERIES / COMPUTER CONSUMABLES | Dept: Admin & General Services'),
('052101400100','overhead','22020307','','overhead-running-costs','admin-general-services',106593244.00,'BPR-2026Q2-400100-004','BPR Q2 2026 aggregate | Econ 22020307 DRUGS/LABORATORY/MEDICAL SUPPLIES | Dept: Admin & General Services'),
('052101400100','overhead','22020401','','overhead-running-costs','admin-general-services',956000.00,'BPR-2026Q2-400100-005','BPR Q2 2026 aggregate | Econ 22020401 MAINTENANCE OF MOTOR VEHICLE / TRANSPORT EQUIPMENT | Dept: Admin & General Services'),
('052101400100','overhead','22020403','','overhead-running-costs','admin-general-services',2182000.00,'BPR-2026Q2-400100-006','BPR Q2 2026 aggregate | Econ 22020403 MAINTENANCE OF OFFICE BUILDING / RESIDENTIAL QTRS | Dept: Admin & General Services'),
('052101400100','overhead','22020406','','overhead-running-costs','admin-general-services',600100.00,'BPR-2026Q2-400100-007','BPR Q2 2026 aggregate | Econ 22020406 OTHER MAINTENANCE SERVICES | Dept: Admin & General Services'),
('052101400100','overhead','22020601','','overhead-running-costs','admin-general-services',1400000.00,'BPR-2026Q2-400100-008','BPR Q2 2026 aggregate | Econ 22020601 SECURITY SERVICES | Dept: Admin & General Services'),
('052101400100','overhead','22020801','','overhead-running-costs','admin-general-services',512000.00,'BPR-2026Q2-400100-009','BPR Q2 2026 aggregate | Econ 22020801 MOTOR VEHICLE  FUEL COST | Dept: Admin & General Services')
) as wb(mda_code, budget_class, econ, proj_md5, cat_slug, prog_slug, amount, voucher, remarks)
join public.mdas m on m.code = wb.mda_code
join public.expenditure_categories c on c.slug = wb.cat_slug
join public.programme_areas p on p.slug = wb.prog_slug
left join lateral (
  select bl.id from public.approved_budget_lines bl
  where bl.fiscal_year = 2026 and bl.mda_id = m.id
    and bl.budget_class = wb.budget_class and bl.economic_code = wb.econ
    and (wb.proj_md5 = ''
         or md5(lower(regexp_replace(btrim(coalesce(bl.project_description,'')), '\s+', ' ', 'g'))) = wb.proj_md5)
  order by bl.approved_amount desc limit 1
) l on true
where not exists (
  select 1 from public.expenditure_entries e
  where e.mda_id = m.id and e.fiscal_year = 2026 and e.voucher_ref_no = wb.voucher
);

-- 6. Revenue: 86 coded lines (23,703,247,286.79 budgeted) with Q1 and Q2
--    collections (376,358,271.56 and 5,786,320,959.18).

create temporary table _rev_load(
  mda_code text, stream text, econ text, econn text, receipt_desc text,
  approved numeric(18,2), row_no int, q1 numeric(18,2), q2 numeric(18,2)
) on commit drop;

insert into _rev_load values
('052100100100','capital_receipt','13020102','CAPITAL DOMESTIC GRANTS FROM FGN','FGN Grant - Basic Health Care Provision Fund (BHCPF)',705862500.00,1,0.00,0.00),
('052100100100','capital_receipt','13020202','CAPITAL FOREIGN GRANTS','UNICEF supported Grant - Certification for Open Defecation Free (ODF) claimed communities  RUWASA',710000000.00,1,0.00,0.00),
('052100100100','recurrent','12020134','PRIVATE SCHOOLS LICENSES','',8100000.00,1,0.00,0.00),
('052100100100','recurrent','12020136','HEALTH FACILITIES LICENSES','',40500000.00,1,0.00,0.00),
('052100100100','recurrent','12020403','Patent Medicine Licensing Fees','',24300000.00,1,0.00,3080200.00),
('052100100100','recurrent','12020417','TENDER  FEES','',40500000.00,1,0.00,0.00),
('052100100100','recurrent','12020427','ASSOCIATION FEES','',51840000.00,1,0.00,0.00),
('052100100100','recurrent','12020441','APPLICATIONS FORMS & FEES','',16200000.00,1,0.00,0.00),
('052100100100','recurrent','12020450','Agricultural Product/Produce Sales Fees','',16200000.00,1,0.00,0.00),
('052100100100','recurrent','12020452','PROCESSING FEES','',48600000.00,1,0.00,0.00),
('052100100100','recurrent','12020501','FINES/PENALTIES','',29970000.00,1,0.00,0.00),
('052100300100','recurrent','12020428','BIRTH & DEATH REGISTRATION FEES','',219607200.00,1,20529415.72,0.00),
('052100300100','recurrent','12020612','PROCEEDS FROM SALES OF DRUGS AND MEDICATIONS','',87807240.00,1,36590786.00,0.00),
('052100300100','recurrent','12020701','EARNINGS FROM CONSULTANCY SERVICES','',31706640.00,1,10175400.00,0.00),
('052100300100','recurrent','12020707','EARNINGS FROM MEDICAL SERVICES','',571060903.07,1,50529415.72,159707750.00),
('052100300100','recurrent','12020712','EARNINGS FROM DRF SERVICE ACCOUNT','',231070320.00,1,18270552.60,0.00),
('052100300100','recurrent','12020712','EARNINGS FROM DRF SERVICE ACCOUNT','',80611200.00,2,0.00,0.00),
('052100300100','recurrent','12020712','EARNINGS FROM DRF SERVICE ACCOUNT','',63612540.00,3,0.00,0.00),
('052100300100','recurrent','12020712','EARNINGS FROM DRF SERVICE ACCOUNT','',6421680.00,4,0.00,0.00),
('052100300100','recurrent','12020712','EARNINGS FROM DRF SERVICE ACCOUNT','',9164340.00,5,0.00,0.00),
('052100300100','recurrent','12020722','EARNING FROM ICU SERVICES','',130831200.00,1,22474895.00,0.00),
('052100300100','recurrent','12020724','EARNING FROM SCANNING SERVICES','',571060903.07,1,16671215.80,136537397.01),
('052100300100','recurrent','12020725','EARNING FRON MATUARY SERVICES','',222615922.83,1,14163028.20,193963.00),
('052100300100','recurrent','12020726','EARNING FROM THEATRE SERCICES','',28385640.00,1,0.00,0.00),
('052100300100','recurrent','12020727','EARNING FROM SCBU SERVICES (SPECIAL CARE BABY UNIT)','',222615922.83,1,89455329.32,0.00),
('052100300100','recurrent','12020732','PATIENT ADMISSION SERVICE','',6259680.00,1,0.00,0.00),
('052100300100','recurrent','12020735','EARNING FROM PUBLIC CONVENIENCES','',40176000.00,1,0.00,0.00),
('052100300200','capital_receipt','13010102','CAPITAL DOMESTIC AIDS','Donation by individual to Accident and Emergency',100000000.00,1,0.00,0.00),
('052100300200','capital_receipt','13010202','CAPITAL FOREIGN AIDS','Lafiya Project Aid to support Research for Health Programmes in the Ministry of Health',100000000.00,1,0.00,0.00),
('052100300200','recurrent','12020702','EARNINGS FROM LABORATORY SERVICES','',243162000.00,1,35000000.00,4243344.38),
('052100300200','recurrent','12020707','EARNINGS FROM MEDICAL SERVICES','',203680980.00,1,26148233.20,0.00),
('052100300200','recurrent','12020707','EARNINGS FROM MEDICAL SERVICES','',100083753.51,2,15000000.00,16857845.39),
('052100300200','recurrent','12020707','EARNINGS FROM MEDICAL SERVICES','',20541600.00,3,0.00,0.00),
('052100300200','recurrent','12020707','EARNINGS FROM MEDICAL SERVICES','',906795.47,4,0.00,0.00),
('052100300200','recurrent','12020707','EARNINGS FROM MEDICAL SERVICES','',64800000.00,5,2000000.00,0.00),
('052100300200','recurrent','12020712','EARNINGS FROM DRF SERVICE ACCOUNT','',49167000.00,1,0.00,0.00),
('052100300200','recurrent','12020712','EARNINGS FROM DRF SERVICE ACCOUNT','',4082400.00,2,0.00,0.00),
('052100300200','recurrent','12020712','EARNINGS FROM DRF SERVICE ACCOUNT','',1273568.77,3,0.00,106083.61),
('052100300200','recurrent','12020712','EARNINGS FROM DRF SERVICE ACCOUNT','',324000.52,4,0.00,0.00),
('052100300200','recurrent','12020712','EARNINGS FROM DRF SERVICE ACCOUNT','',2430073.08,5,0.00,0.00),
('052100300200','recurrent','12020716','EARNINGS FROM ENT SERVICES','',15301386.16,1,0.00,21216.72),
('052100300200','recurrent','12020717','EARNINGS FROM DIALYSIS SERVICES','',64800000.00,1,0.00,4922279.48),
('052100300200','recurrent','12020718','EARNINGS FROM DENTAL SERVICES','',10928395.62,1,0.00,2170894.98),
('052100300200','recurrent','12020719','EARNING FROM PHYSIOTHERAPHY SERVICES','',7413742.65,1,0.00,865642.25),
('052100300200','recurrent','12020720','EARNING FROM 10% NHIS /KSCHMA','',11463323.34,1,0.00,2304539.11),
('052100300200','recurrent','12020721','EARNINGS FROM EYE CLINIC SERVICES','',8743623.99,1,0.00,8043471.43),
('052100300200','recurrent','12020722','EARNING FROM ICU SERVICES','',23059852.93,1,0.00,3791428.20),
('052100300200','recurrent','12020723','EARNING FROM X-RAY SERVICES','',31509000.00,1,0.00,9172201.04),
('052100300200','recurrent','12020724','EARNING FROM SCANNING SERVICES','',33615000.00,1,0.00,9762874.57),
('052100300200','recurrent','12020725','EARNING FRON MATUARY SERVICES','',891700.99,1,0.00,0.00),
('052100300200','recurrent','12020726','EARNING FROM THEATRE SERCICES','',117968400.00,1,4700000.00,8179682.79),
('052100300200','recurrent','12020731','EARNING FROM DRESSING SERVICE','',5436720.00,1,0.00,19796519.06),
('052100400100','recurrent','12020437','STUDENT REGISTRATION FEES','',21060000.00,1,0.00,0.00),
('052100400100','recurrent','12020441','APPLICATIONS FORMS & FEES','',32400000.00,1,0.00,555000.00),
('052100400100','recurrent','12020482','OTHER FEES','',275400000.00,1,14650000.00,16448500.00),
('052100400100','recurrent','12020482','OTHER FEES','',16200000.00,2,0.00,0.00),
('052100400300','recurrent','12020437','STUDENT REGISTRATION FEES','',32400000.00,1,0.00,0.00),
('052100400300','recurrent','12020470','HOTEL REGISTRSTION FEES','',3240000.00,1,0.00,0.00),
('052100400300','recurrent','12020482','OTHER FEES','',16200000.00,1,0.00,0.00),
('052100400700','recurrent','12020437','STUDENT REGISTRATION FEES','',16200000.00,1,0.00,0.00),
('052100400700','recurrent','12020482','OTHER FEES','',15390000.00,1,0.00,0.00),
('052100400800','recurrent','12020437','STUDENT REGISTRATION FEES','',19440000.00,1,0.00,0.00),
('052100400800','recurrent','12020470','HOTEL REGISTRSTION FEES','',7290000.00,1,0.00,0.00),
('052100400800','recurrent','12020482','OTHER FEES','',6480000.00,1,0.00,0.00),
('052100500100','capital_receipt','13020102','CAPITAL DOMESTIC GRANTS FROM FGN','Basic Healthcare Programm BHCPF Programm',2030400000.00,1,0.00,363692431.00),
('052100500100','capital_receipt','13020104','CAPITAL GRANT FROM LGAs','LGAs Grant to Support to Primary Health Care Service Delivery',1219000000.98,1,0.00,0.00),
('052100500100','capital_receipt','13020202','CAPITAL FOREIGN GRANTS','United Nations Childrens Fund (UNICEF) Grant For Community Health Influences, Promoters and Awareness Programme in Kano State',1023995297.98,1,0.00,310854515.00),
('052100500100','capital_receipt','13020202','CAPITAL FOREIGN GRANTS','UNICEF Support Grant - IMPACT PROJECT',2030400000.00,2,0.00,0.00),
('052100800100','capital_receipt','13020103','CURRENT GRANT FROM LGAs','Local Government Grant (1% ) Support to  Contributory Health Scheme (KACHIMA) to fund Medical Supplies',1219000000.00,1,0.00,2877542224.09),
('052100800100','recurrent','12020453','SURVEY FEES','',2430000.00,1,0.00,0.00),
('052100800100','recurrent','12021103','OTHER INVESTMENT INCOME','',1944000000.00,1,0.00,989431395.64),
('052100900100','capital_receipt','13020104','CAPITAL GRANT FROM LGAs','Local Government Grant Contribution to Support  Kano State Health Trust Fund (KHEFUND) for Health care and Nutrition Programmes',1218591639.00,1,0.00,0.00),
('052100900100','capital_receipt','13020104','CAPITAL GRANT FROM LGAs','Local Government 1% Grant to support Health Trust Fund Service Delivery',3000000000.00,2,0.00,829267060.43),
('052101100100','recurrent','12020707','EARNINGS FROM MEDICAL SERVICES','',85860000.00,1,0.00,8772500.00),
('052101300100','capital_receipt','13020102','CAPITAL DOMESTIC GRANTS FROM FGN','FGN Grant for the Intergrated last mile delivery by Gate fundation',70000000.00,1,0.00,0.00),
('052101300100','capital_receipt','13020102','CAPITAL DOMESTIC GRANTS FROM FGN','FGN Grant to Support Upgrade/Renovation of 4 zonal warehouse and 4 central warehouses',200000000.00,2,0.00,0.00),
('052101300100','recurrent','12020707','EARNINGS FROM MEDICAL SERVICES','',162000000.00,1,0.00,0.00),
('052101400100','capital_receipt','13020104','CAPITAL GRANT FROM LGAs','Support to Kano state Disease control (KNDC) for construction of additional toilets & 9 windows by Kano state Health Trust Fund (KHETFUND)',50000000.00,1,0.00,0.00),
('052101400100','capital_receipt','13020104','CAPITAL GRANT FROM LGAs','1% Grant From the LGA For Emergency Prepadness Respose (EPR)',3000000000.00,2,0.00,0.00),
('052101400100','capital_receipt','13020106','CAPITAL GRANTS FROM OTHER SOURCES','Capital Grant from BMCF AND DANGOTE (HEALTH MoU BASKET)',200000000.00,1,0.00,0.00),
('052103000100','recurrent','12020482','OTHER FEES','',53460000.00,1,0.00,0.00),
('052104000100','recurrent','12020437','STUDENT REGISTRATION FEES','',234900000.00,1,0.00,0.00),
('052104000100','recurrent','12020437','STUDENT REGISTRATION FEES','',2203200.00,2,0.00,0.00),
('052104000100','recurrent','12020441','APPLICATIONS FORMS & FEES','',32400000.00,1,0.00,0.00),
('052104000100','recurrent','12020441','APPLICATIONS FORMS & FEES','',324000.00,2,0.00,0.00),
('052104000100','recurrent','12020482','OTHER FEES','',25920000.00,1,0.00,0.00);

insert into public.budget_line_revenues
  (fiscal_year, mda_id, stream, economic_code, economic_description, receipt_description,
   approved_amount, source_label, source_row_number)
select 2026, m.id, v.stream, v.econ, v.econn, nullif(v.receipt_desc,''),
       v.approved, 'Q2 2026 UPDATED BPR', v.row_no
from _rev_load v join public.mdas m on m.code=v.mda_code
on conflict (fiscal_year, mda_id, stream, economic_code, coalesce(source_row_number, -1))
do update set approved_amount = excluded.approved_amount,
              economic_description = excluded.economic_description,
              receipt_description = excluded.receipt_description,
              source_label = excluded.source_label,
              updated_at = now();

insert into public.budget_line_revenue_actuals (budget_line_revenue_id, quarter, amount, source_label)
select b.id, a.quarter, a.amount, 'Q2 2026 UPDATED BPR'
from _rev_load v
join public.mdas m on m.code=v.mda_code
join public.budget_line_revenues b
  on b.fiscal_year=2026 and b.mda_id=m.id and b.stream=v.stream
 and b.economic_code=v.econ and b.source_row_number=v.row_no
cross join lateral (values (1::smallint, v.q1), (2::smallint, v.q2)) as a(quarter, amount)
where a.amount <> 0
on conflict (budget_line_revenue_id, quarter)
do update set amount = excluded.amount, source_label = excluded.source_label, updated_at = now();


-- 7. Funding mirror, following the Q1 convention: a government release is
--    recorded equal to the spend it financed, plus revenue actually collected.
insert into public.funding_entries
  (transaction_date, mda_id, funding_source_id, programme_area_id, amount, reference_no, remarks, entered_by)
select date '2026-06-30', x.mda_id,
       (select id from public.funding_sources where slug = 'kano-state-govt-budget-release'),
       (select id from public.programme_areas where slug = 'other'),
       x.amt,
       'BPR-2026Q2-REL-' || m.code || '-' || upper(left(x.cls, 4)),
       'BPR Q2 2026 | Budget release mirroring ' || x.cls || ' actuals for the quarter',
       '00000000-0000-0000-0000-000000000001'::uuid
from (
  select e.mda_id, c.slug cls, sum(e.amount) amt
  from public.expenditure_entries e
  join public.expenditure_categories c on c.id = e.expenditure_category_id
  where e.fiscal_year = 2026 and e.quarter = 2 group by 1, 2
) x join public.mdas m on m.id = x.mda_id
where not exists (select 1 from public.funding_entries f
  where f.mda_id = x.mda_id and f.fiscal_year = 2026
    and f.reference_no = 'BPR-2026Q2-REL-' || m.code || '-' || upper(left(x.cls, 4)));

insert into public.funding_entries
  (transaction_date, mda_id, funding_source_id, programme_area_id, amount, reference_no, remarks, entered_by)
select date '2026-06-30', x.mda_id,
       (select id from public.funding_sources where slug = x.src),
       (select id from public.programme_areas where slug = 'other'),
       x.amt,
       'BPR-2026Q2-REV-' || m.code || '-' || x.tag,
       'BPR Q2 2026 | ' || x.label,
       '00000000-0000-0000-0000-000000000001'::uuid
from (
  select b.mda_id,
         case when b.stream = 'recurrent' then 'internally-generated-revenue-igr'
              when left(b.economic_code, 6) = '130201' then 'lga-contribution'
              else 'donors-development-partners-funding' end src,
         case when b.stream = 'recurrent' then 'IGR'
              when left(b.economic_code, 6) = '130201' then 'LGA'
              else 'GRANT' end tag,
         case when b.stream = 'recurrent' then 'Recurrent revenue collected'
              when left(b.economic_code, 6) = '130201' then 'Capital receipt - current grant from LGAs'
              else 'Capital receipt - grants / aid' end label,
         sum(a.amount) amt
  from public.budget_line_revenue_actuals a
  join public.budget_line_revenues b on b.id = a.budget_line_revenue_id
  where a.quarter = 2 and b.fiscal_year = 2026 group by 1, 2, 3, 4
) x join public.mdas m on m.id = x.mda_id
where x.amt <> 0
  and not exists (select 1 from public.funding_entries f
    where f.mda_id = x.mda_id and f.fiscal_year = 2026
      and f.reference_no = 'BPR-2026Q2-REV-' || m.code || '-' || x.tag);

-- 8. Q1 correction: bind PHCMB's Q1 capital entries to their budget lines.
--
-- Seed 007 loaded Table 24 as per-LGA allocations under programme-shaped
-- categories (Outreach, Transport, M&E). `classifyEntry` prefers a bound
-- budget line's NCOA class, but with no line bound these fell back to the
-- category name and reported 1,893,448,900 of capital spend as "other
-- recurrent" -- under-stating Q1 capital in the BIR economic table.
--
-- Lives here rather than in 007 because it depends on seed 010's budget lines.
-- MoH's single Q1 capital aggregate (spanning 14 lines) and the personnel
-- entries (split by month, not by economic code) have no 1:1 line and stay
-- unbound; both already classify correctly from their category name.
--
-- Note: the 254,000,000 group is labelled "Coordination of public health
-- emergency at LGA level" in seed 007, but the Q2 workbook reports that Q1
-- actual against "Building Of Incinerator..." (23020118). The workbook wins.
with map(project_prefix, econ, line_prefix) as (values
  ('Routine immunization programme',                                    '23030105', 'Conduction/Provision Of Routine Immunization Programme'),
  ('Minimal Service Package (MSP) investment plan',                     '23020106', 'Implementation Of Minimal Service Package (MSP) Investment Plan'),
  ('Coordination of public health emergency at LGA level',              '23020118', 'Building Of Incinerator At State Primary Health Care'),
  ('Solarization of board HQ',                                          '23020103', 'Solarization Of Board Headquarters'),
  ('Procurement of 4no. operational vehicles to replace aged ones',     '23010105', 'Procurement Of 4no. Operational Vehicles To Replace Aged'),
  ('Renovation/maintenance of PHC facilities',                          '23030105', 'Renovation/Maintenance Of Primary Health Care Facilities'),
  ('Procurement of 10no. operational vehicles (1no. per department)',   '23010105', 'Procurement Of 10no. Operational Vehicles'),
  ('Newborn resuscitation centres in all 44 LGAs',                      '23030105', 'Establishment Of Newborn Resuccitation Center'),
  ('Medical field unit / integrated mobile health services',            '23030105', 'Conduction Of Medical Field Unit/Integrated Mobile Health'),
  ('Printing of data tools',                                            '23050102', 'Printing Of Data Tools'),
  ('Coordination of primary health care services/activities',           '23030106', 'Coordination Of Primary Health Care Services/Activities')
)
update public.expenditure_entries e
set approved_budget_line_id = bl.id, updated_at = now()
from map, public.mdas m, public.approved_budget_lines bl
where e.mda_id = m.id and m.code = '052100500100'
  and e.quarter = 1 and e.fiscal_year = 2026
  and e.approved_budget_line_id is null
  and split_part(e.remarks, ' — ', 1) like map.project_prefix || '%'
  and bl.fiscal_year = 2026 and bl.mda_id = m.id and bl.budget_class = 'capital'
  and bl.economic_code = map.econ and bl.project_description like map.line_prefix || '%';

commit;
