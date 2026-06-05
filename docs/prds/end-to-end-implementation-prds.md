# Kano Health Finance Tracker: End-to-End Implementation PRDs

These PRDs translate the current domain notes, ADRs, design system, implementation plan, workbook study, database model, and Supabase artifacts into implementation-ready product slices.

Stack note: these PRDs specify a Next.js App Router implementation aligned with ADR 0002.

Issue tracker publication note: the `to-prd` skill expects a configured issue tracker and `ready-for-agent` triage label, but no issue-tracker setup or label vocabulary is present in this repository. Until that setup exists, this document is the source artifact to publish.

## PRD 1: Application Foundation, Auth, And Design System

## Problem Statement

The project already has strong domain documentation, a verified Supabase schema, and a clear visual direction, but it does not yet have the web application foundation needed for MDA users, Reviewers, and Admins to perform routine finance work. Without a consistent app shell, authenticated routing, Supabase clients, and reusable UI primitives, each downstream workflow would either duplicate infrastructure or drift away from the calm civic operations dashboard described in the design system.

## Solution

Build the Next.js foundation for the Kano Health Finance Tracker using Supabase, TypeScript, Tailwind CSS, shadcn/ui, and lucide icons. The first implementation slice should create authenticated App Router pages, Supabase browser and server clients, role-aware navigation, semantic theme tokens, shared UI primitives, and route-handler conventions for trusted workflows. The experience should feel like a compact, light-first public finance operations tool with long-form data entry, dense tables, status clarity, audit visibility, and Nigerian naira formatting treated as first-class requirements.

## User Stories

1. As an MDA user, I want to sign in securely, so that only authorized users can submit Funding Entries and Expenditure Entries.
2. As a Reviewer, I want to sign in securely, so that I can review entries only for assigned MDAs.
3. As an Admin, I want authenticated access to the platform, so that reference data, imports, exports, and statewide insights are protected.
4. As an authenticated user, I want the app shell to show my role, fiscal-year context, notifications, and account menu, so that I know what context I am working in.
5. As an MDA user, I want role-aware navigation, so that I see submission, dashboard, comments, and notification workflows without admin-only distractions.
6. As a Reviewer, I want role-aware navigation, so that review queues, assigned-MDA dashboards, comments, and data quality warnings are easy to reach.
7. As an Admin, I want role-aware navigation, so that reference data, planning data, imports, exports, users, audit history, and Admin Insights are easy to reach.
8. As a finance user, I want long MDA names, Public Entry IDs, voucher references, fiscal labels, and naira values to fit cleanly, so that dense finance screens remain readable.
9. As a user doing repeated entry work, I want a stable layout with compact tables and clear form sections, so that daily reporting work is efficient.
10. As a user, I want pending, approved, processed, and rejected statuses to use consistent colors and labels, so that review state is instantly understandable.
11. As a user, I want data quality warnings to look different from validation errors, so that I can tell non-blocking warnings from submission blockers.
12. As a user, I want predictable loading, empty, error, and success states, so that the app feels reliable even when data is missing or still loading.
13. As an Admin, I want privileged workflows to run in trusted Next.js route handlers, so that service-role access, Resend email delivery, imports, exports, and storage signing are not exposed in the browser.
14. As a developer, I want shared Supabase client helpers, so that browser-safe access and trusted server-side access patterns are explicit and consistent.
15. As a developer, I want shared UI primitives for forms, tables, filters, dialogs, sheets, status badges, charts, notifications, imports, uploads, and exports, so that feature work can move quickly without visual drift.
16. As a developer, I want semantic design tokens instead of raw colors in feature components, so that the product can evolve without rewriting every screen.
17. As a developer, I want shared Nigerian naira, date, quarter, fiscal-year, status, and Public Entry ID formatting helpers, so that user-visible finance data is consistent.
18. As a developer, I want App Router route groups and authorization guards that separate MDA, Reviewer, and Admin surfaces, so that downstream screens inherit the right boundaries.

## Implementation Decisions

- Use Next.js App Router, React, TypeScript, Tailwind CSS, shadcn/ui, lucide icons, Supabase browser and server clients, and Next.js route handlers for privileged workflows.
- Preserve Supabase Row Level Security as the primary data-access boundary; privileged server code must still enforce domain authorization.
- Create a shared app shell with collapsible sidebar navigation and a slim contextual top header.
- Use the design system's light-first civic operations theme, including Kano Health Green, Deep Governance Green, Grounded Earth Brown, status colors, restrained borders, and limited shadows.
- Use Inter or Geist Sans with normal letter spacing and restrained type scale.
- Use compact, table-forward layouts rather than marketing-style pages.
- Build reusable status badge variants for `pending`, `approved`, `processed`, and `rejected`.
- Build data quality warning components that use amber warning treatment rather than destructive red styling.
- Create shared form, table, filter, dialog, sheet, chart, notification, import, upload, and export primitives using shadcn/ui composition.
- Create a permissions module with a stable interface for role checks, assigned-MDA checks, submitter checks, reviewer checks, and admin checks.
- Create a formatting module for Nigerian naira, dates, fiscal year, quarter, Public Entry IDs, and status labels.
- Create Supabase access helpers that clearly separate browser-safe queries from trusted server-side operations.
- Create route-handler conventions for imports, exports, Resend email delivery, storage signing, and service-role operations.
- Keep routes boring and explicit so the framework surface area does not become a source of product complexity.

