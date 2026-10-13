# AI assisted data ingestion

Status: proposed implementation specification, prepared 13 October 2026. The current Imports page is a placeholder and the current AI assistant is read-only. This specification prepares the feature for implementation; it does not claim a working importer exists.

## User outcome

An MDA user uploads an Excel workbook, CSV or PDF, understands what it contains, resolves missing or ambiguous information, reviews exactly what will be inserted and confirms the operation. Invalid rows remain outside reportable data. AI helps extract, classify, map and ask questions; application code and database rules decide what can be saved.

The primary rule is to identify what each row represents before choosing a destination. A transaction, monthly return, annual budget, AOP plan, facility and quarterly aggregate cannot be interchanged.

## Experience from upload to receipt

1. **Upload and scope.** Select files, permitted MDA(s) and intended data type, or choose Detect. Show accepted formats and configured file/page/row limits. Preserve original files privately with hashes. An upload creates an import draft, never a ledger entry.
2. **Inspect.** Validate real file format, readability, encryption and archive limits. Inventory sheets/pages, headers, formulas, hidden rows/sheets and likely data blocks. Report unreadable portions; never quietly report a partially parsed file as complete.
3. **Classify.** Show detected transaction ledgers, monthly returns, planning/reference data and report summaries separately. Ask which periods and sheets to include. Keep totals/subtotals as reconciliation evidence rather than additional detail records.
4. **Map.** Propose source-column-to-field mappings and known MDA/source/category aliases. Display original text beside the resolved reference. Use exact administrative codes when available; fuzzy matches require confirmation when ambiguous.
5. **Clarify.** Ask grouped questions tied to specific rows/cells/pages. Permit a one-row answer, selection-wide answer or explicitly confirmed default. Re-run affected validation after every answer. “I don't know” leaves the relevant rows blocked or excluded.
6. **Review.** Show eligible/blocked/excluded/duplicate counts, totals by ledger/MDA/period/source/category, missing fields, proposed values and source evidence. Let the user inspect every eligible row. Show insert/update/no-change separately; default MDA ledger imports to insert-only.
7. **Confirm.** The user presses an explicit button such as “Insert 42 expenditure entries totalling NGN 8,500,000.” Freeze the selected revision and plan hash. Recheck permissions, publication locks, duplicates and reference validity on the server at commit time.
8. **Receipt.** Return actual committed counts/totals, entry IDs and a downloadable issue report with sheet/row/page provenance. Excluded or failed records stay visible in the batch; retry only records whose commit state is known. Link to the normal entry register.

Draft imports never affect reports. A confirmed, valid transaction import follows the same immediate-reportability rule as manual entry; it does not introduce a Viewer approval queue.

## Source families already available

The corpus below combines project artifacts, files present locally and recovered earlier chats. It is representative, not a claim that every attachment from every past chat has been recovered. Preserve originals; use controlled copies for evaluation.

| Source | Observed structure or earlier finding | Required handling |
| --- | --- | --- |
| Kano Health Finance Tracker.xlsx | 22 sheets including Funding Log, Expenditure Log, LOOKUP, Budget 2026 and AOP 2026. | Classify sheets independently. Ignore dashboard formulas as transactions; map ledger rows to the correct manual-entry fields. |
| 2026 MDAs BUDGET TRACKING TEMPLATE-7.xlsx and -8.xlsx | Template-8 has 23 sheets: individual MDAs plus Q1/Q2. Earlier analysis found broken shared-string relationships and a distinct SMOH layout. | Recognise workbook corruption separately from bad row data; offer a repaired copy or explicit re-save workflow with a repair log. Parse per-sheet headers; do not apply one positional schema to every MDA. |
| Template-8 summary versus detail | Prior comparison found SMOH capital summary/detail differences and missing personnel detail; other MDAs also differed. | Ask which source governs, preserve both amounts and the variance, and block disputed values until resolved. Do not silently prefer a summary or overwrite current records. Recompute from originals before any commit; historical figures are not current database facts. |
| KANO STATE HEALTH SECTOR APPROVED BUDGET.xlsx | Personnel, overhead and capital sheets. | Route to admin planning reconciliation, keeping administrative/economic codes as text and preserving project distinctions. Do not treat appropriations as receipts. |
| SMoH RESOURCE MAPPING.xlsx | Sheet1, NO FUNDING SOURCE, GOVT, PARTNERS, JOINT FUNDING. | Route to AOP/planning records; repeated classifications/sheets may describe the same activities. Planned funding is not cash received. Missing sources need explicit resolution. |
| SPHCMB_2026_AOP.xlsx | SPHCMB sheet. Existing seed tooling preserves activity/source-row identity. | Preserve repeated activity codes when they identify distinct source rows; don't collapse genuine activities. |
| Q2 2026 Health Component.xlsx | Eight sheets with overview, revenue, total expenditure, personnel, overhead, capital and PHC views. | Recognise overlapping aggregates; avoid adding total expenditure to its component breakdown or adding PHC to the same statewide total again. |
| Kano Q1/Q2 2026 and Q1-Q4 2025 budget performance PDFs | Published period summaries; previous Q1 review described image-based tables and different printed/file page numbers. | Extract text where reliable; use page images/OCR when necessary. Keep table/page provenance, distinguish quarter-only from YTD and avoid inventing transaction dates/vouchers. |
| GRID3 health facilities CSV | 51,022 rows; state, LGA, facility identifiers/names, classification and coordinates, including disagreement fields. | Treat as reference data. Filter Kano before matching, preserve identifiers, resolve LGA/facility ambiguity and map facility type deliberately. Admin-only publication into reference data. |

