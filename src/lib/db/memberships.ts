import type { User } from "@supabase/supabase-js";
import type { TypedSupabaseClient } from "@/lib/supabase/client";
import type { Tables } from "@/lib/db/types";
import type {
  AppProfile,
  FacilityAssignment,
  MdaMembership,
} from "@/lib/auth-types";

type Client = TypedSupabaseClient;

type MembershipRow = Tables<"user_mda_memberships"> & {
  mdas: Pick<Tables<"mdas">, "id" | "name" | "abbreviation"> | null;
};

type FacilityAssignmentRow = Tables<"user_facility_assignments"> & {
  facilities: Pick<
    Tables<"facilities">,
    "id" | "name" | "lga_id" | "facility_type"
  > | null;
  mdas: Pick<Tables<"mdas">, "id" | "name" | "abbreviation"> | null;
};

/**
 * Load the authenticated user's profile + MDA memberships in one round-trip.
 * Falls back to a minimal `mda_user` profile when the row is missing so the
 * shell can still render while admins finish the membership setup.
 */
export async function loadProfileForUser(
  client: Client,
  user: User,
): Promise<AppProfile> {
  const fallbackName = user.email?.split("@")[0] ?? "Kano finance user";

  const [profileResult, membershipResult, facilityResult] = await Promise.all([
    client
      .from("profiles")
      .select("id, full_name, role")
      .eq("id", user.id)
      .maybeSingle(),
    client
      .from("user_mda_memberships")
      .select("id, mda_id, membership_role, mdas(id, name, abbreviation)")
      .eq("user_id", user.id),
    client
      .from("user_facility_assignments")
      .select(
        "id, facility_id, mda_id, facilities(id, name, lga_id, facility_type), mdas(id, name, abbreviation)",
      )
      .eq("user_id", user.id),
  ]);

  const profileRow = profileResult.data as
    | Pick<Tables<"profiles">, "id" | "full_name" | "role">
    | null;
  const memberships = normalizeMemberships(
    (membershipResult.data ?? []) as MembershipRow[],
  );
  const facilityAssignments = normalizeFacilityAssignments(
    (facilityResult.data ?? []) as FacilityAssignmentRow[],
  );

  return {
    id: user.id,
    full_name: profileRow?.full_name ?? fallbackName,
    role: profileRow?.role ?? "mda_user",
    memberships,
    facilityAssignments,
  };
}

function pickOne<T>(value: T[] | T | null | undefined): T | null {
  if (Array.isArray(value)) return value[0] ?? null;
  return value ?? null;
}

function normalizeFacilityAssignments(
  rows: FacilityAssignmentRow[],
): FacilityAssignment[] {
  return rows.map((row) => ({
    id: row.id,
    facility_id: row.facility_id,
    mda_id: row.mda_id,
    facilities: pickOne(row.facilities),
    mdas: pickOne(row.mdas),
  }));
}

function normalizeMemberships(rows: MembershipRow[]): MdaMembership[] {
  return rows.map((row) => ({
    id: row.id,
    mda_id: row.mda_id,
    membership_role: row.membership_role,
    mdas: Array.isArray(row.mdas) ? (row.mdas[0] ?? null) : (row.mdas ?? null),
  }));
}