## Testing Decisions

- Good tests should verify externally observable behavior: route protection, visible navigation, role scoping, formatting, and trusted-operation boundaries.
- Test the permissions module because it is a deep module that should present a stable capability interface to the rest of the app.
- Test formatting helpers for naira values, fiscal-year derivation display, quarter display, status labels, and long Public Entry IDs.
- Test authenticated route guards for unauthenticated users, MDA users, Reviewers, and Admins.
- Test the app shell navigation for role-specific visibility and current-context display.
- Test status badge and data quality warning variants through rendered text/classes rather than implementation details.
- Use existing migration and seed verification as prior art for domain-level confidence; no frontend test prior art exists yet in the repository.

## Out of Scope

- Building full Funding Entry or Expenditure Entry submission flows.
- Building full review queues, Admin Insights, imports, exports, notifications, or reference-data CRUD.
- Dark mode.
- Public marketing pages.
- A full custom backend service beyond Next.js route handlers and Supabase.

## Further Notes

- This slice unlocks all other implementation work.
- The app should not hardcode 2026 even though the current workbook seed data is 2026-heavy.
- Trusted server-side code must not treat service-role access as a substitute for domain authorization.

## PRD 2: MDA Funding And Expenditure Entry Workflows

## Problem Statement

Routine health finance reporting currently depends on workbook data entry, VLOOKUP-style dropdowns, copied ledger rows, and manual consistency checks. MDA users can easily submit inconsistent MDA names, programme areas, funding sources, expenditure categories, LGA/facility combinations, voucher references, and status data. This weakens review, auditability, PHC analysis, AOP linkage, and budget utilization reporting.

## Solution

Build authenticated MDA workflows for creating, viewing, and editing pending Funding Entries and Expenditure Entries. The forms should use controlled Reference Data, enforce domain validation before submission, derive fiscal year and quarter from transaction date, generate database-backed Public Entry IDs, support optional attachments, and keep PHC and AOP behavior aligned with the workbook study and database model. MDA users should only submit and edit entries for assigned MDAs, and only while entries remain pending.

## User Stories

1. As an MDA user, I want to choose only MDAs assigned to me, so that I cannot submit for an unauthorized MDA.
2. As an MDA user, I want to create a Funding Entry with transaction date, MDA, programme area, funding source, amount, reference number, and remarks, so that funding received is captured consistently.
3. As an MDA user, I want fiscal year and quarter derived from transaction date, so that reporting periods are not manually mistyped.
4. As an MDA user, I want MDA, programme area, and funding source to use controlled dropdowns, so that reports are comparable across MDAs.
5. As an MDA user, I want Funding Entry amount to require a positive Money Amount, so that normal submissions do not use negative correction rows.
6. As an MDA user, I want Funding Entry reference number required, so that every funding inflow is traceable.
7. As an MDA user, I want duplicate Funding Entry reference numbers blocked within fiscal year and MDA, so that funding is not double-counted.
8. As an MDA user, I want to create an Expenditure Entry with transaction date, MDA, programme area, expenditure category, optional expenditure item, amount, PHC flag, payment method, voucher reference number, and remarks, so that outflows are captured consistently.
9. As an MDA user, I want Payment Method required for every Expenditure Entry, so that finance teams can reconcile spending channels.
10. As an MDA user, I want Expenditure Entry amount to require a positive Money Amount, so that corrections remain audited edits rather than negative routine entries.
11. As an MDA user, I want voucher reference number required, so that every Expenditure Entry is traceable.
12. As an MDA user, I want duplicate voucher reference numbers blocked within fiscal year and MDA, so that expenditure is not double-counted.
13. As an MDA user, I want Expenditure Item to be optional but dropdown-backed, so that the platform supports item detail without inventing workbook data.
14. As an MDA user, I want Expenditure Items filtered by selected Expenditure Category when category-linked items exist, so that I choose a valid item.
15. As an MDA user, I want to mark whether an Expenditure Entry is PHC Expenditure, so that PHC spending can be analyzed separately.
16. As an MDA user, I want PHC Expenditure to require LGA and Facility, so that facility-level analysis remains reliable.
17. As an MDA user, I want Facility choices filtered by selected LGA, so that impossible LGA/facility combinations are blocked.
18. As an MDA user, I want only PHC facilities selectable for PHC Expenditure, so that PHC reporting remains accurate.
19. As an MDA user, I want non-PHC Expenditure to hide or clear LGA and Facility fields, so that non-PHC entries do not carry misleading facility data.
20. As an MDA user, I want an Admin-created Unspecified PHC Facility to be available when exact facility is unknown, so that facility cannot be left blank.
21. As an MDA user, I want optional AOP Linkage filtered by selected MDA and fiscal year, so that linked expenditure matches the relevant AOP Activity.
22. As an MDA user, I want Expenditure Entries without AOP Linkage still accepted, so that routine reporting is not blocked while AOP matching improves over time.
23. As an MDA user, I want remarks required when I select an Other Option, so that ambiguous controlled values are explained.
24. As an MDA user, I want optional Entry Attachments for vouchers, approval letters, release memos, and receipts, so that Reviewers can inspect supporting files.
25. As an MDA user, I want submitted entries to default to pending, so that review workflow starts consistently.
26. As an MDA user, I want to view my submitted Funding Entries and Expenditure Entries, so that I can track status and follow up.
27. As an MDA user, I want to edit my own assigned-MDA entries while pending, so that I can fix mistakes before review.
28. As an MDA user, I want reviewed entries locked from normal editing, so that approved, processed, and rejected records are not silently changed.
29. As an MDA user, I want rejected entries and rejection comments visible, so that I can understand what failed review.
30. As an MDA user, I want a Reference Value Request option when a controlled dropdown is missing a needed value, so that I do not misuse remarks or Other Options.