Files are under `/Users/kunle/Downloads/` and `/Users/kunle/Downloads/nocopojson/`. Earlier chats used: **Plan Q1 2026 Budget Seeding** (12 July), **Update Q1 data by MDA** (16 July) and **Investigate Q2/Q3 gap data** (16 July). Earlier analyses are evidence of test cases, not authority to repeat historical database writes.

## Destination and authorization rules

| Detected data | Destination | Who may confirm |
| --- | --- | --- |
| Individual receipts with dates and references | Funding entries | MDA funding submitter for that MDA, or Admin. |
| Individual payments with complete fields/allocations | Expenditure entries plus allocations | MDA expenditure submitter for that MDA, or Admin. Facility support must enforce assigned-facility scope. |
| Budget-line monthly actuals | Existing monthly_expenditure_tracking model | Admin initially. Current database policies allow admin writes only; do not bypass them through an elevated importer. MDA draft upload/review can precede Admin confirmation until scoped write rules are deliberately implemented. |
| Annual budget lines/totals | Approved budgets and approved budget lines | Admin. Show proposed updates and variances. |
| AOP plans/costs | AOP activities and supported planning relationships | Admin. |
| MDAs, facilities, categories | Reference-data staging and reconciliation | Admin. |
| Quarterly published aggregates | Report-snapshot/reconciliation draft | Admin; a dedicated snapshot persistence path must be designed before commit. Never fabricate mandatory ledger details. |

The existing monthly tracking migration explicitly separates MDA monthly returns from published BPR figures. Preserve this distinction in previews and reporting. A zero monthly return is valid data; a blank/missing cell is not a zero submission. Routine ledger values must remain greater than zero.

New MDA import access must depend on the same granular grants as manual forms. Merely changing `/imports` from Admin-only in the UI is insufficient. Batch ownership, staging-row reads, source-file access and confirmation all need server-enforced scope.

## Clarification examples

- “This workbook has Q1 and Q2 sheets plus MDA detail tabs. Which period and data blocks should this batch include?”
- “Does 04/05/2026 mean 4 May or 5 April? Choose the date convention for these 18 rows.”
- “Are these figures in naira, thousands of naira or millions? The header and values do not establish the unit.”
- “Does KSCHMA map to the configured KCHIMA MDA? Here are the code and name matches.”
- “These 12 payments have no voucher reference. Supply the source references or leave these rows out.”
- “These amounts are monthly totals, not individual vouchers. Save as monthly returns for Admin confirmation?”
- “The Q1 summary and SMOH detail disagree. Which is authoritative for this batch, and what explains the difference?”
- “This expense has two funding sources but no split. Enter each allocation so the total matches NGN 100,000.”
- “This PDF cell may read 1,800,000 or 7,800,000. Verify it against the highlighted page image.”
- “These rows belong to an MDA you cannot submit for. Exclude them or route the file to an authorized Admin.”

Never infer a voucher, payment date, payment method, source allocation or user identity merely to satisfy a required field. Document-wide defaults are allowed only after the user confirms the evidence and the exact affected rows.

