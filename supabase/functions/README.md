# Supabase Edge Function Conventions

Privileged workflows live outside the browser. Use Supabase Edge Functions for work that needs secrets, service-role access, Resend email delivery, import writes, export generation, storage signing, or any operation that must not trust client-side authorization alone.

## Rules

- Browser code may use only `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY`.
- Edge Functions may read `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `RESEND_API_KEY`, and workflow-specific secrets.
- Every function must validate the caller from the `Authorization` header before using service-role privileges.
- Service-role writes must still perform domain authorization checks against `profiles` and `user_mda_memberships`.
- Import functions validate row-level errors before writing rows.
- Export functions persist an `export_jobs` row before creating downloadable output.
- Email functions record `email_delivery_events`, including failure responses.

## Suggested folders

- `_shared/` contains auth, CORS, env, and response helpers.
- `send-workflow-email/` records email delivery attempts through Resend.
- `validate-import/` checks upload rows before any write.
- `generate-export/` creates CSV, XLSX, or PDF outputs from selected filters.
