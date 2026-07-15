import { NextResponse } from "next/server";
import {
  buildMembershipRows,
  parseStringArray,
  validateUserAccess,
} from "@/lib/admin/user-access";
import type { AdminUserRecord } from "@/lib/admin/users";
import {
  requireAdminActor,
  replaceUserScope,
} from "@/lib/server/admin-users";

function relationOne<T>(value: T | T[] | null | undefined): T | null {
  if (Array.isArray(value)) return value[0] ?? null;
  return value ?? null;
}

const ALLOWED_ROLES = ["admin", "reviewer", "mda_user", "facility_user"] as const;
type AllowedRole = (typeof ALLOWED_ROLES)[number];

type UpdateUserBody = {
  full_name?: unknown;
  role?: unknown;
  facility_ids?: unknown;
  mda_id?: unknown;
  funding_mda_ids?: unknown;
  expenditure_mda_ids?: unknown;
};

function badRequest(message: string) {
  return NextResponse.json({ error: message }, { status: 400 });
}

export async function PATCH(
  request: Request,
  context: { params: Promise<{ userId: string }> },
) {
  const auth = await requireAdminActor(request);
  if ("error" in auth) return auth.error;
  const { serviceClient, actorId } = auth;
  const { userId } = await context.params;

  let body: UpdateUserBody;
  try {
    body = (await request.json()) as UpdateUserBody;
  } catch {
    return badRequest("Request body must be valid JSON.");
  }

  const fullName =
    typeof body.full_name === "string" ? body.full_name.trim() : "";
  const role = body.role as AllowedRole;
  const access = {
    mda_id: typeof body.mda_id === "string" ? body.mda_id : null,
    facility_ids: parseStringArray(body.facility_ids),
    funding_mda_ids: parseStringArray(body.funding_mda_ids),
    expenditure_mda_ids: parseStringArray(body.expenditure_mda_ids),
  };

  if (!fullName) return badRequest("Full name is required.");
  if (!ALLOWED_ROLES.includes(role)) {
    return badRequest("Role must be admin, reviewer, mda_user, or facility_user.");
  }

  const accessError = validateUserAccess(role, access);
  if (accessError) return badRequest(accessError);

  const { data: existing, error: existingError } = await serviceClient
    .from("profiles")
    .select("id, role, full_name")
    .eq("id", userId)
    .maybeSingle();

  if (existingError) {
    return NextResponse.json({ error: existingError.message }, { status: 500 });
  }
  if (!existing) {
    return NextResponse.json({ error: "User not found." }, { status: 404 });
  }

  if (userId === actorId && role !== "admin") {
    return badRequest("You cannot remove your own admin access.");
  }

  const { error: profileError } = await serviceClient
    .from("profiles")
    .update({ full_name: fullName, role })
    .eq("id", userId);
  if (profileError) {
    return NextResponse.json({ error: profileError.message }, { status: 400 });
  }

  const scopeError = await replaceUserScope(serviceClient, userId, role, {
    mda_id: access.mda_id,
    facility_ids: access.facility_ids,
    membershipRows: buildMembershipRows(userId, role, access),
  });
  if (scopeError) {
    return NextResponse.json({ error: scopeError.message }, { status: 400 });
  }

  const { data: authUser } = await serviceClient.auth.admin.getUserById(userId);

  const { data: updatedProfile, error: reloadError } = await serviceClient
    .from("profiles")
    .select(
      `
      id,
      full_name,
      role,
      user_mda_memberships (
        mda_id,
        membership_role,
        mdas ( name, abbreviation )
      ),
      user_facility_assignments (
        facility_id,
        mda_id,
        facilities ( name ),
        mdas ( name, abbreviation )
      )
    `,
    )
    .eq("id", userId)
    .maybeSingle();

  if (reloadError || !updatedProfile) {
    return NextResponse.json(
      { error: reloadError?.message ?? "User updated but could not be reloaded." },
      { status: 500 },
    );
  }

  const user: AdminUserRecord = {
    id: updatedProfile.id,
    email: authUser.user?.email ?? "unknown@user.local",
    full_name: updatedProfile.full_name,
    role: updatedProfile.role as AllowedRole,
    memberships: (updatedProfile.user_mda_memberships ?? []).map((membership) => {
      const mda = relationOne(membership.mdas);
      return {
        mda_id: membership.mda_id,
        membership_role:
          membership.membership_role as AdminUserRecord["memberships"][number]["membership_role"],
        mda_name: mda?.name ?? membership.mda_id,
        mda_abbreviation: mda?.abbreviation ?? null,
      };
    }),
    facility_assignments: (updatedProfile.user_facility_assignments ?? []).map(
      (assignment) => {
        const facility = relationOne(assignment.facilities);
        const mda = relationOne(assignment.mdas);
        return {
          facility_id: assignment.facility_id,
          facility_name: facility?.name ?? assignment.facility_id,
          mda_id: assignment.mda_id,
          mda_name: mda?.name ?? assignment.mda_id,
          mda_abbreviation: mda?.abbreviation ?? null,
        };
      },
    ),
  };

  await serviceClient
    .from("entry_audit_events")
    .insert({
      entity_type: "profile",
      entity_id: userId,
      entity_key: user.email,
      event_type: "user_access_updated",
      old_values: {
        role: existing.role,
        full_name: existing.full_name,
      },
      new_values: {
        role,
        full_name: fullName,
        facility_ids: access.facility_ids,
        mda_id: access.mda_id,
        funding_mda_ids: access.funding_mda_ids,
        expenditure_mda_ids: access.expenditure_mda_ids,
      },
      actor_id: actorId,
    })
    .then(
      () => undefined,
      () => undefined,
    );

  return NextResponse.json({ user });
}
