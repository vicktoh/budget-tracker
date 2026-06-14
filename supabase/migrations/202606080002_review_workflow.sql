-- Slice 5: Reviewer/Admin Entry Detail, Comments, and Status Workflow.
-- Adds:
--   * review_entry(p_entry_type, p_entry_id, p_action, p_reason, p_comment)
--     RPC that validates the state-machine transition, sets app.audit_reason
--     so the existing audit trigger records the reason, updates status +
--     approved_by/approved_at, and optionally records a comment.
--   * resubmit_entry(p_entry_type, p_entry_id) RPC that lets the original
--     submitter return a rejected entry to pending.
--   * update_reviewed_funding_entry / update_reviewed_expenditure_entry RPCs
--     that let reviewers/admins edit non-pending entries with a mandatory
--     audit reason captured in the same transaction.
--   * current_user_can_view_entry_audit() helper + an entry_audit_events
--     SELECT policy so reviewers can see history for their MDA entries.
--
-- State machine (from ADR notes):
--   pending  -> approved | rejected
--   approved -> processed | rejected
--   rejected -> pending  (resubmit, original submitter only)
--   processed: terminal.

create or replace function app_private.current_user_can_view_entry_audit(
  target_entity_type text,
  target_entity_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select case
    when app_private.current_user_is_admin() then true
    when target_entity_type = 'funding_entries' then exists (
      select 1
      from public.funding_entries
      where id = target_entity_id
        and app_private.current_user_can_review_mda(mda_id)
    )
    when target_entity_type = 'expenditure_entries' then exists (
      select 1
      from public.expenditure_entries
      where id = target_entity_id
        and app_private.current_user_can_review_mda(mda_id)
    )
    else false
  end;
$$;

create policy "audit_select_entry_reviewers" on public.entry_audit_events
for select to authenticated
using (
  entity_id is not null
  and app_private.current_user_can_view_entry_audit(entity_type, entity_id)
);

-- review_entry: status transitions for reviewers and admins.
create or replace function public.review_entry(
  p_entry_type text,
  p_entry_id uuid,
  p_action text,
  p_reason text default null,
  p_comment text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  current_status text;
  entry_mda uuid;
  next_status text;
  comment_kind text;
  trimmed_reason text;
  trimmed_comment text;
  reviewer_id uuid := (select auth.uid());
begin
  if reviewer_id is null then
    raise exception 'Not authenticated.' using errcode = '28000';
  end if;

  if p_entry_type not in ('funding_entry', 'expenditure_entry') then
    raise exception 'Unknown entry type: %', p_entry_type using errcode = '22023';
  end if;

  if p_action not in ('approve', 'reject', 'process') then
    raise exception 'Unknown review action: %', p_action using errcode = '22023';
  end if;

  if p_entry_type = 'funding_entry' then
    select status, mda_id into current_status, entry_mda
    from public.funding_entries where id = p_entry_id;
  else
    select status, mda_id into current_status, entry_mda
    from public.expenditure_entries where id = p_entry_id;
  end if;

  if current_status is null then
    raise exception 'Entry not found.' using errcode = '02000';
  end if;

  if not app_private.current_user_can_review_mda(entry_mda) then
    raise exception 'You do not have permission to review entries for this MDA.'
      using errcode = '42501';
  end if;

  -- State machine.
  next_status := case
    when p_action = 'approve'  and current_status = 'pending'  then 'approved'
    when p_action = 'process'  and current_status = 'approved' then 'processed'
    when p_action = 'reject'   and current_status in ('pending', 'approved') then 'rejected'
    else null
  end;

  if next_status is null then
    raise exception 'Cannot % an entry that is currently %.', p_action, current_status
      using errcode = '22023';
  end if;

  trimmed_reason  := nullif(btrim(coalesce(p_reason, '')), '');
  trimmed_comment := nullif(btrim(coalesce(p_comment, '')), '');

  if p_action = 'reject' and trimmed_comment is null and trimmed_reason is null then
    raise exception 'A rejection reason is required.' using errcode = '22023';
  end if;

  -- Stamp the audit reason on the audit row written by audit_row_change().
  perform set_config(
    'app.audit_reason',
    coalesce(trimmed_reason, trimmed_comment, ''),
    true
  );

  if p_entry_type = 'funding_entry' then
    update public.funding_entries
       set status = next_status,
           approved_by = case
             when next_status in ('approved', 'processed', 'rejected') then reviewer_id
             else approved_by
           end,
           approved_at = case
             when next_status in ('approved', 'processed', 'rejected') then now()
             else approved_at
           end
     where id = p_entry_id;
  else
    update public.expenditure_entries
       set status = next_status,
           approved_by = case
             when next_status in ('approved', 'processed', 'rejected') then reviewer_id
             else approved_by
           end,
           approved_at = case
             when next_status in ('approved', 'processed', 'rejected') then now()
             else approved_at
           end
     where id = p_entry_id;
  end if;

  -- Persist the operator's note alongside the audit trail.
  if trimmed_comment is not null then
    comment_kind := case
      when p_action = 'reject'  then 'rejection_reason'
      when p_action = 'approve' then 'approval_note'
      else 'general'
    end;
    insert into public.entry_comments (entry_type, entry_id, body, comment_type, author_id)
    values (p_entry_type, p_entry_id, trimmed_comment, comment_kind, reviewer_id);
  end if;
end;
$$;

revoke all on function public.review_entry(text, uuid, text, text, text) from public;
grant execute on function public.review_entry(text, uuid, text, text, text) to authenticated;

-- resubmit_entry: original submitter returns a rejected entry to pending.
create or replace function public.resubmit_entry(
  p_entry_type text,
  p_entry_id uuid
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  current_status text;
  current_entered_by uuid;
  submitter_id uuid := (select auth.uid());
begin
  if submitter_id is null then
    raise exception 'Not authenticated.' using errcode = '28000';
  end if;

  if p_entry_type not in ('funding_entry', 'expenditure_entry') then
    raise exception 'Unknown entry type: %', p_entry_type using errcode = '22023';
  end if;

  if p_entry_type = 'funding_entry' then
    select status, entered_by into current_status, current_entered_by
    from public.funding_entries where id = p_entry_id;
  else
    select status, entered_by into current_status, current_entered_by
    from public.expenditure_entries where id = p_entry_id;
  end if;

  if current_status is null then
    raise exception 'Entry not found.' using errcode = '02000';
  end if;

  if current_entered_by is distinct from submitter_id then
    raise exception 'Only the original submitter can resubmit a rejected entry.'
      using errcode = '42501';
  end if;

  if current_status <> 'rejected' then
    raise exception 'Only rejected entries can be resubmitted (current status: %).', current_status
      using errcode = '22023';
  end if;

  perform set_config('app.audit_reason', 'Resubmitted by author', true);

  if p_entry_type = 'funding_entry' then
    update public.funding_entries
       set status = 'pending',
           approved_by = null,
           approved_at = null
     where id = p_entry_id;
  else
    update public.expenditure_entries
       set status = 'pending',
           approved_by = null,
           approved_at = null
     where id = p_entry_id;
  end if;
end;
$$;

revoke all on function public.resubmit_entry(text, uuid) from public;
grant execute on function public.resubmit_entry(text, uuid) to authenticated;

-- update_reviewed_funding_entry: edit a non-pending entry as a reviewer/admin,
-- capturing a mandatory audit reason in the same transaction.
create or replace function public.update_reviewed_funding_entry(
  p_id uuid,
  p_reason text,
  p_transaction_date date,
  p_mda_id uuid,
  p_programme_area_id uuid,
  p_funding_source_id uuid,
  p_amount numeric,
  p_reference_no text,
  p_remarks text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  current_status text;
  current_mda uuid;
  trimmed_reason text := nullif(btrim(coalesce(p_reason, '')), '');
begin
  if trimmed_reason is null then
    raise exception 'An audit reason is required for reviewed-entry edits.'
      using errcode = '22023';
  end if;

  select status, mda_id into current_status, current_mda
  from public.funding_entries where id = p_id;

  if current_status is null then
    raise exception 'Entry not found.' using errcode = '02000';
  end if;

  if not app_private.current_user_can_review_mda(current_mda) then
    raise exception 'You do not have permission to edit entries for this MDA.'
      using errcode = '42501';
  end if;

  if not app_private.current_user_can_review_mda(p_mda_id) then
    raise exception 'You do not have permission to assign this entry to that MDA.'
      using errcode = '42501';
  end if;

  perform set_config('app.audit_reason', trimmed_reason, true);

  update public.funding_entries
     set transaction_date = p_transaction_date,
         mda_id = p_mda_id,
         programme_area_id = p_programme_area_id,
         funding_source_id = p_funding_source_id,
         amount = p_amount,
         reference_no = p_reference_no,
         remarks = p_remarks
   where id = p_id;
end;
$$;

revoke all on function public.update_reviewed_funding_entry(
  uuid, text, date, uuid, uuid, uuid, numeric, text, text
) from public;
grant execute on function public.update_reviewed_funding_entry(
  uuid, text, date, uuid, uuid, uuid, numeric, text, text
) to authenticated;

-- update_reviewed_expenditure_entry: same shape for expenditure rows.
create or replace function public.update_reviewed_expenditure_entry(
  p_id uuid,
  p_reason text,
  p_transaction_date date,
  p_mda_id uuid,
  p_programme_area_id uuid,
  p_expenditure_category_id uuid,
  p_expenditure_item_id uuid,
  p_aop_activity_id uuid,
  p_is_phc boolean,
  p_lga_id uuid,
  p_facility_id uuid,
  p_amount numeric,
  p_voucher_ref_no text,
  p_payment_method_id uuid,
  p_remarks text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  current_status text;
  current_mda uuid;
  trimmed_reason text := nullif(btrim(coalesce(p_reason, '')), '');
begin
  if trimmed_reason is null then
    raise exception 'An audit reason is required for reviewed-entry edits.'
      using errcode = '22023';
  end if;

  select status, mda_id into current_status, current_mda
  from public.expenditure_entries where id = p_id;

  if current_status is null then
    raise exception 'Entry not found.' using errcode = '02000';
  end if;

  if not app_private.current_user_can_review_mda(current_mda) then
    raise exception 'You do not have permission to edit entries for this MDA.'
      using errcode = '42501';
  end if;

  if not app_private.current_user_can_review_mda(p_mda_id) then
    raise exception 'You do not have permission to assign this entry to that MDA.'
      using errcode = '42501';
  end if;

  perform set_config('app.audit_reason', trimmed_reason, true);

  update public.expenditure_entries
     set transaction_date = p_transaction_date,
         mda_id = p_mda_id,
         programme_area_id = p_programme_area_id,
         expenditure_category_id = p_expenditure_category_id,
         expenditure_item_id = p_expenditure_item_id,
         aop_activity_id = p_aop_activity_id,
         is_phc = p_is_phc,
         lga_id = p_lga_id,
         facility_id = p_facility_id,
         amount = p_amount,
         voucher_ref_no = p_voucher_ref_no,
         payment_method_id = p_payment_method_id,
         remarks = p_remarks
   where id = p_id;
end;
$$;

revoke all on function public.update_reviewed_expenditure_entry(
  uuid, text, date, uuid, uuid, uuid, uuid, uuid, boolean, uuid, uuid,
  numeric, text, uuid, text
) from public;
grant execute on function public.update_reviewed_expenditure_entry(
  uuid, text, date, uuid, uuid, uuid, uuid, uuid, boolean, uuid, uuid,
  numeric, text, uuid, text
) to authenticated;
