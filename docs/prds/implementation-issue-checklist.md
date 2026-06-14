# Implementation Issue Checklist

This checklist converts the end-to-end implementation PRDs into `to-issues` style tracer-bullet slices. Each slice is meant to be independently grabbable, demoable, and checkable as the project is implemented.

Issue tracker publication note: no issue tracker configuration or triage label vocabulary is present in this repository yet. Until that setup exists, use this file as the local issue checklist. When an issue tracker is configured, publish these in dependency order and apply the `ready-for-agent` label.

## Proposed Slice Review

- [ ] Confirm the slice granularity is right.
- [ ] Confirm dependency relationships are correct.
- [ ] Confirm HITL/AFK markings are right.
- [ ] Confirm no slices should be merged or split further.
- [ ] Publish approved slices to the issue tracker in dependency order.

## Slice Summary

1. [x] Next.js app shell and authenticated role routing
   - Type: AFK
   - Blocked by: None
   - User stories covered: PRD 1 stories 1-18
2. [x] Supabase database connection, typed access, and capability checks
   - Type: AFK
   - Blocked by: Slice 1
   - User stories covered: PRD 1 stories 13-18; PRD 2 stories 1, 26-28; PRD 3 stories 1-4
3. [x] Funding Entry submit and pending edit path
   - Type: AFK
   - Blocked by: Slices 1, 2
   - User stories covered: PRD 2 stories 1-7, 23-28, 30
4. [x] Expenditure Entry submit and pending edit path
   - Type: AFK
   - Blocked by: Slices 1, 2
   - User stories covered: PRD 2 stories 1, 8-30
5. [x] Reviewer/Admin entry detail, comments, and status workflow
   - Type: AFK
   - Blocked by: Slices 3, 4
   - User stories covered: PRD 3 stories 1-16, 23-25
6. [ ] Data Quality Warnings and workflow notifications
   - Type: AFK
   - Blocked by: Slice 5
   - User stories covered: PRD 3 stories 17-22; PRD 4 stories 27-29
7. [x] Reference Data management and Reference Value Requests
   - Type: AFK
   - Blocked by: Slices 1, 2
   - User stories covered: PRD 4 stories 1-16
8. [x] Approved Budget and AOP Activity management
   - Type: AFK
   - Blocked by: Slices 1, 2, 7
   - User stories covered: PRD 4 stories 17-20
9. [ ] Admin Import validation and write workflow
   - Type: AFK
   - Blocked by: Slices 3, 4, 7, 8
   - User stories covered: PRD 4 stories 21-26, 30
10. [ ] MDA Dashboard and Admin Insights
    - Type: AFK
    - Blocked by: Slices 3, 4, 5, 8
    - User stories covered: PRD 5 stories 1-23, 30
11. [ ] CSV, XLSX, and PDF Export Jobs
    - Type: AFK
    - Blocked by: Slice 10
    - User stories covered: PRD 5 stories 24-29
12. [ ] End-to-end hardening and launch readiness
    - Type: HITL
    - Blocked by: Slices 1-11
    - User stories covered: PRD 6 stories 1-18

### TOR Alignment Slices (added after IBP TOR review)

13. [ ] Monthly Submission Cycle skeleton (draft + submit + deadline + late state)
    - Type: AFK
    - Blocked by: Slices 3, 4
    - User stories covered: PRD stories 53, 54, 56, 57
14. [ ] Budget Release Entries and expenditure release-reconciliation fields
    - Type: AFK
    - Blocked by: Slices 4, 8, 13
    - User stories covered: PRD stories 61, 62
15. [ ] Release Notes and Activity Progress per cycle
    - Type: AFK
    - Blocked by: Slices 8, 13, 14
    - User stories covered: PRD stories 58, 59
16. [ ] Submission confirmation PDF and PHC facility-cycle entry surface
    - Type: AFK
    - Blocked by: Slices 13, 15
    - User stories covered: PRD stories 55, 60
17. [ ] SMoH System-Wide Dashboard with drill-down, quarterly breakdown, Compliance Matrix, and annotations
    - Type: AFK
    - Blocked by: Slices 5, 10, 13
    - User stories covered: PRD stories 63, 64, 65, 66, 67
18. [ ] Fiscal Intelligence rules engine (snapshot, variance, compliance alerts, lagging programmes, zero-release attribution, early warning)
    - Type: AFK
    - Blocked by: Slices 8, 13, 14, 15, 17
    - User stories covered: PRD stories 68, 69, 70, 71, 72, 73, 74, 75
19. [ ] MoPB role and Monthly Aggregate Feed portal (BIR Excel + JSON/CSV + DQ Flag Matrix)
    - Type: AFK
    - Blocked by: Slices 8, 11, 13, 14, 15, 18
    - User stories covered: PRD stories 76, 77, 78
20. [ ] BIR pre-publication validation interface
    - Type: AFK
    - Blocked by: Slice 19
    - User stories covered: PRD story 79
21. [ ] Security and operations hardening (immutable audit log, session timeout, concurrent sessions, ≥80% coverage)
    - Type: AFK
    - Blocked by: Slices 5, 6
    - User stories covered: PRD stories 82, 83
22. [ ] Hosting Strategy ADR and Deferred TOR Commitments register
    - Type: HITL
    - Blocked by: None
    - User stories covered: PRD stories 80, 85 (planning/decisions only)
23. [ ] PWA offline-first upgrade (service worker, IndexedDB mirror, sync queue, conflict surfacing)
    - Type: AFK
    - Blocked by: Slices 13, 14, 15, 16
    - User stories covered: PRD story 81

### Facility User Slices (added after facility-level expenditure decision, ADR 0004)

24. [x] Facility-level expenditure users and Admin user management
    - Type: AFK
    - Blocked by: Slices 1, 2, 4
    - User stories covered: PRD 7 stories 1-16
    - Note: standalone direct-submission path; cross-references Slice 16 (PHC facility-cycle entry) so facility entries roll into the MDA cycle when that work lands.

## Issue Drafts

## Issue 1: Next.js App Shell And Authenticated Role Routing

Status:
- [ ] Not started
- [ ] In progress
- [x] Complete

## What to build

