-- Monthly expenditure tracking (IBP reconciliation workbook)
--
-- The state's official BPR is quarterly; IBP's tracking workbook ("2026 MDAs
-- BUDGET TRACKING TEMPLATE") collects the same budget lines month by month,
-- directly from each MDA. It is a *second source*, not a finer-grained view of
-- the ledger: its totals genuinely disagree with the published BPR in places
-- (KCHIMA capital shows ~N1.71bn across Jan-Mar where the BPR books the whole
-- amount in Q2). The published BPR stays authoritative for headline figures;
-- this table exists so the insights surface can show month-by-month activity
-- and make those disagreements visible instead of hiding them.
--
-- Row semantics: one row per budget line per month WHERE THE SHEET HAS A CELL.
--   * amount > 0  - figure reported for that month
--   * amount = 0  - MDA explicitly reported zero (a real submission)
--   * no row      - nothing submitted for that month (a reporting gap)
-- The zero / no-row distinction is load-bearing for the month-tracker display.

create table public.monthly_expenditure_tracking (
  id uuid primary key default gen_random_uuid(),
  fiscal_year int not null check (fiscal_year between 2000 and 2100),
  mda_id uuid not null references public.mdas(id) on delete restrict,
  budget_class text not null check (budget_class in ('personnel', 'overhead', 'capital')),
  economic_code text not null,
  description text,
  -- Best-effort bind to the approved budget line (capital lines match on
  -- project description, recurrent on economic code). Null when the tracking
  -- sheet carries a line the approved budget does not.
  approved_budget_line_id uuid references public.approved_budget_lines(id) on delete set null,
  month smallint not null check (month between 1 and 12),
  amount numeric(18,2) not null,
  source_label text,
  -- Row number in the MDA's sheet; disambiguates capital lines that repeat the
  -- same economic code, mirroring approved_budget_lines_natural_key.
  source_row_number int,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index monthly_expenditure_tracking_natural_key
  on public.monthly_expenditure_tracking (
    fiscal_year,
    mda_id,
    budget_class,
    economic_code,
    coalesce(source_row_number, -1),
    month
  );

create index idx_monthly_tracking_year_mda
  on public.monthly_expenditure_tracking (fiscal_year, mda_id, budget_class, month);

create index idx_monthly_tracking_budget_line
  on public.monthly_expenditure_tracking (approved_budget_line_id)
  where approved_budget_line_id is not null;

-- Standard housekeeping triggers, matching the sibling planning tables.
create trigger set_monthly_tracking_updated_at before update on public.monthly_expenditure_tracking
for each row execute function app_private.touch_updated_at();
create trigger audit_monthly_tracking after insert or update or delete on public.monthly_expenditure_tracking
for each row execute function app_private.audit_row_change();

-- RLS: everyone authenticated can read; only admins write (same as
-- approved_budget_lines / budget_line_revenues).
alter table public.monthly_expenditure_tracking enable row level security;
create policy "plans_select_authenticated" on public.monthly_expenditure_tracking
for select to authenticated using (true);
create policy "plans_admin_monthly_tracking" on public.monthly_expenditure_tracking
for all to authenticated using (app_private.current_user_is_admin()) with check (app_private.current_user_is_admin());
