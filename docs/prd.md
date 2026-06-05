# PRD: Kano Health Finance Tracker Web Platform

## Problem Statement

Kano State health-sector funding and expenditure tracking currently depends on a complex Excel workbook with manual data entry, VLOOKUP-driven dropdowns, copied ledger rows, formula dashboards, and separate analysis tabs. This makes it easy for MDAs to enter inconsistent data, hard for admins to review submissions, and slow to produce reliable insights across funding, expenditure, budgets, AOP activities, LGAs, and facilities.

The platform should replace routine spreadsheet reporting with authenticated web forms, controlled dropdowns, review workflows, auditability, and admin insights while preserving the useful structure already present in the workbook.

## Solution

Build a Supabase-backed web platform where MDA users submit Funding Entries and Expenditure Entries through clean, authenticated forms. Most fields should be controlled dropdowns backed by admin-managed Reference Data. Admins and Reviewers should review, approve, reject, process, comment on, and audit entries. Admins should manage reference data, import seed/planning data, export reports, and access statewide insights. MDA users should see scoped dashboards for assigned MDAs.

The first version should use the verified Supabase schema and workbook-generated seeds already produced in this repo.

## User Stories

1. As an MDA user, I want to sign in securely, so that only authorized users can submit health finance records.
2. As an MDA user, I want to see only my assigned MDAs, so that I do not submit against the wrong MDA.
3. As an MDA user, I want to create a Funding Entry with date, MDA, programme area, funding source, amount, reference number, and remarks, so that funding received is captured consistently.
4. As an MDA user, I want fiscal year and quarter derived from transaction date, so that I do not manually select reporting periods.
5. As an MDA user, I want funding source and programme area selected from dropdowns, so that spelling variations do not break reporting.
6. As an MDA user, I want reference number required for Funding Entries, so that every funding record is traceable.
7. As an MDA user, I want to create an Expenditure Entry with date, MDA, programme area, expenditure category, optional expenditure item, amount, payment method, voucher reference number, and remarks, so that expenditure is captured consistently.
8. As an MDA user, I want expenditure category, expenditure item, programme area, payment method, LGA, facility, and AOP activity selected from dropdowns where applicable, so that bad data is blocked early.
9. As an MDA user, I want voucher reference number required for Expenditure Entries, so that every expenditure record is traceable.
10. As an MDA user, I want Payment Method required for Expenditure Entries, so that finance teams can reconcile spending channels.
11. As an MDA user, I want amounts to be positive Nigerian naira values, so that corrections do not distort reports through negative entries.
12. As an MDA user, I want to mark an Expenditure Entry as PHC or non-PHC, so that PHC facility spending can be analyzed separately.
13. As an MDA user, I want PHC Expenditure to require LGA and PHC Facility, so that facility-level analysis remains reliable.
14. As an MDA user, I want facilities filtered by selected LGA, so that I cannot choose an impossible LGA/facility combination.
15. As an MDA user, I want to optionally link an Expenditure Entry to an AOP Activity, so that planned-vs-actual reporting improves over time.
16. As an MDA user, I want `Other` selections to require remarks, so that ambiguous dropdown choices are explained.
17. As an MDA user, I want to request a missing Reference Data value, so that I do not use remarks as a workaround for absent dropdown options.
18. As an MDA user, I want to attach optional supporting files to entries, so that vouchers or approval letters can be reviewed later.
19. As an MDA user, I want to edit my own pending entries, so that I can fix mistakes before review.
20. As an MDA user, I want reviewed entries locked from normal editing, so that approved/rejected records are not silently changed.
21. As an MDA user, I want comments on rejected entries, so that I know what needs correction.
22. As an MDA user, I want email and in-app notifications when entries are approved, rejected, or processed, so that I do not need to constantly check manually.
23. As an MDA user, I want an MDA Dashboard for assigned MDAs, so that I can see submission status, totals, and budget utilization.
24. As a Reviewer, I want to see entries for assigned MDAs, so that I can review submissions without full admin powers.
25. As a Reviewer, I want to approve, reject, or process entries, so that submissions move through a clear workflow.
26. As a Reviewer, I want rejection comments required, so that MDA users receive actionable feedback.
27. As a Reviewer, I want to edit reviewed entries only with a reason, so that necessary corrections are accountable.
28. As a Reviewer, I want to see Data Quality Warnings, so that I can pay attention to fallback facilities, stale pending entries, missing optional context, and entries outside submission windows.
29. As an Admin, I want statewide Admin Insights, so that I can monitor health-sector funding and expenditure across MDAs.
30. As an Admin, I want insights to show all submitted entries by default with status filters, so that I can switch between operational review and official reporting.
31. As an Admin, I want to filter insights by fiscal year, MDA, status, programme area, funding source, expenditure category, LGA, facility, date range, and PHC status, so that I can answer targeted reporting questions.
32. As an Admin, I want budget vs funding vs expenditure by MDA, so that I can track utilization.
33. As an Admin, I want funding by source, so that I can understand financing mix.
34. As an Admin, I want expenditure by category, so that I can see where funds are spent.
35. As an Admin, I want programme-area summaries, so that I can compare financing against health priorities.
36. As an Admin, I want PHC LGA and Facility summaries, so that I can monitor frontline facility spending.
37. As an Admin, I want AOP planned-vs-actual reporting, so that I can compare activity budgets with linked expenditures.
38. As an Admin, I want unlinked expenditure reporting, so that I can improve AOP linkage over time.
39. As an Admin, I want to manage MDAs and MDA Types, so that the institution list stays current.
40. As an Admin, I want to manage programme areas, funding sources, expenditure categories, expenditure items, payment methods, statuses, LGAs, and facilities, so that dropdowns remain useful.
41. As an Admin, I want active Reference Data immediately available in forms, so that operational updates are quick.
42. As an Admin, I want to deactivate old Reference Data instead of deleting it, so that historical reports remain stable.
43. As an Admin, I want to approve or reject Reference Value Requests, so that MDA users have a clean path for missing dropdown options.
44. As an Admin, I want to manage Approved Budgets by fiscal year and MDA, so that budget utilization stays current.
45. As an Admin, I want to manage AOP Activities by fiscal year and MDA, so that planned-vs-actual reporting can evolve beyond imports.
46. As an Admin, I want Admin Imports for seed, planning, reference, and historical ledger data, so that workbook data can be migrated safely.
47. As an Admin, I want import validation and row-level errors, so that bad rows are rejected before they affect reports.
48. As an Admin, I want duplicate ledger rows rejected by scoped reference/voucher uniqueness, so that imports do not double-count records.
49. As an Admin, I want CSV, XLSX, and PDF exports, so that I can serve both analyst and decision-maker reporting needs.
50. As an Admin, I want audit history for entries and reference data, so that changes are accountable.
51. As an Admin, I want email delivery records for Resend emails, so that failed workflow emails can be reviewed and retried.
52. As an Admin, I want submission windows available but permissive by default, so that rollout and historical catch-up are not blocked.

