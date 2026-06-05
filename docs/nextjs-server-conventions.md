# Next.js Server Conventions

Privileged workflows live outside the browser. Use Next.js App Router route handlers and server-only modules for work that needs secrets, service-role access, Resend email delivery, import writes, export generation, storage signing, or any operation that must not trust client-side authorization alone.

## Rules

- Browser code may use only `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`.
- Route handlers and server modules may read `SUPABASE_SERVICE_ROLE_KEY`, `RESEND_API_KEY`, and workflow-specific secrets.
- Every privileged route handler must validate the caller from the `Authorization` header before using service-role privileges.
- Service-role writes must still perform domain authorization checks against `profiles` and `user_mda_memberships`.
- Import handlers validate row-level errors before writing rows.
- Export handlers persist an `export_jobs` row before creating downloadable output.
- Email handlers record `email_delivery_events`, including failure responses.

## Suggested locations

- `src/lib/server/` contains auth, env, and shared server helpers.
- `app/api/workflows/send-email/route.ts` records email delivery attempts through Resend.
- `app/api/imports/validate/route.ts` checks upload rows before any write.
- `app/api/exports/generate/route.ts` creates CSV, XLSX, or PDF outputs from selected filters.

## Supabase clients

- `src/lib/supabase/client.ts` creates the browser client for interactive UI.
- `src/lib/supabase/server.ts` creates the cookie-aware server client for SSR and middleware session refresh.
- `src/lib/server/auth.ts` creates the service-role client for privileged route handlers.
