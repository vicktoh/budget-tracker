begin;

-- Supabase projects may grant new functions directly to anon/authenticated via
-- default privileges. Revoke every client-facing grant explicitly, then grant
-- only the signed-in execution surface intended by these RPCs.
revoke all on function public.publish_budget_implementation_report(int, smallint) from public, anon, authenticated;
revoke all on function public.correct_unpublished_funding_entry(uuid, text, date, uuid, uuid, uuid, numeric, text, text) from public, anon, authenticated;
revoke all on function public.correct_unpublished_expenditure_entry(uuid, text, date, uuid, uuid, uuid, uuid, uuid, boolean, uuid, uuid, numeric, text, uuid, text, jsonb) from public, anon, authenticated;
revoke all on function public.amend_published_funding_entry(uuid, text, date, uuid, uuid, uuid, numeric, text, text) from public, anon, authenticated;
revoke all on function public.amend_published_expenditure_entry(uuid, text, date, uuid, uuid, uuid, uuid, uuid, boolean, uuid, uuid, numeric, text, uuid, text, jsonb) from public, anon, authenticated;
revoke all on function public.replace_expenditure_funding_allocations(uuid, jsonb) from public, anon, authenticated;

grant execute on function public.publish_budget_implementation_report(int, smallint) to authenticated;
grant execute on function public.correct_unpublished_funding_entry(uuid, text, date, uuid, uuid, uuid, numeric, text, text) to authenticated;
grant execute on function public.correct_unpublished_expenditure_entry(uuid, text, date, uuid, uuid, uuid, uuid, uuid, boolean, uuid, uuid, numeric, text, uuid, text, jsonb) to authenticated;
grant execute on function public.amend_published_funding_entry(uuid, text, date, uuid, uuid, uuid, numeric, text, text) to authenticated;
grant execute on function public.amend_published_expenditure_entry(uuid, text, date, uuid, uuid, uuid, uuid, uuid, boolean, uuid, uuid, numeric, text, uuid, text, jsonb) to authenticated;
grant execute on function public.replace_expenditure_funding_allocations(uuid, jsonb) to authenticated;

commit;