## Error and warning policy

**File blockers:** corrupt/unreadable ZIP/XML/PDF, encrypted content without a supported unlock process, wrong format, unsafe archives, resource-limit breaches, or no reliable table extraction. Explain what was read and what failed; retain the original. A valid ZIP checksum does not prove workbook relationships or cell semantics are valid.

**Row blockers:** missing required fields; invalid calendar dates; non-numeric or non-positive ledger amounts; ambiguous units; unsupported currencies; unknown/inactive references; wrong MDA access; locked BIR quarter; PHC facility/LGA/type mismatch; wrong AOP/budget year or MDA; incorrect allocation total; duplicate source in allocations; unresolved exact duplicate/reference conflict; aggregate row sent to a transaction destination; missing cached formula result needed for the amount.

**Warnings requiring acknowledgement or investigation:** unusual amounts, probable near-duplicates, missing optional AOP/budget linkage, low-confidence OCR, hidden data, formula-derived amounts, inconsistent detail/summary totals and source disagreements. Unresolved uncertainty in an amount, identity, date or mandatory field is blocking even if the model labels it a warning. Reconciliation differences can block the affected dataset while unrelated validated rows remain eligible.

**Informational exclusions:** blank decorative rows, repeated page headers, subtotals and totals when their underlying detail is selected, out-of-scope periods, and already imported unchanged rows. Show each disposition in counts and the issue export. Do not silently discard a nonempty row.

Preserve original and normalized values side by side. Use exact decimal strings/integer minor units for money calculations and database numeric storage. Preserve leading zeros in codes. Recognise parentheses/negative amounts and flag corrections instead of turning them positive. Do not execute spreadsheet macros, external links or arbitrary formulas. Protect spreadsheet issue exports from formula injection.

## Implementation shape

Build a dedicated import feature rather than giving the existing read-only assistant unrestricted write tools. Reuse the app's form labels, reference queries, granular access helpers, ledger validators and audited database paths. Harden calendar-date/reference existence/decimal validation on the server; the current client validators assume controlled dropdowns and are insufficient for arbitrary files.

Suggested modules: format-specific extractors; block/row classifier; reference resolver; deterministic normalizer/validator; clarification state; preview planner; transactional commit service; audit/provenance reader. A bounded background job handles large files and OCR, with progress, cancellation, timeouts and retryable processing stages. Do not run long ingestion entirely inside a short web request.

Suggested persistence: `import_batches` (owner, scope, source hashes, status, revision, counts); private source files; `import_rows` (raw and proposed values, destination, provenance, validation issues and disposition); `import_questions` (affected row IDs, answer and applied scope); `import_events` (who changed/confirmed what); committed row links and idempotency keys. Existing `admin_import_batches/errors` can be evaluated for reuse, but their admin-only policies cannot simply serve MDA users.

Use an explicit lifecycle: uploaded, extracting, needs clarification, ready for review, committing, completed, completed with exclusions, failed, cancelled. A changed answer invalidates the old preview/confirmation. Version/hash the exact plan presented to the user; reject a stale confirmation and regenerate it.

AI receives only authorized source blocks and the reference subset needed for the batch. Treat all text inside documents as untrusted data; it cannot instruct the system to skip validation, change roles or write to another destination. Require structured output with nullable unknowns, evidence references and confidence. Confidence never overrides a database constraint or missing source evidence.

The commit service verifies the actor/session and owns authorization. Execute ledger writes with the user's access context or a narrowly scoped audited transaction that independently checks every row. Do not expose a service-role credential or let a model select arbitrary SQL/tables. Apply row-level policies to import metadata and private storage; prevent cross-MDA source-file access.

For a selected valid set, commit the whole set atomically where feasible, including expenditure allocations, provenance and audit links. For larger chunked batches, show confirmed chunk outcomes explicitly; never claim the entire batch succeeded when some chunks failed. Use stable per-row idempotency keys and database uniqueness so retries, double-clicks and lost responses cannot create duplicates. Check existing commit state before retrying.

Default to insert-only for routine MDA transactions. An existing reference with changed values is a conflict requiring an explicit correction workflow. Plan updates to budgets/returns show old value, proposed value, delta and source. Published-period corrections must use the existing amendment governance, not an import bypass.