## Implementation Decisions

- Keep Funding Entries and Expenditure Entries as separate write workflows and separate write models.
- Use active Reference Data for controlled dropdowns while preserving inactive values for historical display.
- Derive fiscal year and quarter from transaction date and show them as read-only form context.
- Rely on database-generated Public Entry IDs and show them after successful submission.
- Enforce positive Money Amounts, required Reference Number, required Voucher Reference Number, required Payment Method, and scoped duplicate checks.
- Enforce remarks when the selected Funding Source, Programme Area, or Payment Method is an Other Option; keep remarks optional otherwise.
- For PHC Expenditure, require LGA and Facility and filter Facility by selected LGA and PHC facility type.
- For non-PHC Expenditure, clear LGA and Facility before submission.
- For AOP Linkage, filter available AOP Activities by selected MDA and fiscal year; keep linkage optional.
- For Expenditure Item, filter by Expenditure Category when the item is category-linked; keep item optional in v1.
- Use private Supabase Storage and attachment metadata for optional Entry Attachments.
- Route all submission writes through authorization-aware client commands or trusted Next.js route handlers with Supabase RLS still active.
- MDA users can update their assigned-MDA entries only while status is pending.
- Reviewed-entry edits by Admins or Reviewers belong to the review/audit PRD, not normal MDA editing.
- Create a deep entry-validation module that converts domain rules and Reference Data into reusable validation for forms, imports, and tests.
- Create a deep entry-command module that handles submit, pending edit, attachment metadata, and user-facing error mapping for both ledgers.

## Testing Decisions

- Good tests should submit forms through public behavior and assert validation, saved values, status, and visible feedback, not component internals.
- Test the entry-validation module heavily because it encapsulates many domain rules behind a stable interface.
- Test Funding Entry validation for required fields, positive amount, derived fiscal year/quarter display, Other requiring remarks, duplicate reference number, and assigned-MDA access.
- Test Expenditure Entry validation for required fields, positive amount, required Payment Method, PHC LGA/facility requirements, non-PHC facility clearing, facility/LGA mismatch, non-PHC facility type, AOP/MDA/fiscal-year mismatch, Expenditure Item/category mismatch, Other requiring remarks, and duplicate voucher reference number.
- Test MDA permission behavior for create, view, and pending edit access.
- Test attachment metadata creation and access behavior without depending on storage implementation details.
- Use the existing SQL trigger validation and seed verification as prior art for expected domain behavior.

## Out of Scope

- Admin and Reviewer status transitions.
- Formal Correction Requests after review.
- Mandatory attachments.
- Negative/reversal entries.
- Funding receipt or deposit method.
- MDA-specific core taxonomies.
- Non-PHC facility expenditure workflows beyond the general facility model.

## Further Notes

- Routine reporting should happen through authenticated forms, not workbook-style free entry.
- Existing workbook Other Options remain available where seeded; new Other Options should not be added everywhere by default.
- Submission Windows exist in v1 but start permissive so rollout and historical catch-up are not blocked.

## PRD 3: Review Workflow, Audit Trail, Comments, And Notifications

## Problem Statement

The workbook gives no robust way to review submissions, preserve rejection reasons, track who changed entries, notify submitters, or distinguish an MDA user from a Reviewer. Without a workflow, submitted entries can become hard to trust, and corrections after approval can silently change official reporting.

## Solution

Build Reviewer and Admin workflows for reviewing Funding Entries and Expenditure Entries. Reviewers should operate only on assigned MDAs, while Admins can act statewide. Pending entries can be approved, rejected, or processed according to the Entry Status model. Rejections require Entry Comments, reviewed-entry edits require audit reasons, every material change creates Audit Events, optional attachments can be inspected, and workflow events create in-app Notifications plus Resend-backed Email Delivery Events.

