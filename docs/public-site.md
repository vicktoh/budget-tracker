# Public site (kanohealthbudget.org)

The public pages show Kano State health-sector budget figures from the State's
quarterly Budget Performance Reports (BIRs). Decisions behind it (22 Oct 2026):
official quarters only, one frozen published dataset, lens filters, nominal
naira, descriptive tone, anonymous AI assistant with a $100/month cap.

## Pages

| Route | What it shows |
|---|---|
| `/` | Deep-teal hero with an animated Kano LGA map and the Ask AI box, four colour tiles, spending-type donut, three rule-generated facts, top MDAs (largest budgets / lowest share spent), same point each year, Ask AI band |
| `/explore` | The full lens explorer (MDA / programme / function × type × period, breakdown or compare years) |
| `/phc` | Health programmes (immunisation, malaria, nutrition, maternal & child health, family planning, disease control): 2026 budget totalled across every MDA from the approved capital budget lines (`src/lib/public/programme-budgets-<year>.json`, from `scripts/public/export-programme-budgets.ts`), with a who-funds-it split; spending shown for the PHC Board only (the one body whose project spending the BIR reports). Grouping by project name in `src/lib/public/phc-programmes.ts`, totals in `src/lib/public/health-programmes.ts` (shared with Ask AI); KHETFUND remittances excluded to avoid double counting |
| `/revenue` | Where health MDAs' own revenue comes from: expected revenue by source (federal incl. BHCPF, local governments, donors, fees, other) from the approved revenue budget lines (`revenue-budgets-<year>.json`, `scripts/public/export-revenue-budgets.ts`, grouped in `revenue-sources.ts`), and collected so far per MDA from the BIR (totals only — the BIR does not split collections by source) |
| `/reports` | All 24 reports since 2019: mirrored PDF download (counted), link to the original, SHA-256 |
| `/data` | Full dataset CSV/JSON (CC BY 4.0), a plain table view, how figures are checked |
| `/ask` | "Ask AI" assistant (English or Hausa), full page. Answers cite sources in plain text (report, table, page) with no links. The same chat opens as a slide-in panel from the header button, the floating launcher, the hero ask box and "Ask about …" buttons on every public page |

Everyone sees the public site at `/`; the staff user menu links to it too.
The PWA starts at `/mda`.

## Data flow

```
budget.kn.gov.ng PDFs
  └─ scripts/bir/download.py   mirror + sha256 → tmp/bir-pdfs/manifest.json
  └─ scripts/bir/parse.py      health tables → tmp/bir-parsed/<slug>.json (+ checks)
  └─ scripts/bir/load.ts       bir_reports / bir_figures / bir_entities + bir-reports bucket
public pages + /api/public/*   read only published rows, as the anon role
```

- `bir_reports.data_status = 'published'` makes a report's figures public. The
  loader publishes a report only if it is in `PUBLISHABLE` (load.ts), its parse
  has **no failing checks**, and — for years the platform ledger covers — the
  quarter has a platform BIR publication (`budget_implementation_report_publications`).
- Checks: every row reproduces the BIR's own % and balance columns; MDA total =
  personnel + overhead + capital + other; sector = sum of MDAs (admin, function,
  programme). Known source defects are handled in `scripts/bir/corrections.json`
  (derived values carry a visible note).
- Mid-year reports sometimes print the revised budget in a column labelled
  "Original"; the parser detects this against the year's Q1 report and takes the
  original budget from Q1 (noted on the row).
- A quarter without its own published report is derived from the next
  quarter's report (YTD − that quarter) and says so (e.g. 2026 Q1 from 2026 Q2).

