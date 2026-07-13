import { NextResponse } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import { requireAuthenticatedUser } from "@/lib/server/auth";

export async function requireAdminActor(request: Request) {
  let serviceClient;
  let actorId: string;
  try {
    const auth = await requireAuthenticatedUser(request);
    serviceClient = auth.serviceClient;
    actorId = auth.user.id;
  } catch (error) {
    return {
      error: NextResponse.json(
        { error: error instanceof Error ? error.message : "Unauthorized" },
        { status: 401 },
      ),
    };
  }

  const { data: actorProfile, error: actorError } = await serviceClient
    .from("profiles")
    .select("role")
    .eq("id", actorId)
    .maybeSingle();

  if (actorError) {
    return {
      error: NextResponse.json({ error: actorError.message }, { status: 500 }),
    };
  }
  if (!actorProfile || actorProfile.role !== "admin") {
    return {
      error: NextResponse.json(
        { error: "Only admins can manage users." },
        { status: 403 },
      ),
    };
  }

  return { serviceClient, actorId };
}

export async function replaceUserScope(
  serviceClient: SupabaseClient,
  userId: string,
  role: string,
  access: {
    mda_id: string | null;
    facility_ids: string[];
    membershipRows: Array<{
      user_id: string;
      mda_id: string;
      membership_role: string;
    }>;
  },
) {
  await serviceClient
    .from("user_mda_memberships")
    .delete()
    .eq("user_id", userId);
  await serviceClient
    .from("user_facility_assignments")
    .delete()
    .eq("user_id", userId);

  if (role === "facility_user" && access.mda_id) {
    const rows = access.facility_ids.map((facilityId) => ({
      user_id: userId,
      facility_id: facilityId,
      mda_id: access.mda_id!,
    }));
    const { error } = await serviceClient
      .from("user_facility_assignments")
      .insert(rows);
    if (error) return error;
  } else if (access.membershipRows.length > 0) {
    const { error } = await serviceClient
      .from("user_mda_memberships")
      .insert(access.membershipRows);
    if (error) return error;
  }

  return null;
}
