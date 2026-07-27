# PRD: Kano Health Finance Tracker Web Platform

> **Current product decision (2026-07-15):** ADR 0005 supersedes every ledger-status and per-entry approval/rejection requirement below. Funding and expenditure rows are reportable when recorded. The internal `reviewer` role is presented as **Viewer** and can read, comment, inspect evidence, warnings, and audit history, but cannot mutate ledger entries. Admin publication of a quarter-specific BIR irreversibly locks routine writes for that quarter; reasoned Admin amendments create successive BIR metadata versions. References to statuses in offline queues, imports, exports, and Reference Value Requests remain valid.

## Problem Statement

Kano State health-sector funding and expenditure tracking currently depends on a complex Excel workbook with manual data entry, VLOOKUP-driven dropdowns, copied ledger rows, formula dashboards, and separate analysis tabs. This makes it easy for MDAs to enter inconsistent data, hard for admins to review submissions, and slow to produce reliable insights across funding, expenditure, budgets, AOP activities, LGAs, and facilities.

IBP's fiscal analysis of the 2026 health budget surfaced the same problem at sector level: first-quarter execution at 9.5%, zero recorded overhead releases across 21 MDAs, a ₦14bn gap between AOP tracking and the Budget Implementation Report (BIR), and zero of 2,046 AOP activities mapped to budget codes. The platform must replace incomplete, delayed reporting with structured monthly data flows, real-time fund-flow visibility, and transparent fiscal intelligence — across all 21 health MDAs, 44 LGAs, and 450+ PHC facilities.

The platform should replace routine spreadsheet reporting with authenticated web forms, controlled dropdowns, an Entry Register with comments, database-enforced quarterly BIR publication locks, auditability, admin insights, structured monthly submissions per MDA, a system-wide SMoH dashboard, a MoPB aggregate feed compatible with BIR, and a transparent rules-driven analytics layer.

## Solution

Build a Supabase/Postgres-backed web platform where MDA users submit Funding Entries, Budget Release Entries, Expenditure Entries, Activity Progress updates, and Release Notes through clean, authenticated forms grouped under a Monthly Submission Cycle. Most fields should be controlled dropdowns backed by admin-managed Reference Data.

Admins and Viewers should inspect, comment on, annotate, and audit entries. Admins can publish a selected quarterly BIR and make reasoned, versioned amendments after publication. SMoH should get a system-wide dashboard with sector → MDA → programme → LGA → facility drill-down, a compliance matrix, a quarterly breakdown, and outputs from a transparent rules engine (variance flags, compliance alerts, lagging programme ranking, early warning signals, zero-release attribution, plain-language expenditure snapshots). MoPB should get a dedicated portal for the monthly aggregate feed in BIR-compatible Excel and machine-readable JSON/CSV, with a data quality flag matrix and a pre-publication BIR validation interface.

Admins manage reference data, import seed/planning data, export reports at every drill level, and configure submission windows and rule thresholds. MDA users see dashboards scoped to assigned MDAs. The platform is designed for offline-tolerant use through draft auto-save in v1, with a Progressive Web App (PWA) offline-first upgrade planned.

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

### Monthly Submission Cycle

53. As an MDA user, I want a Monthly Submission Cycle that bundles budget releases, expenditures, funding sources, activity progress, and release notes for one fiscal month, so that I submit one coherent return per month instead of disconnected rows.
54. As an MDA user, I want to save the cycle as a draft and return to it without data loss, so that I can complete it across sittings.
55. As an MDA user, I want to download a PDF submission confirmation when I submit a cycle, so that I have a record of what I sent.
56. As an MDA user, I want the deadline (default 5th of the following month) shown in the cycle, so that I know when my submission is late.
57. As an MDA user, I want real-time validation of implausible values before I submit, so that obvious errors are caught at entry time.
58. As an MDA user, I want to record a mandatory Release Note for any programme line showing zero release for the cycle, so that zero releases are explained, not silent.
59. As an MDA user, I want to record Activity Progress on AOP Activities (`completed`, `in_progress`, `not_started`, `blocked`) with a mandatory reason when `blocked`, so that planned-vs-actual goes beyond expenditure.
60. As an MDA user assigned to an MDA with PHC responsibility (primarily PHCMB), I want to enter facility-level expenditure linked to the correct LGA and facility within the same cycle, so that facility-level analysis is captured at source.

### Budget Releases (Internal Releases vs Funding Receipts)

