-- Demo auth users for local/staging sign-in with email + password.
-- Default password for all accounts: ChangeMe123!
-- Run after reference data so MDA memberships can resolve MDAs.

begin;

create extension if not exists pgcrypto;

do $$
declare
  demo_password text := crypt('ChangeMe123!', gen_salt('bf'));
  admin_id uuid := '00000000-0000-0000-0000-000000000001';
  mda_user_id uuid := '00000000-0000-0000-0000-000000000002';
  reviewer_id uuid := '00000000-0000-0000-0000-000000000003';
  facility_user_id uuid := '00000000-0000-0000-0000-000000000004';
  mda_hq_id uuid;
  demo_facility_id uuid;
begin
  select id into mda_hq_id from public.mdas where name = 'Ministry of Health (HQ)' limit 1;
  select id into demo_facility_id
    from public.facilities
    where lower(facility_type) = 'phc' and active
    order by name
    limit 1;

  insert into auth.users (
    instance_id,
    id,
    aud,
    role,
    email,
    encrypted_password,
    email_confirmed_at,
    raw_app_meta_data,
    raw_user_meta_data,
    created_at,
    updated_at,
    confirmation_token,
    email_change,
    email_change_token_new,
    recovery_token
  )
  values
    (
      '00000000-0000-0000-0000-000000000000',
      admin_id,
      'authenticated',
      'authenticated',
      'admin@example.gov.ng',
      demo_password,
      now(),
      '{"provider":"email","providers":["email"]}',
      '{"full_name":"Admin User"}',
      now(),
      now(),
      '',
      '',
      '',
      ''
    ),
    (
      '00000000-0000-0000-0000-000000000000',
      mda_user_id,
      'authenticated',
      'authenticated',
      'mda@example.gov.ng',
      demo_password,
      now(),
      '{"provider":"email","providers":["email"]}',
      '{"full_name":"MDA Submitter"}',
      now(),
      now(),
      '',
      '',
      '',
      ''
    ),
    (
      '00000000-0000-0000-0000-000000000000',
      reviewer_id,
      'authenticated',
      'authenticated',
      'reviewer@example.gov.ng',
      demo_password,
      now(),
      '{"provider":"email","providers":["email"]}',
      '{"full_name":"Finance Reviewer"}',
      now(),
      now(),
      '',
      '',
      '',
      ''
    ),
    (
      '00000000-0000-0000-0000-000000000000',
      facility_user_id,
      'authenticated',
      'authenticated',
      'facility@example.gov.ng',
      demo_password,
      now(),
      '{"provider":"email","providers":["email"]}',
      '{"full_name":"Facility Officer"}',
      now(),
      now(),
      '',
      '',
      '',
      ''
    )
  on conflict (id) do nothing;

  insert into auth.identities (
    id,
    user_id,
    identity_data,
    provider,
    provider_id,
    last_sign_in_at,
    created_at,
    updated_at
  )
  values
    (
      admin_id,
      admin_id,
      format('{"sub":"%s","email":"admin@example.gov.ng"}', admin_id)::jsonb,
      'email',
      admin_id::text,
      now(),
      now(),
      now()
    ),
    (
      mda_user_id,
      mda_user_id,
      format('{"sub":"%s","email":"mda@example.gov.ng"}', mda_user_id)::jsonb,
      'email',
      mda_user_id::text,
      now(),
      now(),
      now()
    ),
    (
      reviewer_id,
      reviewer_id,
      format('{"sub":"%s","email":"reviewer@example.gov.ng"}', reviewer_id)::jsonb,
      'email',
      reviewer_id::text,
      now(),
      now(),
      now()
    ),
    (
      facility_user_id,
      facility_user_id,
      format('{"sub":"%s","email":"facility@example.gov.ng"}', facility_user_id)::jsonb,
      'email',
      facility_user_id::text,
      now(),
      now(),
      now()
    )
  on conflict (provider, provider_id) do nothing;

  insert into public.profiles (id, full_name, role)
  values
    (admin_id, 'Admin User', 'admin'),
    (mda_user_id, 'MDA Submitter', 'mda_user'),
    (reviewer_id, 'Finance Reviewer', 'reviewer'),
    (facility_user_id, 'Facility Officer', 'facility_user')
  on conflict (id) do update
  set full_name = excluded.full_name,
      role = excluded.role,
      updated_at = now();

  if mda_hq_id is not null then
    insert into public.user_mda_memberships (user_id, mda_id, membership_role)
    values
      (mda_user_id, mda_hq_id, 'submitter'),
      (reviewer_id, mda_hq_id, 'reviewer')
    on conflict (user_id, mda_id, membership_role) do nothing;
  end if;

  if mda_hq_id is not null and demo_facility_id is not null then
    insert into public.user_facility_assignments (user_id, facility_id, mda_id)
    values (facility_user_id, demo_facility_id, mda_hq_id)
    on conflict (user_id, facility_id) do nothing;
  end if;
end $$;

commit;
