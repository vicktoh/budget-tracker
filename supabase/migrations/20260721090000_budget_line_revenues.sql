-- Revenue side of the Budget Performance Report (BPR)
--
-- `approved_budget_lines` covers the expenditure half of the NCOA chart of
-- accounts (personnel / overhead / capital). The state's BPR workbook also
-- reports two revenue streams that had no home in this schema at all:
--
--   * Recurrent revenue  (worksheet "1. Rec Revenue")    - IGR, fees, licences
--   * Capital receipts   (worksheet "5. Capital Receipts") - grants, loans, aid
--
-- `funding_entries` is deliberately NOT reused: it records money *released to
-- an MDA*, carries no economic code, and has no notion of an approved figure.
-- Revenue budgeted vs collected is a different question, so it gets its own
-- pair of tables mirroring the expenditure side:
--
--   budget_line_revenues          - the approved figure, one row per coded line
--   budget_line_revenue_actuals   - collections, one row per line per quarter
--
-- Reporting is against the ORIGINAL budget (per the workbook's Calibration
-- sheet), so in-year budget revisions are intentionally not modelled here.

create table public.budget_line_revenues (
  id uuid primary key default gen_random_uuid(),
  fiscal_year int not null check (fiscal_year between 2000 and 2100),
  mda_id uuid not null references public.mdas(id) on delete restrict,
  stream text not null check (stream in ('recurrent', 'capital_receipt')),
  economic_code text not null,
  economic_description text not null,
  receipt_description text,
  approved_amount numeric(18,2) not null default 0 check (approved_amount >= 0),
  source_label text,
  source_row_number int,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Natural key mirrors `approved_budget_lines_natural_key`: a coded line is
-- unique within its MDA / stream for the year, with `source_row_number`
-- preserving workbook rows that legitimately repeat the same economic code
-- (common on the capital receipts sheet, where one code covers several
-- distinct grants or loans).
create unique index budget_line_revenues_natural_key
  on public.budget_line_revenues (
    fiscal_year,
    mda_id,
    stream,
    economic_code,
    coalesce(source_row_number, -1)
  );

create index idx_budget_line_revenues_year_mda
  on public.budget_line_revenues (fiscal_year, mda_id, stream);

create table public.budget_line_revenue_actuals (
  id uuid primary key default gen_random_uuid(),
  budget_line_revenue_id uuid not null
    references public.budget_line_revenues(id) on delete cascade,
  quarter smallint not null check (quarter between 1 and 4),
  amount numeric(18,2) not null default 0,
  source_label text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- One collected figure per line per quarter. This is what makes a BPR re-import
-- idempotent: a corrected workbook upserts onto the same row rather than
-- appending a second quarter's worth of revenue.
create unique index budget_line_revenue_actuals_line_quarter
  on public.budget_line_revenue_actuals (budget_line_revenue_id, quarter);

create index idx_budget_line_revenue_actuals_quarter
  on public.budget_line_revenue_actuals (quarter);

-- Standard housekeeping triggers, matching the sibling planning tables.
create trigger set_budget_line_revenues_updated_at before update on public.budget_line_revenues
for each row execute function app_private.touch_updated_at();
create trigger audit_budget_line_revenues after insert or update or delete on public.budget_line_revenues
for each row execute function app_private.audit_row_change();

create trigger set_budget_line_revenue_actuals_updated_at before update on public.budget_line_revenue_actuals
for each row execute function app_private.touch_updated_at();
create trigger audit_budget_line_revenue_actuals after insert or update or delete on public.budget_line_revenue_actuals
for each row execute function app_private.audit_row_change();

-- RLS: everyone authenticated can read; only admins write (same as
-- `approved_budgets` / `approved_budget_lines` / `aop_activities`).
alter table public.budget_line_revenues enable row level security;
create policy "plans_select_authenticated" on public.budget_line_revenues
for select to authenticated using (true);
create policy "plans_admin_budget_line_revenues" on public.budget_line_revenues
for all to authenticated using (app_private.current_user_is_admin()) with check (app_private.current_user_is_admin());

alter table public.budget_line_revenue_actuals enable row level security;
create policy "plans_select_authenticated" on public.budget_line_revenue_actuals
for select to authenticated using (true);
create policy "plans_admin_budget_line_revenue_actuals" on public.budget_line_revenue_actuals
for all to authenticated using (app_private.current_user_is_admin()) with check (app_private.current_user_is_admin());

-- Quarterly BPR ingests are a recurring import type of their own: they are not a
-- one-off historical backfill, and they carry both expenditure actuals and the
-- revenue lines above. Recording them in `admin_import_batches` is what makes a
-- re-import auditable.
alter table public.admin_import_batches drop constraint admin_import_batches_import_type_check;
alter table public.admin_import_batches add constraint admin_import_batches_import_type_check
  check (import_type = any (array[
    'reference_data','approved_budget','aop_activities',
    'historical_funding','historical_expenditure','bpr_quarterly_actuals']));
