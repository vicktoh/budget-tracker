begin;

-- Public BIR dataset: the frozen, published figures behind kanohealthbudget.org.
--
-- Filled by scripts/bir/load.ts from the state's Budget Implementation /
-- Performance Reports (parsed and arithmetic-checked by scripts/bir/parse.py).
-- Anonymous visitors read only these tables, and only rows of published
-- reports; the ledger, comments and profiles stay private.

create table public.bir_reports (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,                       -- '2026-Q2', '2019-FY'
  fiscal_year int not null check (fiscal_year between 2000 and 2200),
  quarter smallint not null check (quarter between 1 and 4),
  full_year_only boolean not null default false,   -- 2019/2020 annual reports
  title text not null,
  source_url text not null unique,                 -- original link on budget.kn.gov.ng
  source_note text,                                -- e.g. mislabelled on the state site
  storage_path text,                               -- mirrored copy in the bir-reports bucket
  sha256 text,
  file_bytes bigint,
  page_count int,
  -- download_only: PDF is browsable, figures are not public (yet)
  -- published:     figures checked and public
  data_status text not null default 'download_only'
    check (data_status in ('download_only', 'published')),
  data_note text,                                  -- shown to visitors when figures are missing
  checks jsonb not null default '{}'::jsonb,       -- parser check summary
  -- false while a report found by the watcher waits for admin review
  is_listed boolean not null default true,
  published_at timestamptz,
  discovered_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.bir_figures (
  id bigint generated always as identity primary key,
  report_id uuid not null references public.bir_reports(id) on delete cascade,
  -- which BIR table the row comes from
  lens text not null check (lens in (
    'state', 'revenue', 'mda', 'function', 'programme',
    'phc_mda', 'phc_function', 'phc_programme', 'phc_economic', 'phc_project'
  )),
  econ_class text not null default 'total'
    check (econ_class in ('total', 'personnel', 'overhead', 'capital', 'other')),
  code text,                                       -- NCOA admin/function/programme/economic code
  row_key text,                                    -- state headline key, or 'table_total'
  name text not null,
  mda_code text,                                   -- owning MDA for PHC projects
  original_budget numeric(18, 2),
  revised_budget numeric(18, 2),
  quarter_actual numeric(18, 2),
  ytd_actual numeric(18, 2),
  table_number int,
  page int,                                        -- PDF page, for source links
  note text                                        -- derived values, budget-column caveats
);

create index idx_bir_figures_report_lens on public.bir_figures (report_id, lens, econ_class);
create index idx_bir_figures_code on public.bir_figures (lens, code);

-- Display names for codes across years (names drift between reports).
create table public.bir_entities (
  lens text not null check (lens in ('mda', 'function', 'programme', 'revenue')),
  code text not null,
  name text not null,
  short_name text,
  sort_order int,
  primary key (lens, code)
);

-- Anonymous log of public assistant conversations (no IPs; hashed visitor id).
create table public.public_assistant_log (
  id bigint generated always as identity primary key,
  created_at timestamptz not null default now(),
  visitor_hash text not null,
  conversation_id text not null,
  question text not null,
  answer text,
  model text,
  input_tokens int,
  output_tokens int,
  cost_usd numeric(10, 5) not null default 0,
  status text not null default 'ok' check (status in ('ok', 'rate_limited', 'budget_exhausted', 'error', 'rejected'))
);

create index idx_public_assistant_log_visitor on public.public_assistant_log (visitor_hash, created_at desc);
create index idx_public_assistant_log_month on public.public_assistant_log (created_at);

-- Download / export counters for the public site (no visitor data at all).
create table public.public_download_events (
  id bigint generated always as identity primary key,
  created_at timestamptz not null default now(),
  kind text not null check (kind in ('pdf', 'csv', 'dataset')),
  report_slug text
);

alter table public.bir_reports enable row level security;
alter table public.bir_figures enable row level security;
alter table public.bir_entities enable row level security;
alter table public.public_assistant_log enable row level security;
alter table public.public_download_events enable row level security;

-- Separate visitor and admin policies: anon has no access to app_private.
create policy "bir_reports_public_read" on public.bir_reports
for select to anon, authenticated
using (is_listed);

create policy "bir_reports_admin_read" on public.bir_reports
for select to authenticated
using (app_private.current_user_is_admin());

create policy "bir_figures_public_read" on public.bir_figures
for select to anon, authenticated
using (exists (
  select 1 from public.bir_reports r
  where r.id = bir_figures.report_id and r.data_status = 'published' and r.is_listed
));

create policy "bir_figures_admin_read" on public.bir_figures
for select to authenticated
using (app_private.current_user_is_admin());

create policy "bir_entities_public_read" on public.bir_entities
for select to anon, authenticated using (true);

create policy "bir_reports_admin_write" on public.bir_reports
for all to authenticated
using (app_private.current_user_is_admin())
with check (app_private.current_user_is_admin());

create policy "public_assistant_log_admin_read" on public.public_assistant_log
for select to authenticated using (app_private.current_user_is_admin());

create policy "public_download_events_admin_read" on public.public_download_events
for select to authenticated using (app_private.current_user_is_admin());

grant select on public.bir_reports, public.bir_figures, public.bir_entities to anon, authenticated;

-- Counting a download needs no table access: anon calls this function only.
create or replace function public.record_public_download(p_kind text, p_report_slug text default null)
returns void
language sql
security definer
set search_path = public
as $$
  insert into public.public_download_events (kind, report_slug)
  select p_kind, p_report_slug
  where p_kind in ('pdf', 'csv', 'dataset')
    and (p_report_slug is null or exists (select 1 from public.bir_reports where slug = p_report_slug));
$$;

revoke all on function public.record_public_download(text, text) from public;
grant execute on function public.record_public_download(text, text) to anon, authenticated;

-- Mirrored PDFs: public read, written only with the service role.
insert into storage.buckets (id, name, public)
values ('bir-reports', 'bir-reports', true)
on conflict (id) do update set public = true;

-- Weekly check of budget.kn.gov.ng for new reports (Mondays 07:00 UTC = 08:00 WAT).
-- New PDFs are queued unlisted for admin review; nothing is published automatically.
select cron.unschedule(jobname) from cron.job where jobname = 'bir-archive-watch';
select cron.schedule(
  'bir-archive-watch',
  '0 7 * * 1',
  $$select app_private.call_notification_route('/api/public/bir-watch', 120000)$$
);

commit;