## User Stories

1. As a Reviewer, I want a queue of pending Funding Entries for assigned MDAs, so that I can review funding submissions without full admin powers.
2. As a Reviewer, I want a queue of pending Expenditure Entries for assigned MDAs, so that I can review spending submissions without full admin powers.
3. As an Admin, I want statewide review queues, so that I can oversee all submitted entries.
4. As a Reviewer, I want to filter review queues by fiscal year, MDA, status, programme area, funding source, expenditure category, PHC status, LGA, facility, date range, and warning state, so that I can focus review work.
5. As a Reviewer, I want to open an entry detail view, so that I can inspect form fields, Public Entry ID, attachments, comments, audit history, and warnings.
6. As a Reviewer, I want to approve a pending entry, so that it is accepted for reporting.
7. As a Reviewer, I want to reject a pending entry with a required rejection comment, so that the submitter understands what to fix.
8. As a Reviewer, I want to process an approved entry, so that it can be marked accepted and reconciled or posted in the finance process.
9. As a Reviewer, I want status changes to record who acted and when, so that workflow accountability is preserved.
10. As an Admin, I want to approve, reject, or process any entry, so that statewide review work can continue even when assigned Reviewers are unavailable.
11. As a Reviewer, I want to edit a reviewed entry only with a reason, so that necessary corrections are auditable.
12. As an Admin, I want to edit reviewed entries only with a reason, so that official reporting changes remain accountable.
13. As an MDA user, I want reviewed entries locked from ordinary editing, so that review decisions are not overwritten silently.
14. As an MDA user, I want to see rejection comments, so that I can understand why an entry was rejected.
15. As a Reviewer, I want Entry Comments for clarification and review discussion, so that entry-specific conversations stay attached to the record.
16. As a Reviewer, I want uploaded Entry Attachments visible from the entry detail view, so that supporting evidence can inform review.
17. As a Reviewer, I want Data Quality Warnings surfaced before approval, so that I can notice fallback facilities, stale pending entries, missing AOP linkage, or submission-window concerns.
18. As a Reviewer, I want to resolve Data Quality Warnings when appropriate, so that the review queue reflects current concerns.
19. As an MDA user, I want in-app Notifications when my entries are approved, rejected, or processed, so that I can track outcomes.
20. As an MDA user, I want email Notifications when my entries are approved, rejected, or processed, so that I do not need to constantly check the platform.
21. As a Reviewer, I want in-app Notifications when entries are submitted for my assigned MDAs, so that I can act quickly.
22. As an Admin, I want notification and email delivery history, so that failed workflow emails can be reviewed and retried.
23. As an Admin, I want Audit Events for entry creation, edits, status changes, and reference-data changes, so that historical accountability is available.
24. As an Admin, I want audit history to show old values, new values, actor, reason, and timestamp, so that changes can be reconstructed.
25. As a developer, I want workflow rules centralized, so that status transitions, comments, audit events, warnings, notifications, and emails do not drift across screens.

## Implementation Decisions

- Keep Reviewer distinct from Admin; Reviewers can review assigned MDAs without managing users, imports, exports, or Reference Data.
- Use pending, approved, processed, and rejected as the v1 Entry Status workflow states.
- Use Entry Comments for rejection reasons and review discussion; rejected entries require a rejection reason.
- Use Audit Events for entry creation, updates, status transitions, reviewed-entry edits, and reference-data changes.
- Reviewed-entry edits by Admins and Reviewers must require a reason and create an Audit Event.
- MDA users cannot edit reviewed entries through normal entry forms.
- Use Data Quality Warnings as non-blocking review prompts, not submission blockers.
- Generate v1 warning checks for Unspecified PHC Facility, missing optional AOP Linkage, stale pending entries, and entries outside a Submission Window.
- Use in-app Notifications for entry submitted, approved, rejected, and processed events.
- Use Resend-backed Email Delivery Events for auditable workflow email tracking.
- Keep workflow emails server-side and record provider status, payload, recipient, and errors.
- Create a deep workflow module that exposes approve, reject, process, reviewed edit, comment, warning resolution, notification, and email commands.
- Create a deep audit module that standardizes event shape, reason handling, and actor capture.
- Create a deep notification module that creates in-app records and queues/sends email events from the same workflow payload.

## Testing Decisions

- Good tests should verify status transitions, visible comments, audit records, notifications, and authorization outcomes rather than private implementation details.
- Test workflow commands for allowed and forbidden transitions by Admin, Reviewer, and MDA user.
- Test rejection requiring Entry Comment.
- Test reviewed-entry edits requiring an audit reason.
- Test Audit Events for old values, new values, actor, event type, reason, and timestamp presence.
- Test Data Quality Warning generation and resolution behavior.
- Test notification creation for submitted, approved, rejected, and processed entries.
- Test email delivery event creation and failure recording without requiring live Resend calls.
- Use the existing audit-trigger schema and notification tables as prior art for expected persistence.