## Implementation Decisions

- Build against Supabase/Postgres using the verified initial schema and seed files already produced.
- Build the web platform with Vite, React, Supabase, and shadcn/ui.
- Keep privileged service-role operations, Resend email delivery, imports, and export generation in Supabase Edge Functions or equivalent serverless handlers rather than the browser bundle.
- Keep Funding Entries and Expenditure Entries as separate write models.
- Use Supabase Auth with `profiles` for app role and `user_mda_memberships` for one-to-many MDA access.
- Keep `admin`, `mda_user`, and `reviewer` as distinct roles.
- Use RLS for MDA-scoped access, admin access, reviewer access, notification visibility, imports, exports, and reference management.
- Use UUID primary keys internally and generated Public Entry IDs externally.
- Generate fiscal year and quarter from transaction date.
- Use controlled dropdowns for all fields with known options.
- Make Funding Entry reference number required and unique by fiscal year and MDA.
- Make Expenditure Entry voucher reference number required and unique by fiscal year and MDA.
- Make Payment Method required for Expenditure Entries.
- Keep Funding Entries free of receipt/deposit method in v1.
- Make Expenditure Item optional but dropdown-backed and admin-managed.
- Model Facility generally with `facility_type`; seed workbook facilities as PHC.
- Require LGA and PHC Facility for PHC Expenditure.
- Keep AOP linkage optional and filtered by selected MDA/fiscal year.
- Keep Reference Data admin-editable and immediately available when active.
- Preserve history by deactivating referenced values instead of deleting them.
- Add Reference Value Requests for missing dropdown options.
- Keep existing workbook `Other` values where present; require remarks when selected.
- Require remarks for rejection and reviewed-entry edits; otherwise remarks are optional.
- Add audit events for entry, status, planning, and reference-data changes.
- Add entry comments for review discussion and rejection reasons.
- Add optional attachments backed by private Supabase Storage.
- Add Admin Imports and import errors.
- Add in-app notifications and Resend-backed email delivery events.
- Add CSV, XLSX, and PDF export jobs.
- Add reporting views for MDA budget vs actual, funding by source, expenditure by category, programme summaries, PHC summaries, AOP planned-vs-actual, and unlinked expenditure.
- Build a deep form-validation module around schema-derived constraints and reference data.
- Build a deep permissions module that centralizes actor capabilities for app UI and serverless command handlers.
- Build a deep reporting module that wraps view/query access and filter composition.
- Build a deep import module that validates rows before writing.
- Build a deep export module that can output CSV, XLSX, and PDF from the same filtered report payload.
- Build a deep notification module that creates in-app notifications and queues Resend email delivery.

