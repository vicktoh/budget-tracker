# Proposed Supabase/Postgres Model

> **Current schema decision:** ADR 0005 removes `entry_statuses` and the `status`, `approved_by`, and `approved_at` fields from Funding and Expenditure Entries. Every active row is reportable. Quarter-specific BIR publication metadata is append-only and database triggers block routine ledger/allocation writes after publication. The internal profile role remains `reviewer` but is displayed as “Viewer”; `reviewer` is no longer a membership-role value.

This model keeps the spreadsheet's controlled dropdown behavior but replaces VLOOKUP-style coupling with normalized reference tables, foreign keys, and reporting views.

## Design Principles

- Keep **Funding Entries** and **Expenditure Entries** as separate write tables because the forms, required fields, identifiers, and validation rules differ. This is a confirmed product decision.
- Share reference dimensions across both ledgers: MDA, fiscal year, programme area, and authenticated user.
- Derive fiscal year and quarter from transaction date instead of asking users to type them.
- Support multiple fiscal years from v1; do not hardcode the platform to 2026.
- Preserve user-friendly public IDs for references, but use UUID primary keys internally. Generate fiscal-year-scoped IDs like `FL-2026-0001` and `EL-2026-0001`.
- Treat budget and AOP as imported planning/reference data, not user-entered transaction data.
- Allow admins to create and update all reference data, including MDAs, programme areas, funding sources, expenditure categories, LGAs, facilities, payment methods, approved budgets, and AOP activities.
- Keep programme areas, funding sources, expenditure categories, and payment methods global across all MDAs in v1.
- Preserve historical reporting by deactivating referenced values instead of deleting them. When the meaning of a reference value changes, admins should create a new value and deactivate the old one.
- Active reference values created by admins should be immediately available in forms; no separate reference-data approval workflow in v1.
- Store monetary values as `numeric(18,2)` and format them as Nigerian naira in the UI.
- Use database constraints for high-confidence rules and application validation for user-friendly messages.

## Core Tables

### `profiles`

Extends `auth.users` with platform-specific authorization data.

| Column | Type | Notes |
| --- | --- | --- |
| `id` | `uuid` | Primary key, references `auth.users(id)` |
| `full_name` | `text` | Display name |
| `role` | `text` | Suggested values: `admin`, `mda_user`, `reviewer` |
| `created_at` | `timestamptz` | Default now |

MDA access should not be stored as a single column on `profiles`; use `user_mda_memberships` so shared finance/admin staff can submit for more than one MDA.

### `user_mda_memberships`

Links users to the MDAs for which they can submit entries. Statewide Viewer visibility is derived from the profile role and RLS helpers.

| Column | Type | Notes |
| --- | --- | --- |
| `id` | `uuid` | Primary key |
| `user_id` | `uuid` | FK to `profiles(id)` |
| `mda_id` | `uuid` | FK to `mdas(id)` |
| `membership_role` | `text` | Value: `submitter` |
| `created_at` | `timestamptz` | Default now |

Unique constraint: `(user_id, mda_id, membership_role)`.

### `budget_implementation_report_publications`

Append-only evidence that an Admin published a fiscal-year quarter. `(fiscal_year, quarter, version)` is unique. Version 1 has no predecessor; amendment versions reference the publication they supersede and require a reason. Authenticated users may read metadata, while only Admin RPCs insert it.

### `budget_implementation_report_amendments`

Records the affected ledger entry, source and resulting publication versions, required reason, before/after JSON, Admin actor, and timestamp. Expenditure amendments replace funding allocations in the same transaction.

### `archived_ledger_entries`

Admin-readable snapshot store for legacy rejected rows removed during the status migration. It preserves the original row plus comment, audit, and attachment metadata snapshots and is excluded from all ledger reporting.

### `mdas`

| Column | Type | Notes |
| --- | --- | --- |
| `id` | `uuid` | Primary key |
| `code` | `text` | Unique MDA code |
| `name` | `text` | Unique canonical name |
| `mda_type_id` | `uuid` | Optional FK to `mda_types(id)` |
| `abbreviation` | `text` | Optional display abbreviation |
| `active` | `boolean` | Default true |
| `created_at` | `timestamptz` | Default now |
| `updated_at` | `timestamptz` | Default now |