## Out of Scope

- Formal Correction Request workflow.
- Configurable warning or amount-threshold rule builders.
- Making attachments mandatory for high-value entries.
- Real-time collaborative commenting.
- User-defined notification preferences.

## Further Notes

- Rejected entries are excluded from official reporting, but Admin Insights should still allow status filters for operational review and audits.
- Processed means accepted and reconciled or posted in the finance process; the app should not imply external financial-system integration in v1.

## PRD 4: Reference Data, Planning Data, Admin Imports, And Submission Windows

## Problem Statement

The workbook centralizes dropdowns in a LOOKUP sheet and planning data in Budget 2026 and AOP 2026 sheets. This supports some consistency, but it makes updates manual, hard to audit, and fragile for future fiscal years. MDA users also have no clean path to request missing controlled values, and Admins need a safe way to load historical ledger data, Reference Data, Approved Budgets, and AOP Activities without corrupting reports.

## Solution

Build Admin management workflows for Reference Data, Approved Budgets, AOP Activities, Reference Value Requests, Submission Windows, and Admin Imports. Admins should create, update, deactivate, and reactivate controlled values; manage MDA and planning data across fiscal years; validate import files before writing; preserve row-level import errors; and avoid deleting referenced values. MDA users should request missing values instead of free-typing around controlled dropdowns.

## User Stories

1. As an Admin, I want to manage MDA Types, so that MDAs can be organized and filtered.
2. As an Admin, I want to manage MDAs, so that ministries, boards, agencies, schools, colleges, hospitals, and funds stay current.
3. As an Admin, I want to deactivate MDAs instead of deleting referenced MDAs, so that historical reports remain stable.
4. As an Admin, I want to manage Programme Areas, so that funding and expenditure classification remains consistent.
5. As an Admin, I want to manage Funding Sources, so that funding inflows use controlled origin categories.
6. As an Admin, I want to manage Expenditure Categories, so that spending classifications stay consistent.
7. As an Admin, I want to manage optional Expenditure Items under Expenditure Categories, so that item-level detail can be added after launch.
8. As an Admin, I want to manage Payment Methods, so that Expenditure Entries capture valid finance channels.
9. As an Admin, I want to manage LGAs, so that PHC geography remains complete.
10. As an Admin, I want to manage Facilities under LGAs with facility types, so that PHC facility dropdowns stay accurate.
11. As an Admin, I want active Reference Data immediately available in forms, so that operational updates do not require deployments.
12. As an Admin, I want to deactivate and reactivate referenced values, so that old meanings are preserved without hiding historical records.
13. As an Admin, I want Reference Data changes audited, so that I can explain why a dropdown changed.
14. As an MDA user, I want to submit a Reference Value Request, so that missing dropdown values can be added through an approved path.
15. As an Admin, I want to approve Reference Value Requests by creating or updating the relevant Reference Data, so that requests become usable values.
16. As an Admin, I want to reject Reference Value Requests with a required review comment, so that users receive a reason.
17. As an Admin, I want to manage Approved Budgets by fiscal year and MDA, so that budget utilization reporting is current.
18. As an Admin, I want Approved Budget totals to enforce personnel plus other recurrent and recurrent plus capital relationships, so that budget data stays arithmetically sound.
19. As an Admin, I want to manage AOP Activities by fiscal year and MDA, so that planned-vs-actual reporting can evolve beyond imports.
20. As an Admin, I want AOP Activities to allow duplicate activity-code/MDA pairs when source row identity differs, so that workbook data is preserved.
21. As an Admin, I want Admin Imports for Reference Data, Approved Budgets, AOP Activities, historical Funding Entries, and historical Expenditure Entries, so that data can be migrated safely.
22. As an Admin, I want imports to validate before writing, so that bad rows do not affect reports.
23. As an Admin, I want row-level import errors with field names, messages, source row numbers, and raw row snapshots, so that import issues are fixable.
24. As an Admin, I want historical Funding imports to reject duplicate fiscal-year/MDA/reference-number collisions, so that funding is not double-counted.
25. As an Admin, I want historical Expenditure imports to reject duplicate fiscal-year/MDA/voucher-reference collisions, so that expenditure is not double-counted.
26. As an Admin, I want import batches to preserve status and summary counts, so that migration work is auditable.
27. As an Admin, I want Submission Windows for fiscal years, date ranges, and optional MDAs, so that routine submissions can later be opened or closed.
28. As an Admin, I want Submission Windows permissive by default in v1, so that rollout and historical catch-up are not blocked.
29. As a Reviewer, I want entries outside an open Submission Window to create warnings rather than immediate blockers in v1, so that review can decide how to handle rollout exceptions.
30. As a developer, I want import validation to share the same domain rules as forms where possible, so that imported rows and submitted rows are treated consistently.

## Implementation Decisions