61. As an MDA user, I want to record Budget Release Entries for releases received against approved budget lines, with programme line, funding source, release date, amount, and memo reference, so that internal Kano releases are tracked separately from external funding receipts.
62. As an MDA user, I want Expenditure Entries to optionally capture `uncommitted_balance` and the `activity_line` they execute against, so that release-to-expenditure reconciliation is possible.

### SMoH System-Wide Dashboard

63. As an SMoH user, I want a real-time sector overview mirroring the workbook Dashboard sheet — sector totals, funding by source, expenditure by category, MDA-by-MDA comparison, quarterly breakdown, and programme-area rollups — that updates from live submissions.
64. As an SMoH user, I want to drill down sector → MDA → programme area → LGA → facility, so that I can investigate from headline numbers to source records in one tool.
65. As an SMoH user, I want a Compliance Matrix showing submission status (`not started | draft | submitted | late | accepted | returned`) for every MDA for every month, so that non-submission is visible without manual chasing.
66. As an SMoH user, I want to annotate records and flag them for follow-up with an assignee and resolution status, so that observations turn into action.
67. As an SMoH user, I want exportable reports (CSV/XLSX/PDF) at sector, MDA, LGA, facility, and programme-area levels, so that I can share findings outside the platform.

### Fiscal Intelligence (Rules Engine)

68. As an SMoH user, I want an auto-generated plain-language expenditure snapshot after each MDA submission, so that I can read what happened without opening tables.
69. As an SMoH user, I want variance flags where actual release deviates from approved budget by more than a configurable threshold (default 20%), each flag showing the programme line, approved amount, actual release, variance %, and an MDA explanation field, so that I can see why a line is flagged.
70. As an SMoH user, I want automatic Compliance Alerts after each monthly deadline showing on-time, late, and missing MDAs, so that compliance is enforced without manual review.
71. As an SMoH user, I want continuous ranking of programme areas by execution rate across MDAs, with the bottom quartile surfaced, so that lagging programmes are visible every cycle.
72. As an SMoH user, I want Early Warning Signals once at least two quarters of history exist, identifying programme lines or MDAs whose execution trajectory historically predicts year-end gaps, with the historical basis shown alongside, so that warnings are explainable.
73. As an SMoH user, I want automatic Zero-Release Attribution: for every programme line with zero release in a month, check whether a Release Note exists; if not, raise an unresolved-gap alert, so that silent zero releases stop happening.
74. As an Admin, I want to configure rule thresholds (e.g., variance %, lookback windows), so that the rules engine can be tuned without code changes.
75. As an SMoH user, I want every alert to expose the data and rule that produced it, so that I can explain it to leadership.

### MoPB Portal And BIR

76. As a MoPB user, I want to log into a dedicated portal scoped to aggregate data, so that I do not need access to MDA-level write workflows.
77. As a MoPB user, I want to download the monthly aggregate in BIR-compatible Excel and in machine-readable JSON/CSV, so that I can feed it into the BIR compilation process.
78. As a MoPB user, I want a Data Quality Flag Matrix on the aggregate showing per-MDA `complete | partial | absent` plus unresolved gaps, so that I know which lines to treat with caution.
79. As an SMoH user, I want a BIR pre-publication validation interface where I upload MoPB's draft BIR and compare it against platform data, with discrepancies highlighted, so that BIR releases are reconciled before publication.

### Offline And Device Support

80. As an MDA user, I want the platform to work on the office equipment I actually have (Windows 7+, Chrome/Firefox/Edge from 2020, 1024×768 screens) and to load reasonably on slow connections, so that infrastructure gaps do not block submissions.
81. As an MDA user, I want to capture a submission cycle as a draft even when offline and have it sync when I reconnect, with conflict surfacing rather than silent overwrite, so that connectivity gaps do not become data gaps.

### Security And Operations

82. As an Admin, I want immutable audit logs that no role can edit or delete, so that the audit trail is trustworthy.
83. As an Admin, I want session inactivity timeout (default 30 minutes, configurable) and concurrent-session controls, so that abandoned sessions cannot be misused.
84. As an Admin, I want daily automated backups with a documented and tested restore procedure, so that recovery is real, not theoretical.
85. As a Government IT Administrator, I want three environments (development, staging, production) with separate databases, OpenAPI documentation, and configuration-driven (not hardcoded) Kano values, so that I can operate, replicate, and migrate the platform independently.

## Implementation Decisions