- Older reports vary: some class tables print MDA names without codes (coded
  from the same report's total table), some print "-" for most rows' final
  budget, and some total rows mix bases (% against original, balance against
  final). The parser handles each and still checks every row.
- Reports whose tables are images are transcribed by hand into
  `scripts/bir/transcriptions/<slug>.json` (rows exactly as printed; the
  parser runs the same checks on them and each figure carries a note). Where a
  total table is cut off, the missing MDA totals are worked out from the class
  tables and marked derived. A transcribed Q1 does not relabel later quarters'
  budget columns (2022 amended some original budgets after Q2).
- Programme tables are published from 2025 (earlier reports print only some).
- Three schools changed codes in 2023; `CODE_ALIASES` in load.ts files their
  2021–22 figures under the current codes (each keeps a note of the printed code).

### Coverage (Oct 2026)

| Report | Status |
|---|---|
| 2021 Q1 – 2026 Q2 | Published, all checks passing (2022 Q1 and 2024 Q4 transcribed from images) |
| 2026 Q1 | Admin/revenue tables are images; Q1 is derived from Q2 |
| 2019, 2020 | Older format, not extracted |

## Adding a new quarter

1. The weekly `bir-archive-watch` cron (Mondays 08:00 WAT) records new PDFs on
   budget.kn.gov.ng as unlisted rows and notifies admins. Or add the entry to
   `scripts/bir/sources.json` by hand.
2. Add it to `sources.json` (if the watcher found it), then:
   ```
   python3 -I scripts/bir/download.py scripts/bir/sources.json tmp/bir-pdfs
   python3 -I scripts/bir/parse.py tmp/bir-pdfs/manifest.json tmp/bir-pdfs tmp/bir-parsed <slug>
   ```
   Fix any failing check (parser or `corrections.json`) until it reports 0.
3. Current year only: publish the quarter in the platform (Admin → BIR publish),
   which also locks the quarter's ledger entries.
4. Add the slug to `PUBLISHABLE` in `scripts/bir/load.ts`, then
   `npx tsx scripts/bir/load.ts` (dry run) and `npx tsx scripts/bir/load.ts --write`.
5. Refresh the pages: `POST /api/public/revalidate` with the `x-cron-secret`
   header (or wait up to an hour).

## Ask AI guardrails

`/api/public/chat` — no sign-in. Tools read only the in-memory published
dataset (`src/lib/public/assistant.ts`); no database access.

| Setting (env) | Default |
|---|---|
| `PUBLIC_ASSISTANT_MODEL` | `gpt-5-mini` |
| `PUBLIC_ASSISTANT_MONTHLY_CAP_USD` | 100 (then "busy, try later") |
| `PUBLIC_ASSISTANT_MESSAGES_PER_HOUR` | 20 per visitor |
| `PUBLIC_ASSISTANT_MAX_TURNS` | 6 user messages per conversation |
| `PUBLIC_ASSISTANT_PRICE_IN_PER_M` / `_OUT_PER_M` | 0.25 / 2 (USD per 1M tokens) |
| `PUBLIC_ASSISTANT_SALT` | salt for the visitor hash (falls back to the service key) |
| `TURNSTILE_SECRET_KEY` + `NEXT_PUBLIC_TURNSTILE_SITE_KEY` | Turnstile off when unset |

Exchanges are logged to `public_assistant_log` (salted monthly visitor hash, no
IP). Local development does not log unless `PUBLIC_ASSISTANT_LOG_IN_DEV=1`.

## Analytics

Cloudflare Web Analytics loads when `NEXT_PUBLIC_CF_ANALYTICS_TOKEN` is set
(cookieless; no consent banner). Downloads and dataset exports are counted in
`public_download_events` via `record_public_download()`.

## Local development

`npx tsx scripts/bir/load.ts --export tmp/bir-dataset.json --assume-published 2026-Q1,2026-Q2`
writes the dataset as JSON; the `dev-public-fixture` launch config runs
`next dev` with `PUBLIC_DATASET_FIXTURE=tmp/bir-dataset.json`, so pages render
without touching the database.

## Yearly budget-line exports

The programme and revenue pages also use the year's approved budget lines,
committed as JSON (the approved budget changes once a year). After a new
year's budget is loaded into `approved_budget_lines` / `budget_line_revenues`:

```
npx tsx scripts/public/export-programme-budgets.ts <year>
npx tsx scripts/public/export-revenue-budgets.ts <year>
```

then add the new files to `OTHER_MDA_BUDGETS` (src/lib/public/health-programmes.ts)
and `REVENUE_BUDGETS` (app/(public)/revenue/page.tsx). The /phc cards and Ask
AI's `getHealthProgrammes` tool both read `buildHealthProgrammes`, so they
always show the same programme figures.

## Briefs (Accountability Brief)

Admins publish the civil-society Accountability Brief from
`/admin/reports/cso` → **Publish to public site** (republish / remove there
too). It captures the brief for the selected period as a PDF into the public
`public-briefs` bucket and records it in `public_briefs`; the public Reports
page lists it under "Briefs and analysis". The database trigger
`enforce_public_brief_period` refuses any period that is not officially
published (a quarter needs its BIR publication; a full-year brief needs all
four), so provisional quarters cannot go public this way.

## Year-by-year chart (landing page)

Full years come from each year's Q4 report: published figures first, then
`src/lib/public/full-year-history.json` for years whose Q4 report is not fully
on the site (2021 and 2022 parsed; 2024 transcribed from its image table and
cross-checked against 2024 Q3). The current year shows spending up to the
latest published quarter. `src/test/full-year-history.test.ts` re-checks each
row against the report's own % column. 2020 and earlier use an older report
format (supplementary budget; salaries, running costs and capital in separate
tables) and are not included.

`/` is the public landing page for everyone, signed in or not (22 Oct 2026: the
earlier redirect of signed-in staff to /mda was removed). Signed-in staff see a
"My workspace" link in the public header; installed staff PWAs start at /mda.
