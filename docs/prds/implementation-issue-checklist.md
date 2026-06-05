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

1. [x] Vite app shell and authenticated role routing
   - Type: AFK
   - Blocked by: None
   - User stories covered: PRD 1 stories 1-18
2. [ ] Supabase database connection, typed access, and capability checks
   - Type: AFK
   - Blocked by: Slice 1
   - User stories covered: PRD 1 stories 13-18; PRD 2 stories 1, 26-28; PRD 3 stories 1-4
3. [ ] Funding Entry submit and pending edit path
   - Type: AFK
   - Blocked by: Slices 1, 2
   - User stories covered: PRD 2 stories 1-7, 23-28, 30
4. [ ] Expenditure Entry submit and pending edit path
   - Type: AFK
   - Blocked by: Slices 1, 2
   - User stories covered: PRD 2 stories 1, 8-30
5. [ ] Reviewer/Admin entry detail, comments, and status workflow
   - Type: AFK
   - Blocked by: Slices 3, 4
   - User stories covered: PRD 3 stories 1-16, 23-25
6. [ ] Data Quality Warnings and workflow notifications
   - Type: AFK
   - Blocked by: Slice 5
   - User stories covered: PRD 3 stories 17-22; PRD 4 stories 27-29
7. [ ] Reference Data management and Reference Value Requests
   - Type: AFK
   - Blocked by: Slices 1, 2
   - User stories covered: PRD 4 stories 1-16
8. [ ] Approved Budget and AOP Activity management
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

## Issue Drafts

## Issue 1: Vite App Shell And Authenticated Role Routing

Status:
- [ ] Not started
- [ ] In progress
- [x] Complete

## What to build

Build the Vite/React application foundation for authenticated MDA user, Reviewer, and Admin workflows. The slice should create the app shell, client-side routing, Supabase browser client setup, role-aware navigation, design tokens, and core UI primitives so a signed-in user can land in the correct product surface.

## Acceptance criteria

- [x] A Vite/React/TypeScript app runs from the repository root.
- [x] Supabase browser configuration reads `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY`.
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
- [ ] Complete

## What to build

Connect the app to the existing Supabase/Postgres schema and expose typed helpers for active Reference Data, MDA Memberships, role checks, assigned-MDA checks, and common query patterns. The slice should make authorization visible to the UI while preserving Row Level Security as the data-access boundary.

## Acceptance criteria

- [ ] Database types or typed access helpers reflect the current Supabase schema.
- [ ] Active Reference Data can be queried for form dropdowns.
- [ ] MDA Memberships can be queried for the authenticated user.
- [ ] Capability helpers distinguish Admin, Reviewer, submitter, and assigned-MDA access.
- [ ] UI route guards use capability helpers rather than ad hoc role checks.
- [ ] Tests cover capability outcomes for Admin, Reviewer, MDA user, one-MDA membership, and multi-MDA membership.

## Blocked by

- Slice 1: Vite App Shell And Authenticated Role Routing

## Issue 3: Funding Entry Submit And Pending Edit Path

Status:
- [ ] Not started
- [ ] In progress
- [ ] Complete

## What to build

Build the complete MDA Funding Entry path from dashboard/navigation to form submission, pending entry display, and pending edit. The workflow should use controlled Reference Data, derive fiscal year and quarter from transaction date, enforce Funding Entry domain rules, and show the generated Public Entry ID after save.

## Acceptance criteria

- [ ] MDA users can create Funding Entries only for assigned MDAs.
- [ ] The form captures transaction date, MDA, Programme Area, Funding Source, Money Amount, Reference Number, and Remarks.
- [ ] Fiscal Year and quarter are derived from transaction date and shown read-only.
- [ ] Amount must be positive.
- [ ] Reference Number is required and duplicate scoped references are surfaced clearly.
- [ ] Other Options require Remarks.
- [ ] Submitted entries default to pending.
- [ ] MDA users can edit their own assigned-MDA Funding Entries only while pending.
- [ ] Tests cover required fields, amount validation, Other requiring Remarks, duplicate Reference Number handling, and pending-only edit access.

## Blocked by

- Slice 1: Vite App Shell And Authenticated Role Routing
- Slice 2: Supabase Database Connection, Typed Access, And Capability Checks

## Issue 4: Expenditure Entry Submit And Pending Edit Path

Status:
- [ ] Not started
- [ ] In progress
- [ ] Complete

## What to build

Build the complete MDA Expenditure Entry path from dashboard/navigation to form submission, pending entry display, and pending edit. The workflow should enforce Expenditure Entry domain rules, PHC LGA/facility validation, optional AOP Linkage, optional Expenditure Item, required Payment Method, required Voucher Reference Number, and generated Public Entry ID display.