Admins can add or update MDAs. Deactivate MDAs instead of deleting them once entries, budgets, or AOP activities reference them.

### `mda_types`

Admin-managed classifications for MDAs.

| Column | Type | Notes |
| --- | --- | --- |
| `id` | `uuid` | Primary key |
| `name` | `text` | Example: `Ministry`, `Board`, `Agency`, `School`, `College`, `Hospital` |
| `active` | `boolean` | Default true |
| `created_at` | `timestamptz` | Default now |
| `updated_at` | `timestamptz` | Default now |

MDA type is optional and used for filtering/organization.

### `programme_areas`

Reference table for programme-area dropdown values.

Admins can add, rename, deactivate, and reactivate global values.

### `funding_sources`

Reference table for funding-source dropdown values.

Admins can add, rename, deactivate, and reactivate global values.

### `expenditure_categories`

Reference table for expenditure-category dropdown values.

Admins can add, rename, deactivate, and reactivate global values.

### `expenditure_items`

Optional dropdown values for specific items, services, or sub-categories under an expenditure category.

| Column | Type | Notes |
| --- | --- | --- |
| `id` | `uuid` | Primary key |
| `expenditure_category_id` | `uuid` | Optional FK to `expenditure_categories(id)` |
| `name` | `text` | Item/sub-category display name |
| `active` | `boolean` | Default true |
| `created_at` | `timestamptz` | Default now |
| `updated_at` | `timestamptz` | Default now |

Admins can add, rename, deactivate, and reactivate global values. If category-linked, expenditure item dropdowns should be filtered by the selected expenditure category. Expenditure item remains optional in v1, even when items exist for the selected category.

### `payment_methods`

Reference table for payment-method dropdown values.

Admins can add, rename, deactivate, and reactivate global values.

### `entry_statuses`

Reference table for review workflow status dropdown values. Seed with:

| Slug | Meaning |
| --- | --- |
| `pending` | Submitted by an MDA user and awaiting review |
| `approved` | Reviewed and accepted for reporting |
| `processed` | Accepted and reconciled or posted in the finance process |
| `rejected` | Reviewed and rejected; excluded from official reporting |

Admins can update status labels and add statuses if the workflow evolves. Slugs used in workflow logic should be changed carefully.

### `lgas`

| Column | Type | Notes |
| --- | --- | --- |
| `id` | `uuid` | Primary key |
| `name` | `text` | Unique LGA name |

Admins can add or update LGAs. Deactivate LGAs instead of deleting them if historical facilities or entries exist.

### `facilities`

| Column | Type | Notes |
| --- | --- | --- |
| `id` | `uuid` | Primary key |
| `lga_id` | `uuid` | Required FK to `lgas` |
| `name` | `text` | Facility name |
| `facility_type` | `text` | Example: `phc`; seed workbook facilities as PHC |
| `active` | `boolean` | Default true |

Recommended unique constraint: `(lga_id, name)`.

Admins can add or update facilities. Facility moves between LGAs should be treated carefully because they affect historical facility reporting. If PHC expenditure must be submitted when the exact facility is unknown, admins can create an `Unspecified PHC Facility` record for that LGA rather than allowing blank facility values.

## Planning Tables

### `approved_budgets`

One row per MDA per fiscal year.

For v1, approved budgets stay at the workbook's MDA-level structure: personnel, other recurrent, recurrent total, capital, and total budget. Do not introduce a separate budget-line hierarchy unless an official budget chart of accounts is introduced later.

Seed 2026 from the workbook, but keep the table multi-year.

| Column | Type | Notes |
| --- | --- | --- |
| `id` | `uuid` | Primary key |
| `fiscal_year` | `int` | Example: 2026 |
| `mda_id` | `uuid` | FK to `mdas` |
| `personnel_amount` | `numeric(18,2)` | Default 0 |
| `other_recurrent_amount` | `numeric(18,2)` | Default 0 |
| `total_recurrent_amount` | `numeric(18,2)` | Can be generated or stored from source |
| `capital_amount` | `numeric(18,2)` | Default 0 |
| `total_budget_amount` | `numeric(18,2)` | Can be generated or stored from source |
| `source_label` | `text` | Example: Kano State Government 2026 Approved Budget |

