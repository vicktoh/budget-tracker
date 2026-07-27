# Reports Hub — Implementation Plan

> **2026-07-15 update:** ADR 0005 removes ledger-status filtering and approved/processed-only actuals. Every active ledger row feeds reports. A BIR preview for one selected quarter exposes Admin-only publication, version metadata, and subsequent amendments; full-year previews cannot be published. Reviewer-facing text is now Viewer.

**Status:** Approved design, ready to build
**Design reference:** [UI proposal artifact](https://claude.ai/code/artifact/6499096a-f6e3-453f-8114-0290f3b3736c) · aligned to [DESIGN.md](../../DESIGN.md)
**Feature owner route:** `/admin/reports`

## Context

Today `/admin/reports` renders a single admin-only Budget Performance Report infographic
([admin-reports.tsx](../../src/components/reporting/admin-reports.tsx), 725 lines), and `/exports` is a
dead stub. We are turning the reports page into a **publications desk**: one hub that generates four
audience-specific documents from the same live ledger — a CSO accountability brief, the official
government BIR, an Auditor-General audit annex, and a Ministry of Budget & Planning execution review.
Each document has its own cover identity but the app chrome stays fully on the platform's design system
(Kano Health Green actions, white ledger cards, semantic status colours, sans typography).

Reports are still computed **client-side** from the existing `useReportingData` dataset (raw funding /
expenditure / budgets / AOP rows aggregated in [aggregate.ts](../../src/lib/reporting/aggregate.ts)); the
offline read-through cache continues to apply. Two new small DB tables persist editorial state, and a
faithful FY2025 seed unlocks year-over-year narrative.

### Decisions locked during design review

| Area | Decision |
|---|---|
| v1 scope | All 4 templates; the current BPR infographic is **absorbed** into the BIR template; `/exports` stub removed |
| Access | Admin **+ reviewer** generate & download; no public share links in v1 |
| CSO editorial | Rules + editable overrides — signals/headlines auto-computed, prose editable per period |
| CSO branding | **Configurable publisher** (IBP watchdog ↔ government brief): logo, palette, voice preset |
| BIR content | Mirror the official BIR structure: summary table → graphs → per-MDA classification tables → PHC §3 |
| Audit content | Three parts: registers + exceptions + reconciliation; vector tables + per-register CSV |
| M&BP content | Five sections: pro-rata execution, AOP variance, absorption, composition, release calendar |
| 2025 baselines | **Seed FY2025 into the DB**, anchor-faithful (per-MDA, Q4-heavy capital, published totals hit exactly) |
| Export tech | Hybrid client-side: DOM→canvas→jsPDF for visual reports; jspdf-autotable + CSV for audit |
| UI model | Gallery hub + lazy per-report preview routes with download actions |

> ⚠️ **Modeling caveat to carry through the build:** the FY2025 quarterly split and the CSO per-LGA
> figures are *modeled*, not published at that granularity. Every seeded row's `remarks` must cite its
> source table, and modeled distributions must reconcile exactly to the published annual/sector totals.

---

## Phase 0 — Foundations (data + access + scaffolding)

Low-risk wiring that everything else builds on. Ship and verify before templates.

### 0.1 FY2025 seed — `supabase/seeds/008_kano_2025_actuals.sql`
Anchor-faithful, mirroring the idiom of [007_kano_2026_q1_bpr.sql](../../supabase/seeds/007_kano_2026_q1_bpr.sql).
- **Approved budgets (FY2025):** per-MDA rows scaled from each MDA's 2026 share to hit the published
  **₦109.8bn** health total (2026 is ₦214.8bn, +96%). `on conflict (fiscal_year, mda_id)`.
- **Ledger actuals (FY2025):** funding + expenditure entries across Q1–Q4 reproducing every published
  2025 figure from `Kano Health Numbers.pdf` — Routine Immunisation ₦100.56m, the **Q4 capital spike**
  (85% full-year capital in Q4 → "uniform capital execution" finding), PHCMB ₦928.7m total, etc. Status
  `processed`; deterministic `KH25-*` reference/voucher prefixes; `remarks` cite source tables.
- **Funding allocations** for each expenditure entry (100% budget release) so pools balance — same pattern
  as 007's allocation block.
- Verify: `sum(expenditure) FY2025` = published sector total; per-MDA checks; zero over-allocation warnings.

### 0.2 Editorial tables — `supabase/migrations/<ts>_report_editorial.sql`
- **`report_publishers`** — `id, slug unique, name, logo_kind, palette jsonb, voice_preset, active`.
  Seed two rows: `ibp` (watchdog voice, navy) and `kano-gov` (commitments voice, green). RLS: read for
  authenticated admins/reviewers; write admin-only.
- **`report_narratives`** — `id, template text, fiscal_year int, quarter int null, section_key text,
  body text, edited_by → profiles, updated_at`, unique `(template, fiscal_year, quarter, section_key)`.
  RLS: read admins/reviewers; upsert admins/reviewers. Add to `app_private.audit_row_change()` coverage.
- Regenerate types: `supabase gen types` → [src/lib/db/types.ts](../../src/lib/db/types.ts).

### 0.3 Access + navigation
- [access.ts](../../src/lib/access.ts): add routes `"/admin/reports/cso" | "/admin/reports/bir" |
  "/admin/reports/audit" | "/admin/reports/mbp"` to `AppRoute` + `routeRoles`. Change `/admin/reports`
  (and the four children) to `["admin", "reviewer"]`, and add reviewer cases to `canAccessRoute`
  (reviewer allowed when `reviewableMdaIds > 0`, mirroring `/review`). Remove `/exports`.
- [navigation.ts](../../src/components/layout/navigation.ts): update the **Reports** item roles to
  `["admin", "reviewer"]`; **remove the Exports item**. Delete `app/(authenticated)/exports/` +
  `src/routes/…` export stub and its access-test references.

### 0.4 Report registry — `src/lib/reporting/report-templates.ts`
Single source of truth consumed by the hub and each preview:
```ts
export type ReportTemplateId = "cso" | "bir" | "audit" | "mbp";
export type ReportTemplate = {
  id: ReportTemplateId; route: AppRoute; title: string; audience: string;
  description: string; contents: string[]; hasNarrative: boolean; hasCsv: boolean;
  computeSignals: (view: ReportView) => ReportSignal[]; // for the hub chips
};
```

---

## Phase 1 — Shared engine + hub

### 1.1 Signals engine — `src/lib/reporting/signals.ts`
Pure, tested module. `SignalLevel = "strong" | "on_track" | "investigate" | "critical"` mapping to the
DESIGN.md status tokens (green / teal / amber / red). Rule helpers:
- `zeroRelease(category|programme)` → critical (e.g. overhead ₦0, family planning ₦0)
- `proRataBand(executionPct, quarter)` → strong ≥ target, on_track within band, critical far below
  (Q1 target = 25%)
- `yoyMultiple(2026, 2025)` → strong/context (e.g. immunisation 29×)
- `aopMappingGap()` → investigate/critical (0/384 activities mapped)
Output feeds both the hub chips and the in-document finding badges — one rule set, no duplication.

### 1.2 New aggregates — extend [aggregate.ts](../../src/lib/reporting/aggregate.ts)
Reuse existing 22 functions; add: `aggregateExceptions` (unlinked-to-AOP, allocation
mismatch, rejected) and `aggregateYoyComparison` (2026 vs seeded 2025). Keep them pure over
`ReportingDataset`; unit-test against fixtures.
> **Built:** `aggregateExceptions` + `aggregateYoyComparison` shipped in Phase 1.
> `aggregateAbsorption` and `aggregateReleaseCalendar` are **deferred to Phase 5** (their only
> consumer is the M&BP document body; the M&BP hub chip needs neither). Over-allocation-warning
> and post-approval-edit exceptions need `entry_data_quality_warnings` / audit rows, which aren't
> in the reporting dataset — folded into Phase 4 when the audit register extends the select.

> **Signals wiring:** `computeSignals` lives in `signals.ts` as `computeHubSignals(templateId, …)`
> rather than as a method on each registry entry — keeps [report-templates.ts](../../src/lib/reporting/report-templates.ts)
> a pure metadata module and avoids a metadata→aggregate dependency.

### 1.3 Hub page — rebuild `admin-reports.tsx` → hub shell
- Keep `useReportingData(supabase, {})` + `useReportFilters()` (URL-backed, [url-state.ts](../../src/lib/reporting/url-state.ts)).
- Shared **PeriodSelector** (extract the existing one) drives all four cards.
- Render four `ReportCard`s from the registry; each runs `computeSignals(view)` for live chips.
- New components under `src/components/reporting/reports-hub/`: `ReportCard`, and CSS-drawn covers
  `CsoCover`, `BirCover`, `AuditCover`, `MbpCover` (SVG/CSS, period- and publisher-aware).
- Cards link to preview routes; extras conditional (`Edit narrative` on CSO, `CSV ▾` on Audit).

### 1.4 Routes scaffolding
Follow the existing thin-wrapper pattern for each of cso/bir/audit/mbp:
- `app/(authenticated)/admin/reports/<id>/page.tsx` → `<Admin<Id>ReportRoute />`
- `src/routes/admin-report-<id>.tsx` → re-export from `src/components/reporting/reports/<id>/…`
- Each preview component `dynamic()`-imports its heavy body so the hub bundle stays lean.
- Shared `ReportDocumentShell` (toolbar: back, title, period, download; `data-pdf-exclude` on controls;
  reuses `exportElementToPdf` from [export-pdf.ts](../../src/lib/reporting/export-pdf.ts)).

**Verify Phase 1:** hub renders with live chips for FY2026 Q1; reviewer login sees Reports; period
changes recompute chips; four preview routes reachable (bodies can be stubs).

---

## Phase 2 — Official BIR template (absorbs current BPR) ✅

`src/components/reporting/reports/bir/bir-report.tsx`, restructured into the government document:
1. Document header (crest, "Kano State Government", title, period).
2. **Table 1 — Budget Implementation Summary** by economic class (`aggregateEconomicSummary`).
3. **1.F Summary graphs** — quarterly performance + composition (reused charts).
4. **Table 4 — Expenditure by Administrative Classification** (per-MDA, economic split, %perf, balance
   via `aggregateAdminClassification`).
5. **Table 3 — Revenue by Source** (`aggregateFundingBySource`).
6. **Section 3 — Primary Healthcare** (PHCMB-scoped economic + programme tables;
   `resolvePhcmbMdaId` in [mda-lookup.ts](../../src/lib/reporting/mda-lookup.ts)).

Economic classification: budget uses the clean approved-budget split; actual is classified from
expenditure categories ([economic-class.ts](../../src/lib/reporting/economic-class.ts)). The ledger has no
NCOA dimension, so the aggregate keeps a 4th `other` bucket; the BIR presentation folds `other` into
capital (this health dataset's `other` is entirely PHC capital projects — BIR Table 24), matching the
published report. Reusable [ReportTable](../../src/components/reporting/reports/report-table.tsx) for all
formal tables.

**Verified:** classification reconciles to the published/seeded ledger to the kobo — personnel
₦6,413,798,906.85, overhead ₦0, capital ₦13,917,554,184.17, total ₦20,331,353,091.02 (9.5% execution);
PHCMB total ₦3,350,448,772.48. `tsc` clean · 248 tests (3 new: classification + admin table) · build green.
Not visually screenshotted — the page is auth-gated and I don't enter credentials.

---

## Phase 3 — CSO template + narrative & publisher ✅ (built)

> **Built:** `src/components/reporting/reports/cso/cso-report.tsx` (cover, signal-coloured findings
> with editable prose, programme-at-a-glance, recommendations, watchlist, verified-figures YoY table),
> `publisher-switch.tsx`, `use-cso-narratives.ts`; `src/lib/db/report-publishers.ts` +
> `report-narratives.ts`; `src/lib/reporting/cso-content.ts` (auto-drafts + YoY). Findings/headlines
> come from the shared `computeFindings` (enriched with headline/context in `signals.ts`).
>
> **Verified:** `tsc` clean · 253 tests (new: `reporting-cso.test.ts`) · build green (CSO 6.57 kB).
> Persistence checked directly via MCP: both publishers load (ibp/watchdog, kano-gov/commitments);
> the narrative upsert round-trips through the `(template, fiscal_year, quarter, section_key)` unique
> constraint. The interactive re-skin/edit→save→PDF flow wasn't screenshotted (auth-gated; no credentials).
>
> **Two notes for follow-up:**
> 1. supabase-js's generic `from()` resolves the two hand-authored tables to `never` (the `Database`
>    type in `db/types.ts` is hand-written, not generated). Worked around with a localised typed cast in
>    both db modules — same pattern as `asRpc` in `db/review.ts`. A future `supabase gen types` would
>    remove the need.
> 2. **`src/lib/access.ts` was changed (outside these phases) to role-based reviewer checks** —
>    `/review` and the report routes now return `isReviewer(profile)` instead of
>    `reviewableMdaIds(profile).length > 0`. This means an `mda_user` with a per-MDA reviewer membership
>    no longer gets route access to `/review` or reports. I reconciled two pre-existing access tests to
>    match; **please confirm that role-based reviewer routing was intended** (vs a membership-based grant).

`src/components/reporting/reports/cso/`.
- **Publisher:** `src/lib/reporting/publishers.ts` loads `report_publishers`; a `PublisherSwitch` in the
  toolbar swaps cover/branding/voice preset live (default from a setting; per-download override).
- **Narrative:** `src/lib/db/report-narratives.ts` (load/upsert by template+period+section). Auto-drafts
  generated from signals; admin edits saved with `edited_by`; badges show auto-draft vs edited. Editing
  rail matches the mock (locked computed headline + editable prose with green focus ring).
- **Document:** cover, "Ten Findings" (signal-coloured cards), programme-at-a-glance table, recommendations,
  Q2 watchlist, all-verified-figures table. YoY callouts pull from `aggregateYoyComparison` (needs 0.1).
- **Verify:** switch publisher re-skins live; edit a section, reload, download → edit persists in PDF.

---

## Phase 4 — Audit template

`src/components/reporting/reports/audit/`. Add dependency **`jspdf-autotable`**.
- Sections: A) expenditure & funding registers (voucher-level), B) exceptions (`aggregateExceptions`),
  C) reconciliation (funding received vs allocated per MDA × source).