- Use Admin-only CRUD for Reference Data, MDAs, MDA Types, Approved Budgets, AOP Activities, Submission Windows, and import batches.
- Keep programme areas, funding sources, expenditure categories, payment methods, and statuses global in v1.
- Use deactivate/reactivate behavior instead of destructive deletion for referenced values.
- Preserve inactive Reference Values for historical display and reporting.
- Keep active Admin-created Reference Data immediately available in forms.
- Keep existing workbook Other Options where present, but avoid adding Other everywhere by default.
- Use Reference Value Requests as the approved path for missing dropdown values.
- Keep Approved Budgets at MDA/fiscal-year level with personnel, other recurrent, recurrent total, capital, and total budget.
- Exclude workbook sector-total rows from MDA-level Approved Budgets and derive sector totals through reporting.
- Keep AOP Activities multi-year and MDA-scoped, with source row number preserving workbook duplicate activity codes.
- Treat Admin Imports as admin-only bulk paths for seed, reference, planning, and historical migration data.
- Validate import files before writing any accepted rows.
- Store row-level import errors and batch summaries.
- Reject duplicate historical Funding and Expenditure rows according to scoped reference/voucher uniqueness rules.
- Submission Windows exist in v1 but begin permissive; closed-window behavior should surface warnings first unless explicitly configured otherwise later.
- Create a deep reference-data module for list, create, update, deactivate, reactivate, and request resolution.
- Create a deep planning module for Approved Budget and AOP Activity management.
- Create a deep import module that accepts typed import rows, validates them, returns row-level errors, and only writes valid batches.

## Testing Decisions

- Good tests should verify admin-visible behavior, validation outcomes, inactive value preservation, audit events, and import errors.
- Test Reference Data create, update, deactivate, reactivate, active form availability, and historical inactive display.
- Test Reference Value Request submit, approve, reject, and required rejection comment behavior.
- Test Approved Budget arithmetic and uniqueness by fiscal year and MDA.
- Test AOP Activity filtering, duplicate source-row preservation, and activity-code behavior.
- Test Admin Import validation for missing references, invalid amounts, duplicate funding references, duplicate expenditure vouchers, invalid PHC LGA/facility combinations, AOP mismatch, and row-level error reporting.
- Test Submission Window warning behavior for entries outside windows.
- Use existing seed generation scripts, seed catalog, and local SQL verification as prior art for import and planning-data correctness.

## Out of Scope

- Routine MDA reporting through imports.
- Full effective-dated Reference Data versioning.
- MDA-specific core dropdown taxonomies.
- Automatically importing the workbook from a local user Downloads path in production.
- Configurable import mapping UI beyond the supported import types.
- Hard blocking closed Submission Windows for all users during initial rollout.

## Further Notes

- The current seed data includes 21 MDAs, 44 LGAs, 471 PHC facilities, 21 approved 2026 budget rows, and 2,031 AOP activity rows.
- Seven AOP activity-code/MDA pairs repeat in the workbook; source row number is an intentional preservation mechanism.

## PRD 5: Dashboards, Admin Insights, Reporting Views, And Exports

## Problem Statement

The workbook includes formula dashboards and analysis sheets for funding, expenditure, budgets, MDAs, LGAs, and facilities, but those insights are fragile, manual, and hard to filter by workflow status or user authorization. MDA users need scoped dashboards for their assigned MDAs, while Admins and Reviewers need statewide and assigned-MDA insights that support review, planning, PHC analysis, AOP planned-vs-actual reporting, and exports.

## Solution

Build MDA Dashboards, Reviewer/Admin Insights, reporting queries, and export workflows backed by Supabase views and authorization-aware filters. Dashboards should show all submitted entries by default with status filters, preserve RLS boundaries, and support CSV, XLSX, and PDF Exports for ledgers, insight tables, and dashboard summaries. Charts should remain restrained and paired with drill-down tables.

## User Stories

