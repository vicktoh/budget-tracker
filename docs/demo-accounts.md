# Demo Accounts

These accounts are seeded by `supabase/seeds/004_demo_users.sql` after reference data is loaded. Use them for local development and staging sign-in with **email and password** at `/sign-in`.

**Do not use these credentials in production.** Change or remove demo users before go-live.

## Shared password

All demo accounts use the same password:

```
ChangeMe123!
```

## Accounts

| Email | Password | Role | MDA access |
| --- | --- | --- | --- |
| `admin@example.gov.ng` | `ChangeMe123!` | Admin | All MDAs (admin bypass) |
| `mda@example.gov.ng` | `ChangeMe123!` | MDA user | Ministry of Health (HQ) — submitter |
| `reviewer@example.gov.ng` | `ChangeMe123!` | Viewer | Statewide entry register, comments, warnings, audit, and reports (internal role slug: `reviewer`) |
| `facility@example.gov.ng` | `ChangeMe123!` | Facility user | Ministry of Health (HQ) — assigned PHC |

## Re-seeding

To recreate demo users after a database reset:

```bash
psql "$DATABASE_URL" -f supabase/seeds/004_demo_users.sql
```

Run this only after `001_reference_data.sql` so MDA memberships can resolve **Ministry of Health (HQ)**.
