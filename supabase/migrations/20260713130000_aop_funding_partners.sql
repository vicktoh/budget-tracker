-- Named funding partners (donors / implementing partners) and per-activity
-- AoP funding allocations from the resource-mapping workbooks.
-- An activity's funding gap is derived: budgeted_cost - sum(allocations.amount).

create table public.funding_partners (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null unique,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.aop_activity_funding_allocations (
  id uuid primary key default gen_random_uuid(),
  aop_activity_id uuid not null references public.aop_activities(id) on delete cascade,
  -- tranche 0 = government fund; 1-5 = development partner tranches, in source column order
  tranche_no smallint not null check (tranche_no between 0 and 5),
  funding_source_id uuid not null references public.funding_sources(id) on delete restrict,
  donor_partner_id uuid references public.funding_partners(id) on delete restrict,
  implementing_partner_id uuid references public.funding_partners(id) on delete restrict,
  -- zero-amount rows record attribution stated in the AoP without a committed figure
  amount numeric(18,2) not null default 0 check (amount >= 0),
  source_donor_name text,
  source_partner_name text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (aop_activity_id, tranche_no)
);

create index idx_aop_activity_funding_activity on public.aop_activity_funding_allocations(aop_activity_id);
create index idx_aop_activity_funding_source on public.aop_activity_funding_allocations(funding_source_id);
create index idx_aop_activity_funding_donor on public.aop_activity_funding_allocations(donor_partner_id);

create trigger set_funding_partners_updated_at before update on public.funding_partners
for each row execute function app_private.touch_updated_at();
create trigger set_aop_activity_funding_updated_at before update on public.aop_activity_funding_allocations
for each row execute function app_private.touch_updated_at();

create trigger audit_funding_partners after insert or update or delete on public.funding_partners
for each row execute function app_private.audit_row_change();
create trigger audit_aop_activity_funding after insert or update or delete on public.aop_activity_funding_allocations
for each row execute function app_private.audit_row_change();

alter table public.funding_partners enable row level security;
alter table public.aop_activity_funding_allocations enable row level security;

create policy "reference_select_authenticated" on public.funding_partners
for select to authenticated using (true);
create policy "reference_admin_funding_partners" on public.funding_partners
for all to authenticated using (app_private.current_user_is_admin()) with check (app_private.current_user_is_admin());

create policy "plans_select_authenticated" on public.aop_activity_funding_allocations
for select to authenticated using (true);
create policy "plans_admin_aop_activity_funding" on public.aop_activity_funding_allocations
for all to authenticated using (app_private.current_user_is_admin()) with check (app_private.current_user_is_admin());