Unique constraint: `(fiscal_year, mda_id)`.

Do not import the workbook's sector-total row as an MDA. Store sector totals as a view or a separate import summary.

Admins can create and update approved budgets in the app. Imports can still be provided as a bulk-entry path, but they are not the only source of truth.

### `aop_activities`

| Column | Type | Notes |
| --- | --- | --- |
| `id` | `uuid` | Primary key |
| `fiscal_year` | `int` | Example: 2026 |
| `activity_code` | `text` | Activity code from AOP |
| `description` | `text` | Activity description |
| `mda_id` | `uuid` | FK to `mdas` |
| `budgeted_cost` | `numeric(18,2)` | Default 0 |
| `source_row_number` | `int` | Optional import row number, used to preserve duplicate workbook activity codes |

Suggested import-safe unique constraint: `(fiscal_year, activity_code, mda_id, source_row_number)`.

Admins can create and update AOP activities in the app. Imports can still be provided as a bulk-entry path.

Seed 2026 from the workbook, but keep the table multi-year.

## Ledger Tables

### `funding_entries`

| Column | Type | Notes |
| --- | --- | --- |
| `id` | `uuid` | Primary key |
| `public_id` | `text` | Generated user-facing ID, e.g. `FL-2026-0001` |
| `transaction_date` | `date` | Required |
| `fiscal_year` | `int` | Generated from `transaction_date`; calendar-year assumption for v1 |
| `quarter` | `smallint` | Generated from date, 1-4 |
| `mda_id` | `uuid` | Required FK |
| `funding_source_id` | `uuid` | Required FK |
| `programme_area_id` | `uuid` | Required FK |
| `amount` | `numeric(18,2)` | Required, positive |
| `reference_no` | `text` | Required traceability identifier |
| `remarks` | `text` | Optional |
| `status_id` | `uuid` | Required FK; default pending |
| `entered_by` | `uuid` | Required FK to `profiles` |
| `created_at` | `timestamptz` | Default now |
| `updated_at` | `timestamptz` | Default now |
| `approved_by` | `uuid` | Optional FK to `profiles` |
| `approved_at` | `timestamptz` | Optional |

Recommended unique constraint: `(fiscal_year, mda_id, reference_no)`.

### `expenditure_entries`

| Column | Type | Notes |
| --- | --- | --- |
| `id` | `uuid` | Primary key |
| `public_id` | `text` | Generated user-facing ID, e.g. `EL-2026-0001` |
| `transaction_date` | `date` | Required |
| `fiscal_year` | `int` | Generated from `transaction_date`; calendar-year assumption for v1 |
| `quarter` | `smallint` | Generated from date, 1-4 |
| `mda_id` | `uuid` | Required FK |
| `expenditure_category_id` | `uuid` | Required FK |
| `programme_area_id` | `uuid` | Required FK |
| `aop_activity_id` | `uuid` | Optional FK to `aop_activities`; filtered by selected MDA and fiscal year |
| `expenditure_item_id` | `uuid` | Optional FK to `expenditure_items`; dropdown-backed but not required in v1 |
| `is_phc` | `boolean` | Required default false |
| `lga_id` | `uuid` | Required only when `is_phc = true` |
| `facility_id` | `uuid` | Required only when `is_phc = true` |
| `amount` | `numeric(18,2)` | Required, positive |
| `voucher_ref_no` | `text` | Required traceability identifier |
| `payment_method_id` | `uuid` | Required FK; do not allow blank expenditure payment methods |
| `remarks` | `text` | Optional |
| `status_id` | `uuid` | Required FK; default pending |
| `entered_by` | `uuid` | Required FK to `profiles` |
| `created_at` | `timestamptz` | Default now |
| `updated_at` | `timestamptz` | Default now |
| `approved_by` | `uuid` | Optional FK to `profiles` |
| `approved_at` | `timestamptz` | Optional |

