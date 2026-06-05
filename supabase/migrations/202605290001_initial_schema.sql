-- Kano Health Finance Tracker initial Supabase/Postgres schema.
-- This migration intentionally keeps funding and expenditure as separate ledgers,
-- while sharing reference tables and reporting views.

create extension if not exists pgcrypto;

create schema if not exists app_private;
revoke all on schema app_private from public;
grant usage on schema app_private to authenticated;
grant usage on schema app_private to service_role;

create or replace function app_private.touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create or replace function app_private.entry_fiscal_year(entry_date date)
returns int
language sql
immutable
as $$
  select extract(year from entry_date)::int;
$$;

create or replace function app_private.entry_quarter(entry_date date)
returns smallint
language sql
immutable
as $$
  select extract(quarter from entry_date)::smallint;
$$;

create or replace function app_private.slugify(value text)
returns text
language sql
immutable
as $$
  select trim(both '-' from regexp_replace(lower(coalesce(value, '')), '[^a-z0-9]+', '-', 'g'));
$$;

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null,
  role text not null default 'mda_user'
    check (role in ('admin', 'mda_user', 'reviewer')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.mda_types (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null unique,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.mdas (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name text not null unique,
  mda_type_id uuid references public.mda_types(id),
  abbreviation text,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.user_mda_memberships (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  mda_id uuid not null references public.mdas(id) on delete restrict,
  membership_role text not null check (membership_role in ('submitter', 'reviewer')),
  created_at timestamptz not null default now(),
  unique (user_id, mda_id, membership_role)
);

create table public.programme_areas (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null unique,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.funding_sources (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null unique,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.expenditure_categories (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null unique,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.expenditure_items (
  id uuid primary key default gen_random_uuid(),
  expenditure_category_id uuid references public.expenditure_categories(id) on delete restrict,
  slug text not null unique,
  name text not null,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (expenditure_category_id, name)
);

create table public.payment_methods (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null unique,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.entry_statuses (
  slug text primary key,
  name text not null unique,
  description text not null,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.lgas (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.facilities (
  id uuid primary key default gen_random_uuid(),
  lga_id uuid not null references public.lgas(id) on delete restrict,
  name text not null,
  facility_type text not null default 'phc',
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (lga_id, name)
);

create table public.approved_budgets (
  id uuid primary key default gen_random_uuid(),
  fiscal_year int not null check (fiscal_year between 2000 and 2100),
  mda_id uuid not null references public.mdas(id) on delete restrict,
  personnel_amount numeric(18,2) not null default 0 check (personnel_amount >= 0),
  other_recurrent_amount numeric(18,2) not null default 0 check (other_recurrent_amount >= 0),
  total_recurrent_amount numeric(18,2) not null default 0 check (total_recurrent_amount >= 0),
  capital_amount numeric(18,2) not null default 0 check (capital_amount >= 0),
  total_budget_amount numeric(18,2) not null default 0 check (total_budget_amount >= 0),
  source_label text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (fiscal_year, mda_id),
  check (total_recurrent_amount = personnel_amount + other_recurrent_amount),
  check (total_budget_amount = total_recurrent_amount + capital_amount)
);

create table public.aop_activities (
  id uuid primary key default gen_random_uuid(),
  fiscal_year int not null check (fiscal_year between 2000 and 2100),
  activity_code text not null,
  description text not null,
  mda_id uuid not null references public.mdas(id) on delete restrict,
  budgeted_cost numeric(18,2) not null default 0 check (budgeted_cost >= 0),
  source_row_number int,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (fiscal_year, activity_code, mda_id, source_row_number)
);

create table public.entry_public_id_counters (
  prefix text not null,
  fiscal_year int not null,
  last_value bigint not null default 0,
  primary key (prefix, fiscal_year)
);

create table public.funding_entries (
  id uuid primary key default gen_random_uuid(),
  public_id text unique,
  transaction_date date not null,
  fiscal_year int generated always as (app_private.entry_fiscal_year(transaction_date)) stored,
  quarter smallint generated always as (app_private.entry_quarter(transaction_date)) stored,
  mda_id uuid not null references public.mdas(id) on delete restrict,
  funding_source_id uuid not null references public.funding_sources(id) on delete restrict,
  programme_area_id uuid not null references public.programme_areas(id) on delete restrict,
  amount numeric(18,2) not null check (amount > 0),
  reference_no text not null,
  remarks text,
  status text not null default 'pending' references public.entry_statuses(slug) on update cascade,
  entered_by uuid not null references public.profiles(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  approved_by uuid references public.profiles(id) on delete restrict,
  approved_at timestamptz,
  unique (fiscal_year, mda_id, reference_no),
  check (quarter between 1 and 4)
);

create table public.expenditure_entries (
  id uuid primary key default gen_random_uuid(),
  public_id text unique,
  transaction_date date not null,
  fiscal_year int generated always as (app_private.entry_fiscal_year(transaction_date)) stored,
  quarter smallint generated always as (app_private.entry_quarter(transaction_date)) stored,
  mda_id uuid not null references public.mdas(id) on delete restrict,
  expenditure_category_id uuid not null references public.expenditure_categories(id) on delete restrict,
  programme_area_id uuid not null references public.programme_areas(id) on delete restrict,
  aop_activity_id uuid references public.aop_activities(id) on delete restrict,
  expenditure_item_id uuid references public.expenditure_items(id) on delete restrict,
  is_phc boolean not null default false,
  lga_id uuid references public.lgas(id) on delete restrict,
  facility_id uuid references public.facilities(id) on delete restrict,
  amount numeric(18,2) not null check (amount > 0),
  voucher_ref_no text not null,
  payment_method_id uuid not null references public.payment_methods(id) on delete restrict,
  remarks text,
  status text not null default 'pending' references public.entry_statuses(slug) on update cascade,
  entered_by uuid not null references public.profiles(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  approved_by uuid references public.profiles(id) on delete restrict,
  approved_at timestamptz,
  unique (fiscal_year, mda_id, voucher_ref_no),
  check (quarter between 1 and 4),
  check (
    (is_phc and lga_id is not null and facility_id is not null)
    or
    (not is_phc and lga_id is null and facility_id is null)
  )
);

create table public.entry_audit_events (
  id uuid primary key default gen_random_uuid(),
  entity_type text not null,
  entity_id uuid,
  entity_key text not null,
  event_type text not null,
  old_values jsonb,
  new_values jsonb,
  reason text,
  actor_id uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);

create table public.entry_comments (
  id uuid primary key default gen_random_uuid(),
  entry_type text not null check (entry_type in ('funding_entry', 'expenditure_entry')),
  entry_id uuid not null,
  body text not null,
  comment_type text not null default 'general'
    check (comment_type in ('general', 'clarification', 'rejection_reason', 'approval_note')),
  author_id uuid not null references public.profiles(id) on delete restrict,
  created_at timestamptz not null default now()
);

create table public.entry_attachments (
  id uuid primary key default gen_random_uuid(),
  entry_type text not null check (entry_type in ('funding_entry', 'expenditure_entry')),
  entry_id uuid not null,
  storage_bucket text not null default 'entry-attachments',
  storage_path text not null,
  file_name text not null,
  content_type text,
  file_size_bytes bigint check (file_size_bytes is null or file_size_bytes > 0),
  uploaded_by uuid not null references public.profiles(id) on delete restrict,
  created_at timestamptz not null default now(),
  unique (storage_bucket, storage_path)
);

create table public.admin_import_batches (
  id uuid primary key default gen_random_uuid(),
  import_type text not null check (
    import_type in (
      'reference_data',
      'approved_budget',
      'aop_activities',
      'historical_funding',
      'historical_expenditure'
    )
  ),
  source_file_name text not null,
  storage_path text,
  status text not null default 'pending'
    check (status in ('pending', 'validated', 'imported', 'failed')),
  summary jsonb not null default '{}'::jsonb,
  created_by uuid not null references public.profiles(id) on delete restrict,
  created_at timestamptz not null default now(),
  completed_at timestamptz
);

create table public.admin_import_errors (
  id uuid primary key default gen_random_uuid(),
  batch_id uuid not null references public.admin_import_batches(id) on delete cascade,
  row_number int,
  field_name text,
  message text not null,
  raw_row jsonb,
  created_at timestamptz not null default now()
);

create table public.submission_windows (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  fiscal_year int check (fiscal_year is null or fiscal_year between 2000 and 2100),
  start_date date,
  end_date date,
  status text not null default 'open' check (status in ('open', 'closed')),
  applies_to_mda_id uuid references public.mdas(id) on delete cascade,
  created_by uuid not null references public.profiles(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (start_date is null or end_date is null or start_date <= end_date)
);

create table public.entry_data_quality_warnings (
  id uuid primary key default gen_random_uuid(),
  entry_type text not null check (entry_type in ('funding_entry', 'expenditure_entry')),
  entry_id uuid not null,
  warning_code text not null,
  message text not null,
  severity text not null default 'warning' check (severity in ('info', 'warning', 'high')),
  resolved_at timestamptz,
  resolved_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);

create table public.reference_value_requests (
  id uuid primary key default gen_random_uuid(),
  reference_type text not null check (
    reference_type in (
      'mda',
      'mda_type',
      'programme_area',
      'funding_source',
      'expenditure_category',
      'expenditure_item',
      'facility',
      'payment_method',
      'lga'
    )
  ),
  requested_label text not null,
  description text,
  related_mda_id uuid references public.mdas(id) on delete set null,
  related_lga_id uuid references public.lgas(id) on delete set null,
  related_category_id uuid references public.expenditure_categories(id) on delete set null,
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  resolved_reference_id uuid,
  requested_by uuid not null references public.profiles(id) on delete restrict,
  reviewed_by uuid references public.profiles(id) on delete restrict,
  review_comment text,
  created_at timestamptz not null default now(),
  reviewed_at timestamptz,
  check (status <> 'rejected' or nullif(trim(coalesce(review_comment, '')), '') is not null)
);

create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  recipient_id uuid not null references public.profiles(id) on delete cascade,
  notification_type text not null,
  title text not null,
  body text not null,
  entity_type text,
  entity_id uuid,
  read_at timestamptz,
  created_at timestamptz not null default now()
);

create table public.email_delivery_events (
  id uuid primary key default gen_random_uuid(),
  recipient_id uuid references public.profiles(id) on delete set null,
  recipient_email text not null,
  template_key text not null,
  entity_type text,
  entity_id uuid,
  payload jsonb not null default '{}'::jsonb,
  provider text not null default 'resend',
  provider_message_id text,
  status text not null default 'queued' check (status in ('queued', 'sent', 'delivered', 'failed')),
  error_message text,
  created_at timestamptz not null default now(),
  sent_at timestamptz
);

create table public.export_jobs (
  id uuid primary key default gen_random_uuid(),
  export_type text not null check (export_type in ('csv', 'xlsx', 'pdf')),
  subject text not null,
  filters jsonb not null default '{}'::jsonb,
  storage_bucket text,
  storage_path text,
  status text not null default 'queued' check (status in ('queued', 'processing', 'completed', 'failed')),
  error_message text,
  created_by uuid not null references public.profiles(id) on delete restrict,
  created_at timestamptz not null default now(),
  completed_at timestamptz
);

create or replace function app_private.current_user_is_admin()
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
      and role = 'admin'
  );
$$;

create or replace function app_private.current_user_can_submit_for_mda(target_mda_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select app_private.current_user_is_admin()
    or exists (
      select 1
      from public.user_mda_memberships
      where user_id = (select auth.uid())
        and mda_id = target_mda_id
        and membership_role = 'submitter'
    );
$$;

create or replace function app_private.current_user_can_review_mda(target_mda_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select app_private.current_user_is_admin()
    or exists (
      select 1
      from public.user_mda_memberships
      where user_id = (select auth.uid())
        and mda_id = target_mda_id
        and membership_role = 'reviewer'
    );
$$;

create or replace function app_private.current_user_can_view_mda(target_mda_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select app_private.current_user_is_admin()
    or exists (
      select 1
      from public.user_mda_memberships
      where user_id = (select auth.uid())
        and mda_id = target_mda_id
    );
$$;

create or replace function app_private.current_user_can_view_entry(target_entry_type text, target_entry_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select case
    when target_entry_type = 'funding_entry' then exists (
      select 1
      from public.funding_entries
      where id = target_entry_id
        and app_private.current_user_can_view_mda(mda_id)
    )
    when target_entry_type = 'expenditure_entry' then exists (
      select 1
      from public.expenditure_entries
      where id = target_entry_id
        and app_private.current_user_can_view_mda(mda_id)
    )
    else false
  end;
$$;

create or replace function app_private.next_entry_public_id()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  entry_prefix text;
  entry_year int;
  next_value bigint;
begin
  if new.public_id is not null then
    return new;
  end if;

  if tg_table_name = 'funding_entries' then
    entry_prefix := 'FL';
  elsif tg_table_name = 'expenditure_entries' then
    entry_prefix := 'EL';
  else
    raise exception 'Unsupported entry table for public ID: %', tg_table_name;
  end if;

  entry_year := app_private.entry_fiscal_year(new.transaction_date);

  insert into public.entry_public_id_counters as counters (prefix, fiscal_year, last_value)
  values (entry_prefix, entry_year, 1)
  on conflict (prefix, fiscal_year)
  do update set last_value = counters.last_value + 1
  returning last_value into next_value;

  new.public_id := entry_prefix || '-' || entry_year::text || '-' || lpad(next_value::text, 4, '0');
  return new;
end;
$$;

create or replace function app_private.validate_funding_entry()
returns trigger
language plpgsql
as $$
declare
  source_name text;
  programme_name text;
begin
  select name into source_name from public.funding_sources where id = new.funding_source_id;
  select name into programme_name from public.programme_areas where id = new.programme_area_id;

  if (lower(coalesce(source_name, '')) = 'other' or lower(coalesce(programme_name, '')) = 'other')
     and nullif(trim(coalesce(new.remarks, '')), '') is null then
    raise exception 'Remarks are required when Other is selected.';
  end if;

  return new;
end;
$$;

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

  return new;
end;
$$;

create or replace function app_private.audit_row_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  event_kind text;
  row_id uuid;
  row_key text;
begin
  event_kind := case tg_op
    when 'INSERT' then 'created'
    when 'UPDATE' then
      case
        when to_jsonb(old)->>'status' is distinct from to_jsonb(new)->>'status' then 'status_changed'
        when to_jsonb(old)->>'active' = 'true' and to_jsonb(new)->>'active' = 'false' then 'deactivated'
        when to_jsonb(old)->>'active' = 'false' and to_jsonb(new)->>'active' = 'true' then 'reactivated'
        else 'updated'
      end
    when 'DELETE' then 'deleted'
  end;

  row_key := coalesce(
    to_jsonb(new)->>'id',
    to_jsonb(old)->>'id',
    to_jsonb(new)->>'slug',
    to_jsonb(old)->>'slug'
  );

  row_id := case
    when coalesce(to_jsonb(new), to_jsonb(old)) ? 'id' then row_key::uuid
    else null
  end;

  insert into public.entry_audit_events (
    entity_type,
    entity_id,
    entity_key,
    event_type,
    old_values,
    new_values,
    reason,
    actor_id
  )
  values (
    tg_table_name,
    row_id,
    row_key,
    event_kind,
    case when tg_op in ('UPDATE', 'DELETE') then to_jsonb(old) else null end,
    case when tg_op in ('INSERT', 'UPDATE') then to_jsonb(new) else null end,
    nullif(current_setting('app.audit_reason', true), ''),
    (select auth.uid())
  );

  return coalesce(new, old);
end;
$$;

create trigger set_profiles_updated_at before update on public.profiles
for each row execute function app_private.touch_updated_at();
create trigger set_mda_types_updated_at before update on public.mda_types
for each row execute function app_private.touch_updated_at();
create trigger set_mdas_updated_at before update on public.mdas
for each row execute function app_private.touch_updated_at();
create trigger set_programme_areas_updated_at before update on public.programme_areas
for each row execute function app_private.touch_updated_at();
create trigger set_funding_sources_updated_at before update on public.funding_sources
for each row execute function app_private.touch_updated_at();
create trigger set_expenditure_categories_updated_at before update on public.expenditure_categories
for each row execute function app_private.touch_updated_at();
create trigger set_expenditure_items_updated_at before update on public.expenditure_items
for each row execute function app_private.touch_updated_at();
create trigger set_payment_methods_updated_at before update on public.payment_methods
for each row execute function app_private.touch_updated_at();
create trigger set_entry_statuses_updated_at before update on public.entry_statuses
for each row execute function app_private.touch_updated_at();
create trigger set_lgas_updated_at before update on public.lgas
for each row execute function app_private.touch_updated_at();
create trigger set_facilities_updated_at before update on public.facilities
for each row execute function app_private.touch_updated_at();
create trigger set_approved_budgets_updated_at before update on public.approved_budgets
for each row execute function app_private.touch_updated_at();
create trigger set_aop_activities_updated_at before update on public.aop_activities
for each row execute function app_private.touch_updated_at();
create trigger set_funding_entries_updated_at before update on public.funding_entries
for each row execute function app_private.touch_updated_at();
create trigger set_expenditure_entries_updated_at before update on public.expenditure_entries
for each row execute function app_private.touch_updated_at();
create trigger set_submission_windows_updated_at before update on public.submission_windows
for each row execute function app_private.touch_updated_at();

create trigger set_funding_public_id before insert on public.funding_entries
for each row execute function app_private.next_entry_public_id();
create trigger set_expenditure_public_id before insert on public.expenditure_entries
for each row execute function app_private.next_entry_public_id();

create trigger validate_funding_entry before insert or update on public.funding_entries
for each row execute function app_private.validate_funding_entry();
create trigger validate_expenditure_entry before insert or update on public.expenditure_entries
for each row execute function app_private.validate_expenditure_entry();

create trigger audit_funding_entries after insert or update or delete on public.funding_entries
for each row execute function app_private.audit_row_change();
create trigger audit_expenditure_entries after insert or update or delete on public.expenditure_entries
for each row execute function app_private.audit_row_change();
create trigger audit_mda_types after insert or update or delete on public.mda_types
for each row execute function app_private.audit_row_change();
create trigger audit_mdas after insert or update or delete on public.mdas
for each row execute function app_private.audit_row_change();
create trigger audit_programme_areas after insert or update or delete on public.programme_areas
for each row execute function app_private.audit_row_change();
create trigger audit_funding_sources after insert or update or delete on public.funding_sources
for each row execute function app_private.audit_row_change();
create trigger audit_expenditure_categories after insert or update or delete on public.expenditure_categories
for each row execute function app_private.audit_row_change();
create trigger audit_expenditure_items after insert or update or delete on public.expenditure_items
for each row execute function app_private.audit_row_change();
create trigger audit_payment_methods after insert or update or delete on public.payment_methods
for each row execute function app_private.audit_row_change();
create trigger audit_entry_statuses after insert or update or delete on public.entry_statuses
for each row execute function app_private.audit_row_change();
create trigger audit_lgas after insert or update or delete on public.lgas
for each row execute function app_private.audit_row_change();
create trigger audit_facilities after insert or update or delete on public.facilities
for each row execute function app_private.audit_row_change();
create trigger audit_approved_budgets after insert or update or delete on public.approved_budgets
for each row execute function app_private.audit_row_change();
create trigger audit_aop_activities after insert or update or delete on public.aop_activities
for each row execute function app_private.audit_row_change();

create index idx_user_mda_memberships_user on public.user_mda_memberships(user_id);
create index idx_user_mda_memberships_mda on public.user_mda_memberships(mda_id);
create index idx_facilities_lga on public.facilities(lga_id);
create index idx_approved_budgets_year_mda on public.approved_budgets(fiscal_year, mda_id);
create index idx_aop_activities_year_mda on public.aop_activities(fiscal_year, mda_id);
create index idx_funding_entries_year_mda_status on public.funding_entries(fiscal_year, mda_id, status);
create index idx_funding_entries_date on public.funding_entries(transaction_date);
create index idx_expenditure_entries_year_mda_status on public.expenditure_entries(fiscal_year, mda_id, status);
create index idx_expenditure_entries_date on public.expenditure_entries(transaction_date);
create index idx_expenditure_entries_phc on public.expenditure_entries(lga_id, facility_id) where is_phc;
create index idx_entry_audit_events_entity on public.entry_audit_events(entity_type, entity_id, created_at desc);
create index idx_entry_comments_entry on public.entry_comments(entry_type, entry_id, created_at);
create index idx_entry_attachments_entry on public.entry_attachments(entry_type, entry_id);
create index idx_notifications_recipient on public.notifications(recipient_id, read_at, created_at desc);

create or replace view public.mda_budget_vs_actual
with (security_invoker = true)
as
select
  b.fiscal_year,
  m.id as mda_id,
  m.name as mda_name,
  b.total_budget_amount,
  coalesce(funding.total_funding_amount, 0)::numeric(18,2) as total_funding_amount,
  coalesce(expenditure.total_expenditure_amount, 0)::numeric(18,2) as total_expenditure_amount,
  (b.total_budget_amount - coalesce(expenditure.total_expenditure_amount, 0))::numeric(18,2) as budget_balance_amount,
  case
    when b.total_budget_amount = 0 then null
    else (coalesce(expenditure.total_expenditure_amount, 0) / b.total_budget_amount)
  end as budget_used_ratio
from public.approved_budgets b
join public.mdas m on m.id = b.mda_id
left join (
  select fiscal_year, mda_id, sum(amount) as total_funding_amount
  from public.funding_entries
  group by fiscal_year, mda_id
) funding on funding.fiscal_year = b.fiscal_year and funding.mda_id = b.mda_id
left join (
  select fiscal_year, mda_id, sum(amount) as total_expenditure_amount
  from public.expenditure_entries
  group by fiscal_year, mda_id
) expenditure on expenditure.fiscal_year = b.fiscal_year and expenditure.mda_id = b.mda_id;

create or replace view public.funding_by_source
with (security_invoker = true)
as
select
  fe.fiscal_year,
  fe.quarter,
  fe.mda_id,
  m.name as mda_name,
  fs.id as funding_source_id,
  fs.name as funding_source_name,
  sum(fe.amount)::numeric(18,2) as total_amount,
  count(*) as entry_count
from public.funding_entries fe
join public.mdas m on m.id = fe.mda_id
join public.funding_sources fs on fs.id = fe.funding_source_id
group by fe.fiscal_year, fe.quarter, fe.mda_id, m.name, fs.id, fs.name;

create or replace view public.expenditure_by_category
with (security_invoker = true)
as
select
  ee.fiscal_year,
  ee.quarter,
  ee.mda_id,
  m.name as mda_name,
  ec.id as expenditure_category_id,
  ec.name as expenditure_category_name,
  sum(ee.amount)::numeric(18,2) as total_amount,
  count(*) as entry_count
from public.expenditure_entries ee
join public.mdas m on m.id = ee.mda_id
join public.expenditure_categories ec on ec.id = ee.expenditure_category_id
group by ee.fiscal_year, ee.quarter, ee.mda_id, m.name, ec.id, ec.name;

create or replace view public.programme_area_summary
with (security_invoker = true)
as
select
  pa.id as programme_area_id,
  pa.name as programme_area_name,
  coalesce(funding.fiscal_year, expenditure.fiscal_year) as fiscal_year,
  coalesce(funding.mda_id, expenditure.mda_id) as mda_id,
  coalesce(funding.total_funding_amount, 0)::numeric(18,2) as total_funding_amount,
  coalesce(expenditure.total_expenditure_amount, 0)::numeric(18,2) as total_expenditure_amount
from public.programme_areas pa
left join (
  select fiscal_year, mda_id, programme_area_id, sum(amount) as total_funding_amount
  from public.funding_entries
  group by fiscal_year, mda_id, programme_area_id
) funding on funding.programme_area_id = pa.id
full join (
  select fiscal_year, mda_id, programme_area_id, sum(amount) as total_expenditure_amount
  from public.expenditure_entries
  group by fiscal_year, mda_id, programme_area_id
) expenditure on expenditure.programme_area_id = pa.id
  and expenditure.fiscal_year = funding.fiscal_year
  and expenditure.mda_id = funding.mda_id;

create or replace view public.phc_lga_expenditure_summary
with (security_invoker = true)
as
select
  ee.fiscal_year,
  ee.lga_id,
  l.name as lga_name,
  sum(ee.amount)::numeric(18,2) as total_expenditure_amount,
  count(*) as entry_count
from public.expenditure_entries ee
join public.lgas l on l.id = ee.lga_id
where ee.is_phc
group by ee.fiscal_year, ee.lga_id, l.name;

create or replace view public.phc_facility_expenditure_summary
with (security_invoker = true)
as
select
  ee.fiscal_year,
  ee.lga_id,
  l.name as lga_name,
  ee.facility_id,
  f.name as facility_name,
  sum(ee.amount)::numeric(18,2) as total_expenditure_amount,
  count(*) as entry_count
from public.expenditure_entries ee
join public.lgas l on l.id = ee.lga_id
join public.facilities f on f.id = ee.facility_id
where ee.is_phc
group by ee.fiscal_year, ee.lga_id, l.name, ee.facility_id, f.name;

create or replace view public.aop_planned_vs_actual
with (security_invoker = true)
as
select
  a.fiscal_year,
  a.mda_id,
  m.name as mda_name,
  a.id as aop_activity_id,
  a.activity_code,
  a.description,
  a.budgeted_cost,
  coalesce(sum(ee.amount), 0)::numeric(18,2) as linked_expenditure_amount,
  (a.budgeted_cost - coalesce(sum(ee.amount), 0))::numeric(18,2) as remaining_amount
from public.aop_activities a
join public.mdas m on m.id = a.mda_id
left join public.expenditure_entries ee on ee.aop_activity_id = a.id
group by a.fiscal_year, a.mda_id, m.name, a.id, a.activity_code, a.description, a.budgeted_cost;

create or replace view public.unlinked_expenditure
with (security_invoker = true)
as
select
  ee.fiscal_year,
  ee.mda_id,
  m.name as mda_name,
  ee.programme_area_id,
  pa.name as programme_area_name,
  ee.expenditure_category_id,
  ec.name as expenditure_category_name,
  sum(ee.amount)::numeric(18,2) as total_amount,
  count(*) as entry_count
from public.expenditure_entries ee
join public.mdas m on m.id = ee.mda_id
join public.programme_areas pa on pa.id = ee.programme_area_id
join public.expenditure_categories ec on ec.id = ee.expenditure_category_id
where ee.aop_activity_id is null
group by ee.fiscal_year, ee.mda_id, m.name, ee.programme_area_id, pa.name, ee.expenditure_category_id, ec.name;

alter table public.profiles enable row level security;
alter table public.user_mda_memberships enable row level security;
alter table public.mda_types enable row level security;
alter table public.mdas enable row level security;
alter table public.programme_areas enable row level security;
alter table public.funding_sources enable row level security;
alter table public.expenditure_categories enable row level security;
alter table public.expenditure_items enable row level security;
alter table public.payment_methods enable row level security;
alter table public.entry_statuses enable row level security;
alter table public.lgas enable row level security;
alter table public.facilities enable row level security;
alter table public.approved_budgets enable row level security;
alter table public.aop_activities enable row level security;
alter table public.entry_public_id_counters enable row level security;
alter table public.funding_entries enable row level security;
alter table public.expenditure_entries enable row level security;
alter table public.entry_audit_events enable row level security;
alter table public.entry_comments enable row level security;
alter table public.entry_attachments enable row level security;
alter table public.admin_import_batches enable row level security;
alter table public.admin_import_errors enable row level security;
alter table public.submission_windows enable row level security;
alter table public.entry_data_quality_warnings enable row level security;
alter table public.reference_value_requests enable row level security;
alter table public.notifications enable row level security;
alter table public.email_delivery_events enable row level security;
alter table public.export_jobs enable row level security;

grant usage on schema public to authenticated;
grant select, insert, update, delete on all tables in schema public to authenticated;
grant usage, select on all sequences in schema public to authenticated;

create policy "profiles_select_own_or_admin" on public.profiles
for select to authenticated
using (id = (select auth.uid()) or app_private.current_user_is_admin());
create policy "profiles_insert_self" on public.profiles
for insert to authenticated
with check (id = (select auth.uid()));
create policy "profiles_update_self_or_admin" on public.profiles
for update to authenticated
using (id = (select auth.uid()) or app_private.current_user_is_admin())
with check (id = (select auth.uid()) or app_private.current_user_is_admin());

create policy "memberships_select_own_or_admin" on public.user_mda_memberships
for select to authenticated
using (user_id = (select auth.uid()) or app_private.current_user_is_admin());
create policy "memberships_admin_all" on public.user_mda_memberships
for all to authenticated
using (app_private.current_user_is_admin())
with check (app_private.current_user_is_admin());

create policy "reference_select_authenticated" on public.mda_types
for select to authenticated using (true);
create policy "reference_admin_mda_types" on public.mda_types
for all to authenticated using (app_private.current_user_is_admin()) with check (app_private.current_user_is_admin());
create policy "reference_select_authenticated" on public.mdas
for select to authenticated using (true);
create policy "reference_admin_mdas" on public.mdas
for all to authenticated using (app_private.current_user_is_admin()) with check (app_private.current_user_is_admin());
create policy "reference_select_authenticated" on public.programme_areas
for select to authenticated using (true);
create policy "reference_admin_programme_areas" on public.programme_areas
for all to authenticated using (app_private.current_user_is_admin()) with check (app_private.current_user_is_admin());
create policy "reference_select_authenticated" on public.funding_sources
for select to authenticated using (true);
create policy "reference_admin_funding_sources" on public.funding_sources
for all to authenticated using (app_private.current_user_is_admin()) with check (app_private.current_user_is_admin());
create policy "reference_select_authenticated" on public.expenditure_categories
for select to authenticated using (true);
create policy "reference_admin_expenditure_categories" on public.expenditure_categories
for all to authenticated using (app_private.current_user_is_admin()) with check (app_private.current_user_is_admin());
create policy "reference_select_authenticated" on public.expenditure_items
for select to authenticated using (true);
create policy "reference_admin_expenditure_items" on public.expenditure_items
for all to authenticated using (app_private.current_user_is_admin()) with check (app_private.current_user_is_admin());
create policy "reference_select_authenticated" on public.payment_methods
for select to authenticated using (true);
create policy "reference_admin_payment_methods" on public.payment_methods
for all to authenticated using (app_private.current_user_is_admin()) with check (app_private.current_user_is_admin());
create policy "reference_select_authenticated" on public.entry_statuses
for select to authenticated using (true);
create policy "reference_admin_entry_statuses" on public.entry_statuses
for all to authenticated using (app_private.current_user_is_admin()) with check (app_private.current_user_is_admin());
create policy "reference_select_authenticated" on public.lgas
for select to authenticated using (true);
create policy "reference_admin_lgas" on public.lgas
for all to authenticated using (app_private.current_user_is_admin()) with check (app_private.current_user_is_admin());
create policy "reference_select_authenticated" on public.facilities
for select to authenticated using (true);
create policy "reference_admin_facilities" on public.facilities
for all to authenticated using (app_private.current_user_is_admin()) with check (app_private.current_user_is_admin());

create policy "plans_select_authenticated" on public.approved_budgets
for select to authenticated using (true);
create policy "plans_admin_approved_budgets" on public.approved_budgets
for all to authenticated using (app_private.current_user_is_admin()) with check (app_private.current_user_is_admin());
create policy "plans_select_authenticated" on public.aop_activities
for select to authenticated using (true);
create policy "plans_admin_aop_activities" on public.aop_activities
for all to authenticated using (app_private.current_user_is_admin()) with check (app_private.current_user_is_admin());

create policy "public_id_counters_admin_only" on public.entry_public_id_counters
for all to authenticated using (app_private.current_user_is_admin()) with check (app_private.current_user_is_admin());

create policy "funding_select_by_mda_membership" on public.funding_entries
for select to authenticated
using (app_private.current_user_can_view_mda(mda_id));
create policy "funding_insert_by_submitter" on public.funding_entries
for insert to authenticated
with check (
  entered_by = (select auth.uid())
  and status = 'pending'
  and app_private.current_user_can_submit_for_mda(mda_id)
);
create policy "funding_update_pending_by_submitter" on public.funding_entries
for update to authenticated
using (
  status = 'pending'
  and entered_by = (select auth.uid())
  and app_private.current_user_can_submit_for_mda(mda_id)
)
with check (
  status = 'pending'
  and entered_by = (select auth.uid())
  and app_private.current_user_can_submit_for_mda(mda_id)
);
create policy "funding_review_update_by_reviewer" on public.funding_entries
for update to authenticated
using (app_private.current_user_can_review_mda(mda_id))
with check (app_private.current_user_can_review_mda(mda_id));
create policy "funding_admin_delete" on public.funding_entries
for delete to authenticated
using (app_private.current_user_is_admin());

create policy "expenditure_select_by_mda_membership" on public.expenditure_entries
for select to authenticated
using (app_private.current_user_can_view_mda(mda_id));
create policy "expenditure_insert_by_submitter" on public.expenditure_entries
for insert to authenticated
with check (
  entered_by = (select auth.uid())
  and status = 'pending'
  and app_private.current_user_can_submit_for_mda(mda_id)
);
create policy "expenditure_update_pending_by_submitter" on public.expenditure_entries
for update to authenticated
using (
  status = 'pending'
  and entered_by = (select auth.uid())
  and app_private.current_user_can_submit_for_mda(mda_id)
)
with check (
  status = 'pending'
  and entered_by = (select auth.uid())
  and app_private.current_user_can_submit_for_mda(mda_id)
);
create policy "expenditure_review_update_by_reviewer" on public.expenditure_entries
for update to authenticated
using (app_private.current_user_can_review_mda(mda_id))
with check (app_private.current_user_can_review_mda(mda_id));
create policy "expenditure_admin_delete" on public.expenditure_entries
for delete to authenticated
using (app_private.current_user_is_admin());

create policy "audit_select_admin" on public.entry_audit_events
for select to authenticated using (app_private.current_user_is_admin());
create policy "audit_insert_system_or_admin" on public.entry_audit_events
for insert to authenticated with check (app_private.current_user_is_admin());

create policy "comments_select_entry_viewers" on public.entry_comments
for select to authenticated
using (app_private.current_user_can_view_entry(entry_type, entry_id));
create policy "comments_insert_entry_viewers" on public.entry_comments
for insert to authenticated
with check (
  author_id = (select auth.uid())
  and app_private.current_user_can_view_entry(entry_type, entry_id)
);

create policy "attachments_select_entry_viewers" on public.entry_attachments
for select to authenticated
using (app_private.current_user_can_view_entry(entry_type, entry_id));
create policy "attachments_insert_entry_viewers" on public.entry_attachments
for insert to authenticated
with check (
  uploaded_by = (select auth.uid())
  and app_private.current_user_can_view_entry(entry_type, entry_id)
);

create policy "imports_admin_batches" on public.admin_import_batches
for all to authenticated using (app_private.current_user_is_admin()) with check (app_private.current_user_is_admin());
create policy "imports_admin_errors" on public.admin_import_errors
for all to authenticated using (app_private.current_user_is_admin()) with check (app_private.current_user_is_admin());

create policy "submission_windows_select_authenticated" on public.submission_windows
for select to authenticated using (true);
create policy "submission_windows_admin_all" on public.submission_windows
for all to authenticated using (app_private.current_user_is_admin()) with check (app_private.current_user_is_admin());

create policy "warnings_select_entry_viewers" on public.entry_data_quality_warnings
for select to authenticated
using (app_private.current_user_can_view_entry(entry_type, entry_id));
create policy "warnings_reviewer_update" on public.entry_data_quality_warnings
for update to authenticated
using (app_private.current_user_can_view_entry(entry_type, entry_id))
with check (app_private.current_user_can_view_entry(entry_type, entry_id));
create policy "warnings_admin_insert" on public.entry_data_quality_warnings
for insert to authenticated
with check (app_private.current_user_is_admin());

create policy "reference_requests_select_own_or_admin" on public.reference_value_requests
for select to authenticated
using (requested_by = (select auth.uid()) or app_private.current_user_is_admin());
create policy "reference_requests_insert_own" on public.reference_value_requests
for insert to authenticated
with check (requested_by = (select auth.uid()));
create policy "reference_requests_admin_update" on public.reference_value_requests
for update to authenticated
using (app_private.current_user_is_admin())
with check (app_private.current_user_is_admin());

create policy "notifications_select_own_or_admin" on public.notifications
for select to authenticated
using (recipient_id = (select auth.uid()) or app_private.current_user_is_admin());
create policy "notifications_update_own_read_at" on public.notifications
for update to authenticated
using (recipient_id = (select auth.uid()) or app_private.current_user_is_admin())
with check (recipient_id = (select auth.uid()) or app_private.current_user_is_admin());
create policy "notifications_admin_insert" on public.notifications
for insert to authenticated
with check (app_private.current_user_is_admin());

create policy "email_delivery_admin_all" on public.email_delivery_events
for all to authenticated using (app_private.current_user_is_admin()) with check (app_private.current_user_is_admin());
create policy "export_jobs_admin_all" on public.export_jobs
for all to authenticated using (app_private.current_user_is_admin()) with check (app_private.current_user_is_admin());

insert into storage.buckets (id, name, public)
values ('entry-attachments', 'entry-attachments', false)
on conflict (id) do nothing;

create policy "entry_attachment_objects_admin_all" on storage.objects
for all to authenticated
using (bucket_id = 'entry-attachments' and app_private.current_user_is_admin())
with check (bucket_id = 'entry-attachments' and app_private.current_user_is_admin());
