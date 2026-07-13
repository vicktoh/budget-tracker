-- Reviewers review all MDAs.
--
-- Previously a reviewer's scope was expressed as `reviewer` rows in
-- user_mda_memberships, and RLS bounded the review queue / approvals / audit
-- visibility / reporting to those MDAs. We now make the `reviewer` role mean
-- "can review every MDA" -- automatically, including MDAs created later --
-- mirroring how the admin role already short-circuits access.

-- New role predicate, mirroring app_private.current_user_is_admin().
create or replace function app_private.current_user_is_reviewer()
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
      and role = 'reviewer'
  );
$$;

-- Review capability is now purely role-based (admin or reviewer). The
-- per-MDA membership-row branch is dropped; MDA users can no longer review.
create or replace function app_private.current_user_can_review_mda(target_mda_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select app_private.current_user_is_admin()
    or app_private.current_user_is_reviewer();
$$;

-- Reviewers can view entries across every MDA. MDA users keep view access
-- through their own memberships (funding / expenditure submitter rows).
create or replace function app_private.current_user_can_view_mda(target_mda_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select app_private.current_user_is_admin()
    or app_private.current_user_is_reviewer()
    or exists (
      select 1
      from public.user_mda_memberships
      where user_id = (select auth.uid())
        and mda_id = target_mda_id
    );
$$;

-- Legacy per-MDA reviewer assignments are now meaningless. Removing them also
-- strips the incidental view access that mixed MDA-user accounts held via
-- reviewer rows (intended: review is only via the reviewer role now).
delete from public.user_mda_memberships
where membership_role = 'reviewer';
