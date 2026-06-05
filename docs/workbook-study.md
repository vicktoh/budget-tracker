# Workbook Study: Kano Health Finance Tracker

Source workbook: `/Users/kunle/Downloads/Kano Health Finance Tracker.xlsx`

## Workbook Shape

The workbook has 22 visible sheets:

- Operational entry: `Data Entry`, `Funding Log`, `Expenditure Log`
- Admin summaries: `Dashboard`, `Facility Analysis`, `LGA Analysis`
- MDA-specific analysis: `MoH HQ`, `HMB`, `MAWSH`, `PHCMB`, `SACA`, `KCHIMA`, `KHETFUND`, `PHIMA`, `DMA`, `KNCDC`, `Col. Health Sci`, `Col. Nursing`, `Nursing Schools`
- Planning/reference data: `Budget 2026`, `AOP 2026`, `LOOKUP`

The workbook is built around two ledgers:

- `Funding Log`: up to 500 rows of funding received
- `Expenditure Log`: up to 1,000 rows of expenditure made

Most dropdown behavior is sourced from `LOOKUP`. PHC facility selection uses dependent dropdowns: choose an LGA, then Excel uses a named range for that LGA's facilities.

## Data Entry Form

Section A - General Information:

| Form label | Web field | Source behavior |
| --- | --- | --- |
| Day | `day` | Dropdown from `LOOKUP!P2:P32` |
| Month | `month` | Dropdown from `LOOKUP!N2:N13` |
| Year | `year` | Dropdown from `LOOKUP!L2:L18` |
| Entry Date (Auto) | `transaction_date` | Formula combines day, month, year |
| Quarter (Auto) | `quarter` | Formula derives quarter from transaction date |
| Fiscal Year | `fiscal_year` | Workbook uses dropdown; platform resolution is derived from transaction date |
| MDA (Department / Agency) | `mda_id` | Dropdown from `LOOKUP!B2:B22` |
| Programme Area | `programme_area_id` | Dropdown from `LOOKUP!H2:H25` |
| Prepared By | `prepared_by` | Free text in form; likely maps to entry user |

Section B - Funding Entry:

| Form label | Web field | Source behavior |
| --- | --- | --- |
| Funding Source | `funding_source_id` | Dropdown from `LOOKUP!D2:D9` |
| Amount Received | `amount` | Numeric money value |
| Reference Number | `reference_no` | Free text |
| Description / Remarks | `remarks` | Free text |

Section C - Expenditure Entry:

| Form label | Web field | Source behavior |
| --- | --- | --- |
| Expenditure Category | `expenditure_category_id` | Intended dropdown from `LOOKUP!F2:F13`; workbook validation appears attached to `C20`, not the visible row `C23` |
| Expenditure Sub-Category / Item | `expenditure_item_id` | Present on form, absent from `Expenditure Log`; platform resolution is optional admin-managed dropdown |
| Amount Spent | `amount` | Numeric money value |
| Is this a PHC Expenditure? | `is_phc` | Dropdown from `LOOKUP!V2:V3` |
| LGA (if PHC) | `lga_id` | Dropdown from `LOOKUP!X2:X45` |
| Facility Name (if PHC) | `facility_id` | Dependent dropdown from named range matching selected LGA |
| Voucher / Reference No. | `voucher_ref_no` | Free text |
| Payment Method | `payment_method_id` | Dropdown from `LOOKUP!R2:R7` |
| Description / Remarks | `remarks` | Free text |

## Funding Log Fields

| Column | Field | Notes |
| --- | --- | --- |
| ID | `public_id` | Excel formula creates `FL-0001`, etc.; platform should generate fiscal-year-scoped IDs like `FL-2026-0001` |
| Date | `transaction_date` | User-entered transaction date |
| Fiscal Year | `fiscal_year` | Workbook dropdown; platform derives from transaction date |
| Quarter | `quarter` | Auto-derived from date |
| MDA | `mda_id` | Dropdown |
| Funding Source | `funding_source_id` | Dropdown |
| Programme Area | `programme_area_id` | Dropdown |
| Amount | `amount` | Money amount |
| Reference No. | `reference_no` | Free text |
| Description / Remarks | `remarks` | Free text |
| Date Entered | `created_at` or `entered_at` | Entry timestamp |
| Entered By | `entered_by` | Authenticated user |
| Status | `status` | Dropdown |

## Expenditure Log Fields

