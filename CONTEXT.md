# Kano Health Finance Tracker

This context describes how Kano State health-sector funding, approved budgets, annual operational plans, and expenditures are tracked. It exists to keep the web platform aligned with the spreadsheet's domain language while we replace manual workbook entry with authenticated forms and auditable analytics.

## Language

**MDA**:
A Ministry, Department, Agency, board, school, or administrative unit responsible for health-sector funding or expenditure.
_Avoid_: Agency alone, department alone

**MDA Type**:
An admin-managed classification for an **MDA**, such as ministry, board, agency, school, college, or hospital.
_Avoid_: MDA when referring only to classification

**Funding Entry**:
A recorded inflow of funds received by an **MDA** for a **Fiscal Year**, **Programme Area**, and **Funding Source**.
_Avoid_: Funding log row, receipt

**Expenditure Entry**:
A recorded outflow of funds spent by an **MDA** for a **Fiscal Year**, **Programme Area**, and **Expenditure Category**.
_Avoid_: Expense, payment row

**Approved Budget**:
The official budget allocation for an **MDA** in a **Fiscal Year**, split into personnel, other recurrent, and capital amounts.
_Avoid_: Budget line when referring to the MDA-level allocation

**AOP Activity**:
An Annual Operational Plan activity with an activity code, description, owning **MDA**, and budgeted cost.
_Avoid_: Workplan row

**AOP Linkage**:
An optional connection from an **Expenditure Entry** to the **AOP Activity** it helps execute.
_Avoid_: Mandatory activity coding

**Programme Area**:
A health-sector service, administrative, or strategic area used to classify both **Funding Entries** and **Expenditure Entries**.
_Avoid_: Program, department

**Funding Source**:
The origin category for a **Funding Entry**, such as state budget release, BHCPF allocation, donor funding, or internally generated revenue.
_Avoid_: Donor when the source may be government or IGR

**Reference Number**:
A required traceability identifier for a **Funding Entry**.
_Avoid_: Remarks

**Payment Method**:
The controlled method used to make an **Expenditure Entry**, such as bank transfer, cheque, cash, GIFMIS, IPPIS, or other.
_Avoid_: Funding source

**Voucher Reference Number**:
A required traceability identifier for an **Expenditure Entry**.
_Avoid_: Payment method

**Expenditure Category**:
The top-level spending classification for an **Expenditure Entry**, such as personnel costs, capital expenditure, or drugs and medical supplies.
_Avoid_: Sub-category

**Expenditure Item**:
An optional admin-managed dropdown value describing the specific item, service, or sub-category within an **Expenditure Category**.
_Avoid_: Category

**PHC Expenditure**:
An **Expenditure Entry** that is explicitly tied to a primary health care **Facility** in an **LGA**.
_Avoid_: Facility expenditure when non-PHC facilities may be introduced later

**LGA**:
One of Kano State's 44 local government areas used to locate PHC facilities and aggregate PHC expenditure.
_Avoid_: Locality, district

**Facility**:
A named health facility belonging to exactly one **LGA**, with a facility type such as PHC.
_Avoid_: Hospital unless the facility is actually a hospital

**Unspecified PHC Facility**:
An admin-created fallback **Facility** for an **LGA** when a PHC expenditure is known to belong to that LGA but the exact facility is not known.
_Avoid_: Blank facility

**Entry Status**:
The review workflow state of a **Funding Entry** or **Expenditure Entry**: pending, approved, processed, or rejected.
_Avoid_: Payment status unless it refers only to disbursement processing

**Admin Insight**:
An admin-facing summary, chart, table, or filterable view across submitted **Funding Entries**, **Expenditure Entries**, budgets, AOP activities, MDAs, LGAs, and facilities.
_Avoid_: Dashboard when referring to a single metric or report

**MDA Dashboard**:
A scoped dashboard that shows an MDA user entries, statuses, totals, and budget utilization for their assigned MDAs only.
_Avoid_: Admin insight

