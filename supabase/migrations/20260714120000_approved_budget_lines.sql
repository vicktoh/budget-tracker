-- Approved Budget line items (NCOA chart-of-accounts granularity)
--
-- The existing `approved_budgets` table holds one aggregate row per
-- (fiscal_year, mda_id). This migration introduces the line-item detail that
-- rolls up into those aggregates: one row per Nigerian NCOA budget line
-- (Admin × Economic × Function × Location × Fund × Programme), split by the
-- three budget classes personnel / overhead / capital.
--
-- `approved_budgets` is kept as the derived rollup so existing budget-vs-actual
-- reporting keeps working unchanged; the seed regenerates it from these lines.
--
-- Expenditure entries funded from the state budget can bind to a specific line
-- via `expenditure_entries.approved_budget_line_id`, enabling per-line
-- budget-vs-actual and remaining-balance checks (mirroring AOP activities).

create table public.approved_budget_lines (
  id uuid primary key default gen_random_uuid(),
  fiscal_year int not null check (fiscal_year between 2000 and 2100),
  mda_id uuid not null references public.mdas(id) on delete restrict,
  budget_class text not null check (budget_class in ('personnel', 'overhead', 'capital')),
  economic_code text not null,
  economic_description text not null,
  project_description text,
  function_code text,
  location_code text,
  fund_code text,
  programme_code text,
  approved_amount numeric(18,2) not null default 0 check (approved_amount >= 0),
  source_label text,
  source_row_number int,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Natural key: a coded line is unique within its MDA / class / location / fund /
-- programme for the year. `source_row_number` preserves workbook rows that
-- legitimately repeat the same coded line (common on the capital sheet, where
-- one economic code covers many distinct projects).
create unique index approved_budget_lines_natural_key
  on public.approved_budget_lines (
    fiscal_year,
    mda_id,
    budget_class,
    economic_code,
    coalesce(location_code, ''),
    coalesce(fund_code, ''),
    coalesce(programme_code, ''),
    coalesce(source_row_number, -1)
  );

create index idx_approved_budget_lines_year_mda
  on public.approved_budget_lines (fiscal_year, mda_id, budget_class);

alter table public.expenditure_entries
  add column approved_budget_line_id uuid
    references public.approved_budget_lines(id) on delete restrict;

create index idx_expenditure_entries_budget_line
  on public.expenditure_entries (approved_budget_line_id)
  where approved_budget_line_id is not null;

-- Standard housekeeping triggers, matching the sibling planning tables.
create trigger set_approved_budget_lines_updated_at before update on public.approved_budget_lines
for each row execute function app_private.touch_updated_at();
create trigger audit_approved_budget_lines after insert or update or delete on public.approved_budget_lines
for each row execute function app_private.audit_row_change();

-- RLS: everyone authenticated can read; only admins write (same as
-- `approved_budgets` / `aop_activities`).
alter table public.approved_budget_lines enable row level security;
create policy "plans_select_authenticated" on public.approved_budget_lines
for select to authenticated using (true);
create policy "plans_admin_approved_budget_lines" on public.approved_budget_lines
for all to authenticated using (app_private.current_user_is_admin()) with check (app_private.current_user_is_admin());

-- Extend the expenditure validation trigger: a bound budget line must belong to
-- the entry's MDA and fiscal year (derived from the transaction date).
create or replace function app_private.validate_expenditure_entry()
returns trigger
language plpgsql
as $$
declare
  category_name text;
  programme_name text;
  method_name text;
  facility_lga_id uuid;
  facility_type_value text;
  activity_mda_id uuid;
  activity_fiscal_year int;
  entry_year int;
  item_category_id uuid;
  line_mda_id uuid;
  line_fiscal_year int;
begin
  select name into category_name from public.expenditure_categories where id = new.expenditure_category_id;
  select name into programme_name from public.programme_areas where id = new.programme_area_id;
  select name into method_name from public.payment_methods where id = new.payment_method_id;

  if (lower(coalesce(category_name, '')) = 'other'
      or lower(coalesce(programme_name, '')) = 'other'
      or lower(coalesce(method_name, '')) = 'other')
     and nullif(trim(coalesce(new.remarks, '')), '') is null then
    raise exception 'Remarks are required when Other is selected.';
  end if;

  if new.facility_id is not null then
    select lga_id, facility_type into facility_lga_id, facility_type_value
    from public.facilities
    where id = new.facility_id;

    if facility_lga_id is distinct from new.lga_id then
      raise exception 'Selected facility must belong to the selected LGA.';
    end if;

    if new.is_phc and lower(facility_type_value) <> 'phc' then
      raise exception 'PHC expenditure must use a PHC facility.';
    end if;
  end if;

  entry_year := app_private.entry_fiscal_year(new.transaction_date);

  if new.aop_activity_id is not null then
    select mda_id, fiscal_year into activity_mda_id, activity_fiscal_year
    from public.aop_activities
    where id = new.aop_activity_id;

    if activity_mda_id is distinct from new.mda_id or activity_fiscal_year is distinct from entry_year then
      raise exception 'AOP activity must match expenditure MDA and fiscal year.';
    end if;
  end if;

  if new.expenditure_item_id is not null then
    select expenditure_category_id into item_category_id
    from public.expenditure_items
    where id = new.expenditure_item_id;

    if item_category_id is not null and item_category_id is distinct from new.expenditure_category_id then
      raise exception 'Expenditure item must match selected expenditure category.';
    end if;
  end if;

  if new.approved_budget_line_id is not null then
    select mda_id, fiscal_year into line_mda_id, line_fiscal_year
    from public.approved_budget_lines
    where id = new.approved_budget_line_id;

    if line_mda_id is distinct from new.mda_id or line_fiscal_year is distinct from entry_year then
      raise exception 'Approved budget line must match expenditure MDA and fiscal year.';
    end if;
  end if;

  return new;
end;
$$;