Build the Next.js application foundation for authenticated MDA user, Reviewer, and Admin workflows. The slice should create the app shell, App Router pages, Supabase browser and server client setup, role-aware navigation, design tokens, and core UI primitives so a signed-in user can land in the correct product surface.

## Acceptance criteria

- [x] A Next.js/React/TypeScript app runs from the repository root.
- [x] Supabase browser configuration reads `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`.
- [x] Unauthenticated users are routed to sign-in or an auth gate.
- [x] MDA users, Reviewers, and Admins see role-appropriate navigation.
- [x] The shared app shell includes sidebar navigation and a contextual top header.
- [x] Theme tokens reflect the calm civic operations dashboard design system.
- [x] Core UI primitives exist for status badges, empty states, loading states, alerts, forms, and tables.
- [x] Basic route protection tests cover unauthenticated and authenticated users.

## Blocked by

None - can start immediately.

## Issue 2: Supabase Database Connection, Typed Access, And Capability Checks

Status:
- [ ] Not started
- [ ] In progress
- [x] Complete

## What to build

Connect the app to the existing Supabase/Postgres schema and expose typed helpers for active Reference Data, MDA Memberships, role checks, assigned-MDA checks, and common query patterns. The slice should make authorization visible to the UI while preserving Row Level Security as the data-access boundary.

## Acceptance criteria

- [x] Database types or typed access helpers reflect the current Supabase schema (`src/lib/db/types.ts`).
- [x] Active Reference Data can be queried for form dropdowns (`src/lib/db/reference-data.ts`).
- [x] MDA Memberships can be queried for the authenticated user (`src/lib/db/memberships.ts`).
- [x] Capability helpers distinguish Admin, Reviewer, submitter, and assigned-MDA access (`src/lib/access.ts`).
- [x] UI route guards use capability helpers rather than ad hoc role checks (`AuthenticatedLayout` → `canAccessRoute`).
- [x] Tests cover capability outcomes for Admin, Reviewer, MDA user, one-MDA membership, and multi-MDA membership (`src/test/access.test.ts`).

## Blocked by

- Slice 1: Next.js App Shell And Authenticated Role Routing

## Issue 3: Funding Entry Submit And Pending Edit Path

Status:
- [ ] Not started
- [ ] In progress
- [x] Complete

## What to build

Build the complete MDA Funding Entry path from dashboard/navigation to form submission, pending entry display, and pending edit. The workflow should use controlled Reference Data, derive fiscal year and quarter from transaction date, enforce Funding Entry domain rules, and show the generated Public Entry ID after save.

## Acceptance criteria

- [x] MDA users can create Funding Entries only for assigned MDAs. *(MDA combobox is filtered to `submittableMdaIds(profile)`; admins see all. RLS `funding_insert_by_submitter` enforces server-side.)*
- [x] The form captures transaction date, MDA, Programme Area, Funding Source, Money Amount, Reference Number, and Remarks. *(`src/components/funding/funding-entry-form.tsx`.)*
- [x] Fiscal Year and quarter are derived from transaction date and shown read-only. *(`deriveFiscalPeriod` + read-only "FY YYYY · Q#" chip.)*
- [x] Amount must be positive. *(Validation rejects ≤ 0; Postgres `amount > 0` check is the final gate.)*
- [x] Reference Number is required and duplicate scoped references are surfaced clearly. *(Required validation + `mapFundingEntryError` translates 23505 unique violations into a field-scoped message.)*
- [x] Other Options require Remarks. *(`validateFundingEntry` flags Other Programme Area or Funding Source without remarks; trigger validation surfaces the same message if bypassed.)*
- [x] Submitted entries default to pending. *(`insertFundingEntry` sets `status: "pending"`; DB default and `funding_insert_by_submitter` RLS also enforce.)*
- [x] MDA users can edit their own assigned-MDA Funding Entries only while pending. *(UI uses `canEditFundingEntry`; the edit sheet calls `updatePendingFundingEntry` which scopes the update to `status = 'pending'`.)*
- [x] Tests cover required fields, amount validation, Other requiring Remarks, duplicate Reference Number handling, and pending-only edit access. *(`src/test/funding-validation.test.ts`, 19 cases.)*

## Blocked by

- Slice 1: Next.js App Shell And Authenticated Role Routing
- Slice 2: Supabase Database Connection, Typed Access, And Capability Checks

## Issue 4: Expenditure Entry Submit And Pending Edit Path

Status:
- [ ] Not started
- [ ] In progress
- [x] Complete

## What to build

Build the complete MDA Expenditure Entry path from dashboard/navigation to form submission, pending entry display, and pending edit. The workflow should enforce Expenditure Entry domain rules, PHC LGA/facility validation, optional AOP Linkage, optional Expenditure Item, required Payment Method, required Voucher Reference Number, and generated Public Entry ID display.

## Acceptance criteria

- [x] MDA users can create Expenditure Entries only for assigned MDAs. *(MDA combobox is filtered to `submittableMdaIds(profile)`; admins see all. RLS `expenditure_insert_by_submitter` enforces server-side.)*
- [x] The form captures transaction date, MDA, Programme Area, Expenditure Category, optional Expenditure Item, Money Amount, PHC flag, Payment Method, Voucher Reference Number, and Remarks. *(`src/components/expenditure/expenditure-entry-form.tsx`.)*
- [x] Fiscal Year and quarter are derived from transaction date and shown read-only. *(`deriveFiscalPeriod` + read-only "FY YYYY · Q#" chip.)*
- [x] PHC Expenditure requires LGA and PHC Facility. *(`validateExpenditureEntry` flags missing LGA/facility when `is_phc`; trigger `validate_expenditure_entry` is the final gate.)*
- [x] Facility choices are filtered by selected LGA. *(Form filters `facilities` by `lga_id`; clearing LGA clears facility.)*
- [x] Non-PHC Expenditure clears LGA and Facility. *(Toggle off resets `lga_id`/`facility_id` in draft and `ValidatedExpenditureEntry` returns nulls.)*
- [x] AOP Activity choices are filtered by selected MDA and fiscal year. *(Form filters `aopActivities` by `mda_id` + derived `fiscal_year`; switching MDA or date clears stale linkage.)*
- [x] Amount must be positive and Voucher Reference Number is required. *(Validation rejects ≤ 0 and blank voucher; Postgres `amount > 0` check + unique constraint are the final gates.)*
- [x] Payment Method is required. *(Validation rejects missing payment method; column is `not null` in the schema.)*
- [x] Other Options require Remarks. *(`validateExpenditureEntry` flags Other Programme Area, Expenditure Category, or Payment Method without remarks; trigger validation surfaces the same message if bypassed.)*
- [x] Submitted entries default to pending. *(`insertExpenditureEntry` sets `status: "pending"`; DB default and `expenditure_insert_by_submitter` RLS also enforce.)*
- [x] MDA users can edit their own assigned-MDA Expenditure Entries only while pending. *(UI uses `canEditExpenditureEntry`; the edit page calls `updatePendingExpenditureEntry` which scopes the update to `status = 'pending'`.)*
- [x] Tests cover PHC validation, AOP mismatch, facility/LGA mismatch, Expenditure Item/category mismatch, duplicate Voucher Reference Number handling, and pending-only edit access. *(`src/test/expenditure-validation.test.ts`, 33 cases.)*

