# Implementation Plan

## Phase 1: Project Scaffold

- [x] Create a Next.js App Router web app shell directly in the repository root.
- [x] Configure Supabase browser and server client environment variables.
- [x] Configure shadcn/ui, Tailwind CSS, lucide icons, and semantic theme tokens from `DESIGN.md`.
- [x] Add authenticated App Router pages and route guards.
- [x] Add shared app shell for MDA users, Reviewers, and Admins with a collapsible sidebar and slim contextual top header.
- [x] Add base UI primitives for forms, tables, filters, dialogs, tabs, status badges, file upload controls, charts, notifications, empty states, and export actions.
- [x] Add Next.js route handler conventions for privileged workflows that require secrets, service-role access, Resend email delivery, imports, or export generation.

## Phase 1A: Visual Design System And shadcn Foundation

- [x] Use `DESIGN.md` as the source of truth for the app's visual language: calm civic operations dashboard, light-first surfaces, neutral base colors, Kano health green, restrained earth-brown planning accents, subtle rounding, soft borders, and mostly flat elevation.
- [x] Configure Tailwind/shadcn semantic tokens for background, foreground, card, popover, primary, secondary, muted, accent, destructive, border, input, ring, chart colors, and sidebar colors; avoid hardcoded raw colors in feature components.
- [x] Use Inter or Geist Sans as the app font, with restrained weight usage: bold for page titles and key metrics, semibold for section titles/table headers, medium for labels/navigation, and regular for body/table text.
- [x] Establish status badge variants for `pending`, `approved`, `processed`, and `rejected`; use amber for pending and data quality warnings, health green for approved, teal for processed, and muted red for rejected/errors.
- [x] Keep the default geometry subtly rounded, approximately 6px to 8px for buttons, inputs, cards, badges, menus, and dialogs; use borders and background contrast before shadows.
- [x] Build the app shell with `Sidebar`, `Breadcrumb`, `DropdownMenu`, `Avatar`, `Tooltip`, `Separator`, `Sheet`, and `ScrollArea`-equivalent overflow regions; use the sidebar for role-aware navigation and the top header for fiscal year, MDA/role context, notifications, and user menu.
- [x] Build form foundations with `Form`/field patterns, `FieldGroup`, `Field`, `Input`, `Textarea`, `Select`, `Combobox` (searchable reference data), `DatePicker`, `Popover`, `Switch`, `Checkbox`, `RadioGroup`, `Alert`, and a consistent file-upload composition. (`Calendar` is deferred — `DatePicker` currently wraps the native control.)
- [x] Build table and review foundations with `Table`, `Badge`, `Button`, `DropdownMenu`, `Checkbox`, `Pagination`, `Tabs`, `Tooltip`, `Sheet`, `Dialog`, `AlertDialog`, `Skeleton`, and `Empty`; use compact rows, sticky headers where useful, and row-level actions.
- [x] Build dashboard and insight foundations with `Card`, `Chart` (`MiniBarChart`), `Tabs`, `Select`, `DatePicker`, `Table`, `Badge`, `Progress`, `Tooltip`, and `Skeleton`; keep charts restrained and pair them with drill-down tables.
- [x] Build admin/import/export foundations with `Card`, `Table`, `Alert`, `Progress`, `Dialog`, `AlertDialog`, `Tabs`, `Accordion`, `Badge`, `Button`, `DropdownMenu`, and `Empty`.
- [x] Use `sonner` for toast feedback, `Alert` for persistent page-level feedback, `Skeleton` for loading states, and `Empty` for empty queues, missing reference data, no filtered results, and completed import/export lists.
- [x] Use lucide icons inside buttons and navigation for recognizable actions such as add, save, upload, download, filter, search, approve, reject, process, export, notifications, audit history, and settings.
- [x] Document component usage rules in `docs/component-usage.md`: semantic color classes, `gap-*` spacing instead of `space-*`, full card composition, accessible dialog/sheet titles, and primitives before custom markup.

## Phase 2: Database Integration

- [x] `supabase/migrations/202605290001_initial_schema.sql` is the source of truth for the schema. Application against a remote Supabase project is left as a deploy-time step (no project linked yet).
- [x] Reference, 2026 budget, and 2026 AOP seeds exist under `supabase/seeds/`. Application is a deploy-time step.
- [x] Hand-authored typed database access (`src/lib/db/types.ts`) covering tables and reporting views. `Database` type is wired into `createBrowserClient`/`createServerClient`.
- [x] Capability helpers for admin, reviewer, submitter, and assigned-MDA checks live in `src/lib/access.ts`, mirroring the Postgres `app_private.current_user_*` helpers. Covered by `src/test/access.test.ts`.
- [x] Common query helpers for active Reference Data dropdowns live in `src/lib/db/reference-data.ts`; profile + membership loading lives in `src/lib/db/memberships.ts`.