| Column | Field | Notes |
| --- | --- | --- |
| ID | `public_id` | Excel formula creates `EL-0001`, etc.; platform should generate fiscal-year-scoped IDs like `EL-2026-0001` |
| Date | `transaction_date` | User-entered transaction date |
| Fiscal Year | `fiscal_year` | Workbook dropdown; platform derives from transaction date |
| Quarter | `quarter` | Auto-derived from date |
| MDA | `mda_id` | Dropdown |
| Expenditure Category | `expenditure_category_id` | Dropdown |
| Programme Area | `programme_area_id` | Dropdown |
| Is PHC? | `is_phc` | Yes/no |
| LGA | `lga_id` | Required when `is_phc = true` |
| Facility Name | `facility_id` | Required when `is_phc = true` |
| Amount | `amount` | Money amount |
| Voucher / Ref. No. | `voucher_ref_no` | Free text |
| Payment Method | `payment_method_id` | Dropdown |
| Description / Remarks | `remarks` | Free text |
| Date Entered | `created_at` or `entered_at` | Entry timestamp |
| Entered By | `entered_by` | Authenticated user |
| Status | `status` | Dropdown |

## Reference Data

MDA lookup contains 21 MDAs. The 2026 budget sheet contains those 21 plus one sector-total row.

Funding sources:

- Kano State Govt Budget Release
- BHCPF Allocation
- Donors / Development Partners Funding
- LGA Contribution
- NHIA / NHIS
- Internally Generated Revenue (IGR)
- Federal Government Grant
- Other

Expenditure categories:

- Personnel Costs
- Overhead / Running Costs
- Capital Expenditure
- Drugs & Medical Supplies
- Training & Capacity Building
- Outreach & Service Delivery
- Monitoring & Evaluation
- Community Engagement
- Infrastructure & Rehabilitation
- Equipment & Furniture
- Transport & Logistics

Programme areas:

- Admin & General Services
- Planning, Research & Statistics
- Nursing Services
- Pharmaceutical Services
- Medical Services
- Public Health & Disease Control
- Physical Planning
- Hospital Services
- Family Health
- Disease Control
- Environmental & Public Health
- Information & Communication Technology
- Health Management / Programmes
- Health Emergency, Preparedness & Response
- Drug & Supply Management
- Community Health Services
- Health Financing
- Human Resource for Health
- Reproductive, Maternal, Newborn & Child Health
- Immunisation & Vaccines
- HIV/AIDS, TB & Malaria
- Mental Health
- Non-Communicable Diseases
- Other

Payment methods:

- Bank Transfer
- Cheque
- Cash
- GIFMIS
- IPPIS
- Other

Entry statuses:

- Pending
- Approved
- Processed
- Rejected

Geography and facilities:

- 44 LGAs
- 471 PHC facility rows plus one grand-total row in `Facility Analysis`
- 44 LGA named ranges in the workbook for dependent facility dropdowns

## Budget And AOP Data

`Budget 2026` stores MDA-level approved budget allocations:

- MDA code
- MDA / administrative unit
- Personnel amount
- Other recurrent amount
- Total recurrent amount
- Capital amount
- Total budget
- Percent of sector total

The sector total row is `MINISTRY OF HEALTH (SECTOR TOTAL)` with a total budget of `214,839,309,263.70`.

`AOP 2026` stores activity-level planning data:

- Activity code
- Activity description
- MDA / agency
- Budgeted cost
- Percent of MDA AOP

Observed AOP extract:

- 2,031 activity rows
- Total activity budgeted cost: `145,085,682,460.75`
- AOP activities only appear for 11 MDAs, while the budget lookup has 21 MDAs

## Existing Insight Logic

The dashboard and analysis sheets calculate:

- Total funding received
- Total expenditure
- Budget balance
- Funding vs expenditure gap
- Funding by source
- Expenditure by category
- MDA budget vs actual expenditure
- MDA funding received
- MDA budget used percentage
- LGA-level PHC expenditure
- Facility-level PHC expenditure

The web platform should rebuild these as database-backed views or server-side queries rather than spreadsheet formulas.

## Platform Enhancements Beyond Workbook

- Expenditure entries should optionally link to an AOP activity, filtered by selected MDA and fiscal year.
- Planned-vs-actual insights should compare AOP activity budgets with linked expenditure entries where linkage exists, while still reporting unlinked expenditure separately.

## Workbook Issues To Resolve

- `Dashboard!B5` is labeled "TOTAL BUDGET (2026)" but references `Budget 2026!H5`, which is the percent of sector total for Ministry of Health HQ, not the sector budget amount.
- `Data Entry` has "Expenditure Sub-Category / Item", but `Expenditure Log` does not store it and `LOOKUP` has no item/sub-category list. Platform resolution: capture it as an optional admin-managed dropdown.
- `Data Entry` validation for expenditure category appears attached to `C20`, which is an instruction row, rather than `C23`, the visible expenditure category row.
- `Budget 2026` includes the sector-total row as if it were a row in the same table; imports must tag this as a summary row or exclude it from MDA-level rows.
- `AOP 2026` has activity data for fewer MDAs than the budget reference list; the platform should allow MDAs with budgets but no AOP activities.