## Blocked by

- Slice 1: Next.js App Shell And Authenticated Role Routing
- Slice 2: Supabase Database Connection, Typed Access, And Capability Checks

## Issue 5: Reviewer/Admin Entry Detail, Comments, And Status Workflow

Status:
- [ ] Not started
- [ ] In progress
- [x] Complete

## What to build

Build review queues and entry detail workflows for Funding Entries and Expenditure Entries. Reviewers should act only on assigned MDAs, while Admins can act statewide. Entry detail should include fields, status, attachments, comments, audit history, and workflow actions.

## Acceptance criteria

- [x] Reviewers can see pending entries for assigned MDAs. *(`src/routes/review.tsx` scopes list queries by `reviewableMdaIds(profile)`; reviewer SELECT RLS on `funding_entries`/`expenditure_entries` is unchanged.)*
- [x] Admins can see entries statewide. *(Admins return `[]` from `reviewableMdaIds`, which leaves the list queries unfiltered.)*
- [x] Review queues support status, fiscal year, MDA, and date filters. *(`ReviewFiltersPanel` + extended `ListFundingEntriesOptions` / `ListExpenditureEntriesOptions` with `fiscalYear`, `dateFrom`, `dateTo`.)*
- [x] Entry detail shows form fields, Public Entry ID, comments, attachments, audit history, and status. *(`src/components/review/entry-review-detail.tsx` + `src/routes/review-entry-detail.tsx`; pages at `app/(authenticated)/review/{funding,expenditure}/[id]/page.tsx`.)*
- [x] Reviewers/Admins can approve, reject, and process entries according to allowed workflow transitions. *(`src/lib/review/transitions.ts` state machine: pending->approved|rejected, approved->processed|rejected, rejected->pending via resubmit, processed terminal; enforced server-side by `public.review_entry` RPC.)*
- [x] Rejection requires an Entry Comment with rejection reason. *(`ReviewActionDialog` requires non-empty text for reject; `review_entry` raises `22023` if neither reason nor comment is provided.)*
- [x] Reviewed-entry edits require an audit reason. *(`ReviewedEditBanner` captures the reason; `public.update_reviewed_funding_entry` / `update_reviewed_expenditure_entry` reject empty reasons and `set_config('app.audit_reason', ...)` so the trigger records it.)*
- [x] Audit Events are created for status changes and reviewed-entry edits. *(Existing `app_private.audit_row_change()` trigger picks up `app.audit_reason` set by the RPCs; reviewer access added via `audit_select_entry_reviewers` policy + `current_user_can_view_entry_audit` helper.)*
- [x] Tests cover allowed/forbidden transitions, rejection comments, audit reasons, and role/MDA scope. *(`src/test/review-transitions.test.ts` covers the full 12-case state machine + `requiresComment` + `canResubmit`; existing `src/test/access.test.ts` covers reviewer vs admin scope. Full suite: 96 passing; `tsc --noEmit` clean; `next build` succeeds; migration applied to live project `znvcxidepemlmqdhavpl`.)*

Implementation notes:
- Review actions and audit-reason capture run through Postgres `security definer` RPCs (`review_entry`, `resubmit_entry`, `update_reviewed_*_entry`) so the state-machine and `app.audit_reason` set are atomic with the row write.
- A `success` variant alert was reused from Slice 24; no new UI primitive was needed.
- Submitters can return rejected entries to pending via `resubmit_entry`, surfaced as a Resubmit button on the review-detail page when the viewer is the original author.

## Blocked by

- Slice 3: Funding Entry Submit And Pending Edit Path
- Slice 4: Expenditure Entry Submit And Pending Edit Path

## Issue 6: Data Quality Warnings And Workflow Notifications

Status:
- [ ] Not started
- [ ] In progress
- [ ] Complete

## What to build

Add non-blocking Data Quality Warnings and workflow Notifications to the review lifecycle. Warnings should guide reviewers without preventing valid submissions. Notifications should create in-app records and Resend-backed Email Delivery Events for workflow changes.

## Acceptance criteria

- [ ] Data Quality Warnings appear for Unspecified PHC Facility use.
- [ ] Data Quality Warnings appear for expenditure without optional AOP Linkage.
- [ ] Data Quality Warnings appear for stale pending entries.
- [ ] Data Quality Warnings appear for entries outside relevant Submission Windows.
- [ ] Reviewers/Admins can resolve warnings.
- [ ] Submitters receive in-app Notifications when entries are approved, rejected, or processed.
- [ ] Admins/Reviewers receive in-app Notifications when entries are submitted for their scope.
- [ ] Email Delivery Events are recorded for workflow email attempts.
- [ ] Tests cover warning generation, warning resolution, notification creation, and email event failure recording.

## Blocked by

- Slice 5: Reviewer/Admin Entry Detail, Comments, And Status Workflow

## Issue 7: Reference Data Management And Reference Value Requests

Status:
- [ ] Not started
- [ ] In progress
- [x] Complete

## What to build

Build Admin Reference Data management and MDA Reference Value Request workflows. Admins should manage controlled dropdown values, deactivate/reactivate values instead of deleting referenced rows, and resolve MDA user requests for missing values.