## Acceptance criteria

- [ ] MDA users can create Expenditure Entries only for assigned MDAs.
- [ ] The form captures transaction date, MDA, Programme Area, Expenditure Category, optional Expenditure Item, Money Amount, PHC flag, Payment Method, Voucher Reference Number, and Remarks.
- [ ] Fiscal Year and quarter are derived from transaction date and shown read-only.
- [ ] PHC Expenditure requires LGA and PHC Facility.
- [ ] Facility choices are filtered by selected LGA.
- [ ] Non-PHC Expenditure clears LGA and Facility.
- [ ] AOP Activity choices are filtered by selected MDA and fiscal year.
- [ ] Amount must be positive and Voucher Reference Number is required.
- [ ] Payment Method is required.
- [ ] Other Options require Remarks.
- [ ] Submitted entries default to pending.
- [ ] MDA users can edit their own assigned-MDA Expenditure Entries only while pending.
- [ ] Tests cover PHC validation, AOP mismatch, facility/LGA mismatch, Expenditure Item/category mismatch, duplicate Voucher Reference Number handling, and pending-only edit access.

## Blocked by

- Slice 1: Vite App Shell And Authenticated Role Routing
- Slice 2: Supabase Database Connection, Typed Access, And Capability Checks

## Issue 5: Reviewer/Admin Entry Detail, Comments, And Status Workflow

Status:
- [ ] Not started
- [ ] In progress
- [ ] Complete

## What to build

Build review queues and entry detail workflows for Funding Entries and Expenditure Entries. Reviewers should act only on assigned MDAs, while Admins can act statewide. Entry detail should include fields, status, attachments, comments, audit history, and workflow actions.

## Acceptance criteria

- [ ] Reviewers can see pending entries for assigned MDAs.
- [ ] Admins can see entries statewide.
- [ ] Review queues support status, fiscal year, MDA, and date filters.
- [ ] Entry detail shows form fields, Public Entry ID, comments, attachments, audit history, and status.
- [ ] Reviewers/Admins can approve, reject, and process entries according to allowed workflow transitions.
- [ ] Rejection requires an Entry Comment with rejection reason.
- [ ] Reviewed-entry edits require an audit reason.
- [ ] Audit Events are created for status changes and reviewed-entry edits.
- [ ] Tests cover allowed/forbidden transitions, rejection comments, audit reasons, and role/MDA scope.

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
- [ ] Complete

## What to build

Build Admin Reference Data management and MDA Reference Value Request workflows. Admins should manage controlled dropdown values, deactivate/reactivate values instead of deleting referenced rows, and resolve MDA user requests for missing values.

## Acceptance criteria

- [ ] Admins can manage MDA Types and MDAs.
- [ ] Admins can manage Programme Areas, Funding Sources, Expenditure Categories, Expenditure Items, Payment Methods, Entry Statuses, LGAs, and Facilities.
- [ ] Active Reference Data appears in entry forms.
- [ ] Inactive Reference Data is hidden from new-entry choices but preserved for historical display.
- [ ] Referenced values use deactivate/reactivate instead of destructive delete.
- [ ] MDA users can submit Reference Value Requests.
- [ ] Admins can approve requests by creating or updating Reference Data.
- [ ] Rejected Reference Value Requests require a review comment.
- [ ] Tests cover create, update, deactivate, reactivate, request approval, and request rejection.

## Blocked by

- Slice 1: Vite App Shell And Authenticated Role Routing
- Slice 2: Supabase Database Connection, Typed Access, And Capability Checks

## Issue 8: Approved Budget And AOP Activity Management

Status:
- [ ] Not started
- [ ] In progress
- [ ] Complete

## What to build

Build Admin planning-data workflows for Approved Budgets and AOP Activities. Admins should manage multi-year MDA-level budgets and MDA-scoped AOP Activities while preserving the workbook-derived model and arithmetic constraints.

## Acceptance criteria

- [ ] Admins can create and update Approved Budgets by fiscal year and MDA.
- [ ] Approved Budget totals enforce personnel plus other recurrent and recurrent plus capital relationships.
- [ ] Admins can create and update AOP Activities by fiscal year and MDA.
- [ ] AOP Activities support source row identity for duplicate workbook activity-code/MDA pairs.
- [ ] AOP Activity lists can be filtered by MDA and fiscal year.
- [ ] Tests cover budget arithmetic, budget uniqueness, AOP filtering, and duplicate source-row preservation.

## Blocked by

- Slice 1: Vite App Shell And Authenticated Role Routing
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

Build Export Jobs for CSV, XLSX, and PDF outputs from shared report payloads. Exports should preserve selected filters and visible totals, run through trusted serverless handlers, and store downloadable file metadata.

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