## Phase 3: MDA Entry Forms

- [x] Build Funding Entry form.
- [x] Build Expenditure Entry form.
- [x] Implement derived fiscal year and quarter display. *(Funding and Expenditure both render the read-only "FY YYYY · Q#" chip from `deriveFiscalPeriod`.)*
- [x] Implement dropdown-backed fields. *(Funding: MDA, programme area, funding source. Expenditure: MDA, programme area, expenditure category, expenditure item, payment method, LGA, PHC facility, AOP activity — all via `Combobox` and active reference data.)*
- [x] Implement conditional PHC LGA/facility section. *(Switch toggles the section; LGA filter cascades to facility; non-PHC clears both in draft and validated output.)*
- [x] Implement optional AOP Activity and Expenditure Item dropdowns. *(AOP filtered by selected MDA + derived fiscal year; Expenditure Item filtered by selected category; both optional.)*
- [x] Implement `Other` remarks requirement. *(Funding: programme area / funding source. Expenditure: programme area / expenditure category / payment method.)*
- [ ] Implement optional attachments.
- [x] Implement pending-entry edit flow. *(Funding via `canEditFundingEntry`; Expenditure via `canEditExpenditureEntry` + `updatePendingExpenditureEntry` scoped to `status = 'pending'`.)*

## Phase 4: Review Workflow

- [ ] Build Reviewer/Admin queues for Funding Entries and Expenditure Entries.
- [ ] Add status transitions for pending, approved, processed, rejected.
- [ ] Require rejection comments.
- [ ] Require audit reason for reviewed-entry edits.
- [ ] Show audit history, comments, attachments, and Data Quality Warnings.
- [ ] Send in-app notifications and Resend email events for workflow changes.

## Phase 5: Reference Data Management

- [ ] Build admin CRUD for MDA Types and MDAs.
- [ ] Build admin CRUD for programme areas, funding sources, expenditure categories, expenditure items, payment methods, statuses, LGAs, and facilities.
- [ ] Use deactivate/reactivate instead of destructive deletes for referenced values.
- [ ] Build Reference Value Request submission and admin review.

## Phase 6: Planning And Imports

- [ ] Build Approved Budget management by fiscal year and MDA.
- [ ] Build AOP Activity management by fiscal year and MDA.
- [ ] Build Admin Import screens for reference data, approved budgets, AOP activities, and historical ledger migration.
- [ ] Show row-level import errors before writing data.
- [ ] Reject duplicate historical funding and expenditure rows by scoped reference/voucher uniqueness.

## Phase 7: Dashboards And Insights

- [ ] Build MDA Dashboard scoped to assigned MDAs.
- [ ] Build Admin Insights with all submitted entries by default.
- [ ] Add status filters for operational and official-reporting views.
- [ ] Add budget vs actual, funding source mix, expenditure category mix, programme-area summary, PHC LGA/facility summaries, AOP planned-vs-actual, and unlinked expenditure.
- [ ] Add Data Quality Warning queues.

## Phase 8: Exports

- [ ] Add CSV exports for raw and filtered ledgers.
- [ ] Add XLSX exports for ledgers and insight tables.
- [ ] Add PDF exports for dashboard summaries and filtered admin reports.
- [ ] Persist export jobs and downloadable file metadata.

## Phase 9: Hardening

- [ ] Add regression tests around validation, permissions, imports, reporting, notifications, and exports.
- [ ] Run Supabase advisors when a real Supabase project is configured.
- [ ] Tighten attachment storage policies after frontend storage paths are finalized.
- [ ] Add seed regeneration checks to development workflow.

## Phase 10: TOR Alignment — Submission Cycle And Compliance

These items come from the IBP/Kano TOR (`Kano_HFFD_TOR_Developer.docx.pdf`) and the workbook's monthly fund-flow framing. They are not yet reflected in `docs/prd.md` and need to be added to the PRD before implementation. See "PRD Updates Required" at the bottom of this file.

