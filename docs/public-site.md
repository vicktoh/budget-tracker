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
| `/phc` | Health programmes (immunisation, malaria, nutrition, maternal & child health, family planning, disease control): 2026 budget totalled across every MDA from the approved capital budget lines (`src/lib/public/programme-budgets-<year>.json`, from `scripts/public/export-programme-budgets.ts`), with a who-funds-it split; spending shown for the PHC Board only (the one body whose project spending the BIR reports). Grouping by project name in `src/lib/public/phc-programmes.ts`; KHETFUND remittances excluded to avoid double counting |
| `/revenue` | Where health MDAs' own revenue comes from: expected revenue by source (federal incl. BHCPF, local governments, donors, fees, other) from the approved revenue budget lines (`revenue-budgets-<year>.json`, `scripts/public/export-revenue-budgets.ts`, grouped in `revenue-sources.ts`), and collected so far per MDA from the BIR (totals only — the BIR does not split collections by source) |
| `/reports` | All 24 reports since 2019: mirrored PDF download (counted), link to the original, SHA-256 |
| `/data` | Full dataset CSV/JSON (CC BY 4.0), a plain table view, how figures are checked |
| `/ask` | "Ask AI" assistant (English or Hausa), full page. Answers cite sources in plain text (report, table, page) with no links. The same chat opens as a slide-in panel from the header button, the floating launcher, the hero ask box and "Ask about …" buttons on every public page |

Signed-in staff visiting `/` go to `/mda`; `/?view=public` (also in the staff
user menu) shows the public site. The PWA starts at `/mda`.

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

### Reports held back (Oct 2026)

| Report | Why | To publish |
|---|---|---|
| 2024 Q3 | Its class tables do not add up to its own totals | Investigate / add corrections |
| 2024 Q4 | Tables are images | Transcribe health rows, then run the same checks |
| 2026 Q1 | Admin/revenue tables are images | Not needed: Q1 is derived from Q2 |
| 2019–2022 | Not extracted yet (garbled text layer) | Phase 2 |

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

then add the new files to `OTHER_MDA_BUDGETS` (app/(public)/phc/page.tsx) and
`REVENUE_BUDGETS` (app/(public)/revenue/page.tsx).