Use private uploads, signed source previews, malware/file checks, configurable retention and per-user cost/size limits. Disclose online AI processing in the upload UI. Never include credentials or unrelated workbook sheets in model input or logs. Record extractor/model version, user answers, repairs and confirmation for reproducibility.

## Preview example for the training

This is an illustrative storyboard, not a result from one of the real workbooks:

“100 candidate expenditure rows for your MDA, Q4 2026. 82 are ready, totalling NGN 8,500,000. Ten need voucher references. Five are probable duplicates. Three are outside your assigned MDA. Zero records have been inserted.”

The attendee opens the ten missing-reference rows, supplies two references, excludes the other eight and resolves the five duplicates as existing records to skip. The three unauthorized rows stay excluded. The revised preview must recompute counts and totals from actual staged rows before showing the confirm button. Do not invent the revised monetary total in the demo.

After explicit confirmation, the receipt reports the actual inserted rows and totals, their public entry IDs and every excluded row. A Viewer can then inspect/comment through the normal register.

## Delivery order and acceptance gates

1. **CSV and clean Excel transaction imports:** private upload, deterministic parsing, header mapping, required fields, reference resolution, preview, permission/publication checks, duplicate prevention, atomic commit and receipt. Gate: known fixtures reconcile exactly and unauthorized writes fail.
2. **AI-assisted heterogeneous workbooks:** per-sheet classification, aliases, source-linked clarification, formula/cache issues, summary/detail reconciliation and MDA draft staging for admin-only datasets. Gate: Template-7/8 differences are surfaced and totals are not double-counted.
3. **PDF and scanned documents:** table detection, OCR/page evidence, confidence-driven human review and aggregate routing. Gate: no invented dates/vouchers and no unreviewed ambiguous money values reach the ledger.
4. **Operational hardening:** resumable processing, larger batches, retention, observability, cancellation and support tooling. Gate: interruption/retry retains an accurate receipt and makes no duplicate writes.

Online processing is required for hosted AI/OCR and final server validation. The initial release should tell an offline user to reconnect before upload/analysis/confirmation. Existing manual offline entry remains separate. A future offline file-draft queue needs deliberate storage, account isolation and cleanup design; do not imply it is delivered by the existing ledger outbox.

## Required test corpus

- Clean funding/expenditure rows plus missing field, invalid real calendar date, zero/negative/over-precision amount, duplicate voucher/reference and allocation mismatch variants.
- Multi-MDA and multi-quarter files; authorized and unauthorized rows; revoked grants and newly published quarters between preview and commit.
- Template-7/8 malformed relationship metadata, per-MDA header variants, hidden rows, formulas with stale/missing cached values and summary/detail conflicts.
- AOP duplicate activity codes, joint-funding sheets and approved-budget rows that must not become receipts.
- CSV encoding/BOM/delimiter/quoted-newline cases, long identifiers, leading zeros and cells beginning with formula syntax.
- Text PDF, image-only PDF, rotated/multipage tables, repeated headers, printed/file page offsets, damaged/encrypted PDF and OCR digit ambiguity.
- Monthly blank versus explicit zero, quarter versus YTD, subtotals versus detail, repeated classifications of the same total and source-version revisions.
- Double confirm, worker timeout, interrupted commit, lost response and resumed batch: exactly one committed row per accepted idempotency key.
- Prompt-injection text embedded in a cell/PDF, oversized archives and cross-user batch/file access: no instructions obeyed, no resource exhaustion and no data exposure.

Maintain expected extraction, normalized rows, issue codes, disposition counts and exact totals for every fixture. Every nonempty source data row must be accounted for. Real files remain private; use redacted copies or clearly synthetic fixtures in source control.

## Review against the codebase (13 October 2026)

Checked against the migrations, the live database's policies and the app code. Corrections and open decisions:

- **Quarterly published aggregates are already in the ledger.** Seeds 007, 011 and 013 load BPR / Q2 Health Component totals into `expenditure_entries` (and Q2 funding) as aggregate rows with synthetic vouchers (`BPR-<year>Q<q>-<mda>-<seq>`), and revenue into `budget_line_revenues`. That was a deliberate July 2026 decision, made after a separate actuals table was rejected. The "never fabricate ledger details / design a snapshot path" rule above therefore conflicts with how Q1/Q2 are actually stored. **Decision needed:** keep quarterly BPR ingestion as admin SQL seeds outside this importer (the current assumption), or have the importer reproduce the synthetic-voucher convention under Admin only.
- **Facility users cannot insert expenditure today.** Migration 20260715132044 dropped the facility insert/update policies without recreating them, and `current_user_can_submit_expenditure_for_mda` checks only Admin or a membership. The UI still offers facility users the expenditure form. Phase 1 gives facility users no import access; the RLS gap needs its own fix.
- **Manual expenditure insert is not atomic.** It inserts the entry, then calls `replace_expenditure_funding_allocations`, then deletes the entry if that fails. The importer instead commits entries, allocations and row links in one SECURITY INVOKER transaction.
- **Database triggers do not check reference activeness.** Inactive MDAs and other reference values are filtered only in the client. The import commit re-checks activeness in SQL.
- **Client validators confirmed insufficient:** `deriveFiscalPeriod` accepts 2026-02-31 and `parseAmount` uses `Number`. The importer uses its own calendar-checked dates and exact decimal (kobo) parsing.
- **Roles:** "Viewer" is the `reviewer` role (statewide, no per-MDA membership). Submit grants are `funding_submitter` and `expenditure_submitter` memberships.
- **Existing import tables:** `admin_import_batches/errors` are admin-only and are used for BPR seed auditing. Phase 1 adds owner-scoped `import_batches` and `import_rows` instead.
- **Entry attachments storage is admin-only.** Only `entry_attachment_objects_admin_all` exists, and migration 20260617232527 is empty. Imports use a separate owner-scoped `import-sources` bucket.
- **Migration drift:** the live project's migration history doesn't match `supabase/migrations`. Remote has `assistant_readonly_query`, which is not in the repo. Local has `expenditure_funding_allocations` and `disable_expenditure_funding_warnings` under names remote does not list. Reconcile this before applying new migrations.

## Phase 1 as built

CSV and single-sheet `.xlsx` imports of funding and expenditure transactions, available to Admins and to MDA users with the matching submit grant (`/imports`). No AI. One funding source per expenditure row; split allocations, multi-sheet classification, PDFs and admin planning datasets are later phases. Code: `src/lib/imports/*`, `app/api/imports/*`, `src/routes/import*.tsx`, `src/components/imports/*`; schema in `supabase/migrations/20261013120000_ledger_imports.sql`.

Verification so far:

- Unit tests cover the CSV/XLSX readers, amounts, dates, mapping, dispositions and duplicates (`src/test/imports*.test.ts`).
- `tools/verify_ledger_imports.sql` runs the commit function as authenticated users on plain Postgres with the repo's stubs. It covers: atomic commit, idempotent replay, stale-plan rejection, foreign-MDA tampering rolling back the whole batch, the BIR publication lock, inactive references, allocation totals, cross-user isolation, completed-batch immutability and folder-scoped source storage.
- The XLSX reader was run locally against the real workbooks in the corpus. With header detection, merged title banners are skipped. In Kano Health Finance Tracker, Funding Log and Expenditure Log resolve to header row 2 with near-complete suggested mappings. Their ≈1,500 empty template rows (unevaluated formulas only) are counted and reported, not staged.
- **Finance Tracker gap:** its Expenditure Log has no funding-source column, so those rows stay blocked until a source column is added. Allocations are never inferred.
- **Live project (13 Oct 2026):** applied to `znvcxidepemlmqdhavpl` as migrations `ledger_imports` and `ledger_imports_pin_search_path`. Remote version numbers differ from the local file name, the same history drift noted above. The security advisor reports no new findings for the import objects.
- **Browser check as an Admin:** upload, mapping, the day-first date choice, the in-page cell fix, exclusion, the issue report (formula cells neutralised, corrections listed), confirm, receipt, idempotent re-confirm, and re-upload (unchanged row skipped as already recorded, changed row blocked). The test inserted **FL-2026-0127 (NGN 1.00)** and **FL-2026-0128 (NGN 2.00)** for Hospital Management Board, references `IMPTEST-20261013-01/02`, remarks "Import feature test - safe to delete". Delete them from the register if they shouldn't stay in reporting.
- **Latency:** each Supabase round trip from the development machine took about 350 ms, so a re-check takes 4–7 s in dev. Production depends on how close the host is to Supabase.