**Reference Data**:
The controlled lists used by forms and reports, including MDAs, programme areas, funding sources, expenditure categories, LGAs, facilities, payment methods, statuses, budgets, and AOP activities.
_Avoid_: Lookup when referring to the platform data model

**Global Reference Value**:
A reference value shared across all MDAs so entries can be compared consistently.
_Avoid_: MDA-specific category

**Inactive Reference Value**:
A reference-data value hidden from new entry forms but preserved for historical reporting.
_Avoid_: Deleted value

**Correction Request**:
A request to change a **Funding Entry** or **Expenditure Entry** after it has left the pending state.
_Avoid_: Required v1 workflow

**Audit Event**:
A timestamped record of who changed an entry, status, or reference-data value and what changed.
_Avoid_: Log when it is only technical application logging

**Entry Comment**:
A user-visible comment on a **Funding Entry** or **Expenditure Entry** used for review, clarification, rejection reasons, or follow-up.
_Avoid_: Audit event

**Entry Attachment**:
An optional supporting file attached to a **Funding Entry** or **Expenditure Entry**, such as a voucher, receipt, approval letter, or release memo.
_Avoid_: Evidence when no file is uploaded

**Admin Import**:
An admin-only upload process for loading seed data, reference data, planning data, or historical ledger entries from Excel or CSV files.
_Avoid_: Routine reporting workflow

**Submission Window**:
An admin-managed fiscal year or date range that can be opened or closed for routine MDA submissions.
_Avoid_: Reporting period when discussing whether users can submit entries

**Data Quality Warning**:
A non-blocking warning that flags an entry for reviewer attention before approval.
_Avoid_: Validation error when the entry can still be submitted

**Controlled Entry Field**:
A form field backed by reference data or fixed options so users select a valid value instead of typing free text.
_Avoid_: Free text when options are known

**Reference Value Request**:
A request from an MDA user for admins to add or update a value in a controlled dropdown.
_Avoid_: Free-text workaround

**Other Option**:
A controlled dropdown value used when no more specific active reference value fits.
_Avoid_: Default choice

**Remarks**:
Optional explanatory text on an entry, required only when a selected value needs clarification.
_Avoid_: Reference number

**Export**:
An admin-generated CSV, XLSX, or PDF output of ledger data, filtered insight tables, or dashboard summaries.
_Avoid_: Backup

**Notification**:
A platform message or email sent when entries are submitted, reviewed, approved, rejected, processed, or require attention.
_Avoid_: Alert when it is not urgent

**Fiscal Year**:
The reporting year derived from an entry's transaction date.
_Avoid_: Manually entered year

**Public Entry ID**:
A human-friendly identifier for a **Funding Entry** or **Expenditure Entry**, scoped by entry type and fiscal year.
_Avoid_: Database ID

**Money Amount**:
A Nigerian naira amount stored with two decimal places for funding, expenditure, budget, and AOP values.
_Avoid_: Float

**MDA Membership**:
A user's authorization to submit or review entries for a specific **MDA**.
_Avoid_: User MDA when a user can belong to more than one MDA

**Reviewer**:
A user who can review, approve, reject, or process entries for assigned MDAs without full admin powers.
_Avoid_: Admin when the user only reviews entries

## Relationships

