begin;

-- Temporarily disable receipt-vs-expenditure over-allocation warnings while
-- retaining funding allocations and the balance/evaluation functions so the
-- feature can be restored without redesigning the expenditure model.
delete from public.entry_data_quality_warnings
where warning_code = 'funding_source_over_allocated';

create or replace function app_private.sync_expenditure_funding_warnings(
  p_expenditure_entry_id uuid
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  -- Allocation replacement still invokes this function. Delete any legacy
  -- warning for the entry, but do not generate a new one while disabled.
  delete from public.entry_data_quality_warnings
  where entry_type = 'expenditure_entry'
    and entry_id = p_expenditure_entry_id
    and warning_code = 'funding_source_over_allocated';
end;
$$;

commit;