Recommended unique constraint: `(fiscal_year, mda_id, voucher_ref_no)`.

Recommended constraints:

- `amount > 0`
- `quarter between 1 and 4`
- `is_phc = false` requires both `lga_id` and `facility_id` to be null
- `is_phc = true` requires both `lga_id` and `facility_id` to be present
- `(facility_id, lga_id)` should match the selected facility's actual LGA, using a composite foreign key or trigger-backed validation

## Audit Tables

### `entry_audit_events`

Records material changes to funding entries, expenditure entries, status transitions, and reference data.

| Column | Type | Notes |
| --- | --- | --- |
| `id` | `uuid` | Primary key |
| `entity_type` | `text` | Example: `funding_entry`, `expenditure_entry`, `mda`, `facility` |
| `entity_id` | `uuid` | UUID of the changed row when the table has a UUID primary key |
| `entity_key` | `text` | Stable key of the changed row; UUID string or slug |
| `event_type` | `text` | Example: `created`, `updated`, `status_changed`, `deactivated`, `reactivated` |
| `old_values` | `jsonb` | Snapshot of changed fields before the event |
| `new_values` | `jsonb` | Snapshot of changed fields after the event |
| `reason` | `text` | Optional user-supplied reason |
| `actor_id` | `uuid` | FK to `profiles(id)` |
| `created_at` | `timestamptz` | Default now |

Capture audit events for:

- Funding entry creation and updates
- Expenditure entry creation and updates
- Status changes, including approve and reject actions
- Reference-data creation, rename/update, deactivate, and reactivate actions
- Admin changes to approved budgets and AOP activities

### `entry_comments`

User-visible comments for review discussion, clarification, rejection reasons, and follow-up.

| Column | Type | Notes |
| --- | --- | --- |
| `id` | `uuid` | Primary key |
| `entry_type` | `text` | `funding_entry` or `expenditure_entry` |
| `entry_id` | `uuid` | ID of the commented entry |
| `body` | `text` | Comment text |
| `comment_type` | `text` | Example: `general`, `clarification`, `rejection_reason`, `approval_note` |
| `author_id` | `uuid` | FK to `profiles(id)` |
| `created_at` | `timestamptz` | Default now |

Rejected entries should require an `entry_comments` row with `comment_type = 'rejection_reason'`.

## Attachment Tables

### `entry_attachments`

Optional supporting files for funding and expenditure entries.

| Column | Type | Notes |
| --- | --- | --- |
| `id` | `uuid` | Primary key |
| `entry_type` | `text` | `funding_entry` or `expenditure_entry` |
| `entry_id` | `uuid` | ID of the attached entry |
| `storage_bucket` | `text` | Private Supabase Storage bucket name |
| `storage_path` | `text` | Object path in storage |
| `file_name` | `text` | Original file name |
| `content_type` | `text` | MIME type |
| `file_size_bytes` | `bigint` | Optional file size |
| `uploaded_by` | `uuid` | FK to `profiles(id)` |
| `created_at` | `timestamptz` | Default now |

Attachments are optional in v1. Store files in private Supabase Storage buckets and enforce access based on the linked entry's MDA membership/admin rights.

## Import Tables

### `admin_import_batches`

Tracks admin-only imports from Excel or CSV files.

| Column | Type | Notes |
| --- | --- | --- |
| `id` | `uuid` | Primary key |
| `import_type` | `text` | Example: `reference_data`, `approved_budget`, `aop_activities`, `historical_funding`, `historical_expenditure` |
| `source_file_name` | `text` | Uploaded file name |
| `storage_path` | `text` | Optional private storage path for the uploaded import file |
| `status` | `text` | Example: `pending`, `validated`, `imported`, `failed` |
| `summary` | `jsonb` | Counts, warnings, and validation results |
| `created_by` | `uuid` | FK to `profiles(id)` |
| `created_at` | `timestamptz` | Default now |
| `completed_at` | `timestamptz` | Optional |

Imports should be admin-only and used for seed/reference/planning data plus historical migration. Routine MDA reporting should happen through authenticated web forms.