1. As an MDA user, I want an MDA Dashboard scoped to my assigned MDAs, so that I can monitor my own funding and expenditure submissions.
2. As an MDA user, I want funding totals by fiscal year, quarter, MDA, funding source, and programme area, so that I can understand recorded inflows.
3. As an MDA user, I want expenditure totals by fiscal year, quarter, MDA, expenditure category, programme area, and PHC status, so that I can understand spending patterns.
4. As an MDA user, I want budget utilization for assigned MDAs, so that I can compare Approved Budget with Expenditure Entries.
5. As an MDA user, I want my pending, approved, processed, and rejected entry counts, so that I know what needs attention.
6. As an MDA user, I want rejected entries and comments visible from the dashboard, so that I can respond to review outcomes.
7. As a Reviewer, I want assigned-MDA insights, so that I can review trends without seeing unauthorized statewide data.
8. As an Admin, I want statewide Admin Insights, so that I can monitor health-sector funding and expenditure across MDAs.
9. As an Admin, I want insights to show all submitted entries by default, so that operational review includes pending, approved, processed, and rejected records unless filtered.
10. As an Admin, I want status filters, so that I can switch between official reporting and operational review.
11. As an Admin, I want budget vs funding vs expenditure by MDA, so that I can track funding gaps and budget utilization.
12. As an Admin, I want funding by Funding Source, so that I can understand the financing mix.
13. As an Admin, I want expenditure by Expenditure Category, so that I can see where funds are spent.
14. As an Admin, I want Programme Area summaries, so that I can compare funding and expenditure against health priorities.
15. As an Admin, I want funding-expenditure gap analysis, so that I can identify MDAs or Programme Areas with mismatched inflows and outflows.
16. As an Admin, I want PHC Expenditure summaries by LGA, so that I can monitor frontline spending geographically.
17. As an Admin, I want PHC Expenditure summaries by Facility, so that facility-level spending is visible.
18. As an Admin, I want AOP budget coverage, so that I can compare AOP budgeted cost with Approved Budget by MDA.
19. As an Admin, I want AOP planned-vs-actual reporting, so that linked Expenditure Entries can be compared with AOP Activity budgets.
20. As an Admin, I want unlinked expenditure reporting, so that AOP linkage gaps can be improved over time.
21. As a Reviewer, I want Data Quality Warning queues, so that questionable entries remain visible during review.
22. As an Admin, I want drill-down tables next to charts, so that visual summaries remain traceable to entries.
23. As an Admin, I want filters for fiscal year, date range, MDA, MDA Type, status, Programme Area, Funding Source, Expenditure Category, LGA, Facility, and PHC status, so that reporting questions can be answered quickly.
24. As an Admin, I want CSV Exports for raw and filtered ledger rows, so that analysts can work with the data.
25. As an Admin, I want XLSX Exports for ledger and insight tables, so that reporting outputs fit familiar finance workflows.
26. As an Admin, I want PDF Exports for dashboard summaries and filtered reports, so that decision-makers receive clean report outputs.
27. As an Admin, I want Exports to preserve selected filters and visible totals, so that exported reports match the screen context.
28. As an Admin, I want Export Jobs with status and downloadable file metadata, so that export generation is traceable.
29. As an Admin, I want export failure messages, so that failed jobs can be diagnosed.
30. As a developer, I want reporting filters centralized, so that dashboards, exports, and drill-down tables agree.

## Implementation Decisions

- Use Supabase reporting views with `security_invoker = true` where available so RLS remains effective.
- Build MDA Dashboards from the same reporting concepts as Admin Insights, constrained by assigned-MDA access.
- Build Admin Insights with all submitted entries by default and status filters for official reporting.
- Include budget vs actual, funding by source, expenditure by category, programme area summary, funding-expenditure gap, PHC LGA summary, PHC Facility summary, AOP budget coverage, AOP planned-vs-actual, and unlinked expenditure.
- Pair restrained charts with drill-down tables for traceability.
- Use the design system's operational chart palette: green, teal, brown, amber, and slate.
- Keep filters consistent across dashboards, tables, exports, and review contexts.
- Use Next.js route handlers for CSV, XLSX, and PDF export generation.
- Store Export Jobs with export type, subject, filters, status, storage metadata, creator, timestamps, and errors.
- Preserve selected filters in exported files.
- Create a deep reporting module that composes filters, queries views, applies role scope, and returns report payloads.
- Create a deep export module that renders CSV, XLSX, and PDF from shared report payloads rather than duplicating report logic.

## Testing Decisions

- Good tests should verify report totals, filters, role scope, export payloads, and status behavior rather than chart library internals.
- Test report filters for fiscal year, date range, MDA, status, Programme Area, Funding Source, Expenditure Category, LGA, Facility, and PHC status.
- Test MDA Dashboard scoping for users with one MDA and multiple MDA Memberships.
- Test Reviewer scoping for assigned MDAs and Admin statewide access.
- Test budget utilization, funding by source, expenditure by category, Programme Area summaries, PHC summaries, AOP planned-vs-actual, and unlinked expenditure against seeded or fixture data.
- Test CSV, XLSX, and PDF exports preserve filters and visible totals.
- Test Export Job lifecycle from queued to completed or failed.
- Use existing database reporting views and workbook insight logic as prior art for expected metrics.

## Out of Scope

- Public dashboards.
- Real-time streaming analytics.
- Custom chart builder.
- User-authored saved report definitions.
- Cross-state comparison or multi-tenant state-level deployment.
- External BI integrations.

## Further Notes

- Rejected entries should remain available through status filters for audit and operational review.
- Official reporting views should make it easy to focus on approved and processed entries without hiding the broader workflow context.

## PRD 6: End-to-End Hardening, Verification, And Launch Readiness

## Problem Statement

The platform will handle authenticated finance reporting, controlled Reference Data, PHC facility spending, review decisions, attachments, audit trails, imports, exports, and workflow emails. Without a hardening phase, the implementation could satisfy individual screens while failing under cross-module behavior, RLS boundaries, data quality expectations, or launch operations.

## Solution