## Testing Decisions

- Tests should verify user-visible behavior and domain rules, not component internals.
- Database migration and seed verification should remain part of the build workflow, including seed row counts.
- Form-validation tests should cover required fields, positive amounts, `Other` requiring remarks, PHC requiring LGA/facility, facility/LGA matching, AOP/MDA/fiscal-year matching, and duplicate reference/voucher rejection.
- Permission tests should cover admin, reviewer, and MDA-user capabilities across ledgers, Reference Data, imports, exports, comments, attachments, and dashboards.
- Import tests should cover missing reference values, duplicate rows, invalid amounts, invalid LGA/facility pairs, and row-level error reporting.
- Reporting tests should cover filter composition and totals for funding, expenditure, budget utilization, PHC summaries, and AOP planned-vs-actual.
- Notification tests should verify notification records and email delivery events for submitted, approved, rejected, and processed entries.
- Export tests should verify CSV/XLSX/PDF outputs preserve selected filters and visible totals.
- UI tests should cover the main MDA submission flow, admin review flow, reference value request flow, and dashboard filters.

## Out of Scope

- Configurable high-value thresholds or rule builders.
- Negative/reversal entries.
- Formal correction-request workflow beyond direct admin/reviewer edits with audit reason.
- Mandatory attachments.
- Separate funding receipt/deposit method.
- MDA-specific core taxonomies for programme areas, funding sources, expenditure categories, payment methods, or statuses.
- Full effective-dated reference-data versioning.
- Non-PHC facility expenditure workflows beyond the general facility model.
- Applying the migration to a real Supabase project in this repo before a project is configured.

## Further Notes

- The workbook-generated seed files are executable and verified locally with Supabase stubs.
- The 2026 AOP sheet has duplicate activity-code/MDA pairs, so `source_row_number` is used to preserve workbook row identity.
- The `Budget 2026` sector-total row is intentionally excluded from `approved_budgets`; sector totals should be derived by reporting queries/views.
- The first scaffold should prioritize authenticated MDA forms, admin review, and reference-data management before advanced visual polish.