Imports must validate before writing. Historical funding imports should reject rows that collide with `(fiscal_year, mda_id, reference_no)`. Historical expenditure imports should reject rows that collide with `(fiscal_year, mda_id, voucher_ref_no)`. Row-level validation errors should be stored in `admin_import_errors`.

### `admin_import_errors`

Stores row-level validation errors for an import batch.

| Column | Type | Notes |
| --- | --- | --- |
| `id` | `uuid` | Primary key |
| `batch_id` | `uuid` | FK to `admin_import_batches(id)` |
| `row_number` | `int` | Source row number when available |
| `field_name` | `text` | Source field or column name |
| `message` | `text` | Human-readable validation error |
| `raw_row` | `jsonb` | Optional source row snapshot |

## Submission Governance

### `submission_windows`

Admin-managed fiscal year or date-range controls for routine MDA submissions.

| Column | Type | Notes |
| --- | --- | --- |
| `id` | `uuid` | Primary key |
| `name` | `text` | Human-readable label |
| `fiscal_year` | `int` | Optional fiscal year governed by the window |
| `start_date` | `date` | Optional start date |
| `end_date` | `date` | Optional end date |
| `status` | `text` | Suggested values: `open`, `closed` |
| `applies_to_mda_id` | `uuid` | Optional FK to `mdas`; null means all MDAs |
| `created_by` | `uuid` | FK to `profiles(id)` |
| `created_at` | `timestamptz` | Default now |
| `updated_at` | `timestamptz` | Default now |

V1 should include this concept but start permissive by default. Admins can use it later to close fiscal years or reporting periods, while rollout and historical catch-up entries remain possible.

## Data Quality Tables

### `entry_data_quality_warnings`

Non-blocking warnings attached to funding and expenditure entries for reviewer attention. V1 should prioritize blocking invalid data at entry time through dropdowns, foreign keys, required fields, and conditional validation. Configurable review thresholds/rule builders are out of scope for v1.

| Column | Type | Notes |
| --- | --- | --- |
| `id` | `uuid` | Primary key |
| `entry_type` | `text` | `funding_entry` or `expenditure_entry` |
| `entry_id` | `uuid` | ID of the flagged entry |
| `warning_code` | `text` | Machine-readable warning code |
| `message` | `text` | Human-readable warning |
| `severity` | `text` | Suggested values: `info`, `warning`, `high` |
| `resolved_at` | `timestamptz` | Optional |
| `resolved_by` | `uuid` | Optional FK to `profiles(id)` |
| `created_at` | `timestamptz` | Default now |

Suggested v1 warning checks:

- Missing reference number or voucher number
- PHC expenditure using an `Unspecified PHC Facility`
- Expenditure without optional AOP linkage
- Stale pending entry
- Entry date outside an open submission window

Do not add configurable amount thresholds or high-value attachment rules in v1.

## Reference Data Requests

### `reference_value_requests`

Requests from MDA users for admins to add or update controlled dropdown values.

| Column | Type | Notes |
| --- | --- | --- |
| `id` | `uuid` | Primary key |
| `reference_type` | `text` | Example: `programme_area`, `funding_source`, `expenditure_category`, `expenditure_item`, `facility`, `payment_method` |
| `requested_label` | `text` | Proposed value |
| `description` | `text` | Why the value is needed |
| `related_mda_id` | `uuid` | Optional FK to `mdas(id)` |
| `related_lga_id` | `uuid` | Optional FK to `lgas(id)`, useful for facility requests |
| `related_category_id` | `uuid` | Optional FK to `expenditure_categories(id)`, useful for expenditure items |
| `status` | `text` | Suggested values: `pending`, `approved`, `rejected` |
| `resolved_reference_id` | `uuid` | Optional ID of the created/updated reference value |
| `requested_by` | `uuid` | FK to `profiles(id)` |
| `reviewed_by` | `uuid` | Optional FK to `profiles(id)` |
| `review_comment` | `text` | Required when rejected |
| `created_at` | `timestamptz` | Default now |
| `reviewed_at` | `timestamptz` | Optional |