- An **MDA** has zero or more **Approved Budgets** across fiscal years.
- An **MDA** may have one **MDA Type**.
- An **MDA** owns zero or more **AOP Activities** across fiscal years.
- A user can have zero or more **MDA Memberships**.
- An **MDA Membership** belongs to exactly one **MDA**.
- A **Funding Entry** belongs to exactly one **MDA**, one **Funding Source**, and one **Programme Area**.
- A **Funding Entry** has exactly one **Reference Number**.
- An **Expenditure Entry** belongs to exactly one **MDA**, one **Expenditure Category**, and one **Programme Area**.
- An **Expenditure Entry** has exactly one **Payment Method**.
- An **Expenditure Entry** has exactly one **Voucher Reference Number**.
- An **Expenditure Entry** may have one **AOP Linkage** to an **AOP Activity** in the same fiscal year and MDA.
- A **PHC Expenditure** must reference exactly one **LGA** and one **Facility**.
- A **Facility** belongs to exactly one **LGA** and has one facility type.
- An **Unspecified PHC Facility** belongs to exactly one **LGA** and is used only when the exact PHC facility is unknown.
- **Admin Insights** aggregate **Funding Entries**, **Expenditure Entries**, **Approved Budgets**, **AOP Activities**, **LGAs**, and **Facilities**.
- Admins can create and update **Reference Data**.
- An **Inactive Reference Value** may still be linked to historical entries.
- Programme areas, funding sources, expenditure categories, payment methods, and statuses are **Global Reference Values** in v1.
- MDA users can submit **Reference Value Requests** when a controlled dropdown is missing a needed value.
- Existing workbook **Other Options** remain available where already present.
- MDA users can edit their own assigned-MDA entries only while the **Entry Status** is pending.
- **Reviewers** can review entries for assigned MDAs without managing users, imports, or reference data.
- Reviewed entries require admin or reviewer action, a reason, and an **Audit Event** before they can change.
- **Audit Events** record material changes to entries, statuses, and reference data.
- **Entry Comments** support review discussion and rejection reasons.
- A **Funding Entry** or **Expenditure Entry** can have zero or more **Entry Attachments**.
- **Admin Imports** can create or update reference, budget, AOP, and historical ledger data.
- **Submission Windows** can govern whether routine MDA users may submit entries for a fiscal year or date range.
- **Data Quality Warnings** can be attached to entries before or during review.
- **Controlled Entry Fields** should be used wherever the valid options are known.
- A **Funding Entry** or **Expenditure Entry** has one **Fiscal Year** derived from its transaction date.
- A **Funding Entry** or **Expenditure Entry** has one **Public Entry ID** for review, exports, and audit conversations.
- Funding, expenditure, budget, and AOP values are **Money Amounts**.
- Admins can create **Exports** from ledgers, filtered insight tables, and dashboard summaries.
- **Notifications** are sent in-app and by email for entry workflow events.
- MDA users can view **MDA Dashboards** for their assigned MDAs.

## Example dialogue

> **Dev:** "When an MDA user records an Expenditure Entry for a PHC facility, can they pick any Facility?"
> **Domain expert:** "No - they must select the LGA first, then choose a Facility that belongs to that LGA."

## Flagged ambiguities