- Build against Supabase/Postgres using the verified initial schema and seed files already produced.
- Build the web platform with Next.js App Router, React, Supabase, and shadcn/ui.
- Keep privileged service-role operations, Resend email delivery, imports, and export generation in Next.js route handlers rather than the browser bundle.
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
- Build a deep permissions module that centralizes actor capabilities for app UI and server-side route handlers.
- Build a deep reporting module that wraps view/query access and filter composition.
- Build a deep import module that validates rows before writing.
- Build a deep export module that can output CSV, XLSX, and PDF from the same filtered report payload.
- Build a deep notification module that creates in-app notifications and queues Resend email delivery.
- Model a Monthly Submission Cycle per MDA per fiscal month bundling budget releases, expenditures, funding sources, activity progress, and release notes with states `draft`, `submitted`, `late`, `accepted`, `returned`.
- Treat **Budget Release Entries** as a separate write model from **Funding Entries**; the latter represent receipts (BHCPF, donors, IGR, etc.), the former represent internal releases against approved budget lines with memo references.
- Add `uncommitted_balance` and `activity_line` to Expenditure Entries.
- Add **Release Notes** as a first-class model; require one whenever a programme line has zero release for a cycle, and raise an unresolved-gap alert when missing.
- Add **Activity Progress** per AOP Activity per cycle with status (`completed | in_progress | not_started | blocked`) and mandatory reason when `blocked`.
- Add a configurable monthly submission deadline (default 5th of the following month) per fiscal year; derive `late` from `submitted_at` vs deadline.
- Generate a submission-confirmation PDF server-side at submit time, archived per cycle.
- Build a transparent **rules engine** with per-rule configuration (threshold, lookback, scope) and an evidence payload attached to every alert. Cover the six TOR functions: expenditure snapshot, variance flagging (default 20%), compliance alerts, lagging programme ranking, early warning signals (after ≥2 quarters), zero-release attribution.
- Build the **SMoH system-wide dashboard** with sector → MDA → programme → LGA → facility drill-down, quarterly breakdown as a first-class view, a Compliance Matrix, annotations and follow-up actions, and exports at every drill level.
- Add a **MoPB user role** restricted to a dedicated portal with monthly aggregate download (BIR-compatible Excel + JSON/CSV) and a Data Quality Flag Matrix.
- Add a **BIR pre-publication validation interface** for SMoH to reconcile MoPB's draft BIR against platform data.
- Audit logs must be **immutable** at the Postgres level — no role, including admin, may edit or delete rows.
- Adopt an **offline-tolerant** posture in v1 (draft auto-save + reconnection retry) and plan a PWA upgrade (service workers, IndexedDB mirror, sync queue, conflict surfacing) as a follow-up.
- Use an **open-source-only** stack with permissive licences (MIT/Apache 2.0/BSD); flag GPL dependencies. No proprietary platform licences post-handover.
- Publish **OpenAPI/Swagger** documentation for every server route handler.
- Keep all Kano-specific values (MDA list, programme codes, budgets, facilities, user accounts) in configuration or database, never hardcoded, so a different state can deploy by changing configuration only.
- Operate three environments (development, staging, production) with independent databases.

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
- Submission-cycle tests should cover draft save/resume, deadline-derived `late` state, zero-release release-note requirement, blocked-activity reason requirement, and PDF confirmation generation.
- Rules engine tests should cover variance threshold configuration, zero-release attribution, compliance alert generation at deadline, lagging programme ranking, and the early-warning rule's gating on ≥2 quarters of history. Each alert must include its evidence payload.
- MoPB tests should cover aggregate composition, BIR-compatible Excel layout, JSON/CSV parity, Data Quality Flag Matrix correctness, and MoPB role isolation.
- BIR validation tests should cover discrepancy detection between an uploaded draft BIR and platform aggregates.
- Security tests should cover authentication bypass, SQL injection, XSS, broken access control, sensitive data exposure (OWASP Top 10), audit log immutability, session inactivity timeout, and concurrent-session controls.
- Operational tests should cover daily backup creation and a documented end-to-end restore in staging.
- Load tests should cover 21 concurrent MDA submissions plus 5 concurrent SMoH users sustained for 30 minutes.
- Offline tests should cover draft capture without connectivity and clean resync on reconnection; PWA-mode tests, when adopted, should add sync-queue ordering and conflict-surfacing checks.
- CI should enforce ≥80% coverage on application code and run the full test suite on every commit.

## Out of Scope

