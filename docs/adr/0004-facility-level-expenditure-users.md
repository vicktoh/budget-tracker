# Facility-Level Expenditure Users And Admin User Management

## Context

PHC expenditure is currently entered by MDA-level users (`mda_user`) who manually toggle the PHC flag and select an LGA and Facility on each Expenditure Entry. We need facility staff to log their own expenditure directly, with the PHC fields fixed to their facility so they cannot misreport scope, and we need Admins to be able to provision these accounts. Today there is no facility-level scoping (`user_mda_memberships` only scopes user ↔ MDA) and no in-app user-creation surface (accounts are seeded via SQL).

## Decision

We will introduce a distinct **`facility_user`** role rather than overloading `mda_user`, and scope it with a new **`user_facility_assignments`** table keyed by `(user_id, facility_id, mda_id)`. A facility user may be assigned to multiple facilities but to exactly one MDA (the board the facilities report under, e.g. PHCMB). Role and assignment remain orthogonal concepts, mirroring the existing `profiles.role` + `user_mda_memberships` separation.

Facility users may submit **Expenditure Entries only**. On every entry `is_phc` is forced true and `mda_id`, `lga_id`, and `facility_id` are hard-locked to the user's assignment (a single facility is fully locked; multiple facilities present a constrained picker from their assigned set). These locks are enforced server-side through Row Level Security and the expenditure validation trigger, not merely disabled inputs. Facility users may edit only their own pending entries.

Visibility is **facility-scoped**: a facility user sees only the expenditure entries for their assigned facilities, tighter than an MDA `submitter`. Facility users have no Funding Entry, review, admin, import, or statewide dashboard access. Review of facility-submitted expenditure is unchanged: the MDA's reviewer and Admins act on these entries exactly as they do for any other expenditure.

Admins provision accounts through a new **Admin Users surface** backed by a trusted Next.js route handler using the Supabase service-role key (never exposed to the browser). The handler creates the `auth.users` record with an admin-set temporary password, inserts the `profiles` row with the chosen role, inserts `user_facility_assignments` rows for facility users, and records an audit event. The surface manages all roles (`admin`, `reviewer`, `mda_user`, `facility_user`), not facility users alone.

Facility-user expenditure is a **standalone direct-submission path** on the existing expenditure surface, independent of the Monthly Submission Cycle work. When the cycle work lands, facility-submitted entries roll into the relevant MDA cycle rather than being re-entered.

## Consequences

- `profiles.role` check, the `AppRole` type, capability helpers, route guards, and navigation gain a fourth role and must be updated together.
- New RLS policies and a trigger/check are required so facility writes and reads are constrained to assigned facilities; service-role code must still enforce domain authorization rather than relying on its bypass.
- Temporary-password provisioning works without live email infrastructure; forced first-login reset is deferred to security hardening.
- The expenditure form branches on role to render locked PHC context for facility users while preserving the existing MDA-user flow.
