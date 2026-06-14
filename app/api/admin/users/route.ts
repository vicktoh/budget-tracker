import { NextResponse } from "next/server";
import { requireAuthenticatedUser } from "@/lib/server/auth";

type CreateUserBody = {
  full_name?: unknown;
  email?: unknown;
  password?: unknown;
  role?: unknown;
  facility_ids?: unknown;
  mda_id?: unknown;
};

const ALLOWED_ROLES = ["admin", "reviewer", "mda_user", "facility_user"] as const;
type AllowedRole = (typeof ALLOWED_ROLES)[number];

function badRequest(message: string) {
  return NextResponse.json({ error: message }, { status: 400 });
}

export async function POST(request: Request) {
  let serviceClient;
  let actorId: string;
  try {
    const auth = await requireAuthenticatedUser(request);
    serviceClient = auth.serviceClient;
    actorId = auth.user.id;
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unauthorized" },
      { status: 401 },
    );
  }

  // Only admins may provision accounts. The service-role key bypasses RLS, so
  // we must check the caller's role explicitly here.
  const { data: actorProfile, error: actorError } = await serviceClient
    .from("profiles")
    .select("role")
    .eq("id", actorId)
    .maybeSingle();
  if (actorError) {
    return NextResponse.json({ error: actorError.message }, { status: 500 });
  }
  if (!actorProfile || actorProfile.role !== "admin") {
    return NextResponse.json(
      { error: "Only admins can create users." },
      { status: 403 },
    );
  }

  let body: CreateUserBody;
  try {
    body = (await request.json()) as CreateUserBody;
  } catch {
    return badRequest("Request body must be valid JSON.");
  }

  const fullName = typeof body.full_name === "string" ? body.full_name.trim() : "";
  const email = typeof body.email === "string" ? body.email.trim() : "";
  const password = typeof body.password === "string" ? body.password : "";
  const role = body.role as AllowedRole;
  const mdaId = typeof body.mda_id === "string" ? body.mda_id : null;
  const facilityIds = Array.isArray(body.facility_ids)
    ? body.facility_ids.filter((id): id is string => typeof id === "string")
    : [];

  if (!fullName) return badRequest("Full name is required.");
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return badRequest("A valid email is required.");
  }
  if (password.length < 8) {
    return badRequest("Temporary password must be at least 8 characters.");
  }
  if (!ALLOWED_ROLES.includes(role)) {
    return badRequest("Role must be admin, reviewer, mda_user, or facility_user.");
  }
  if (role === "facility_user") {
    if (!mdaId) return badRequest("Facility users require a reporting MDA.");
    if (facilityIds.length === 0) {
      return badRequest("Facility users require at least one facility.");
    }
  }

  // 1. Create the auth user with an admin-set temporary password.
  const { data: created, error: createError } =
    await serviceClient.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { full_name: fullName },
    });
  if (createError || !created?.user) {
    return NextResponse.json(
      { error: createError?.message ?? "Failed to create auth user." },
      { status: 400 },
    );
  }

  const newUserId = created.user.id;

  // From here on, clean up the auth user if a downstream write fails so we
  // never leave a half-provisioned account.
  const rollback = async () => {
    await serviceClient.auth.admin.deleteUser(newUserId).catch(() => undefined);
  };

  // 2. Profile row with the chosen role.
  const { error: profileError } = await serviceClient.from("profiles").insert({
    id: newUserId,
    full_name: fullName,
    role,
  });
  if (profileError) {
    await rollback();
    return NextResponse.json({ error: profileError.message }, { status: 400 });
  }

  // 3. Scope rows.
  if (role === "facility_user" && mdaId) {
    const rows = facilityIds.map((facilityId) => ({
      user_id: newUserId,
      facility_id: facilityId,
      mda_id: mdaId,
    }));
    const { error: assignError } = await serviceClient
      .from("user_facility_assignments")
      .insert(rows);
    if (assignError) {
      await rollback();
      return NextResponse.json({ error: assignError.message }, { status: 400 });
    }
  } else if ((role === "mda_user" || role === "reviewer") && mdaId) {
    const { error: membershipError } = await serviceClient
      .from("user_mda_memberships")
      .insert({
        user_id: newUserId,
        mda_id: mdaId,
        membership_role: role === "reviewer" ? "reviewer" : "submitter",
      });
    if (membershipError) {
      await rollback();
      return NextResponse.json(
        { error: membershipError.message },
        { status: 400 },
      );
    }
  }

  // 4. Audit event (service role bypasses the immutable-audit RLS).
  await serviceClient
    .from("entry_audit_events")
    .insert({
      entity_type: "profile",
      entity_id: newUserId,
      entity_key: email,
      event_type: "user_created",
      new_values: { role, full_name: fullName, facility_ids: facilityIds, mda_id: mdaId },
      actor_id: actorId,
    })
    .then(
      () => undefined,
      () => undefined,
    );

  return NextResponse.json({
    status: "created",
    user_id: newUserId,
    email,
    role,
  });
}
