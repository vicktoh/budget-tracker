-- Editorial state for the reports hub:
--   report_publishers  — CSO-report branding presets (name, logo, palette, voice)
--   report_narratives  — per-period editable prose for computed report sections
--
-- Computed figures/signals stay derived at query time; only human-authored
-- overrides and publisher config are persisted here.

/* ---------------------------------------------------------------------- */
/* Helper: admin OR reviewer (the two roles that operate the reports hub)  */
/* ---------------------------------------------------------------------- */
create or replace function app_private.current_user_is_admin_or_reviewer()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.profiles
    where id = (select auth.uid())
      and role in ('admin', 'reviewer')
  );
$$;

/* ---------------------------------------------------------------------- */
/* report_publishers                                                       */
/* ---------------------------------------------------------------------- */
create table if not exists public.report_publishers (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null,
  logo_kind text not null default 'monogram',
  palette jsonb not null default '{}'::jsonb,
  voice_preset text not null default 'neutral',
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger trg_report_publishers_touch
before update on public.report_publishers
for each row execute function app_private.touch_updated_at();

alter table public.report_publishers enable row level security;

create policy "report_publishers_select_authenticated" on public.report_publishers
for select to authenticated using (true);

create policy "report_publishers_admin_write" on public.report_publishers
for all to authenticated
using (app_private.current_user_is_admin())
with check (app_private.current_user_is_admin());

/* ---------------------------------------------------------------------- */
/* report_narratives                                                       */
/* ---------------------------------------------------------------------- */
create table if not exists public.report_narratives (
  id uuid primary key default gen_random_uuid(),
  template text not null,           -- 'cso' | 'bir' | 'audit' | 'mbp'
  fiscal_year int not null,
  quarter int,                       -- null = full year
  section_key text not null,
  body text not null default '',
  edited_by uuid references public.profiles (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint report_narratives_quarter_check check (quarter is null or quarter between 1 and 4),
  constraint report_narratives_unique unique (template, fiscal_year, quarter, section_key)
);

create index if not exists report_narratives_lookup_idx
  on public.report_narratives (template, fiscal_year, quarter);

create trigger trg_report_narratives_touch
before update on public.report_narratives
for each row execute function app_private.touch_updated_at();

alter table public.report_narratives enable row level security;

-- Admins and reviewers may read and author narrative overrides.
create policy "report_narratives_select_admin_reviewer" on public.report_narratives
for select to authenticated
using (app_private.current_user_is_admin_or_reviewer());

create policy "report_narratives_write_admin_reviewer" on public.report_narratives
for all to authenticated
using (app_private.current_user_is_admin_or_reviewer())
with check (app_private.current_user_is_admin_or_reviewer());

/* ---------------------------------------------------------------------- */
/* Seed the two v1 publishers                                              */
/* ---------------------------------------------------------------------- */
insert into public.report_publishers (slug, name, logo_kind, palette, voice_preset)
values
  ('ibp', 'IBP Nigeria', 'monogram',
   '{"cover":"#12303f","accent":"#7fc5dc"}'::jsonb, 'watchdog'),
  ('kano-gov', 'Kano State Government', 'crest',
   '{"cover":"#0f5132","accent":"#9a7b2e"}'::jsonb, 'commitments')
on conflict (slug) do update
set name = excluded.name,
    logo_kind = excluded.logo_kind,
    palette = excluded.palette,
    voice_preset = excluded.voice_preset,
    active = true,
    updated_at = now();