- [ ] Model a **Monthly Submission Cycle** per MDA per fiscal month (`mda_monthly_submissions`) with states `draft`, `submitted`, `late`, `accepted`, `returned`.
- [ ] Configurable monthly deadline (default 5th of the following month) per fiscal year, with `late` derived from submitted_at vs deadline.
- [ ] Submission form bundles the TOR's five categories in one cycle: budget releases, expenditures, funding sources, activity-level progress, release notes.
- [ ] **Budget Release Entry** model (separate from Funding Entry receipts) capturing programme line, funding source, release date, amount, memo reference. Distinct from third-party funding receipts.
- [ ] Add `uncommitted_balance` (nullable, ≥0) and `activity_line` reference to Expenditure Entries to match TOR's expenditure shape.
- [ ] **Release Note** model: mandatory free-text explanation when a programme line shows zero release for a cycle. Auto-flag missing release notes as "unresolved gap".
- [ ] **Activity Progress** model on AOP Activities per cycle: status `completed | in_progress | not_started | blocked`, with mandatory `blocked_reason` when `blocked`.
- [ ] Draft auto-save for in-progress cycles; resume without data loss.
- [ ] **Submission confirmation PDF** generated server-side at submit time, archived per cycle, downloadable by submitter and reviewers.
- [ ] **Compliance Matrix** view (admin/SMoH): MDA × month grid showing `not started | draft | submitted | late | accepted | returned`.
- [ ] Configurable Submission Window per fiscal year with deadline, grace period, and lock date.

## Phase 11: TOR Alignment — Fiscal Intelligence Layer

The TOR mandates six analytics functions delivered as a transparent rules engine, not a black-box model. Each output must surface the data behind it. **This contradicts the current PRD's "Out of Scope: Configurable high-value thresholds or rule builders" — that line must be removed/updated.**

- [ ] Build a **rules engine** with per-rule configuration (threshold, lookback window, scope) and an "evidence" payload attached to every generated alert.
- [ ] **Expenditure snapshot** generator: plain-language summary per MDA per cycle (what was spent, at what rate, vs which programme lines). Director-readable.
- [ ] **Variance flagging** rule: actual release vs approved budget per programme line; configurable threshold (default 20%); flag includes approved, actual, variance %, and MDA explanation field.
- [ ] **Compliance alerts**: generated automatically after each monthly deadline — on-time, late, missing — visible without manual action.
- [ ] **Lagging programme identification**: continuous ranking of all 24 programme areas × 21 MDAs by execution rate; surface bottom quartile.
- [ ] **Early warning signals**: enabled after ≥2 quarters of accumulated history; pattern-based detection of execution trajectories that historically predict year-end gaps. Each warning shows its historical basis.
- [ ] **Zero-release attribution**: for every programme line with zero release in a month, check for a release note; if missing → unresolved gap alert visible to SMoH.
- [ ] Every alert/flag is annotatable; SMoH can record a follow-up action and assign it.
- [ ] Schedule rule evaluation per submission and per deadline tick; persist alert rows so the SMoH dashboard reads precomputed results, not on-the-fly aggregates.

## Phase 12: TOR Alignment — SMoH And MoPB Surfaces

- [ ] **SMoH System-Wide Dashboard** mirroring the workbook `Dashboard` sheet: sector totals, funding by source, expenditure by category, MDA-by-MDA comparison, **quarterly breakdown** (first-class), 24 programme-area rollups.
- [ ] Drill-down hierarchy: sector → MDA → programme area → LGA → facility (matches workbook sheet structure).
- [ ] Admin annotations and "flag for follow-up" on any record, with assignee, due date, and resolution.
- [ ] **MoPB monthly aggregate feed**: scheduled monthly export compiled across all MDAs in BIR administrative classification format.
- [ ] Aggregate available in **Excel (BIR-matching layout)** and **machine-readable JSON/CSV**.
- [ ] **Data Quality Flag Matrix** on the MoPB feed showing per-MDA `complete | partial | absent` and the count of unresolved gaps.
- [ ] **MoPB access portal** (separate role + restricted dashboard) for downloading aggregates and reviewing MDA-level summaries.
- [ ] **BIR pre-publication validation interface**: upload MoPB's draft BIR, compare against platform data, highlight discrepancies, export reconciliation.

## Phase 13: TOR Alignment — Offline-First PWA

The TOR mandates offline-first operation through Service Workers + IndexedDB. Current Next.js + Supabase stack is not offline-first by default. Either adopt PWA patterns or document an explicit waiver with IBP.

- [ ] Decide and document: full PWA offline-first vs. degraded "offline draft" mode. Capture in an ADR.
- [ ] If PWA: install a service worker, app shell caching, and IndexedDB store mirroring submission cycle, reference data, and draft entries.
- [ ] **Sync queue** for offline operations, processed in order on reconnection.
- [ ] **Conflict detection** when the same record is changed offline and online; surface to the user instead of silent overwrite.
- [ ] Document minimum device specs (Windows 7+, Chrome 80+/Firefox 75+/Edge 80+, 1024×768, 2G page-load budget) and add a test matrix.

## Phase 14: TOR Alignment — Security And Operations (V1 Scope)

