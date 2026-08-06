// Compact markdown reference of the public database schema, for the assistant
// LLM that queries Supabase PostgREST read-only. Generated from the final
// state of supabase/migrations/ (through 20260727090000_monthly_expenditure_tracking).
// Regenerate when migrations change.

export const SCHEMA_REFERENCE = `# Database schema (Kano Health Finance Tracker)

- All monetary amounts are NGN, numeric(18,2).
- fiscal_year is the calendar year of transaction_date; quarter (1-4) is the calendar quarter. Both are derived automatically on the ledgers.
- funding_entries records money RECEIVED by an MDA; expenditure_entries records SPENDING. expenditure_funding_allocations splits each expenditure across funding sources (allocations sum to the entry amount). Expenditure can optionally bind to an approved_budget_lines row (state budget line) and/or an aop_activities row.
- There is NO per-entry approval status. Instead, quarterly BIR publications (budget_implementation_report_publications) lock a fiscal quarter: after publication, ledger rows for that quarter only change through admin amendment RPCs, recorded in budget_implementation_report_amendments.
- Row-level security automatically limits what a query returns: admin and reviewer (shown as "Viewer" in the UI) see all MDAs; mda_user sees only their member MDAs; facility_user sees only expenditure for their assigned facilities. Reference and planning tables are readable by all authenticated users. Never assume a result set is statewide unless the user is admin/reviewer.
- Boilerplate columns are omitted below: every table has an id uuid primary key plus created_at timestamptz, and most also have updated_at timestamptz. "Standard reference table" means columns: id, slug text (unique), name text (unique), active boolean, created_at, updated_at.

## profiles
User profile extending auth.users. RLS: own row, or all rows for admins.
- id uuid → auth.users.id
- full_name text
- role text — admin | mda_user | reviewer | facility_user (reviewer is displayed as "Viewer")

## user_mda_memberships
Which MDAs a user may submit entries for. RLS: own rows or admin.
- user_id uuid → profiles.id
- mda_id uuid → mdas.id
- membership_role text — funding_submitter | expenditure_submitter

## user_facility_assignments
Facility-user scoping: one MDA, one or more facilities. RLS: own rows or admin.
- user_id uuid → profiles.id
- facility_id uuid → facilities.id
- mda_id uuid → mdas.id

## mdas
Ministries, departments and agencies (health sector).
- code text — unique MDA code
- name text
- mda_type_id uuid → mda_types.id
- abbreviation text
- active boolean

## mda_types
MDA classification (Ministry, Board, Agency, Hospital...). Standard reference table.

## programme_areas
Programme-area dropdown values (global reference). Standard reference table.

## funding_sources
Funding-source dropdown values (global reference; includes an "Unspecified" source). Standard reference table.

## expenditure_categories
Expenditure-category dropdown values (global reference). Standard reference table.

## expenditure_items
Optional item/sub-category under an expenditure category.
- expenditure_category_id uuid → expenditure_categories.id (nullable)
- slug text
- name text
- active boolean

## payment_methods
Payment-method dropdown values. Standard reference table.

## lgas
Local government areas. Standard reference table minus slug (name and active only).

## facilities
Health facilities within an LGA.
- lga_id uuid → lgas.id
- name text
- facility_type text — default 'phc'
- active boolean

## funding_partners
Named donors / implementing partners for AoP resource mapping. Standard reference table.

## approved_budgets
Aggregate approved budget per (fiscal_year, mda) — rollup of approved_budget_lines.
- fiscal_year int
- mda_id uuid → mdas.id
- personnel_amount numeric
- other_recurrent_amount numeric
- total_recurrent_amount numeric — personnel + other_recurrent
- capital_amount numeric
- total_budget_amount numeric — recurrent + capital
- source_label text

## approved_budget_lines
NCOA line-item detail of the approved budget (one row per coded line).
- fiscal_year int
- mda_id uuid → mdas.id
- budget_class text — personnel | overhead | capital
- economic_code text — NCOA economic segment code
- economic_description text
- project_description text — capital project label (nullable)
- function_code text
- location_code text
- fund_code text
- programme_code text
- approved_amount numeric
- source_label text
- source_row_number int — workbook row; disambiguates repeated capital codes
- active boolean

## budget_line_revenues
Approved revenue budget lines (BPR revenue side; separate from funding_entries).
- fiscal_year int
- mda_id uuid → mdas.id
- stream text — recurrent | capital_receipt
- economic_code text
- economic_description text
- receipt_description text
- approved_amount numeric
- source_label text
- source_row_number int
- active boolean

## budget_line_revenue_actuals
Collected revenue per line per quarter (one row per line+quarter).
- budget_line_revenue_id uuid → budget_line_revenues.id
- quarter smallint — 1-4
- amount numeric — actual collections for the quarter
- source_label text

## aop_activities
Annual Operational Plan activities (imported planning data).
- fiscal_year int
- activity_code text
- description text
- mda_id uuid → mdas.id
- budgeted_cost numeric
- source_row_number int
- active boolean

## aop_activity_funding_allocations
Per-activity AoP funding tranches from resource-mapping workbooks. Funding gap = budgeted_cost - sum(amount).
- aop_activity_id uuid → aop_activities.id
- tranche_no smallint — 0 = government fund; 1-5 = development-partner tranches
- funding_source_id uuid → funding_sources.id
- donor_partner_id uuid → funding_partners.id
- implementing_partner_id uuid → funding_partners.id
- amount numeric — 0 records attribution stated without a committed figure
- source_donor_name text
- source_partner_name text

## funding_entries
Ledger of funds received by an MDA. RLS: MDA-scoped.
- public_id text — human ID like FL-2026-0001
- transaction_date date
- fiscal_year int — generated from transaction_date
- quarter smallint — generated, 1-4
- mda_id uuid → mdas.id
- funding_source_id uuid → funding_sources.id
- programme_area_id uuid → programme_areas.id
- amount numeric — > 0
- reference_no text — unique per (fiscal_year, mda)
- remarks text
- entered_by uuid → profiles.id

## expenditure_entries
Ledger of MDA spending. RLS: MDA-scoped (plus facility scope for facility users).
- public_id text — human ID like EL-2026-0001
- transaction_date date
- fiscal_year int — generated from transaction_date
- quarter smallint — generated, 1-4
- mda_id uuid → mdas.id
- expenditure_category_id uuid → expenditure_categories.id
- programme_area_id uuid → programme_areas.id
- aop_activity_id uuid → aop_activities.id (nullable)
- expenditure_item_id uuid → expenditure_items.id (nullable)
- approved_budget_line_id uuid → approved_budget_lines.id (nullable; binds spend to a state budget line)
- is_phc boolean — true requires lga_id + facility_id; false requires both null
- lga_id uuid → lgas.id
- facility_id uuid → facilities.id
- amount numeric — > 0
- voucher_ref_no text — unique per (fiscal_year, mda)
- payment_method_id uuid → payment_methods.id
- remarks text
- entered_by uuid → profiles.id

## expenditure_funding_allocations
Splits one expenditure entry across funding sources; allocations sum to the entry amount. RLS follows the parent entry.
- expenditure_entry_id uuid → expenditure_entries.id
- funding_source_id uuid → funding_sources.id
- amount numeric — > 0; unique (entry, source)

## monthly_expenditure_tracking
IBP monthly reconciliation workbook figures — a SECOND source alongside the quarterly BPR (which stays authoritative). One row per budget line per month where the sheet has a cell: amount = 0 means the MDA explicitly reported zero; a MISSING row means nothing was submitted for that month (a reporting gap). Never treat a missing row as zero.
- fiscal_year int
- mda_id uuid → mdas.id
- budget_class text — personnel | overhead | capital
- economic_code text
- description text
- approved_budget_line_id uuid → approved_budget_lines.id (nullable best-effort bind)
- month smallint — 1-12
- amount numeric — may be 0 (explicit zero report)
- source_label text
- source_row_number int

## budget_implementation_report_publications
Append-only record that an Admin published a quarter's BIR; publishing LOCKS that quarter's ledger rows. Readable by all authenticated.
- fiscal_year int
- quarter smallint — 1-4
- version int — v1 initial; v>1 are amendments; unique (fiscal_year, quarter, version)
- published_by uuid → profiles.id
- published_at timestamptz
- supersedes_publication_id uuid → budget_implementation_report_publications.id (null on v1)
- amendment_reason text — required when version > 1

## budget_implementation_report_amendments
One post-publication ledger change per new publication version. RLS: viewers of the affected entry.
- entry_type text — funding_entry | expenditure_entry
- entry_id uuid — id in the corresponding ledger table
- source_publication_id uuid → budget_implementation_report_publications.id
- resulting_publication_id uuid → budget_implementation_report_publications.id (unique)
- reason text
- before_values jsonb — entry snapshot before (expenditure includes funding_allocations)
- after_values jsonb — entry snapshot after
- amended_by uuid → profiles.id
- amended_at timestamptz

## submission_windows
Admin-declared entry submission windows.
- name text
- fiscal_year int
- start_date date
- end_date date
- status text — open | closed
- applies_to_mda_id uuid → mdas.id (null = all MDAs)
- created_by uuid → profiles.id

## entry_comments
Discussion on a ledger entry. RLS: users who can view the entry.
- entry_type text — funding_entry | expenditure_entry
- entry_id uuid — id in the corresponding ledger table
- body text
- comment_type text — general | clarification
- author_id uuid → profiles.id
- author_name text — snapshotted display name
- author_role text — admin | reviewer | mda_user | facility_user

## entry_attachments
File attachments on a ledger entry (stored in the entry-attachments bucket). RLS: entry viewers.
- entry_type text — funding_entry | expenditure_entry
- entry_id uuid
- storage_bucket text
- storage_path text
- file_name text
- content_type text
- file_size_bytes bigint
- uploaded_by uuid → profiles.id

## entry_audit_events
Trigger-written audit trail for ledger and reference rows. RLS: admin sees all; others see events for entries in MDAs they can view.
- entity_type text — source table name (e.g. funding_entries, expenditure_entries, mdas)
- entity_id uuid
- entity_key text — id or slug
- event_type text — created | updated | status_changed | deactivated | reactivated | deleted
- old_values jsonb
- new_values jsonb
- reason text — audit reason supplied by correction/amendment RPCs
- actor_id uuid → profiles.id

## entry_data_quality_warnings
Non-blocking data-quality flags on entries (over-allocation warnings currently disabled). RLS: entry viewers.
- entry_type text — funding_entry | expenditure_entry
- entry_id uuid
- warning_code text
- message text
- severity text — info | warning | high
- resolved_at timestamptz
- resolved_by uuid → profiles.id

## reference_value_requests
User requests for new reference/dropdown values. RLS: own requests or admin.
- reference_type text — mda | mda_type | programme_area | funding_source | expenditure_category | expenditure_item | facility | payment_method | lga
- requested_label text
- description text
- related_mda_id uuid → mdas.id
- related_lga_id uuid → lgas.id
- related_category_id uuid → expenditure_categories.id
- status text — pending | approved | rejected
- resolved_reference_id uuid — id of the created reference row
- requested_by uuid → profiles.id
- reviewed_by uuid → profiles.id
- review_comment text
- reviewed_at timestamptz

## notifications
In-app notifications. RLS: recipient (or admin).
- recipient_id uuid → profiles.id
- notification_type text — e.g. entry_comment_added
- title text
- body text
- entity_type text
- entity_id uuid
- read_at timestamptz — null = unread

## report_publishers
Report-branding presets for the reports hub. Readable by all authenticated.
- slug text
- name text
- logo_kind text — e.g. monogram | crest
- palette jsonb
- voice_preset text
- active boolean

## report_narratives
Human-authored prose overrides for report sections. RLS: admin and reviewer only.
- template text — cso | bir | audit | mbp
- fiscal_year int
- quarter int — null = full year
- section_key text
- body text
- edited_by uuid → profiles.id

## archived_ledger_entries
Snapshots of legacy rejected entries removed in the status migration. RLS: ADMIN ONLY; excluded from reporting.
- entry_type text — funding_entry | expenditure_entry
- original_entry_id uuid
- public_id text
- fiscal_year int
- quarter smallint
- mda_id uuid → mdas.id
- archive_reason text
- entry_snapshot jsonb
- comments_snapshot jsonb
- audit_snapshot jsonb
- attachments_snapshot jsonb
- archived_at timestamptz
- archived_by uuid → profiles.id

## admin_import_batches
Admin data-import batches. RLS: ADMIN ONLY.
- import_type text — reference_data | approved_budget | aop_activities | historical_funding | historical_expenditure | bpr_quarterly_actuals
- source_file_name text
- storage_path text
- status text — pending | validated | imported | failed
- summary jsonb
- created_by uuid → profiles.id
- completed_at timestamptz

## export_jobs
Async export jobs. RLS: ADMIN ONLY.
- export_type text — csv | xlsx | pdf
- subject text
- filters jsonb
- storage_bucket text
- storage_path text
- status text — queued | processing | completed | failed
- error_message text
- created_by uuid → profiles.id
- completed_at timestamptz

## mda_budget_vs_actual (view)
Budget vs funding vs expenditure per MDA per fiscal year.
- fiscal_year int
- mda_id uuid → mdas.id
- mda_name text
- total_budget_amount numeric
- total_funding_amount numeric
- total_expenditure_amount numeric
- budget_balance_amount numeric — budget minus expenditure
- budget_used_ratio numeric — expenditure / budget (null when budget = 0)

## funding_by_source (view)
Funding totals per source per MDA per quarter.
- fiscal_year int
- quarter smallint
- mda_id uuid → mdas.id
- mda_name text
- funding_source_id uuid → funding_sources.id
- funding_source_name text
- total_amount numeric
- entry_count bigint

## expenditure_by_category (view)
Expenditure totals per category per MDA per quarter.
- fiscal_year int
- quarter smallint
- mda_id uuid → mdas.id
- mda_name text
- expenditure_category_id uuid → expenditure_categories.id
- expenditure_category_name text
- total_amount numeric
- entry_count bigint

## expenditure_by_funding_source (view)
Expenditure allocation totals per funding source per MDA per quarter (from expenditure_funding_allocations).
- fiscal_year int
- quarter smallint
- mda_id uuid → mdas.id
- mda_name text
- funding_source_id uuid → funding_sources.id
- funding_source_name text
- total_amount numeric
- entry_count bigint — distinct expenditure entries

## programme_area_summary (view)
Funding and expenditure totals per programme area per MDA per year.
- programme_area_id uuid → programme_areas.id
- programme_area_name text
- fiscal_year int
- mda_id uuid → mdas.id
- total_funding_amount numeric
- total_expenditure_amount numeric

## phc_lga_expenditure_summary (view)
PHC expenditure totals per LGA per year (is_phc rows only).
- fiscal_year int
- lga_id uuid → lgas.id
- lga_name text
- total_expenditure_amount numeric
- entry_count bigint

## phc_facility_expenditure_summary (view)
PHC expenditure totals per facility per year (is_phc rows only).
- fiscal_year int
- lga_id uuid → lgas.id
- lga_name text
- facility_id uuid → facilities.id
- facility_name text
- total_expenditure_amount numeric
- entry_count bigint

## aop_planned_vs_actual (view)
Per-AOP-activity budgeted cost vs linked expenditure.
- fiscal_year int
- mda_id uuid → mdas.id
- mda_name text
- aop_activity_id uuid → aop_activities.id
- activity_code text
- description text
- budgeted_cost numeric
- linked_expenditure_amount numeric
- remaining_amount numeric

## unlinked_expenditure (view)
Expenditure with no AOP activity link, grouped by MDA / programme area / category.
- fiscal_year int
- mda_id uuid → mdas.id
- mda_name text
- programme_area_id uuid → programme_areas.id
- programme_area_name text
- expenditure_category_id uuid → expenditure_categories.id
- expenditure_category_name text
- total_amount numeric
- entry_count bigint

## Internal tables (rarely useful)
- entry_public_id_counters — sequence state for FL-/EL- public IDs (admin only)
- email_delivery_events — outbound email delivery log (admin only)
- admin_import_errors — per-row validation errors for admin import batches (admin only)

## Key relationships and gotchas
- Join ledgers to names via mda_id → mdas, programme_area_id → programme_areas, funding_source_id → funding_sources; expenditure additionally via expenditure_category_id, expenditure_item_id, payment_method_id, lga_id, facility_id.
- expenditure_funding_allocations links expenditure_entries to funding_sources; funding_entries are linked to expenditure only indirectly through the shared funding_source + MDA + programme area + year pool.
- entry_comments / entry_attachments / entry_data_quality_warnings / budget_implementation_report_amendments reference ledgers polymorphically via (entry_type, entry_id) — there is no FK, so join manually on entry_id.
- approved_budget_lines rolls up into approved_budgets; expenditure_entries.approved_budget_line_id gives per-line actuals. monthly_expenditure_tracking.approved_budget_line_id links monthly figures to the same lines.
- monthly_expenditure_tracking: amount = 0 means "reported zero"; a missing row means "not reported". BPR quarterly figures remain authoritative when the two disagree.
- Views run with the caller's permissions (security_invoker), so all view output is already RLS-filtered.
- entry_statuses no longer exists and ledgers have no status column; treat every ledger row as reportable.
` as const;