- Negative/reversal entries.
- Formal correction-request workflow beyond direct admin/reviewer edits with audit reason.
- Mandatory attachments.
- Separate funding receipt/deposit method on Funding Entries (release-side detail lives on Budget Release Entries instead).
- MDA-specific core taxonomies for programme areas, funding sources, expenditure categories, payment methods, or statuses.
- Full effective-dated reference-data versioning.
- Non-PHC facility expenditure workflows beyond the general facility model.
- Applying the migration to a real Supabase project in this repo before a project is configured.
- Deployment to government-controlled infrastructure under a `*.kano.gov.ng` domain. This is a TOR requirement, but is **deferred for v1 implementation** while we build against managed Supabase. It is documented under "Deferred TOR Commitments" and must be revisited before formal IBP/SMoH handover.
- A full PWA offline-first build (service workers, IndexedDB mirror, sync queue, conflict surfacing). V1 provides offline-tolerant draft save and reconnection retry only; the PWA upgrade is planned.
- Black-box machine-learning analytics. The rules engine is configurable and transparent by design; any future ML must remain explainable and documented.

## Deferred TOR Commitments (Documented, Not Built In V1)

These are obligations from the IBP Terms of Reference (`/Users/kunle/Downloads/nocopojson/Kano_HFFD_TOR_Developer.docx.pdf`) that we are intentionally not implementing in the first build, but must plan for before handover:

- **Government-controlled hosting on `*.kano.gov.ng`** with the Kano State ICT Agency. V1 runs on managed cloud (Supabase + a Nigeria-region-compatible host). Before handover, capture an ADR for either self-hosted Supabase on government infrastructure or a Nigeria-based government-compliant cloud with a documented migration plan, and remove any non-permissive licences from the dependency register.
- **Three formal environments** (development, staging, production) with independently deployable databases, documented to a standard the ICT Agency can replicate without developer involvement.
- **Web Application Firewall (WAF) and rate limiting** in front of authentication and write endpoints.
- **Encryption at rest** for the database and **encryption in transit** for all API communications, with a documented key-management procedure.
- **OWASP Top 10 assessment** with submitted results.
- **Daily automated backups with off-site storage** and a documented restore procedure tested before go-live.
- **Load test**: 21 concurrent MDA submissions plus 5 concurrent SMoH users sustained for 30 minutes.
- **OpenAPI/Swagger documentation** published for every server route handler.
- **Bilingual training materials (English + Hausa)**: MDA Quick Reference, Submission Checklist, Troubleshooting Flowchart, SMoH Analytics User Guide, MoPB Integration Guide, IT Administrator Manual, plus video walkthroughs (≤10 min each).
- **Reference data verification gate**: joint developer + IBP sign-off on all 21 MDA codes, 24 programme areas, 12 expenditure categories, 8 funding sources, 44 LGAs, 450+ facilities, 2,046 AOP activities, and 2026 approved budgets before any MDA uses production data.
- **Replication Guide** section in the architecture document explaining what a different state would need to change to deploy its own instance.
- **PWA offline-first upgrade** (service workers, IndexedDB mirror, sync queue, conflict surfacing) once v1 is in pilot.
- **90-day post-handover support window** with SLAs (critical ≤4h, high ≤1 business day, medium ≤3 business days).

## Further Notes

- The workbook-generated seed files are executable and verified locally with Supabase stubs.
- The 2026 AOP sheet has duplicate activity-code/MDA pairs, so `source_row_number` is used to preserve workbook row identity.
- The `Budget 2026` sector-total row is intentionally excluded from `approved_budgets`; sector totals should be derived by reporting queries/views.
- The first scaffold should prioritize authenticated MDA forms, admin review, and reference-data management before advanced visual polish.
- The PRD adds a fourth role, **MoPB user**, alongside `admin`, `reviewer`, and `mda_user`. MoPB users are read-only and scoped to the MoPB portal (aggregate download, data quality flag matrix). They do not see MDA-level write surfaces.
- The Funding Entry model already in v1 represents **funding receipts** from external sources (BHCPF, donors, IGR, federal grant, etc.) and remains correct. The new **Budget Release Entry** model represents internal Kano releases against approved budget lines and is the basis for variance flagging and zero-release attribution. Both models share programme area, fiscal year, and MDA dimensions for unified reporting.
- The TOR's six fiscal-intelligence functions (snapshot, variance, compliance, lagging programmes, early warning, zero-release attribution) are implemented as configurable rules in a transparent engine. The earlier PRD line ruling out "configurable thresholds or rule builders" has been removed; TOR §4.2 Component 4 explicitly requires configurability.
- Hosting and infrastructure obligations from the TOR are captured under **Deferred TOR Commitments** above. V1 development should not block on them, but the architecture must not foreclose them (no proprietary licences, no hardcoded Kano values, no Supabase-managed-only assumptions in the application code).
