import { NextResponse } from "next/server";
import { TEMPORARY_PASSWORD_MIN_LENGTH } from "@/lib/admin/passwords";
import { requireAdminActor } from "@/lib/server/admin-users";

type ResetPasswordBody = {
  password?: unknown;
};

function badRequest(message: string) {
  return NextResponse.json({ error: message }, { status: 400 });
}

export async function POST(
  request: Request,
  context: { params: Promise<{ userId: string }> },
) {
  const auth = await requireAdminActor(request);
  if ("error" in auth) return auth.error;
  const { serviceClient, actorId } = auth;
  const { userId } = await context.params;

  let body: ResetPasswordBody;
  try {
    body = (await request.json()) as ResetPasswordBody;
  } catch {
    return badRequest("Request body must be valid JSON.");
  }

  const password = typeof body.password === "string" ? body.password : "";
  if (password.length < TEMPORARY_PASSWORD_MIN_LENGTH) {
    return badRequest(
      `Temporary password must be at least ${TEMPORARY_PASSWORD_MIN_LENGTH} characters.`,
    );
  }

  const { data: existing, error: existingError } = await serviceClient
    .from("profiles")
    .select("id")
    .eq("id", userId)
    .maybeSingle();

  if (existingError) {
    return NextResponse.json({ error: existingError.message }, { status: 500 });
  }
  if (!existing) {
    return NextResponse.json({ error: "User not found." }, { status: 404 });
  }

  const { data: authUser, error: authUserError } =
    await serviceClient.auth.admin.getUserById(userId);
  if (authUserError || !authUser.user) {
    return NextResponse.json(
      { error: authUserError?.message ?? "Auth user not found." },
      { status: 404 },
    );
  }

  const { error: updateError } = await serviceClient.auth.admin.updateUserById(
    userId,
    {
      password,
      email_confirm: true,
    },
  );
  if (updateError) {
    return NextResponse.json({ error: updateError.message }, { status: 400 });
  }

  const email = authUser.user.email ?? "unknown@user.local";

  await serviceClient
    .from("entry_audit_events")
    .insert({
      entity_type: "profile",
      entity_id: userId,
      entity_key: email,
      event_type: "user_password_reset",
      new_values: { reset_by_admin: true },
      actor_id: actorId,
    })
    .then(
      () => undefined,
      () => undefined,
    );

  return NextResponse.json({
    status: "reset",
    email,
  });
}
