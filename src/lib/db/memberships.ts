import type { User } from "@supabase/supabase-js";
import type { TypedSupabaseClient } from "@/lib/supabase/client";
import type { Tables } from "@/lib/db/types";
import type { AppProfile, MdaMembership } from "@/lib/auth-types";

type Client = TypedSupabaseClient;

type MembershipRow = Tables<"user_mda_memberships"> & {
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

  const [profileResult, membershipResult] = await Promise.all([
    client
      .from("profiles")
      .select("id, full_name, role")
      .eq("id", user.id)
      .maybeSingle(),
    client
      .from("user_mda_memberships")
      .select("id, mda_id, membership_role, mdas(id, name, abbreviation)")
      .eq("user_id", user.id),
  ]);

  const profileRow = profileResult.data as
    | Pick<Tables<"profiles">, "id" | "full_name" | "role">
    | null;
  const memberships = normalizeMemberships(
    (membershipResult.data ?? []) as MembershipRow[],
  );

  return {
    id: user.id,
    full_name: profileRow?.full_name ?? fallbackName,
    role: profileRow?.role ?? "mda_user",
    memberships,
  };
}

function normalizeMemberships(rows: MembershipRow[]): MdaMembership[] {
  return rows.map((row) => ({
    id: row.id,
    mda_id: row.mda_id,
    membership_role: row.membership_role,
    mdas: Array.isArray(row.mdas) ? (row.mdas[0] ?? null) : (row.mdas ?? null),
  }));
}