- Vector-text PDF via jspdf-autotable (searchable, small) — a separate path from the canvas pipeline.
- `src/lib/reporting/export-csv.ts` — hand-rolled CSV per register; `CSV ▾` menu downloads each section.
- Tables follow DESIGN.md table conventions (compact, dividers, hover, tabular naira).
- **Verify:** register row counts match `select count(*)` for the period; CSV columns mirror PDF; exception
  list matches `entry_data_quality_warnings` + unlinked view.

---

## Phase 5 — Ministry of Budget & Planning template

`src/components/reporting/reports/mbp/`. Earth-brown identity. Five sections from aggregates:
pro-rata execution bullets per MDA (`aggregateBudgetVsActual` + `proRataBand`), AOP planned-vs-actual
variance (`aggregateAopPlannedVsActual`), absorption (`aggregateAbsorption`), composition
(`aggregateBudgetComposition`), release calendar (`aggregateReleaseCalendar`). Canvas→jsPDF.
- **Verify:** pro-rata flags match hub chips; absorption ties released − spent to the ledger.

---

## Phase 6 — Polish, tests, verification

- Unit tests: `signals.ts` + new aggregates against `reporting-fixtures.ts` (extend with 2025 rows).
- Offline: all reports read `useReportingData`; confirm `OfflineDataNotice` shows on cached data.
- a11y: keyboard focus on toolbar/rail controls, `prefers-reduced-motion` on the publisher transition.
- `npm test`, `npm run build`, and drive each report end-to-end in the running app (see /run).

---

## Files at a glance

**New:** `supabase/seeds/008_kano_2025_actuals.sql`; `supabase/migrations/<ts>_report_editorial.sql`;
`src/lib/reporting/{signals,report-templates,publishers,export-csv}.ts`;
`src/lib/db/report-narratives.ts`; `src/components/reporting/reports-hub/*`;
`src/components/reporting/reports/{cso,bir,audit,mbp}/*`; `src/routes/admin-report-{cso,bir,audit,mbp}.tsx`;
`app/(authenticated)/admin/reports/{cso,bir,audit,mbp}/page.tsx`.

**Modified:** `src/components/reporting/admin-reports.tsx` (→ hub); `src/lib/reporting/aggregate.ts`;
`src/lib/access.ts`; `src/components/layout/navigation.ts`; `src/lib/db/types.ts` (regen);
`src/test/*` (access, new aggregates, fixtures); `package.json` (+jspdf-autotable).

**Removed:** `app/(authenticated)/exports/`, its route wrapper, `/exports` from access + nav.
