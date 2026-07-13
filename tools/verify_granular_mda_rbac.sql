-- Granular MDA RBAC verification harness.
--
-- Intended for a local/staging database after applying migrations. If running
-- in plain Postgres, load tools/verify_supabase_stubs.sql before migrations.
-- The script creates isolated test rows, switches to authenticated role, and
-- exercises the core allow/deny cases.

begin;

do $$
declare
  funding_user uuid := '10000000-0000-0000-0000-000000000001';
  expenditure_user uuid := '10000000-0000-0000-0000-000000000002';
  reviewer_user uuid := '10000000-0000-0000-0000-000000000003';
  admin_user uuid := '10000000-0000-0000-0000-000000000004';
  mda_a uuid := '20000000-0000-0000-0000-000000000001';
  mda_b uuid := '20000000-0000-0000-0000-000000000002';
  programme uuid := '30000000-0000-0000-0000-000000000001';
  source_id uuid := '30000000-0000-0000-0000-000000000002';
  category_id uuid := '30000000-0000-0000-0000-000000000003';
  method_id uuid := '30000000-0000-0000-0000-000000000004';
  funding_entry uuid := '40000000-0000-0000-0000-000000000001';
begin
  insert into auth.users (id)
  values (funding_user), (expenditure_user), (reviewer_user), (admin_user)
  on conflict (id) do nothing;

  insert into public.profiles (id, full_name, role)
  values
    (funding_user, 'RBAC Funding Submitter', 'mda_user'),
    (expenditure_user, 'RBAC Expenditure Submitter', 'mda_user'),
    (reviewer_user, 'RBAC Reviewer', 'reviewer'),
    (admin_user, 'RBAC Admin', 'admin')
  on conflict (id) do update set role = excluded.role;

  insert into public.mdas (id, code, name)
  values
    (mda_a, 'RBAC-A', 'RBAC Test MDA A'),
    (mda_b, 'RBAC-B', 'RBAC Test MDA B')
  on conflict (id) do nothing;

  insert into public.programme_areas (id, slug, name)
  values (programme, 'rbac-programme', 'RBAC Programme')
  on conflict (id) do nothing;

  insert into public.funding_sources (id, slug, name)
  values (source_id, 'rbac-source', 'RBAC Source')
  on conflict (id) do nothing;

  insert into public.expenditure_categories (id, slug, name)
  values (category_id, 'rbac-category', 'RBAC Category')
  on conflict (id) do nothing;

  insert into public.payment_methods (id, slug, name)
  values (method_id, 'rbac-method', 'RBAC Method')
  on conflict (id) do nothing;

  insert into public.user_mda_memberships (user_id, mda_id, membership_role)
  values
    (funding_user, mda_a, 'funding_submitter'),
    (expenditure_user, mda_a, 'expenditure_submitter'),
    (reviewer_user, mda_a, 'reviewer')
  on conflict (user_id, mda_id, membership_role) do nothing;

  insert into public.funding_entries (
    id,
    transaction_date,
    mda_id,
    funding_source_id,
    programme_area_id,
    amount,
    reference_no,
    entered_by,
    status
  )
  values (
    funding_entry,
    current_date,
    mda_a,
    source_id,
    programme,
    100,
    'RBAC-REVIEW-1',
    funding_user,
    'pending'
  )
  on conflict (id) do update set status = 'pending';
end $$;

set local role authenticated;

-- Funding submitter can insert funding for granted MDA.
select set_config('request.jwt.claim.sub', '10000000-0000-0000-0000-000000000001', true);
insert into public.funding_entries (
  transaction_date,
  mda_id,
  funding_source_id,
  programme_area_id,
  amount,
  reference_no,
  entered_by
)
values (
  current_date,
  '20000000-0000-0000-0000-000000000001',
  '30000000-0000-0000-0000-000000000002',
  '30000000-0000-0000-0000-000000000001',
  1,
  'RBAC-FUNDING-ALLOW',
  '10000000-0000-0000-0000-000000000001'
);

-- Funding-only submitter cannot insert expenditure.
do $$
begin
  perform set_config('request.jwt.claim.sub', '10000000-0000-0000-0000-000000000001', true);
  insert into public.expenditure_entries (
    transaction_date,
    mda_id,
    expenditure_category_id,
    programme_area_id,
    amount,
    voucher_ref_no,
    payment_method_id,
    entered_by
  )
  values (
    current_date,
    '20000000-0000-0000-0000-000000000001',
    '30000000-0000-0000-0000-000000000003',
    '30000000-0000-0000-0000-000000000001',
    1,
    'RBAC-FUNDING-EXPENDITURE-DENY',
    '30000000-0000-0000-0000-000000000004',
    '10000000-0000-0000-0000-000000000001'
  );
  raise exception 'Funding-only submitter expenditure insert unexpectedly succeeded.';