- The workbook uses "MDA (Department / Agency)" but the lookup list includes ministries, boards, agencies, schools, and colleges. Proposed resolution: use **MDA** as the canonical umbrella term.
- The data-entry form includes "Expenditure Sub-Category / Item", but the expenditure log has no matching column and the workbook has no lookup list for it. Resolved: capture it as optional admin-managed **Expenditure Item** dropdown in the platform.
- The workbook separates **Funding Entries** and **Expenditure Entries** into two ledgers. Resolved: keep separate write models for **Funding Entries** and **Expenditure Entries**, then build unified reporting views where needed.
- User access to MDAs may be one-to-many. Resolved: use **MDA Memberships** instead of storing a single MDA directly on a user profile.
- **Entry Status** is a review workflow status, not a payment-method or disbursement-status field. Provisional meanings: pending means submitted and awaiting review; approved means accepted for reporting; processed means accepted and reconciled or posted in the finance process; rejected means excluded from official reporting.
- **Admin Insights** should show all submitted entries by default, with status filters and admin actions to approve or reject submissions.
- **AOP Linkage** is optional on **Expenditure Entries** and should be filtered by selected MDA and fiscal year.
- **Reference Data** is admin-editable in the platform. Historical entries should keep their existing foreign-key links, so changing reference data must not silently rewrite old reports.
- Referenced **Reference Data** should not be deleted in v1. Resolved: deactivate old values and create new values when meaning changes.
- New active **Reference Data** created by admins is immediately available in forms; audit events provide accountability.
- **Reference Value Requests** give MDA users an in-platform path to ask for missing dropdown values without creating them directly.
- Keep existing **Other Options** from the workbook, but do not add new `Other` values everywhere by default. When `Other` is selected, remarks are required.
- **Remarks** are optional for normal entries, but required when `Other` is selected.
- MDA users can edit submitted entries while they are pending. Resolved: once approved, processed, or rejected, entries are locked for normal MDA editing.
- **Audit Events** are required from v1 for entry changes, status changes, and reference-data changes.
- **Entry Attachments** are optional in v1 and should be private, access-controlled supporting files for entries.
- **Admin Imports** are supported for seed/reference/planning data and historical migration. Routine MDA reporting should happen through authenticated web forms.
- **Fiscal Year** should be derived from transaction date rather than manually selected. Current assumption: Kano health finance reporting uses calendar-year fiscal years.
- The platform supports multiple **Fiscal Years** from v1, even though the source workbook mainly seeds 2026 budget and AOP data.
- **Public Entry IDs** should be generated with entry type and fiscal year, such as `FL-2026-0001` and `EL-2026-0001`.
- Facilities are modeled generally with `facility_type`, but the workbook seed data and v1 PHC expenditure form use PHC facilities.
- **MDA Type** is optional admin-managed reference data used for filtering and organization.
- **PHC Expenditures** require both LGA and a PHC **Facility**. If a fallback is needed, admins should create an **Unspecified PHC Facility** for that LGA instead of allowing blank facility values.
- **Payment Method** is required for every **Expenditure Entry**.
- **Funding Entries** do not capture receipt or deposit method in v1; use **Funding Source** and reference number.
- **Reference Number** and **Voucher Reference Number** are required in v1.
- **Reference Number** and **Voucher Reference Number** must be unique per fiscal year and MDA within their entry type.
- **Admin Imports** must reject duplicate ledger rows that collide with reference/voucher uniqueness rules before writing data.
- **Money Amounts** should be stored as fixed-precision `numeric(18,2)` values and displayed as Nigerian naira.
- **Funding Entry** and **Expenditure Entry** amounts must be positive in v1; corrections should use audited edits or reviewed correction workflows rather than negative entries.
- Core dropdown taxonomies should be global across MDAs in v1 to preserve cross-MDA insight quality.
- **Expenditure Item** is dropdown-backed but optional in v1, even when items exist for the selected **Expenditure Category**.
- **Approved Budget** remains MDA-level in v1, split by personnel, other recurrent, and capital; deeper planning detail comes from **AOP Activities**.
- V1 should support CSV, XLSX, and PDF **Exports** for admin reporting.
- V1 should send workflow emails through Resend, backed by in-app notification records and auditable email delivery records.
- **MDA Dashboards** are scoped to the user's assigned MDAs. Cross-MDA comparisons and statewide insights remain admin/reviewer capabilities.
- **Reviewer** is a distinct role from admin in v1, even if early deployments assign both roles to the same people.
- Admins and **Reviewers** can directly edit reviewed entries in v1, but must provide a reason and create an **Audit Event**. A formal **Correction Request** workflow is deferred.
- Rejected entries require an **Entry Comment** explaining the rejection to the submitter.
- **Submission Windows** exist in v1 but start permissive by default so rollout and historical catch-up entries are not blocked.
- V1 should prevent bad data at entry time as much as possible through **Controlled Entry Fields**, required fields, foreign keys, and conditional validation.
- Configurable review thresholds and rule builders are out of scope for v1.
- **Data Quality Warnings** should be limited to cases that cannot be cleanly prevented by dropdowns or validation.