Add end-to-end hardening across validation, permissions, RLS, imports, reporting, notifications, exports, storage, Supabase configuration, and development workflows. This slice should turn the implementation from a collection of features into a reliable public-sector finance system that can be seeded, tested, verified, deployed, and operated with confidence.

## User Stories

1. As an Admin, I want database migrations and seeds to run reliably, so that the platform can be rebuilt from source.
2. As an Admin, I want seed row counts verified, so that Reference Data, Approved Budgets, and AOP Activities are complete.
3. As an Admin, I want Supabase RLS policies verified for each role, so that users cannot access unauthorized entries or admin surfaces.
4. As an MDA user, I want my assigned-MDA boundaries enforced in forms, dashboards, comments, attachments, and notifications, so that other MDA data remains private.
5. As a Reviewer, I want reviewer boundaries enforced across queues, edits, comments, attachments, warnings, and dashboards, so that I act only on assigned MDAs.
6. As an Admin, I want trusted server-side workflows verified, so that imports, exports, storage signing, and Resend operations do not leak secrets.
7. As a finance user, I want all Money Amounts stored and displayed consistently as Nigerian naira with two decimals, so that reports are precise and familiar.
8. As a finance user, I want long MDA names and voucher references to render without clipping, so that dense finance screens are usable.
9. As a Reviewer, I want Data Quality Warnings tested across form submissions and imports, so that warnings are trustworthy.
10. As an Admin, I want private attachment access tightened after storage paths are finalized, so that supporting files are protected.
11. As an Admin, I want email delivery failure handling tested, so that workflow communication issues are visible.
12. As an Admin, I want export generation tested for realistic filters and larger datasets, so that reporting outputs are reliable.
13. As a developer, I want regression tests around the deep modules, so that future agents can change features without breaking domain behavior.
14. As a developer, I want generated Supabase types or typed data helpers, so that database access stays aligned with the schema.
15. As a developer, I want seed regeneration checks, so that workbook-derived artifacts remain synchronized when the workbook changes.
16. As a developer, I want a documented local development flow, so that new agents can reset the database, seed data, run tests, and inspect outputs quickly.
17. As a product owner, I want launch readiness checks for auth, roles, seeds, storage, email, exports, and dashboards, so that deployment risk is visible.
18. As a product owner, I want known caveats documented, so that real Supabase project setup work is not confused with completed local verification.

## Implementation Decisions

- Treat database constraints and RLS policies as critical product behavior, not only infrastructure.
- Verify migration and seed application in the supported Supabase environment once a real project is configured.
- Preserve current local Postgres stub verification as development prior art, but do not treat it as full Supabase advisor coverage.
- Generate typed database access helpers after schema stabilization.
- Add regression tests for validation, permissions, imports, reporting, notifications, exports, and storage access.
- Tighten private attachment bucket policies after frontend storage path conventions are finalized.
- Keep email delivery tests isolated from live Resend calls unless an explicit integration environment is configured.
- Add export tests for CSV, XLSX, and PDF outputs from shared report payloads.
- Add visual and responsive checks for dense tables, long MDA names, status badges, and form layouts.
- Add development documentation for environment variables, database reset, seed order, local verification, tests, and deployment caveats.
- Create a launch checklist covering auth setup, roles, MDA Memberships, seed counts, RLS smoke tests, storage policy checks, Resend configuration, export storage, and dashboard filters.

## Testing Decisions

- Good tests should prove cross-module behavior from the user's perspective: who can do what, what data is saved, what totals are shown, and what audit/notification/export records are produced.
- Test deep modules in isolation: permissions, entry validation, entry commands, workflow, audit, notifications, Reference Data, imports, reporting, and exports.
- Test database behavior with seeded fixtures for fiscal-year derivation, quarter derivation, Public Entry IDs, scoped uniqueness, PHC validation, AOP matching, and Other requiring remarks.
- Test RLS behavior for Admin, MDA user, Reviewer, unauthenticated user, users with one MDA Membership, and users with multiple MDA Memberships.
- Test UI behavior for the main MDA Funding Entry flow, Expenditure Entry flow, review queue flow, Reference Value Request flow, Admin Import validation flow, dashboard filter flow, and export flow.
- Test visual behavior for mobile and desktop viewports where long labels, dense tables, and buttons may overflow.
- Use local schema verification, seed catalog counts, and workbook-derived expected metrics as prior art.

## Out of Scope

- Production deployment to a real Supabase project before credentials and project configuration are provided.
- Supabase advisors before a real Supabase project is configured.
- Load testing beyond realistic v1 data volumes.
- Advanced observability dashboards.
- Multi-tenant state-level rollout.
- Dark mode hardening.

## Further Notes

- Current Supabase artifacts have been syntax- and seed-verified locally with stubs, but not applied to a real Supabase project in this workspace.
- Storage policies currently allow admin management of the private attachment bucket; tighter object-level paths should be finalized with the frontend upload/download flow.
- This phase should be run after the feature PRDs above are implemented, but test scaffolding can begin earlier around deep modules.