exception
  when insufficient_privilege then
    raise notice 'Funding-only submitter expenditure insert denied as expected.';
end $$;

-- Expenditure submitter can insert expenditure for granted MDA.
select set_config('request.jwt.claim.sub', '10000000-0000-0000-0000-000000000002', true);
insert into public.expenditure_entries (
  transaction_date,
  mda_id,
  expenditure_category_id,
  programme_area_id,
  amount,
  voucher_ref_no,
  payment_method_id,
  entered_by
)
values (
  current_date,
  '20000000-0000-0000-0000-000000000001',
  '30000000-0000-0000-0000-000000000003',
  '30000000-0000-0000-0000-000000000001',
  1,
  'RBAC-EXPENDITURE-ALLOW',
  '30000000-0000-0000-0000-000000000004',
  '10000000-0000-0000-0000-000000000002'
);

-- Expenditure-only submitter cannot insert funding.
do $$
begin
  perform set_config('request.jwt.claim.sub', '10000000-0000-0000-0000-000000000002', true);
  insert into public.funding_entries (
    transaction_date,
    mda_id,
    funding_source_id,
    programme_area_id,
    amount,
    reference_no,
    entered_by
  )
  values (
    current_date,
    '20000000-0000-0000-0000-000000000001',
    '30000000-0000-0000-0000-000000000002',
    '30000000-0000-0000-0000-000000000001',
    1,
    'RBAC-EXPENDITURE-FUNDING-DENY',
    '10000000-0000-0000-0000-000000000002'
  );
  raise exception 'Expenditure-only submitter funding insert unexpectedly succeeded.';
exception
  when insufficient_privilege then
    raise notice 'Expenditure-only submitter funding insert denied as expected.';
end $$;

-- Reviewer cannot insert funding or expenditure.
do $$
begin
  perform set_config('request.jwt.claim.sub', '10000000-0000-0000-0000-000000000003', true);
  insert into public.funding_entries (
    transaction_date,
    mda_id,
    funding_source_id,
    programme_area_id,
    amount,
    reference_no,
    entered_by
  )
  values (
    current_date,
    '20000000-0000-0000-0000-000000000001',
    '30000000-0000-0000-0000-000000000002',
    '30000000-0000-0000-0000-000000000001',
    1,
    'RBAC-REVIEWER-FUNDING-DENY',
    '10000000-0000-0000-0000-000000000003'
  );
  raise exception 'Reviewer funding insert unexpectedly succeeded.';
exception
  when insufficient_privilege then
    raise notice 'Reviewer funding insert denied as expected.';
end $$;

-- Reviewer status workflow succeeds.
select set_config('request.jwt.claim.sub', '10000000-0000-0000-0000-000000000003', true);
select public.review_entry(
  'funding_entry',
  '40000000-0000-0000-0000-000000000001',
  'approve',
  null,
  'RBAC reviewer approval'
);

-- Reviewer field correction must fail with 42501.
do $$
begin
  perform public.update_reviewed_funding_entry(
    '40000000-0000-0000-0000-000000000001',
    'RBAC reviewer should not edit fields',
    current_date,
    '20000000-0000-0000-0000-000000000001',
    '30000000-0000-0000-0000-000000000001',
    '30000000-0000-0000-0000-000000000002',
    999,
    'RBAC-REVIEWER-DENY',
    null
  );
  raise exception 'Reviewer field correction unexpectedly succeeded.';
exception
  when insufficient_privilege then
    raise notice 'Reviewer field correction denied as expected.';
end $$;

-- Admin field correction succeeds; run this after confirming the reviewer
-- denial above fails as expected.
select set_config('request.jwt.claim.sub', '10000000-0000-0000-0000-000000000004', true);
select public.update_reviewed_funding_entry(
  '40000000-0000-0000-0000-000000000001',
  'RBAC admin correction',
  current_date,
  '20000000-0000-0000-0000-000000000001',
  '30000000-0000-0000-0000-000000000001',
  '30000000-0000-0000-0000-000000000002',
  111,
  'RBAC-ADMIN-ALLOW',
  null
);

rollback;