Admins approve a request by creating or updating the appropriate reference value. Approved active values become immediately available in forms.

## Other Option Policy

Keep existing workbook `Other` values where they already exist, such as funding source, programme area, and payment method. Do not add new `Other` options to every dropdown by default. Prefer `reference_value_requests` when users need missing controlled values.

When a user selects `Other`, require `remarks` explaining what the value represents.

## Notification Tables

### `notifications`

In-app notification records for users.

| Column | Type | Notes |
| --- | --- | --- |
| `id` | `uuid` | Primary key |
| `recipient_id` | `uuid` | FK to `profiles(id)` |
| `notification_type` | `text` | Example: `entry_submitted`, `entry_approved`, `entry_rejected`, `entry_processed` |
| `title` | `text` | Short notification title |
| `body` | `text` | Human-readable message |
| `entity_type` | `text` | Optional linked entity type |
| `entity_id` | `uuid` | Optional linked entity ID |
| `read_at` | `timestamptz` | Null until read |
| `created_at` | `timestamptz` | Default now |

### `email_delivery_events`

Auditable email outbox and delivery tracking for Resend-backed workflow emails.

| Column | Type | Notes |
| --- | --- | --- |
| `id` | `uuid` | Primary key |
| `recipient_id` | `uuid` | Optional FK to `profiles(id)` |
| `recipient_email` | `text` | Email address used at send time |
| `template_key` | `text` | Example: `entry_submitted_admin`, `entry_approved_submitter` |
| `entity_type` | `text` | Optional linked entity type |
| `entity_id` | `uuid` | Optional linked entity ID |
| `payload` | `jsonb` | Template data sent to the email service |
| `provider` | `text` | Default `resend` |
| `provider_message_id` | `text` | Resend message ID when available |
| `status` | `text` | Example: `queued`, `sent`, `delivered`, `failed` |
| `error_message` | `text` | Failure detail when available |
| `created_at` | `timestamptz` | Default now |
| `sent_at` | `timestamptz` | Optional |

V1 notification rules:

- Notify admins/reviewers by email and in-app notification when a funding or expenditure entry is submitted.
- Notify the submitter by email and in-app notification when an entry is approved, rejected, or processed.
- Keep email delivery records so failed sends can be reviewed and retried.

## Reporting Views

Recommended admin-facing views:

- `mda_budget_vs_actual`: approved budget, funding received, expenditure, balance, percent budget used by MDA and fiscal year
- `funding_by_source`: funding totals by funding source, fiscal year, quarter, and MDA
- `expenditure_by_category`: expenditure totals by category, fiscal year, quarter, and MDA
- `programme_area_summary`: funding and expenditure by programme area
- `funding_expenditure_gap`: funding received minus expenditure by MDA, programme area, quarter, and fiscal year
- `phc_lga_expenditure_summary`: PHC expenditure by LGA
- `phc_facility_expenditure_summary`: PHC expenditure by facility
- `aop_budget_coverage`: AOP budgeted cost by MDA compared with approved budget
- `aop_planned_vs_actual`: AOP activity budgeted cost compared with linked expenditure totals
- `unlinked_expenditure`: expenditure entries without AOP linkage, grouped by MDA, programme area, and category

In Supabase, reporting views exposed to authenticated users should be created with `security_invoker = true` when supported, so table RLS remains effective.

## Auth And Access Model

Proposed roles:

- `admin`: can manage reference data, users, all entries, budgets, AOP imports, and insights
- `mda_user`: can create and view entries for assigned MDAs
- `reviewer`: can review, approve, reject, and process entries for assigned MDAs without full admin powers

Proposed RLS rules:

- All ledger tables: MDA users can select and insert rows where their `user_mda_memberships` include the row's `mda_id`
- All ledger tables: MDA users can update their own assigned-MDA rows only while status is `pending`
- All ledger tables: MDA users cannot approve their own rows unless explicitly allowed
- Reviewers can change statuses and review entries for MDAs where they have reviewer membership
- Reviewers can directly edit reviewed entries for assigned MDAs if they provide a reason and an audit event is created
- Admins can select, insert, update, and delete all rows
- Admins can change entry statuses and directly edit reviewed entries if they provide a reason and an audit event is created
- Reference tables are readable by authenticated users and writable only by admins
- Budget and AOP tables are readable by authenticated users and writable only by admins
- Import batches and import errors are admin-only
- Submission windows are readable by authenticated users and writable only by admins
- Data quality warnings are visible to users who can view the linked entry; resolution is reviewer/admin-only
- Reference value requests are visible to the requester and admins; approval/rejection is admin-only
- Notifications are visible only to their recipient and admins
- Email delivery events are admin-only
- Entry comments are visible to users who can view the linked entry

Authorization data should live in `profiles` and server-managed app metadata, not user-editable metadata.

## Form Behavior

Funding form:

- User chooses date, MDA, programme area, funding source, amount, reference number, remarks
- Fiscal year and quarter are derived automatically from transaction date and shown read-only
- MDA, programme area, and funding source must be dropdown-backed controlled fields
- Status should default to pending
- Entered by should come from the authenticated user
- MDA users can edit submitted funding entries only while status is pending
- Attachments are optional
- Do not capture receipt or deposit method for funding entries in v1
- Amount must be positive
- Reference number is required
- If a selected controlled value is `Other`, remarks are required
- Remarks are otherwise optional
- Submission windows are permissive by default in v1, but can later block routine submissions for closed periods

Expenditure form:

- User chooses date, MDA, programme area, expenditure category, amount, PHC yes/no, payment method, voucher reference, remarks
- User may optionally choose an AOP activity filtered by selected MDA and fiscal year
- MDA, programme area, expenditure category, expenditure item, PHC yes/no, LGA, facility, payment method, and AOP activity should be dropdown-backed controlled fields; optional fields remain optional
- If PHC is yes, require LGA and facility
- If the exact PHC facility is unknown, use an admin-created `Unspecified PHC Facility` for the selected LGA
- Facility dropdown should be filtered by selected LGA and PHC facility type
- If PHC is no, hide or disable LGA and facility
- Status should default to pending
- MDA users can edit submitted expenditure entries only while status is pending
- Attachments are optional
- Amount must be positive
- Voucher/reference number is required
- If a selected controlled value is `Other`, remarks are required
- Remarks are otherwise optional
- Submission windows are permissive by default in v1, but can later block routine submissions for closed periods

Admin insights:

- Budget vs funding vs expenditure by MDA
- Funding source mix
- Expenditure category mix
- Programme area financing
- Budget utilization by MDA
- PHC expenditure by LGA and facility
- Pending/approved/processed/rejected entry counts
- Status filters for every insight view
- Approval and rejection actions for submitted entries
- Planned-vs-actual AOP activity analysis
- Unlinked expenditure reporting
- Data quality checks for missing required references, stale pending entries, PHC fallback facilities, and entries outside open submission windows
- Data quality warning queues before approval
- Audit history for entries and reference-data changes
- Attachment review for supporting documents where uploaded
- Import validation summaries for admins
- CSV, XLSX, and PDF exports for ledgers, filtered insight tables, and dashboard summaries
- Email and in-app notification history for workflow events
- Reference value request queue for missing dropdown values

MDA-user dashboards:

- Assigned-MDA funding and expenditure totals
- Assigned-MDA budget utilization
- User's submitted entries and their statuses
- Pending, approved, processed, and rejected entry counts
- Rejected entries requiring correction
- Entry comments on submitted and reviewed entries
- Optional AOP planned-vs-actual views for assigned MDAs

Cross-MDA comparisons, statewide totals, user management, imports, reference-data administration, and approval queues remain admin/reviewer capabilities.

## Exports

V1 should support:

- CSV exports for raw and filtered ledger rows
- XLSX exports for ledgers and insight tables
- PDF exports for dashboard summaries and filtered admin reports

Exports should preserve selected filters, especially fiscal year, MDA, status, programme area, funding source, expenditure category, LGA, facility, and date range.

Admin dashboards should show all submitted entries by default. Admins must be able to filter by status for official reporting, operational review, and rejected-entry audits.