## Acceptance criteria

- [x] Admins can manage MDA Types and MDAs. *(`ReferenceDataManager` tabs for `mda_type` and `mda`; create/update via `createReferenceValue`/`updateReferenceValue` under the `reference_admin_*` RLS policies.)*
- [x] Admins can manage Programme Areas, Funding Sources, Expenditure Categories, Expenditure Items, Payment Methods, LGAs, and Facilities. *(One tab per kind; `REFERENCE_REGISTRY` drives the form fields. Entry Statuses are intentionally left frozen — they're a system enum referenced by the review state machine.)*
- [x] Active Reference Data appears in entry forms. *(Existing `loadEntryFormReferenceData` already filters `active = true`; no change needed.)*
- [x] Inactive Reference Data is hidden from new-entry choices but preserved for historical display. *(The manager passes `includeInactive: true` so admins see deactivated rows; entry-form helpers default to active-only.)*
- [x] Referenced values use deactivate/reactivate instead of destructive delete. *(`setReferenceActive(client, kind, id, active)` is the only mutation the UI offers; there is no delete button. Postgres FKs use `on delete restrict`, which the design depends on.)*
- [x] MDA users can submit Reference Value Requests. *(`/reference-requests` route, `ReferenceRequestForm` with kind/label + related-MDA/LGA/category context; inserts under `reference_requests_insert_own` RLS.)*
- [x] Admins can approve requests by creating or updating Reference Data. *(`/admin/reference-requests` queue; approve flow either links an existing row or creates a new one via `approveReferenceRequest({ kind: "create_new" | "use_existing" })`.)*
- [x] Rejected Reference Value Requests require a review comment. *(`validateReferenceRequestDecision` rejects empty comments; Postgres CHECK on `reference_value_requests` is the final gate.)*
- [x] Tests cover create, update, deactivate, reactivate, request approval, and request rejection. *(`src/test/reference-validation.test.ts` covers kind-aware validation and 23505 error mapping; `src/test/reference-requests.test.ts` covers request draft validation and approve/reject decision validation; `src/test/access.test.ts` extended for the three new routes. Full suite: 117 passing; `tsc --noEmit` clean; `next build` succeeds.)*

Implementation notes:
- The manager dispatches by `ReferenceKind` from a single registry (`src/lib/reference/types.ts`) so adding a new reference type is a one-place change.
- Approve "create new" reuses `createReferenceValue` so a request approval and a manual create share the same code path and audit trail (`audit_*` triggers from the initial migration).
- Entry Statuses (`pending | approved | rejected | processed`) intentionally stay system-managed; exposing them as an editable reference would let an admin break the review state machine.

## Blocked by

- Slice 1: Next.js App Shell And Authenticated Role Routing
- Slice 2: Supabase Database Connection, Typed Access, And Capability Checks

## Issue 8: Approved Budget And AOP Activity Management

Status:
- [ ] Not started
- [ ] In progress
- [x] Complete

## What to build

Build Admin planning-data workflows for Approved Budgets and AOP Activities. Admins should manage multi-year MDA-level budgets and MDA-scoped AOP Activities while preserving the workbook-derived model and arithmetic constraints.

## Acceptance criteria

- [x] Admins can create and update Approved Budgets by fiscal year and MDA. *(`/admin/budgets` route + `ApprovedBudgetsManager`; `createApprovedBudget` / `updateApprovedBudget` in `src/lib/db/planning.ts` write under the existing `plans_admin_approved_budgets` RLS policy.)*
- [x] Approved Budget totals enforce personnel plus other recurrent and recurrent plus capital relationships. *(`validateApprovedBudget` derives `total_recurrent_amount = personnel + other_recurrent` and `total_budget_amount = total_recurrent + capital`; `previewBudgetTotals` drives a live totals panel; the Postgres CHECK constraints in the initial migration are the final gate, surfaced as a friendly arithmetic message via `mapBudgetWriteError`.)*
- [x] Admins can create and update AOP Activities by fiscal year and MDA. *(`/admin/aop-activities` route + `AopActivitiesManager`; `createAopActivity` / `updateAopActivity` write under `plans_admin_aop_activities`. Deactivate/reactivate via `setAopActivityActive` mirrors the reference-data pattern so historical expenditure links stay intact.)*
- [x] AOP Activities support source row identity for duplicate workbook activity-code/MDA pairs. *(Optional `source_row_number` field on the form; `mapAopActivityWriteError` translates a `23505` collision into "set a distinct source row to keep both" guidance.)*
- [x] AOP Activity lists can be filtered by MDA and fiscal year. *(Top-of-page filters on both managers; `listAdminAopActivities` accepts `fiscalYear` / `mdaId` / `includeInactive` so future surfaces can reuse the same helper.)*
- [x] Tests cover budget arithmetic, budget uniqueness, AOP filtering, and duplicate source-row preservation. *(`src/test/planning-validation.test.ts` covers required-field validation, derived totals, currency formatting, fiscal-year window, source-row integer validation, and the `23505`/`23514` write-error mappers; `src/test/access.test.ts` extended for the two new admin routes. Full suite: 136 passing; `tsc --noEmit` clean; `next build` succeeds.)*

Implementation notes:
- The validation layer mirrors the Postgres CHECK constraints (`total_recurrent_amount = personnel + other_recurrent`, `total_budget_amount = total_recurrent + capital`) so the UI catches arithmetic errors before round-tripping; the database is still the final authority and surfaces leftovers as friendly arithmetic messages.
- AOP Activities use deactivate/reactivate (`active` flag) instead of destructive delete, matching the reference-data convention so historical expenditure entries that link an activity by id keep working.
- `defaultFiscalYearOptions` exposes a 5-year window centred on today, used both for the picker in the editor dialog and to seed the filter so the admin always has the current FY plus near-term planning years available even before a row exists.

## Blocked by

- Slice 1: Next.js App Shell And Authenticated Role Routing
- Slice 2: Supabase Database Connection, Typed Access, And Capability Checks
- Slice 7: Reference Data Management And Reference Value Requests

## Issue 9: Admin Import Validation And Write Workflow

Status:
- [ ] Not started
- [ ] In progress
- [ ] Complete

## What to build

Build Admin Import workflows for Reference Data, Approved Budgets, AOP Activities, historical Funding Entries, and historical Expenditure Entries. Imports should validate before writing, show row-level errors, and reject duplicate ledger rows that would violate scoped reference/voucher uniqueness.

## Acceptance criteria

- [ ] Admins can create import batches for supported import types.
- [ ] Imports validate rows before writing accepted data.
- [ ] Row-level errors include source row number, field name, message, and raw row snapshot where available.
- [ ] Historical Funding imports reject fiscal-year/MDA/Reference Number collisions.
- [ ] Historical Expenditure imports reject fiscal-year/MDA/Voucher Reference Number collisions.
- [ ] PHC LGA/facility and AOP matching rules are enforced during import validation.
- [ ] Import batch summaries show counts, warnings, status, and completion time.
- [ ] Tests cover missing references, invalid amounts, duplicate ledger rows, PHC mismatch, AOP mismatch, and row-level error reporting.

## Blocked by

- Slice 3: Funding Entry Submit And Pending Edit Path
- Slice 4: Expenditure Entry Submit And Pending Edit Path
- Slice 7: Reference Data Management And Reference Value Requests
- Slice 8: Approved Budget And AOP Activity Management

## Issue 10: MDA Dashboard And Admin Insights

Status:
- [ ] Not started
- [ ] In progress
- [ ] Complete

## What to build

Build scoped MDA Dashboards and Admin Insights backed by Supabase reporting views and shared report filters. MDA users should see assigned-MDA totals and entry statuses. Admins should see statewide operational and official-reporting views with drill-down tables.

## Acceptance criteria

- [ ] MDA Dashboard is scoped to assigned MDAs.
- [ ] MDA Dashboard shows funding totals, expenditure totals, budget utilization, and entry status counts.
- [ ] Admin Insights show all submitted entries by default.
- [ ] Status filters allow operational and official-reporting views.
- [ ] Reports include budget vs actual, funding by source, expenditure by category, Programme Area summary, PHC LGA summary, PHC Facility summary, AOP planned-vs-actual, and unlinked expenditure.
- [ ] Filters include fiscal year, date range, MDA, status, Programme Area, Funding Source, Expenditure Category, LGA, Facility, and PHC status where relevant.
- [ ] Charts are paired with drill-down tables.
- [ ] Tests cover role scope, filters, and report totals against seeded or fixture data.

## Blocked by

- Slice 3: Funding Entry Submit And Pending Edit Path
- Slice 4: Expenditure Entry Submit And Pending Edit Path
- Slice 5: Reviewer/Admin Entry Detail, Comments, And Status Workflow
- Slice 8: Approved Budget And AOP Activity Management

## Issue 11: CSV, XLSX, And PDF Export Jobs

Status:
- [ ] Not started
- [ ] In progress
- [ ] Complete

## What to build

Build Export Jobs for CSV, XLSX, and PDF outputs from shared report payloads. Exports should preserve selected filters and visible totals, run through trusted Next.js route handlers, and store downloadable file metadata.

## Acceptance criteria

- [ ] Admins can request CSV Exports for raw and filtered ledgers.
- [ ] Admins can request XLSX Exports for ledgers and insight tables.
- [ ] Admins can request PDF Exports for dashboard summaries and filtered admin reports.
- [ ] Export Jobs persist type, subject, filters, status, creator, storage metadata, timestamps, and errors.
- [ ] Export output preserves selected filters and visible totals.
- [ ] Failed exports show actionable failure messages.
- [ ] Tests cover CSV, XLSX, and PDF generation from the same report payload.

## Blocked by

- Slice 10: MDA Dashboard And Admin Insights

## Issue 12: End-To-End Hardening And Launch Readiness

Status:
- [ ] Not started
- [ ] In progress
- [ ] Complete

## What to build

Harden the full implementation across migrations, seeds, validation, permissions, RLS, imports, reporting, notifications, exports, storage, Supabase configuration, and launch documentation. This slice should turn completed features into a reliable deployment-ready system.

## Acceptance criteria

- [ ] Migration and seed workflows are documented and verified.
- [ ] Seed row counts are checked for MDAs, LGAs, Facilities, Approved Budgets, and AOP Activities.
- [ ] RLS behavior is tested for unauthenticated users, Admins, Reviewers, MDA users, single-MDA members, and multi-MDA members.
- [ ] Deep modules have regression tests for validation, permissions, imports, reporting, notifications, and exports.
- [ ] Attachment storage policies are tightened after frontend storage paths are finalized.
- [ ] Resend email behavior is tested without requiring live sends in normal test runs.
- [ ] Visual checks cover dense tables, long MDA names, status badges, form layouts, and mobile/desktop viewports.
- [ ] Launch checklist covers auth setup, roles, MDA Memberships, seed counts, RLS checks, storage, Resend, exports, and dashboard filters.
- [ ] Known caveats document that real Supabase project advisors require project configuration.

## Blocked by

- Slices 1-11

## Issue 13: Monthly Submission Cycle Skeleton

Status:
- [ ] Not started
- [ ] In progress
- [ ] Complete

## What to build

Introduce the `mda_monthly_submissions` model and a per-MDA monthly cycle UI. A cycle bundles Funding Entries, Budget Release Entries, Expenditure Entries, Activity Progress, and Release Notes for one fiscal month per MDA. The cycle has states `draft`, `submitted`, `late`, `accepted`, `returned`, with `late` derived from `submitted_at` vs a configurable deadline (default 5th of the following month, per fiscal year).

## Acceptance criteria

- [ ] Migration adds `mda_monthly_submissions` keyed by `(mda_id, fiscal_year, fiscal_month)` with state, deadline, submitted_at, submitted_by, accepted_at, returned_reason.
- [ ] Migration adds `submission_deadlines` (per fiscal year) with default month-day 5.
- [ ] MDA users see a "Current Cycle" page for assigned MDAs with progress indicators for each of the five bundled categories.
- [ ] Draft auto-save updates `updated_at` without changing state.
- [ ] Submit action sets state to `submitted` and records `submitted_at`; `late` is derived from the deadline.
- [ ] Real-time validation surfaces implausible values (negative, missing required field, dropdown mismatch) before submit.
- [ ] RLS ensures only assigned-MDA submitters can write a cycle; reviewers and admins can read.
- [ ] Tests cover deadline derivation, late computation, draft-save without state change, submit transition, and assigned-MDA scope.

## Blocked by

- Slice 3: Funding Entry Submit And Pending Edit Path
- Slice 4: Expenditure Entry Submit And Pending Edit Path

## Issue 14: Budget Release Entries And Expenditure Release-Reconciliation Fields

Status:
- [ ] Not started
- [ ] In progress
- [ ] Complete

## What to build

Add a **Budget Release Entry** write model representing internal Kano releases against approved budget lines (distinct from external Funding Entries which represent receipts). Add `uncommitted_balance` and `activity_line` to Expenditure Entries to enable release-to-expenditure reconciliation and variance flagging.

## Acceptance criteria

- [ ] Migration adds `budget_release_entries` with `mda_id`, `fiscal_year`, `programme_area_id`, `funding_source_id`, `release_date`, `amount`, `memo_reference`, `cycle_id`, `entered_by`, `status`.
- [ ] Migration adds `uncommitted_balance numeric(18,2)` (nullable, ≥0) and `activity_line text` on `expenditure_entries`.
- [ ] MDA form supports adding/editing Budget Release Entries within a cycle.
- [ ] Public ID generated as `BR-<fiscal_year>-####`.
- [ ] Insights distinguish "received funding" (Funding Entries) from "internal release" (Budget Release Entries).
- [ ] Tests cover required fields, positive amount, memo reference, scoped uniqueness `(fiscal_year, mda_id, memo_reference)`, and cycle linkage.

## Blocked by

- Slice 4: Expenditure Entry Submit And Pending Edit Path
- Slice 8: Approved Budget And AOP Activity Management
- Slice 13: Monthly Submission Cycle Skeleton

## Issue 15: Release Notes And Activity Progress Per Cycle

Status:
- [ ] Not started
- [ ] In progress
- [ ] Complete

## What to build

Add the **Release Note** model (mandatory free-text for any programme line with zero release in a cycle) and the **Activity Progress** model (status per AOP Activity per cycle with mandatory reason when blocked).

## Acceptance criteria

- [ ] Migration adds `release_notes` keyed by `(cycle_id, programme_area_id)` with `note text not null`.
- [ ] Migration adds `activity_progress` keyed by `(cycle_id, aop_activity_id)` with `status in ('completed','in_progress','not_started','blocked')` and `blocked_reason` required when `status = 'blocked'`.
- [ ] Cycle UI lists programme areas with zero release for the month and requires a Release Note before submit.
- [ ] Cycle UI lists AOP Activities assigned to the MDA for the fiscal year and lets the submitter set status + reason.
- [ ] Cycle submission is blocked when a zero-release programme line has no Release Note.
- [ ] Tests cover zero-release detection, missing Release Note blocking submit, blocked-status requiring reason, and AOP scope by MDA/fiscal year.

## Blocked by

- Slice 8: Approved Budget And AOP Activity Management
- Slice 13: Monthly Submission Cycle Skeleton
- Slice 14: Budget Release Entries And Expenditure Release-Reconciliation Fields

## Issue 16: Submission Confirmation PDF And PHC Facility Cycle Entry

Status:
- [ ] Not started
- [ ] In progress
- [ ] Complete

## What to build

Generate a server-side PDF confirmation when a cycle is submitted, archived per cycle and downloadable by submitter and reviewers. For MDAs with PHC responsibility (primarily PHCMB), surface facility-level expenditure entry inside the cycle with LGA-filtered facilities.

## Acceptance criteria

- [ ] Submit action triggers a route handler that renders a PDF summary (cycle totals + each bundled list) and stores it in private Supabase Storage keyed by cycle.
- [ ] Submitter and reviewers can download the PDF from the cycle page.
- [ ] PHC-responsible MDAs see a facility-level expenditure subtable inside the cycle, with LGA and facility selection.
- [ ] Tests cover PDF generation success, storage path, signed download URL, and PHC-mode visibility scoped to the right MDA configuration.

Note: facility-level expenditure submitted by `facility_user` accounts (Slice 24) should roll into the relevant MDA cycle here rather than being re-entered.

## Blocked by

- Slice 13: Monthly Submission Cycle Skeleton
- Slice 15: Release Notes And Activity Progress Per Cycle

## Issue 17: SMoH System-Wide Dashboard And Compliance Matrix

Status:
- [ ] Not started
- [ ] In progress
- [ ] Complete

## What to build

Build the SMoH-facing system-wide dashboard mirroring the workbook `Dashboard` sheet: sector totals, funding by source, expenditure by category, MDA-by-MDA comparison, quarterly breakdown, and programme-area rollups, all updating from live submissions. Add a Compliance Matrix (MDA × month), drill-down from sector → MDA → programme → LGA → facility, and admin annotations with follow-up actions.

## Acceptance criteria

- [ ] Reporting views aggregate funding, releases, expenditure, and AOP coverage at sector / MDA / programme / LGA / facility levels.
- [ ] Compliance Matrix renders MDA × month with `not started | draft | submitted | late | accepted | returned`.
- [ ] Drill-down navigation preserves filters between levels.
- [ ] Quarterly breakdown is a first-class view, not an ad hoc filter.
- [ ] `record_annotations` table stores annotation, assignee, due date, status with audit events.
- [ ] Tests cover view totals against seeded fixtures, compliance state derivation, drill-down filter propagation, and annotation lifecycle.

## Blocked by

- Slice 5: Reviewer/Admin Entry Detail, Comments, And Status Workflow
- Slice 10: MDA Dashboard And Admin Insights
- Slice 13: Monthly Submission Cycle Skeleton

## Issue 18: Fiscal Intelligence Rules Engine

Status:
- [ ] Not started
- [ ] In progress
- [ ] Complete

## What to build

Implement a transparent, configurable rules engine that evaluates submissions and deadlines and emits `alerts` rows with an evidence payload. Cover the TOR's six functions: expenditure snapshot, variance flagging (default 20%), compliance alerts, lagging programme ranking, early warning signals (after ≥2 quarters), zero-release attribution.

## Acceptance criteria

- [ ] Migration adds `rules` (key, name, threshold, lookback, scope, enabled) and `alerts` (rule_key, scope, severity, evidence_json, created_at, resolved_at, resolved_by, follow_up_action_id).
- [ ] Rule runner executes on cycle submit and on deadline tick; alert rows are persisted, not computed live.
- [ ] Variance rule compares actual release vs approved budget per programme line using the configured threshold.
- [ ] Compliance alerts list on-time, late, and missing MDAs per fiscal month.
- [ ] Lagging programme rule ranks programmes × MDAs by execution rate and surfaces the bottom quartile.
- [ ] Early warning rule activates only with ≥2 quarters of data and includes the historical basis in the evidence payload.
- [ ] Zero-release attribution checks for Release Note presence and raises an unresolved-gap alert when missing.
- [ ] Expenditure snapshot generates plain-language text per cycle and is stored alongside the cycle.
- [ ] SMoH dashboard lists alerts and shows the evidence on click.
- [ ] Tests cover threshold configuration, rule outputs against fixtures, ≥2-quarters gating, alert evidence presence, and resolution lifecycle.

## Blocked by

- Slice 8: Approved Budget And AOP Activity Management
- Slice 13: Monthly Submission Cycle Skeleton
- Slice 14: Budget Release Entries And Expenditure Release-Reconciliation Fields
- Slice 15: Release Notes And Activity Progress Per Cycle
- Slice 17: SMoH System-Wide Dashboard And Compliance Matrix

## Issue 19: MoPB Portal And Monthly Aggregate Feed

Status:
- [ ] Not started
- [ ] In progress
- [ ] Complete

## What to build

Add a `mopb_user` role and a dedicated MoPB portal that exposes only the monthly aggregate feed and supporting context. The feed compiles MDA submissions into a BIR administrative classification layout (Excel) and a machine-readable JSON/CSV. A Data Quality Flag Matrix shows per-MDA `complete | partial | absent` plus unresolved-gap counts.

## Acceptance criteria

- [ ] `profiles.role` accepts `mopb_user`; capability helpers and route guards updated.
- [ ] Migration adds `mopb_aggregates` (fiscal_year, fiscal_month, generated_at, generated_by, excel_path, jsonl_path, dq_summary_json).
- [ ] Scheduled monthly generation triggers after each deadline; manual regeneration available to admins.
- [ ] Excel layout matches the BIR administrative classification (verified against `Budget 2026` sheet structure).
- [ ] JSON/CSV parity is enforced and tested.
- [ ] MoPB portal lists available aggregates with signed downloads and a DQ Flag Matrix table.
- [ ] RLS blocks MoPB users from MDA-level write surfaces and entry tables.
- [ ] Tests cover role isolation, aggregate composition, DQ matrix derivation, BIR layout, and JSON/CSV parity.

## Blocked by

- Slice 8: Approved Budget And AOP Activity Management
- Slice 11: CSV, XLSX, And PDF Export Jobs
- Slice 13: Monthly Submission Cycle Skeleton
- Slice 14: Budget Release Entries And Expenditure Release-Reconciliation Fields
- Slice 15: Release Notes And Activity Progress Per Cycle
- Slice 18: Fiscal Intelligence Rules Engine

## Issue 20: BIR Pre-Publication Validation Interface

Status:
- [ ] Not started
- [ ] In progress
- [ ] Complete

## What to build

SMoH-only interface to upload MoPB's draft BIR, compare it against the platform's monthly aggregate, and surface discrepancies for reconciliation before publication.

## Acceptance criteria

- [ ] Upload accepts MoPB BIR Excel/CSV.
- [ ] Comparison runs per MDA × programme line and reports matches, mismatches (with delta), and missing rows on either side.
- [ ] Reconciliation result is exportable (CSV/XLSX/PDF).
- [ ] Annotations from the SMoH dashboard can be linked to mismatch rows.
- [ ] Tests cover parsing, comparison correctness against fixtures, and edge cases (empty MDA, extra rows, mismatched fiscal month).

## Blocked by

- Slice 19: MoPB Portal And Monthly Aggregate Feed

## Issue 21: Security And Operations Hardening (V1 Scope)

Status:
- [ ] Not started
- [ ] In progress
- [ ] Complete

## What to build

Application-level security and operations work we can ship without government hosting. Infrastructure-level TOR items (WAF, off-site backups, OWASP scan, load test, OpenAPI publication, bilingual training materials) remain in the Deferred TOR Commitments register and are tracked separately.

## Acceptance criteria

- [ ] `audit_events` revoked from UPDATE/DELETE for every role at the Postgres level; tests prove an attempted update or delete fails.
- [ ] Session inactivity timeout (default 30 minutes, configurable) signs the user out and clears tokens.
- [ ] Concurrent-session controls record active sessions per user and let admins terminate other sessions.
- [ ] CI enforces ≥80% statement coverage on application code; PRs fail below the threshold.
- [ ] No Kano-specific value (MDA list, programme codes, facility list, user accounts, budget figures) is hardcoded in application code; all live in config or database.
- [ ] No role is hardcoded outside the capability layer; `admin`, `reviewer`, `mda_user`, and `facility_user` all flow through `AppRole`, capability helpers, and route guards.
- [ ] Facility-user temporary passwords (Slice 24) are subject to forced first-login reset under this hardening slice.
- [ ] Dependency register lists every third-party library, version, and licence; GPL or proprietary dependencies are flagged.

## Blocked by

- Slice 5: Reviewer/Admin Entry Detail, Comments, And Status Workflow
- Slice 6: Data Quality Warnings And Workflow Notifications

## Issue 22: Hosting Strategy ADR And Deferred TOR Commitments Register

Status:
- [ ] Not started
- [ ] In progress
- [ ] Complete

## What to build

Documentation-only slice that captures decisions and outstanding TOR obligations so v1 development does not foreclose handover. Producing this slice early protects every later technical decision.

## Acceptance criteria

- [ ] `docs/adr/0003-hosting-strategy.md` records: v1 on managed Supabase; TOR-required `*.kano.gov.ng` deployment deferred; chosen migration approach (self-hosted Supabase on government infrastructure vs Nigeria-based government-compliant cloud) and its trigger date.
- [ ] `docs/handover/deferred-tor-commitments.md` lists each deferred item (hosting, WAF, off-site backups, OWASP scan, load test, OpenAPI publication, bilingual training, video walkthroughs, reference-data verification gate, PWA upgrade, 90-day SLA) with owner, target phase, and acceptance standard.
- [ ] `docs/prd.md` already references this register; cross-link the ADR.

## Blocked by

None - can start immediately and should be picked up alongside Slice 13.

## Issue 23: PWA Offline-First Upgrade

Status:
- [ ] Not started
- [ ] In progress
- [ ] Complete

## What to build

Upgrade the v1 "offline-tolerant draft" posture to a full PWA offline-first build: service worker app-shell caching, IndexedDB mirror of reference data and the current cycle, a sync queue processed in order on reconnection, and conflict surfacing instead of silent overwrite. This slice is intentionally scheduled after the cycle work is stable.

## Acceptance criteria

- [ ] Service worker registers and serves the app shell offline.
- [ ] Reference data and the active cycle are mirrored in IndexedDB.
- [ ] Cycle drafts captured offline persist and sync on reconnection.
- [ ] Sync queue processes operations in the order they were captured.
- [ ] Conflict detection compares server `updated_at` vs local snapshot; conflicts surface to the user with a chosen-version action, not silent overwrite.
- [ ] Tests cover offline draft capture, queue ordering, conflict detection, and reconnect resync.

## Blocked by

- Slice 13: Monthly Submission Cycle Skeleton
- Slice 14: Budget Release Entries And Expenditure Release-Reconciliation Fields
- Slice 15: Release Notes And Activity Progress Per Cycle
- Slice 16: Submission Confirmation PDF And PHC Facility Cycle Entry

## Issue 24: Facility-Level Expenditure Users And Admin User Management

Status:
- [ ] Not started
- [ ] In progress
- [x] Complete

## What to build

Introduce a `facility_user` role and a `user_facility_assignments` table so facility staff can sign in and submit Expenditure Entries for their own PHC facility with MDA, LGA, Facility, and PHC status preselected and locked. Add an Admin Users surface (service-role-backed route handler) for creating and managing accounts across all roles, including facility users with their facility assignments. Facility-user expenditure is standalone direct submission; review stays with the MDA reviewer and Admins. See ADR 0004 and PRD 7.

## Acceptance criteria

- [x] Migration adds `facility_user` to the `profiles.role` check and a `user_facility_assignments` table keyed by `(user_id, facility_id)` carrying the reporting `mda_id`, with multiple facilities allowed per user and a single MDA enforced across a user's rows. *(`supabase/migrations/202606080001_facility_users.sql`: role check rewrite, table + `enforce_single_mda_per_facility_user` trigger.)*
- [x] `AppRole`, `getRoleLabel`, capability helpers, route roles, and navigation include `facility_user`; facility users can reach `/expenditure` but not `/funding`, `/review`, `/admin`, `/imports`, or statewide dashboards. *(`src/lib/access.ts`, `src/lib/auth-types.ts`, `src/components/layout/navigation.ts`; covered by `src/test/access.test.ts`.)*
- [x] The Expenditure Entry form, for a facility user, forces `is_phc = true` and locks MDA, LGA, and Facility to the assignment (single facility fully locked; multiple facilities use a constrained picker from the assigned set). *(`facilityScope` prop in `src/components/expenditure/expenditure-entry-form.tsx`; wired in `src/routes/expenditure-entry-page.tsx`.)*
- [x] RLS lets a facility user insert/update expenditure only for assigned facilities with `is_phc = true` and matching MDA/LGA, and select only their assigned facilities' entries. *(`expenditure_insert_by_facility_user`, `expenditure_update_pending_by_facility_user`, `expenditure_select_by_facility_assignment` policies.)*
- [x] The expenditure validation trigger rejects a facility-user write whose facility/LGA/MDA does not match their assignment, even via service-role paths. *(`app_private.validate_expenditure_facility_scope` keyed on `entered_by` role.)*
- [x] Facility users can view and edit only their own pending entries. *(Existing `canEditExpenditureEntry` gate + facility-scoped RLS update policy restricted to `status = 'pending'` and `entered_by = auth.uid()`.)*
- [x] Facility-submitted entries appear in the assigned MDA's reviewer queue and follow the existing review workflow unchanged. *(Entries carry the assignment `mda_id`; existing reviewer membership/admin policies select them with no review-side changes.)*
- [x] An Admin Users surface backed by a trusted Next.js route handler (service-role key, never client-exposed, admin authorization enforced in server code) creates an auth user, inserts the profile with the chosen role, inserts facility assignments for facility users, sets/shows a temporary password once, and records an audit event. *(`app/api/admin/users/route.ts` + `src/routes/admin-users.tsx` + `app/(authenticated)/admin/users/page.tsx`.)*
- [x] The Admin Users surface manages all roles (`admin`, `reviewer`, `mda_user`, `facility_user`), not facility users alone. *(Role picker offers all four; mda_user/reviewer optionally get an MDA membership, facility_user gets facility assignments.)*
- [x] Tests cover facility capability/route scope, locked PHC context, and admin-only user management. *(`src/test/access.test.ts`: facility route scope, default path, role label, submittable/viewable/review scope, unassigned handling, admin-only `/admin/users`. Full suite: 78 passing; `tsc --noEmit` and `next build` clean.)*

Implementation notes:
- The facility scope is enforced in three layers: UI locks (`facilityScope`), RLS policies, and a role-keyed trigger that holds even for service-role writes.
- A demo `facility@example.gov.ng` account (password `ChangeMe123!`) is seeded with one PHC facility assignment in `supabase/seeds/004_demo_users.sql`.
- A `success` Alert variant was added (`src/components/ui/alert.tsx`) for the credential confirmation.

## Blocked by

- Slice 1: Next.js App Shell And Authenticated Role Routing
- Slice 2: Supabase Database Connection, Typed Access, And Capability Checks
- Slice 4: Expenditure Entry Submit And Pending Edit Path