V1 builds the application-level security and operational guarantees we can ship without government hosting. Infrastructure-level TOR commitments (`*.kano.gov.ng` hosting, three formal environments, WAF, off-site backups, OWASP scan, load test, OpenAPI publication, bilingual training materials) are captured under **Deferred TOR Commitments** in `docs/prd.md` and must be revisited before formal handover. They are documented now so the architecture does not foreclose them.

- [ ] **HTTPS** everywhere with valid TLS in whatever environment we deploy to.
- [ ] **Session management**: token expiry, configurable inactivity timeout (default 30 min), concurrent-session controls.
- [ ] **Immutable audit log** (`audit_events`) — no role, including admin, can edit or delete rows. Enforce at the Postgres level via revoked UPDATE/DELETE on the table.
- [ ] **Code coverage ≥80%** enforced in CI on application code; full test suite on every commit.
- [ ] **Replication readiness**: every Kano-specific value (MDA list, programme codes, budget figures, user accounts, facility list) lives in config/database, never hardcoded.
- [ ] Keep the dependency surface **open-source with permissive licences** (MIT/Apache 2.0/BSD); flag any GPL or proprietary dependency in the README.
- [ ] No code paths that assume Supabase-managed-only features (so a self-hosted Supabase migration stays possible).
- [ ] Capture an ADR titled "Hosting Strategy" recording: v1 runs on managed cloud; TOR-required `*.kano.gov.ng` deployment is deferred; the migration approach (self-hosted Supabase on government infrastructure or a Nigeria-based government-compliant cloud) will be selected before handover.

## Phase 15: TOR Alignment — Reference Data Verification And Handover

- [ ] **Reference data verification gate**: a written sign-off step where developer + IBP cross-check all 21 MDA codes, 24 programme areas, 12 expenditure categories, 8 funding sources, all 44 LGAs, all 450+ facilities, all 2,046 AOP activities, and 2026 approved budgets against the workbook before any MDA uses production.
- [ ] **Architecture document (formal deliverable)**: cross-reference every database table to a workbook sheet.
- [ ] **Workbook Review Report** signed off before architecture begins (already largely in `docs/workbook-study.md`; add an "IBP review status" header).
- [ ] **IT Administrator Manual**, **MDA Quick Reference (EN + Hausa)**, **MDA Submission Checklist**, **MDA Troubleshooting Flowchart**, **SMoH Analytics User Guide**, **MoPB Integration Guide**, **Video Walkthroughs (≤10 min each)** — produced and stored under `docs/handover/`.
- [ ] **Handover Package**: code repo access, env-config records, dependency/licence register, schema + migration scripts, OpenAPI docs, test data, issue register, handover certificate template.

## PRD Updates Required (driven by the TOR)

Before any of Phases 10–15 begin, `docs/prd.md` needs the following changes. These are not yet captured in the PRD:

- [ ] Add user stories for the **monthly submission cycle**, **release notes**, **activity progress**, **draft auto-save**, and **submission confirmation PDF**.
- [ ] Add user stories for the **MoPB portal**, **MoPB aggregate feed**, **BIR pre-publication validation**, and **Data Quality Flag Matrix**.
- [ ] Add user stories for SMoH **system-wide dashboard**, drill-down, **compliance matrix**, **annotations / follow-up actions**, and **quarterly breakdown** as first-class views.
- [ ] Add user stories for the six **fiscal intelligence** outputs (snapshot, variance, compliance, lagging programmes, early warning, zero-release attribution).
- [ ] Add **offline-first / PWA** as an explicit decision in Implementation Decisions, or capture a waiver.
- [ ] Add **Budget Release Entries** as a separate write model (distinct from Funding Entries which represent receipts), and add `uncommitted_balance` + `activity_line` to Expenditure Entries.
- [ ] Add a **MoPB user role** (read-only access to aggregate feed + their portal) alongside `admin`, `reviewer`, `mda_user`.
- [ ] **Remove or revise** the Out-of-Scope item "Configurable high-value thresholds or rule builders" — the TOR requires a configurable variance threshold (default 20%) and a transparent rules engine.
- [ ] Add Implementation Decisions for: open-source-only stack with permissive licences, configuration-driven Kano values, three environments at deployment time, 80% test coverage, immutable audit log.
- [ ] Add Testing Decisions for: submission-cycle flows, rules-engine evidence payloads, MoPB aggregate/BIR validation, audit-log immutability, session timeout and concurrent sessions, draft offline capture and resync.
- [ ] Add an explicit **Deferred TOR Commitments** section listing items not built in v1 but required before handover: `*.kano.gov.ng` hosting, WAF, off-site backups with tested restore, OWASP Top 10 assessment, load test (21 MDA + 5 SMoH for 30 min), OpenAPI/Swagger publication, bilingual (EN + Hausa) training materials, video walkthroughs, reference-data verification gate, PWA offline-first upgrade, 90-day post-handover SLA.
