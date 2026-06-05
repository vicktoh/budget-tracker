# Implementation Plan

## Phase 1: Project Scaffold

- [x] Create a Vite/React web app shell directly in the repository root.
- [x] Configure Supabase browser client environment variables.
- [x] Configure shadcn/ui, Tailwind CSS, lucide icons, and semantic theme tokens from `DESIGN.md`.
- [x] Add authenticated client-side routing.
- [x] Add shared app shell for MDA users, Reviewers, and Admins with a collapsible sidebar and slim contextual top header.
- [x] Add base UI primitives for forms, tables, filters, dialogs, tabs, status badges, file upload controls, charts, notifications, empty states, and export actions.
- [x] Add Supabase Edge Function or equivalent serverless conventions for privileged workflows that require secrets, service-role access, Resend email delivery, imports, or export generation.

## Phase 1A: Visual Design System And shadcn Foundation

- [ ] Use `DESIGN.md` as the source of truth for the app's visual language: calm civic operations dashboard, light-first surfaces, neutral base colors, Kano health green, restrained earth-brown planning accents, subtle rounding, soft borders, and mostly flat elevation.
- [ ] Configure Tailwind/shadcn semantic tokens for background, foreground, card, popover, primary, secondary, muted, accent, destructive, border, input, ring, chart colors, and sidebar colors; avoid hardcoded raw colors in feature components.
- [ ] Use Inter or Geist Sans as the app font, with restrained weight usage: bold for page titles and key metrics, semibold for section titles/table headers, medium for labels/navigation, and regular for body/table text.
- [ ] Establish status badge variants for `pending`, `approved`, `processed`, and `rejected`; use amber for pending and data quality warnings, health green for approved, teal for processed, and muted red for rejected/errors.
- [ ] Keep the default geometry subtly rounded, approximately 6px to 8px for buttons, inputs, cards, badges, menus, and dialogs; use borders and background contrast before shadows.
- [ ] Build the app shell with shadcn `Sidebar`, `Breadcrumb`, `DropdownMenu`, `Avatar`, `Tooltip`, `Separator`, `Sheet`, and `ScrollArea`; use the sidebar for role-aware navigation and the top header for fiscal year, MDA/role context, notifications, and user menu.
- [ ] Build form foundations with shadcn `Form`/field patterns, `FieldGroup`, `Field`, `Input`, `Textarea`, `Select`, `Combobox` where searchable reference data is needed, `Calendar`, `Popover`, `Switch`, `Checkbox`, `RadioGroup`, `ToggleGroup`, `Alert`, and a consistent file-upload composition.
- [ ] Build table and review foundations with shadcn `Table`, `Badge`, `Button`, `DropdownMenu`, `Checkbox`, `Pagination`, `Tabs`, `Tooltip`, `Sheet`, `Dialog`, `AlertDialog`, `Skeleton`, and `Empty`; use compact rows, sticky headers where useful, and row-level actions.
- [ ] Build dashboard and insight foundations with shadcn `Card`, `Chart`, `Tabs`, `Select`, `Date Picker`, `Table`, `Badge`, `Progress`, `Tooltip`, and `Skeleton`; keep charts restrained and pair them with drill-down tables.
- [ ] Build admin/import/export foundations with shadcn `Card`, `Table`, `Alert`, `Progress`, `Dialog`, `AlertDialog`, `Tabs`, `Accordion`, `Badge`, `Button`, `DropdownMenu`, and `Empty`; show row-level import errors before writes and preserve selected export filters.
- [ ] Use `sonner` for toast feedback, shadcn `Alert` for persistent page-level feedback, `Skeleton` for loading states, and `Empty` for empty queues, missing reference data, no filtered results, and completed import/export lists.
- [ ] Use lucide icons inside buttons and navigation for recognizable actions such as add, save, upload, download, filter, search, approve, reject, process, export, notifications, audit history, and settings.
- [ ] Document component usage rules in the scaffold: use semantic color classes, `gap-*` spacing instead of `space-*`, full card composition, accessible dialog/sheet titles, and shadcn components before custom markup.

## Phase 2: Database Integration

- [ ] Apply `supabase/migrations/202605290001_initial_schema.sql`.
- [ ] Seed reference data, 2026 budgets, and 2026 AOP activities.
- [ ] Generate typed database access helpers.
- [ ] Add capability helpers for admin, reviewer, submitter, and assigned-MDA checks.
- [ ] Add common query helpers for active Reference Data dropdowns.

## Phase 3: MDA Entry Forms

- [ ] Build Funding Entry form.
- [ ] Build Expenditure Entry form.
- [ ] Implement derived fiscal year and quarter display.
- [ ] Implement dropdown-backed fields.
- [ ] Implement conditional PHC LGA/facility section.
- [ ] Implement optional AOP Activity and Expenditure Item dropdowns.
- [ ] Implement `Other` remarks requirement.
- [ ] Implement optional attachments.
- [ ] Implement pending-entry edit flow.

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
